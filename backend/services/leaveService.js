/**
 * Leave Service
 * Business logic for leave management
 */

const db = require('../config/database');

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
    let query = `
      SELECT 
        lb.*,
        (lb.opening_balance + lb.earned) as total_allocated,
        (lb.opening_balance + lb.earned - lb.taken) as remaining,
        lt.leave_code,
        lt.leave_name,
        lt.is_paid
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.leave_type_id
      WHERE lb.employee_id = $1 AND lb.year = $2
      ORDER BY lt.leave_code
    `;
    let result = await db.query(query, [employeeId, year]);

    // Lazy Initialization for fetching balance
    if (result.rows.length === 0) {
      console.log(`[getLeaveBalance] No balance found for Emp ${employeeId}, initializing...`);
      await this.initializeLeaveBalance(employeeId, year);
      result = await db.query(query, [employeeId, year]);
    }

    return result.rows;
  }

  /**
   * Initialize leave balance for an employee
   */
  async initializeLeaveBalance(employeeId, year = new Date().getFullYear()) {
    const leaveTypes = await this.getLeaveTypes();

    const results = [];
    for (const leaveType of leaveTypes) {
      // Check if balance already exists
      const checkQuery = `
        SELECT balance_id FROM leave_balances 
        WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3
      `;
      const existing = await db.query(checkQuery, [employeeId, leaveType.leave_type_id, year]);

      if (existing.rows.length === 0) {
        const maxDays = parseFloat(leaveType.max_days_per_year) || 0;
        console.log(`[DEBUG] Initializing ${leaveType.leave_code} for Emp ${employeeId}: MaxDays=${maxDays}`);

        const insertQuery = `
          INSERT INTO leave_balances (
            employee_id, leave_type_id, year, 
            opening_balance, earned, taken
          ) VALUES ($1, $2, $3, 0, $4, 0)
          RETURNING *
        `;
        const result = await db.query(insertQuery, [
          employeeId,
          leaveType.leave_type_id,
          year,
          maxDays
        ]);
        results.push(result.rows[0]);
      }
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

    // Check leave balance
    const year = new Date(from_date).getFullYear();
    const balanceQuery = `
      SELECT (opening_balance + earned - taken) as available_balance 
      FROM leave_balances 
      WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3
    `;
    let balanceResult = await db.query(balanceQuery, [employee_id, leave_type_id, year]);

    // Lazy Initialization: If balance doesn't exist, create it dynamically
    if (balanceResult.rows.length === 0) {
      console.log(`Leave balance missing for employee ${employee_id}, initializing now...`);
      await this.initializeLeaveBalance(employee_id, year);

      // Re-fetch balance after initialization
      balanceResult = await db.query(balanceQuery, [employee_id, leave_type_id, year]);

      if (balanceResult.rows.length === 0) {
        throw new Error('Failed to initialize leave balance. Please contact HR.');
      }
    }

    const currentBalance = parseFloat(balanceResult.rows[0].available_balance);
    if (currentBalance < total_days) {
      throw new Error(`Insufficient leave balance. Available: ${currentBalance} days, Requested: ${total_days} days`);
    }

    // Check for overlapping leave requests
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
    const overlapResult = await db.query(overlapQuery, [employee_id, from_date, to_date]);

    if (overlapResult.rows.length > 0) {
      throw new Error('Leave request overlaps with existing leave');
    }

    // Create leave request
    const insertQuery = `
      INSERT INTO leave_requests (
        employee_id, leave_type_id, from_date, to_date, 
        total_days, reason, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      employee_id,
      leave_type_id,
      from_date,
      to_date,
      total_days,
      reason
    ]);

    return result.rows[0];
  }

  /**
   * Approve leave request
   */
  async approveLeave(requestId, approvedBy, remarks = null) {
    // Get leave request details
    const getRequestQuery = `
      SELECT lr.*, lt.leave_name, lt.leave_code 
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.leave_type_id
      WHERE lr.request_id = $1
    `;
    const requestResult = await db.query(getRequestQuery, [requestId]);

    if (requestResult.rows.length === 0) {
      throw new Error('Leave request not found');
    }

    const request = requestResult.rows[0];

    if (request.status !== 'PENDING') {
      throw new Error(`Leave request is already ${request.status}`);
    }

    // Update leave request status
    const updateRequestQuery = `
      UPDATE leave_requests 
      SET status = 'APPROVED', 
          approved_by = $1, 
          approved_on = CURRENT_TIMESTAMP,
          remarks = $2
      WHERE request_id = $3
      RETURNING *
    `;
    const updateResult = await db.query(updateRequestQuery, [approvedBy, remarks, requestId]);

    // Deduct from leave balance
    const year = new Date(request.from_date).getFullYear();
    const updateBalanceQuery = `
      UPDATE leave_balances 
      SET taken = taken + $1
      WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4
      RETURNING *
    `;
    await db.query(updateBalanceQuery, [
      request.total_days,
      request.employee_id,
      request.leave_type_id,
      year
    ]);

    // ✅ NEW: Mark attendance for each day of the leave period
    const fromDate = new Date(request.from_date);
    const toDate = new Date(request.to_date);

    console.log(`Marking attendance for leave from ${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`);

    // Loop through each day and mark attendance as 'L' (Leave)
    for (let date = new Date(fromDate); date <= toDate; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];

      // Insert or update attendance_daily with status 'L'
      const attendanceQuery = `
                INSERT INTO attendance_daily (employee_id, date, status, source, remarks)
                VALUES ($1, $2, 'L', 'LEAVE_APPROVAL', $3)
                ON CONFLICT (employee_id, date) 
                DO UPDATE SET 
                    status = 'L', 
                    source = 'LEAVE_APPROVAL', 
                    remarks = EXCLUDED.remarks,
                    updated_at = CURRENT_TIMESTAMP
            `;

      const attendanceRemarks = `${request.leave_name} - Request #${requestId}`;

      await db.query(attendanceQuery, [
        request.employee_id,
        dateStr,
        attendanceRemarks
      ]);
    }

    console.log(`Successfully marked ${request.total_days} days as Leave in attendance`);

    return updateResult.rows[0];
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
          rejection_reason = $2
      WHERE request_id = $3 AND status = 'PENDING'
      RETURNING *
    `;

    const result = await db.query(query, [approvedBy, rejectionReason, requestId]);

    if (result.rows.length === 0) {
      throw new Error('Leave request not found or already processed');
    }

    return result.rows[0];
  }

  /**
   * Cancel leave request (by employee)
   */
  async cancelLeave(requestId, employeeId) {
    // Get leave request
    const getQuery = `
      SELECT * FROM leave_requests 
      WHERE request_id = $1 AND employee_id = $2
    `;
    const requestResult = await db.query(getQuery, [requestId, employeeId]);

    if (requestResult.rows.length === 0) {
      throw new Error('Leave request not found');
    }

    const request = requestResult.rows[0];

    if (request.status === 'CANCELLED') {
      throw new Error('Leave request is already cancelled');
    }

    // If approved, restore balance
    if (request.status === 'APPROVED') {
      const year = new Date(request.from_date).getFullYear();
      const restoreBalanceQuery = `
        UPDATE leave_balances 
        SET taken = taken - $1
        WHERE employee_id = $2 AND leave_type_id = $3 AND year = $4
      `;
      await db.query(restoreBalanceQuery, [
        request.total_days,
        request.employee_id,
        request.leave_type_id,
        year
      ]);

      // ✅ NEW: Remove leave attendance marks
      console.log(`Removing leave attendance marks from ${request.from_date} to ${request.to_date}`);

      const deleteAttendanceQuery = `
                DELETE FROM attendance_daily
                WHERE employee_id = $1 
                AND date BETWEEN $2 AND $3
                AND status = 'L'
                AND source = 'LEAVE_APPROVED'
            `;

      const deleteResult = await db.query(deleteAttendanceQuery, [
        request.employee_id,
        request.from_date,
        request.to_date
      ]);

      console.log(`Removed ${deleteResult.rowCount} attendance records for cancelled leave`);
    }

    // Update status to cancelled
    const updateQuery = `
      UPDATE leave_requests 
      SET status = 'CANCELLED'
      WHERE request_id = $1
      RETURNING *
    `;
    const result = await db.query(updateQuery, [requestId]);

    return result.rows[0];
  }

  /**
   * Get leave requests for an employee
   */
  async getLeaveRequests(employeeId, filters = {}) {
    let query = `
      SELECT 
        lr.*,
        lt.leave_code,
        lt.leave_name,
        e.full_name as approved_by_name
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

    query += ' ORDER BY lr.applied_on DESC';

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
        e.employee_code,
        e.first_name,
        e.last_name,
        e.full_name as employee_name,
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
        lt.leave_code,
        lt.leave_name,
        e.full_name as approved_by_name
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
        e.employee_code,
        e.first_name,
        e.last_name,
        e.full_name as employee_name,
        e.designation,
        e.department,
        lt.leave_code,
        lt.leave_name,
        approver.full_name as approved_by_name
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.employee_id
      JOIN leave_types lt ON lr.leave_type_id = lt.leave_type_id
      LEFT JOIN employees approver ON lr.approved_by = approver.employee_id
    `;

    const params = [];
    let paramCount = 1;

    // WHERE clause builder
    let whereClauses = [];

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
