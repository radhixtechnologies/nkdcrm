/**
 * Leave Service
 * Business logic for leave management
 */

const db = require('../config/database');

const parseIsoDateUtc = (val) => {
  if (!val) return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = val.getMonth() + 1;
    const d = val.getDate();
    return { y, m, d, str: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
  }
  const str = String(val).trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!match) return null;
  return {
    y: parseInt(match[1], 10),
    m: parseInt(match[2], 10),
    d: parseInt(match[3], 10),
    str
  };
};

class LeaveService {
  /**
   * Get all leave types
   */
  async getLeaveTypes() {
    const query = 'SELECT * FROM leave_types WHERE is_active = true ORDER BY leave_code';
    const result = await db.query(query);
    return result.rows;
  }

  /**
   * Get leave balance for an employee
   */
  async getLeaveBalance(employeeId, year = new Date().getFullYear()) {
    const targetYear = parseInt(year, 10) || new Date().getFullYear();
    const query = `
      SELECT
        lb.*,
        (lb.opening_balance + lb.earned) AS total_allocated,
        (lb.opening_balance + lb.earned - lb.taken) AS remaining,
        lt.leave_code,
        lt.leave_name,
        lt.is_paid
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.leave_type_id
      WHERE lb.employee_id = $1 AND lb.year = $2
      ORDER BY lt.leave_code
    `;
    let result = await db.query(query, [employeeId, targetYear]);

    if (result.rows.length === 0) {
      await this.initializeLeaveBalance(employeeId, targetYear);
      result = await db.query(query, [employeeId, targetYear]);
    }

    return result.rows;
  }

  /**
   * Initialize leave balance for an employee
   */
  async initializeLeaveBalance(employeeId, year = new Date().getFullYear()) {
    const targetYear = parseInt(year, 10) || new Date().getFullYear();
    const leaveTypes = await this.getLeaveTypes();

    const results = [];
    for (const leaveType of leaveTypes) {
      const maxDays = parseFloat(leaveType.max_days_per_year) || 0;
      const insertQuery = `
        INSERT INTO leave_balances (
          employee_id, leave_type_id, year,
          opening_balance, earned, taken
        ) VALUES ($1, $2, $3, 0, $4, 0)
        ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING
        RETURNING *
      `;
      const result = await db.query(insertQuery, [
        employeeId,
        leaveType.leave_type_id,
        targetYear,
        maxDays
      ]);
      if (result.rows[0]) results.push(result.rows[0]);
    }

    return results;
  }

  /**
   * Apply for leave
   */
  async applyLeave(leaveData) {
    const {
      employee_id,
      leave_type_id,
      from_date,
      to_date,
      total_days,
      reason
    } = leaveData;

    const fromParsed = parseIsoDateUtc(from_date);
    const toParsed = parseIsoDateUtc(to_date);
    if (!fromParsed || !toParsed) {
      const err = new Error('Valid from_date and to_date (YYYY-MM-DD) are required');
      err.status = 400;
      throw err;
    }

    const fromMs = Date.UTC(fromParsed.y, fromParsed.m - 1, fromParsed.d);
    const toMs = Date.UTC(toParsed.y, toParsed.m - 1, toParsed.d);
    if (toMs < fromMs) {
      const err = new Error('To Date cannot be earlier than From Date');
      err.status = 400;
      throw err;
    }

    const computedDays = Math.floor((toMs - fromMs) / 86400000) + 1;
    const requestedDays = (total_days !== undefined && total_days !== null && Number(total_days) > 0)
      ? parseFloat(total_days)
      : computedDays;

    const year = fromParsed.y;
    const balanceQuery = `
      SELECT (opening_balance + earned - taken) AS available_balance
      FROM leave_balances
      WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3
    `;
    let balanceResult = await db.query(balanceQuery, [employee_id, leave_type_id, year]);

    if (balanceResult.rows.length === 0) {
      await this.initializeLeaveBalance(employee_id, year);
      balanceResult = await db.query(balanceQuery, [employee_id, leave_type_id, year]);
      if (balanceResult.rows.length === 0) {
        throw new Error('Failed to initialize leave balance. Please contact HR.');
      }
    }

    const currentBalance = parseFloat(balanceResult.rows[0].available_balance);
    if (currentBalance < requestedDays) {
      const err = new Error(`Insufficient leave balance. Available: ${currentBalance} days, Requested: ${requestedDays} days`);
      err.status = 400;
      throw err;
    }

    const overlapQuery = `
      SELECT request_id FROM leave_requests
      WHERE employee_id = $1
        AND status IN ('PENDING', 'APPROVED')
        AND (
          (from_date <= $2 AND to_date >= $2) OR
          (from_date <= $3 AND to_date >= $3) OR
          (from_date >= $2 AND to_date <= $3)
        )
    `;
    const overlapResult = await db.query(overlapQuery, [employee_id, fromParsed.str, toParsed.str]);

    if (overlapResult.rows.length > 0) {
      const err = new Error('Leave request overlaps with existing leave');
      err.status = 409;
      throw err;
    }

    const insertQuery = `
      INSERT INTO leave_requests (
        employee_id, leave_type_id, from_date, to_date,
        total_days, reason, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
      RETURNING *,
        TO_CHAR(from_date, 'YYYY-MM-DD') AS from_date,
        TO_CHAR(to_date, 'YYYY-MM-DD') AS to_date,
        created_at AS applied_on
    `;

    const result = await db.query(insertQuery, [
      employee_id,
      leave_type_id,
      fromParsed.str,
      toParsed.str,
      requestedDays,
      reason || ''
    ]);

    return result.rows[0];
  }

