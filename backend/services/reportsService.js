/**
 * Reports Service
 * Generate compliance and summary reports
 */

const db = require('../config/database');

class ReportsService {
    /**
     * Get PF report for a period
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {Object} PF report data
     */
    async getPFReport(month, year) {
        const query = `
      SELECT 
        e.employee_code,
        e.full_name,
        e.uan_number,
        p.basic_earned,
        p.pf_employee,
        p.pf_employer,
        (p.pf_employee + p.pf_employer) as total_pf
      FROM payroll p
      JOIN employees e ON p.employee_id = e.employee_id
      WHERE p.month = $1 AND p.year = $2 AND e.pf_applicable = true
      ORDER BY e.employee_code ASC
    `;

        const result = await db.query(query, [month, year]);

        // Calculate totals
        const totals = {
            total_basic: 0,
            total_pf_employee: 0,
            total_pf_employer: 0,
            total_pf: 0,
        };

        result.rows.forEach(row => {
            totals.total_basic += parseFloat(row.basic_earned);
            totals.total_pf_employee += parseFloat(row.pf_employee);
            totals.total_pf_employer += parseFloat(row.pf_employer);
            totals.total_pf += parseFloat(row.total_pf);
        });

        return {
            period: { month, year },
            employees: result.rows,
            totals,
            count: result.rows.length,
        };
    }

    /**
     * Get ESI report for a period
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {Object} ESI report data
     */
    async getESIReport(month, year) {
        const query = `
      SELECT 
        e.employee_code,
        e.full_name,
        e.esi_number,
        p.gross_earnings,
        p.esi_employee,
        p.esi_employer,
        (p.esi_employee + p.esi_employer) as total_esi
      FROM payroll p
      JOIN employees e ON p.employee_id = e.employee_id
      WHERE p.month = $1 AND p.year = $2 AND e.esi_applicable = true
      ORDER BY e.employee_code ASC
    `;

        const result = await db.query(query, [month, year]);

        // Calculate totals
        const totals = {
            total_gross: 0,
            total_esi_employee: 0,
            total_esi_employer: 0,
            total_esi: 0,
        };

        result.rows.forEach(row => {
            totals.total_gross += parseFloat(row.gross_earnings);
            totals.total_esi_employee += parseFloat(row.esi_employee);
            totals.total_esi_employer += parseFloat(row.esi_employer);
            totals.total_esi += parseFloat(row.total_esi);
        });

        return {
            period: { month, year },
            employees: result.rows,
            totals,
            count: result.rows.length,
        };
    }

    /**
     * Get PT report for a period
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {Object} PT report data
     */
    async getPTReport(month, year) {
        const query = `
      SELECT 
        e.employee_code,
        e.full_name,
        p.gross_earnings,
        p.professional_tax
      FROM payroll p
      JOIN employees e ON p.employee_id = e.employee_id
      WHERE p.month = $1 AND p.year = $2 AND e.pt_applicable = true
      ORDER BY e.employee_code ASC
    `;

        const result = await db.query(query, [month, year]);

        // Calculate totals
        const totals = {
            total_gross: 0,
            total_pt: 0,
        };

        result.rows.forEach(row => {
            totals.total_gross += parseFloat(row.gross_earnings);
            totals.total_pt += parseFloat(row.professional_tax);
        });

        return {
            period: { month, year },
            employees: result.rows,
            totals,
            count: result.rows.length,
        };
    }

    /**
     * Get bank transfer report for a period
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {Object} Bank transfer data
     */
    async getBankTransferReport(month, year) {
        const query = `
      SELECT 
        e.employee_code,
        e.full_name,
        e.bank_name,
        e.account_number,
        e.ifsc_code,
        p.net_salary,
        p.payment_status
      FROM payroll p
      JOIN employees e ON p.employee_id = e.employee_id
      WHERE p.month = $1 AND p.year = $2
      ORDER BY e.bank_name ASC, e.employee_code ASC
    `;

        const result = await db.query(query, [month, year]);

        // Calculate totals
        const totals = {
            total_amount: 0,
            pending_count: 0,
            paid_count: 0,
        };

        result.rows.forEach(row => {
            totals.total_amount += parseFloat(row.net_salary);
            if (row.payment_status === 'PAID') {
                totals.paid_count++;
            } else {
                totals.pending_count++;
            }
        });

        // Group by bank
        const byBank = {};
        result.rows.forEach(row => {
            const bank = row.bank_name || 'Unknown';
            if (!byBank[bank]) {
                byBank[bank] = {
                    bank_name: bank,
                    employees: [],
                    total: 0,
                };
            }
            byBank[bank].employees.push(row);
            byBank[bank].total += parseFloat(row.net_salary);
        });

        return {
            period: { month, year },
            employees: result.rows,
            byBank: Object.values(byBank),
            totals,
            count: result.rows.length,
        };
    }

