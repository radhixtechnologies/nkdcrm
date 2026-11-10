/**
 * Reports Service
 * Generate compliance and summary reports
 */

const db = require('../config/database');

class ReportsService {
    async getPFReport(month, year) {
        const query = `
            SELECT
                e.employee_code,
                e.full_name,
                e.uan_number,
                p.basic_earned,
                p.pf_employee,
                p.pf_employer,
                (p.pf_employee + p.pf_employer) AS total_pf
            FROM payroll p
            JOIN employees e ON p.employee_id = e.employee_id
            WHERE p.month = $1 AND p.year = $2 AND e.pf_applicable = true
            ORDER BY e.employee_code ASC
        `;

        const result = await db.query(query, [month, year]);

        const totals = {
            total_basic: 0,
            total_pf_employee: 0,
            total_pf_employer: 0,
            total_pf: 0
        };

        result.rows.forEach(row => {
            totals.total_basic += parseFloat(row.basic_earned || 0) || 0;
            totals.total_pf_employee += parseFloat(row.pf_employee || 0) || 0;
            totals.total_pf_employer += parseFloat(row.pf_employer || 0) || 0;
            totals.total_pf += parseFloat(row.total_pf || 0) || 0;
        });

        return {
            period: { month, year },
            employees: result.rows,
            totals,
            count: result.rows.length
        };
    }

    async getESIReport(month, year) {
        const query = `
            SELECT
                e.employee_code,
                e.full_name,
                e.esi_number,
                p.gross_earnings,
                p.esi_employee,
                p.esi_employer,
                (p.esi_employee + p.esi_employer) AS total_esi
            FROM payroll p
            JOIN employees e ON p.employee_id = e.employee_id
            WHERE p.month = $1 AND p.year = $2 AND e.esi_applicable = true
            ORDER BY e.employee_code ASC
        `;

        const result = await db.query(query, [month, year]);

        const totals = {
            total_gross: 0,
            total_esi_employee: 0,
            total_esi_employer: 0,
            total_esi: 0
        };

        result.rows.forEach(row => {
            totals.total_gross += parseFloat(row.gross_earnings || 0) || 0;
            totals.total_esi_employee += parseFloat(row.esi_employee || 0) || 0;
            totals.total_esi_employer += parseFloat(row.esi_employer || 0) || 0;
            totals.total_esi += parseFloat(row.total_esi || 0) || 0;
        });

        return {
            period: { month, year },
            employees: result.rows,
            totals,
            count: result.rows.length
        };
    }

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

        const totals = {
            total_gross: 0,
            total_pt: 0
        };

        result.rows.forEach(row => {
            totals.total_gross += parseFloat(row.gross_earnings || 0) || 0;
            totals.total_pt += parseFloat(row.professional_tax || 0) || 0;
        });

        return {
            period: { month, year },
            employees: result.rows,
            totals,
            count: result.rows.length
        };
    }

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

        const totals = {
            total_amount: 0,
            pending_count: 0,
            paid_count: 0
        };

        result.rows.forEach(row => {
            totals.total_amount += parseFloat(row.net_salary || 0) || 0;
            if (row.payment_status === 'PAID') {
                totals.paid_count++;
            } else {
                totals.pending_count++;
            }
        });

        const byBank = {};
        result.rows.forEach(row => {
            const bank = row.bank_name || 'Unknown';
            if (!byBank[bank]) {
                byBank[bank] = {
                    bank_name: bank,
                    employees: [],
                    total: 0
                };
            }
            byBank[bank].employees.push(row);
            byBank[bank].total += parseFloat(row.net_salary || 0) || 0;
        });

        return {
            period: { month, year },
            employees: result.rows,
            byBank: Object.values(byBank),
            totals,
            count: result.rows.length
        };
    }

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
                COALESCE(ROUND((a.present_days::numeric / NULLIF(a.total_days::numeric, 0)) * 100, 2), 0) AS attendance_percentage
            FROM attendance a
            JOIN employees e ON a.employee_id = e.employee_id
            WHERE a.month = $1 AND a.year = $2
            ORDER BY e.employee_code ASC
        `;

        const result = await db.query(query, [month, year]);

        const totals = {
            total_employees: result.rows.length,
            total_present: 0,
            total_absent: 0,
            total_weekly_off: 0,
            total_leave: 0,
            total_half_day: 0,
            total_overtime: 0,
            avg_attendance: 0
        };

        result.rows.forEach(row => {
            totals.total_present += parseFloat(row.present_days || 0) || 0;
            totals.total_absent += parseFloat(row.absent_days || 0) || 0;
            totals.total_weekly_off += parseFloat(row.weekly_off_days || 0) || 0;
            totals.total_leave += parseFloat(row.leave_days || 0) || 0;
            totals.total_half_day += parseFloat(row.half_days || 0) || 0;
            totals.total_overtime += parseFloat(row.overtime_hours || 0) || 0;
            totals.avg_attendance += parseFloat(row.attendance_percentage || 0) || 0;
        });

        if (result.rows.length > 0) {
            totals.avg_attendance = Math.round((totals.avg_attendance / result.rows.length) * 100) / 100;
        }

        return {
            period: { month, year },
            employees: result.rows,
            totals
        };
    }

    async getPayrollByDepartment(month, year) {
        const query = `
            SELECT
                COALESCE(NULLIF(e.department, ''), 'Unassigned') AS department,
                COUNT(*)::int AS employee_count,
                COALESCE(SUM(p.gross_earnings), 0) AS total_gross,
                COALESCE(SUM(p.total_deductions), 0) AS total_deductions,
                COALESCE(SUM(p.net_salary), 0) AS total_net_salary,
                COALESCE(AVG(p.net_salary), 0) AS avg_net_salary
            FROM payroll p
            JOIN employees e ON p.employee_id = e.employee_id
            WHERE p.month = $1 AND p.year = $2
            GROUP BY COALESCE(NULLIF(e.department, ''), 'Unassigned')
            ORDER BY total_net_salary DESC
        `;

        const result = await db.query(query, [month, year]);

        const grandTotals = {
            total_employees: 0,
            total_gross: 0,
            total_deductions: 0,
            total_net_salary: 0
        };

        result.rows.forEach(row => {
            grandTotals.total_employees += parseInt(row.employee_count || 0, 10) || 0;
            grandTotals.total_gross += parseFloat(row.total_gross || 0) || 0;
            grandTotals.total_deductions += parseFloat(row.total_deductions || 0) || 0;
            grandTotals.total_net_salary += parseFloat(row.total_net_salary || 0) || 0;
        });

        return {
            period: { month, year },
            departments: result.rows,
            grandTotals
        };
    }

    async getOvertimeReport(month, year) {
        const query = `
            SELECT
                e.employee_code,
                e.full_name,
                e.department,
                a.total_days,
                a.present_days,
                a.overtime_hours,
                COALESCE(p.overtime_amount, 0) AS overtime_amount
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
            total_overtime_amount: 0
        };
        result.rows.forEach(r => {
            totals.total_overtime_hours += parseFloat(r.overtime_hours || 0) || 0;
            totals.total_overtime_amount += parseFloat(r.overtime_amount || 0) || 0;
        });
        return {
            period: { month, year },
            employees: result.rows,
            totals
        };
    }

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