  /**
   * Approve leave request (atomic transaction with balance validation & attendance sync)
   */
  async approveLeave(requestId, approvedBy, remarks = null) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const requestResult = await client.query(`
        SELECT lr.*,
               TO_CHAR(lr.from_date, 'YYYY-MM-DD') AS from_date_str,
               TO_CHAR(lr.to_date, 'YYYY-MM-DD') AS to_date_str,
               lt.leave_name, lt.leave_code
        FROM leave_requests lr
        JOIN leave_types lt ON lr.leave_type_id = lt.leave_type_id
        WHERE lr.request_id = $1
        FOR UPDATE OF lr
      `, [requestId]);

      if (requestResult.rows.length === 0) {
        const err = new Error('Leave request not found');
        err.status = 404;
        throw err;
      }

      const request = requestResult.rows[0];
      if (request.status !== 'PENDING') {
        const err = new Error(`Leave request is already ${request.status}`);
        err.status = 400;
        throw err;
      }

      const fromParsed = parseIsoDateUtc(request.from_date_str);
      const toParsed = parseIsoDateUtc(request.to_date_str);
      const year = fromParsed.y;

      let balRes = await client.query(`
        SELECT balance_id, (opening_balance + earned - taken) AS available_balance
        FROM leave_balances
        WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3
        FOR UPDATE
      `, [request.employee_id, request.leave_type_id, year]);

      if (balRes.rows.length === 0) {
        await this.initializeLeaveBalance(request.employee_id, year);
        balRes = await client.query(`
          SELECT balance_id, (opening_balance + earned - taken) AS available_balance
          FROM leave_balances
          WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3
          FOR UPDATE
        `, [request.employee_id, request.leave_type_id, year]);
      }

      if (balRes.rows.length > 0) {
        const avail = parseFloat(balRes.rows[0].available_balance);
        if (avail < parseFloat(request.total_days)) {
          const err = new Error(`Insufficient leave balance to approve. Available: ${avail} days, Requested: ${request.total_days} days`);
          err.status = 400;
          throw err;
        }
      }

      const updateResult = await client.query(`
        UPDATE leave_requests
        SET status = 'APPROVED',
            approved_by = $1,
            approved_on = CURRENT_TIMESTAMP,
            remarks = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE request_id = $3
        RETURNING *,
          TO_CHAR(from_date, 'YYYY-MM-DD') AS from_date,
          TO_CHAR(to_date, 'YYYY-MM-DD') AS to_date,
          created_at AS applied_on
      `, [approvedBy || null, remarks, requestId]);