    /**
     * Get attendance summary report
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {Object} Attendance summary
     */
    async getAttendanceSummary(month, year) {
        const query = `
      SELECT 
        e.employee_code,
        e.full_name,
        e.designation,
        e.department,
        a.total_days,
        a.present_days,
        a.absent_days,
        a.weekly_off_days,
        a.leave_days,
        a.half_days,
        a.overtime_hours,
        ROUND((a.present_days::numeric / a.total_days::numeric) * 100, 2) as attendance_percentage
      FROM attendance a
      JOIN employees e ON a.employee_id = e.employee_id
      WHERE a.month = $1 AND a.year = $2
      ORDER BY e.employee_code ASC
    `;

        const result = await db.query(query, [month, year]);

        // Calculate totals and averages
        const totals = {
            total_employees: result.rows.length,
            total_present: 0,
            total_absent: 0,
            total_weekly_off: 0,
            total_leave: 0,
            total_half_day: 0,
            total_overtime: 0,
            avg_attendance: 0,
        };

        result.rows.forEach(row => {
            totals.total_present += parseFloat(row.present_days);
            totals.total_absent += parseFloat(row.absent_days);
            totals.total_weekly_off += parseFloat(row.weekly_off_days);
            totals.total_leave += parseFloat(row.leave_days);
            totals.total_half_day += parseFloat(row.half_days);
            totals.total_overtime += parseFloat(row.overtime_hours);
            totals.avg_attendance += parseFloat(row.attendance_percentage);
        });

        if (result.rows.length > 0) {
            totals.avg_attendance = Math.round((totals.avg_attendance / result.rows.length) * 100) / 100;
        }

        return {
            period: { month, year },
            employees: result.rows,
            totals,
        };
    }

    /**
     * Get payroll summary by department
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {Object} Department-wise payroll summary
     */
    async getPayrollByDepartment(month, year) {
        const query = `
      SELECT 
        e.department,
        COUNT(*) as employee_count,
        SUM(p.gross_earnings) as total_gross,
        SUM(p.total_deductions) as total_deductions,
        SUM(p.net_salary) as total_net_salary,
        AVG(p.net_salary) as avg_net_salary
      FROM payroll p
      JOIN employees e ON p.employee_id = e.employee_id
      WHERE p.month = $1 AND p.year = $2
      GROUP BY e.department
      ORDER BY total_net_salary DESC
    `;

        const result = await db.query(query, [month, year]);

        // Calculate grand totals
        const grandTotals = {
            total_employees: 0,
            total_gross: 0,
            total_deductions: 0,
            total_net_salary: 0,
        };

        result.rows.forEach(row => {
            grandTotals.total_employees += parseInt(row.employee_count);
            grandTotals.total_gross += parseFloat(row.total_gross);
            grandTotals.total_deductions += parseFloat(row.total_deductions);
            grandTotals.total_net_salary += parseFloat(row.total_net_salary);
        });

        return {
            period: { month, year },
            departments: result.rows,
            grandTotals,
        };
    }

    /**
     * Get Overtime report
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {Object} Overtime data
     */
    async getOvertimeReport(month, year) {
        const query = `
          SELECT 
            e.employee_code,
            e.full_name,
            e.department,
            a.total_days,
            a.present_days,
            a.overtime_hours,
            COALESCE(p.overtime_amount, 0) as overtime_amount
          FROM attendance a
          JOIN employees e ON a.employee_id = e.employee_id
          LEFT JOIN payroll p ON p.employee_id = e.employee_id AND p.month = a.month AND p.year = a.year
          WHERE a.month = $1 AND a.year = $2 AND a.overtime_hours > 0
          ORDER BY a.overtime_hours DESC
        `;
        const result = await db.query(query, [month, year]);
        const totals = {
            total_employees: result.rows.length,
            total_overtime_hours: 0,
            total_overtime_amount: 0,
        };
        result.rows.forEach(r => {
            totals.total_overtime_hours += parseFloat(r.overtime_hours || 0);
            totals.total_overtime_amount += parseFloat(r.overtime_amount || 0);
        });
        return {
            period: { month, year },
            employees: result.rows,
            totals,
        };
    }

    // Aliases to match route naming conventions
    getBankTransferStatement(month, year) {
        return this.getBankTransferReport(month, year);
    }

    getAttendanceSummaryReport(month, year) {
        return this.getAttendanceSummary(month, year);
    }

    getDepartmentCostReport(month, year) {
        return this.getPayrollByDepartment(month, year);
    }
}

module.exports = new ReportsService();