      await client.query(`
        UPDATE leave_balances
        SET taken = taken + $1, updated_at = CURRENT_TIMESTAMP
        WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4
      `, [request.total_days, request.employee_id, request.leave_type_id, year]);

      const startMs = Date.UTC(fromParsed.y, fromParsed.m - 1, fromParsed.d);
      const endMs = Date.UTC(toParsed.y, toParsed.m - 1, toParsed.d);
      const attendanceRemarks = `${request.leave_name} - Request #${requestId}`;

      for (let ms = startMs; ms <= endMs; ms += 86400000) {
        const dateStr = new Date(ms).toISOString().slice(0, 10);
        await client.query(`
          INSERT INTO attendance_daily (employee_id, date, status, source, remarks)
          VALUES ($1, $2, 'L', 'LEAVE_APPROVAL', $3)
          ON CONFLICT (employee_id, date)
          DO UPDATE SET
            status = 'L',
            source = 'LEAVE_APPROVAL',
            remarks = EXCLUDED.remarks,
            updated_at = CURRENT_TIMESTAMP
        `, [request.employee_id, dateStr, attendanceRemarks]);
      }

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject leave request
   */
  async rejectLeave(requestId, approvedBy, rejectionReason) {
    const query = `
      UPDATE leave_requests
      SET status = 'REJECTED',
          approved_by = $1,
          approved_on = CURRENT_TIMESTAMP,
          rejection_reason = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE request_id = $3 AND status = 'PENDING'
      RETURNING *,
        TO_CHAR(from_date, 'YYYY-MM-DD') AS from_date,
        TO_CHAR(to_date, 'YYYY-MM-DD') AS to_date,
        created_at AS applied_on
    `;

    const result = await db.query(query, [approvedBy || null, rejectionReason || null, requestId]);

    if (result.rows.length === 0) {
      const err = new Error('Leave request not found or already processed');
      err.status = 400;
      throw err;
    }

    return result.rows[0];
  }

  /**
   * Cancel leave request
   */
  async cancelLeave(requestId, employeeId = null) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const getQuery = employeeId
        ? `SELECT *, TO_CHAR(from_date, 'YYYY-MM-DD') AS from_date_str, TO_CHAR(to_date, 'YYYY-MM-DD') AS to_date_str
           FROM leave_requests WHERE request_id = $1 AND employee_id = $2 FOR UPDATE`
        : `SELECT *, TO_CHAR(from_date, 'YYYY-MM-DD') AS from_date_str, TO_CHAR(to_date, 'YYYY-MM-DD') AS to_date_str
           FROM leave_requests WHERE request_id = $1 FOR UPDATE`;

      const requestResult = await client.query(getQuery, employeeId ? [requestId, employeeId] : [requestId]);
      if (requestResult.rows.length === 0) {
        const err = new Error('Leave request not found');
        err.status = 404;
        throw err;
      }

      const request = requestResult.rows[0];
      if (request.status === 'CANCELLED' || request.status === 'REJECTED') {
        const err = new Error(`Leave request cannot be cancelled (status: ${request.status})`);
        err.status = 400;
        throw err;
      }

      if (request.status === 'APPROVED') {
        const year = parseInt(String(request.from_date_str).slice(0, 4), 10);
        await client.query(`
          UPDATE leave_balances
          SET taken = GREATEST(0, taken - $1), updated_at = CURRENT_TIMESTAMP
          WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4
        `, [request.total_days, request.employee_id, request.leave_type_id, year]);

        await client.query(`
          DELETE FROM attendance_daily
          WHERE employee_id = $1
            AND date BETWEEN $2 AND $3
            AND status = 'L'
            AND source IN ('LEAVE_APPROVAL', 'LEAVE_APPROVED')
        `, [request.employee_id, request.from_date_str, request.to_date_str]);
      }

      const result = await client.query(`
        UPDATE leave_requests
        SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
        WHERE request_id = $1
        RETURNING *,
          TO_CHAR(from_date, 'YYYY-MM-DD') AS from_date,
          TO_CHAR(to_date, 'YYYY-MM-DD') AS to_date,
          created_at AS applied_on
      `, [requestId]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get leave requests for an employee
   */
  async getLeaveRequests(employeeId, filters = {}) {
    let query = `
      SELECT
        lr.*,
        TO_CHAR(lr.from_date, 'YYYY-MM-DD') AS from_date,
        TO_CHAR(lr.to_date, 'YYYY-MM-DD') AS to_date,
        lr.created_at AS applied_on,
        lt.leave_code,
        lt.leave_name,
        e.full_name AS approved_by_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.leave_type_id
      LEFT JOIN employees e ON lr.approved_by = e.employee_id
      WHERE lr.employee_id = $1
    `;

    const values = [employeeId];
    let paramCount = 2;

    if (filters.status) {
      query += ` AND lr.status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.year) {
      query += ` AND EXTRACT(YEAR FROM lr.from_date) = $${paramCount}`;
      values.push(filters.year);
      paramCount++;
    }

    query += ' ORDER BY lr.created_at DESC';

    const result = await db.query(query, values);
    return result.rows;
  }

  /**
   * Get all pending leave requests (for approvers)
   */
  async getPendingLeaveRequests() {
    const query = `
      SELECT
        lr.*,
        TO_CHAR(lr.from_date, 'YYYY-MM-DD') AS from_date,
        TO_CHAR(lr.to_date, 'YYYY-MM-DD') AS to_date,
        lr.created_at AS applied_on,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.full_name AS employee_name,
        e.designation,
        e.department,
        lt.leave_code,
        lt.leave_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.employee_id
      JOIN leave_types lt ON lr.leave_type_id = lt.leave_type_id
      WHERE lr.status = 'PENDING'
      ORDER BY lr.created_at ASC
    `;

    const result = await db.query(query);
    return result.rows;
  }

  /**
   * Get leave history for an employee
   */
  async getLeaveHistory(employeeId, year = new Date().getFullYear()) {
    const query = `
      SELECT
        lr.*,
        TO_CHAR(lr.from_date, 'YYYY-MM-DD') AS from_date,
        TO_CHAR(lr.to_date, 'YYYY-MM-DD') AS to_date,
        lr.created_at AS applied_on,
        lt.leave_code,
        lt.leave_name,
        e.full_name AS approved_by_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.leave_type_id
      LEFT JOIN employees e ON lr.approved_by = e.employee_id
      WHERE lr.employee_id = $1
        AND EXTRACT(YEAR FROM lr.from_date) = $2
      ORDER BY lr.from_date DESC
    `;

    const result = await db.query(query, [employeeId, year]);
    return result.rows;
  }

  /**
   * Get all leave requests (for HR/Admin) with filters
   */
  async getAllLeaves(filters = {}) {
    let query = `
      SELECT
        lr.*,
        TO_CHAR(lr.from_date, 'YYYY-MM-DD') AS from_date,
        TO_CHAR(lr.to_date, 'YYYY-MM-DD') AS to_date,
        lr.created_at AS applied_on,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.full_name AS employee_name,
        e.designation,
        e.department,
        lt.leave_code,
        lt.leave_name,
        approver.full_name AS approved_by_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.employee_id
      JOIN leave_types lt ON lr.leave_type_id = lt.leave_type_id
      LEFT JOIN employees approver ON lr.approved_by = approver.employee_id
    `;

    const params = [];
    let paramCount = 1;
    const whereClauses = [];

    if (filters.status && filters.status !== 'ALL') {
      whereClauses.push(`lr.status = $${paramCount}`);
      params.push(filters.status);
      paramCount++;
    }

    if (filters.search) {
      whereClauses.push(`(
        e.first_name ILIKE $${paramCount} OR
        e.last_name ILIKE $${paramCount} OR
        e.employee_code ILIKE $${paramCount}
      )`);
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` ORDER BY lr.created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  getPendingRequests() {
    return this.getPendingLeaveRequests();
  }

  getAllRequests(filters = {}) {
    return this.getAllLeaves(filters);
  }
}

module.exports = new LeaveService();
