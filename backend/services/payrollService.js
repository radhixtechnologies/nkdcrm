/**
 * Payroll Service
 * Business logic for payroll calculations
 * Handles PF, ESI, PT, TDS calculations and salary proration
 */

const db = require('../config/database');
const attendanceService = require('./attendanceService');

const normalizeRate = (rawValue, defaultPercent, thresholdPercent = 1) => {
    const val = parseFloat(rawValue);
    if (Number.isNaN(val) || val <= 0) return defaultPercent / 100;
    // Supports both decimal ratios (0.12 for 12%, 0.0075 for 0.75%) and whole percentages (12, 0.75, 3.25)
    return val >= thresholdPercent ? val / 100 : val;
};

class PayrollService {
    async getPayrollConfig() {
        const query = 'SELECT config_key, config_value FROM payroll_config';
        const result = await db.query(query);

        const config = {};
        result.rows.forEach(row => {
            config[row.config_key] = parseFloat(row.config_value);
        });

        return config;
    }

    calculateEarnings(employee, attendance, config) {
        const workingDaysPerMonth = config.WORKING_DAYS_PER_MONTH || 26;
        const presentDays = parseFloat(attendance.present_days) || 0;
        const weeklyOffDays = parseFloat(attendance.weekly_off_days) || 0;
        const leaveDays = parseFloat(attendance.leave_days) || 0;
        const halfDays = parseFloat(attendance.half_days) || 0;
        const paidDays = presentDays + weeklyOffDays + leaveDays + (halfDays * 0.5);
        const overtimeHours = parseFloat(attendance.overtime_hours) || 0;

        let basicEarned = 0;
        let hraEarned = 0;
        let conveyanceEarned = 0;
        let incentiveEarned = 0;
        let specialAllowanceEarned = 0;
        let otherAllowanceEarned = 0;
        let overtimeAmount = 0;

        if (employee.wage_type === 'PER_DAY') {
            const effectiveDays = paidDays > 0 ? paidDays : presentDays;
            basicEarned = parseFloat(employee.basic_salary || 0) * effectiveDays;
            hraEarned = parseFloat(employee.hra || 0) * effectiveDays;
            conveyanceEarned = parseFloat(employee.conveyance || 0) * effectiveDays;
            incentiveEarned = parseFloat(employee.incentive_allowance || 0) * effectiveDays;
            specialAllowanceEarned = parseFloat(employee.special_allowance || 0) * effectiveDays;
            otherAllowanceEarned = parseFloat(employee.other_allowance || 0) * effectiveDays;

            if (overtimeHours > 0) {
                const hourlyRate = parseFloat(employee.basic_salary || 0) / 8;
                const overtimeMultiplier = config.OVERTIME_MULTIPLIER || 2;
                overtimeAmount = hourlyRate * overtimeHours * overtimeMultiplier;
            }
        } else {
            const effectiveDays = Math.min(workingDaysPerMonth, paidDays > 0 ? paidDays : presentDays);
            const prorataFactor = effectiveDays / workingDaysPerMonth;

            basicEarned = parseFloat(employee.basic_salary || 0) * prorataFactor;
            hraEarned = parseFloat(employee.hra || 0) * prorataFactor;
            conveyanceEarned = parseFloat(employee.conveyance || 0) * prorataFactor;
            incentiveEarned = parseFloat(employee.incentive_allowance || 0) * prorataFactor;
            specialAllowanceEarned = parseFloat(employee.special_allowance || 0) * prorataFactor;
            otherAllowanceEarned = parseFloat(employee.other_allowance || 0) * prorataFactor;

            if (overtimeHours > 0) {
                const hourlyRate = parseFloat(employee.basic_salary || 0) / (workingDaysPerMonth * 8);
                const overtimeMultiplier = config.OVERTIME_MULTIPLIER || 2;
                overtimeAmount = hourlyRate * overtimeHours * overtimeMultiplier;
            }
        }

        const grossEarnings = basicEarned + hraEarned + conveyanceEarned +
            incentiveEarned + specialAllowanceEarned + otherAllowanceEarned + overtimeAmount;

        return {
            basic_earned: Math.round(basicEarned * 100) / 100,
            hra_earned: Math.round(hraEarned * 100) / 100,
            conveyance_earned: Math.round(conveyanceEarned * 100) / 100,
            incentive_earned: Math.round(incentiveEarned * 100) / 100,
            special_allowance_earned: Math.round(specialAllowanceEarned * 100) / 100,
            other_allowance_earned: Math.round(otherAllowanceEarned * 100) / 100,
            overtime_amount: Math.round(overtimeAmount * 100) / 100,
            gross_earnings: Math.round(grossEarnings * 100) / 100
        };
    }

    calculatePF(employee, basicEarned, config) {
        if (!employee.pf_applicable) {
            return { pf_employee: 0, pf_employer: 0 };
        }

        const pfCeiling = parseFloat(config.PF_WAGE_CEILING || config.PF_CEILING) || 15000;
        const pfEmployeeRatio = normalizeRate(config.PF_EMPLOYEE_RATE, 12, 1);
        const pfEmployerRatio = normalizeRate(config.PF_EMPLOYER_RATE, 12, 1);

        const pfBase = Math.min(basicEarned, pfCeiling);
        const pfEmployee = pfBase * pfEmployeeRatio;
        const pfEmployer = pfBase * pfEmployerRatio;

        return {
            pf_employee: Math.round(pfEmployee * 100) / 100,
            pf_employer: Math.round(pfEmployer * 100) / 100
        };
    }

    calculateESI(employee, grossEarnings, config) {
        if (!employee.esi_applicable) {
            return { esi_employee: 0, esi_employer: 0 };
        }

        const esiCeiling = parseFloat(config.ESI_WAGE_CEILING || config.ESI_CEILING) || 21000;
        const esiEmployeeRatio = normalizeRate(config.ESI_EMPLOYEE_RATE, 0.75, 0.1);
        const esiEmployerRatio = normalizeRate(config.ESI_EMPLOYER_RATE, 3.25, 0.1);

        if (grossEarnings > esiCeiling) {
            return { esi_employee: 0, esi_employer: 0 };
        }

        const esiEmployee = grossEarnings * esiEmployeeRatio;
        const esiEmployer = grossEarnings * esiEmployerRatio;

        return {
            esi_employee: Math.round(esiEmployee * 100) / 100,
            esi_employer: Math.round(esiEmployer * 100) / 100
        };
    }

    calculatePT(employee, grossEarnings, config) {
        if (!employee.pt_applicable) {
            return 0;
        }

        if (grossEarnings <= 10000) {
            return parseFloat(config.PT_SLAB_1) || 0;
        }
        return parseFloat(config.PT_RATE || config.PT_SLAB_2) || 200;
    }

    async calculatePayroll(employeeId, month, year, options = {}) {
        const employeeQuery = 'SELECT * FROM employees WHERE employee_id = $1';
        const employeeResult = await db.query(employeeQuery, [employeeId]);

        if (employeeResult.rows.length === 0) {
            throw new Error(`Employee with ID ${employeeId} not found`);
        }
        const employee = employeeResult.rows[0];

        const attendance = await attendanceService.getAttendanceByEmployee(employeeId, { month, year });

        if (attendance.length === 0) {
            throw new Error(`Attendance for employee ${employee.employee_code} for ${month}/${year} not found`);
        }
        const attendanceRecord = attendance[0];

        const config = await this.getPayrollConfig();
        const earnings = this.calculateEarnings(employee, attendanceRecord, config);
        const pf = this.calculatePF(employee, earnings.basic_earned, config);
        const esi = this.calculateESI(employee, earnings.gross_earnings, config);
        const pt = this.calculatePT(employee, earnings.gross_earnings, config);

        const advanceDeduction = parseFloat(options.advance_deduction || 0) || 0;
        const otherDeductions = parseFloat(options.other_deductions || 0) || 0;
        const tds = parseFloat(options.tds || 0) || 0;

        const totalDeductions = pf.pf_employee + esi.esi_employee + pt +
            advanceDeduction + otherDeductions + tds;

        const netSalary = Math.max(0, earnings.gross_earnings - totalDeductions);

        return {
            employee_id: employeeId,
            attendance_id: attendanceRecord.attendance_id,
            month,
            year,
            total_days: attendanceRecord.total_days || 30,
            present_days: attendanceRecord.present_days || 0,
            absent_days: attendanceRecord.absent_days || 0,
            weekly_off_days: attendanceRecord.weekly_off_days || 0,
            leave_days: attendanceRecord.leave_days || 0,
            half_days: attendanceRecord.half_days || 0,
            overtime_hours: attendanceRecord.overtime_hours || 0,
            ...earnings,
            pf_employee: pf.pf_employee,
            pf_employer: pf.pf_employer,
            esi_employee: esi.esi_employee,
            esi_employer: esi.esi_employer,
            professional_tax: pt,
            tds,
            advance_deduction: advanceDeduction,
            other_deductions: otherDeductions,
            total_deductions: Math.round(totalDeductions * 100) / 100,
            net_salary: Math.round(netSalary * 100) / 100,
            payment_status: 'PENDING',
            calculated_by: options.calculated_by || 'System',
            remarks: options.remarks || null
        };
    }

    async createPayroll(payrollData) {
        const query = `
            INSERT INTO payroll (
                employee_id, attendance_id, month, year,
                total_days, present_days, absent_days, weekly_off_days, leave_days, half_days, overtime_hours,
                basic_earned, hra_earned, conveyance_earned, incentive_earned, special_allowance_earned,
                other_allowance_earned, overtime_amount, gross_earnings,
                pf_employee, pf_employer, esi_employee, esi_employer,
                professional_tax, tds, advance_deduction, other_deductions,
                total_deductions, net_salary, payment_status,
                calculated_by, remarks
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, $8, $9, $10, $11,
                $12, $13, $14, $15, $16,
                $17, $18, $19,
                $20, $21, $22, $23,
                $24, $25, $26, $27,
                $28, $29, $30,
                $31, $32
            )
            RETURNING *
        `;

        const values = [
            payrollData.employee_id,
            payrollData.attendance_id,
            payrollData.month,
            payrollData.year,
            payrollData.total_days || 30,
            payrollData.present_days || 0,
            payrollData.absent_days || 0,
            payrollData.weekly_off_days || 0,
            payrollData.leave_days || 0,
            payrollData.half_days || 0,
            payrollData.overtime_hours || 0,
            payrollData.basic_earned,
            payrollData.hra_earned,
            payrollData.conveyance_earned,
            payrollData.incentive_earned || 0,
            payrollData.special_allowance_earned,
            payrollData.other_allowance_earned,
            payrollData.overtime_amount,
            payrollData.gross_earnings,
            payrollData.pf_employee,
            payrollData.pf_employer,
            payrollData.esi_employee,
            payrollData.esi_employer,
            payrollData.professional_tax,
            payrollData.tds,
            payrollData.advance_deduction,
            payrollData.other_deductions,
            payrollData.total_deductions,
            payrollData.net_salary,
            payrollData.payment_status,
            payrollData.calculated_by,
            payrollData.remarks
        ];

        try {
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') {
                const err = new Error(`Payroll for employee ${payrollData.employee_id} for ${payrollData.month}/${payrollData.year} already exists`);
                err.status = 409;
                throw err;
            }
            throw error;
        }
    }

    async payrollExists(employeeId, month, year) {
        const query = `
            SELECT payroll_id
            FROM payroll
            WHERE employee_id = $1 AND month = $2 AND year = $3
        `;
        const result = await db.query(query, [employeeId, month, year]);
        return result.rows.length > 0;
    }

    async getPayrollById(payrollId) {
        const query = `
            SELECT
                p.*,
                COALESCE(NULLIF(p.present_days, 0), a.present_days, 0) AS present_days,
                COALESCE(NULLIF(p.absent_days, 0), a.absent_days, 0) AS absent_days,
                COALESCE(NULLIF(p.weekly_off_days, 0), a.weekly_off_days, 0) AS weekly_off_days,
                COALESCE(NULLIF(p.leave_days, 0), a.leave_days, 0) AS leave_days,
                COALESCE(NULLIF(p.half_days, 0), a.half_days, 0) AS half_days,
                COALESCE(NULLIF(p.overtime_hours, 0), a.overtime_hours, 0) AS overtime_hours,
                COALESCE(a.total_days, p.total_days, 30) AS total_days,
                e.employee_code, e.first_name, e.last_name, e.full_name,
                e.designation, e.department, e.date_of_joining, e.pan_number, e.uan_number, e.esi_number, e.account_number
            FROM payroll p
            LEFT JOIN employees e ON p.employee_id = e.employee_id
            LEFT JOIN attendance a ON p.attendance_id = a.attendance_id
            WHERE p.payroll_id = $1
        `;
        const result = await db.query(query, [payrollId]);
        return result.rows[0] || null;
    }

    async getPayrollByPeriod(month, year, siteId = null) {
        let query = `
            SELECT
                p.*,
                COALESCE(NULLIF(p.present_days, 0), a.present_days, 0) AS present_days,
                COALESCE(NULLIF(p.absent_days, 0), a.absent_days, 0) AS absent_days,
                COALESCE(a.weekly_off_days, p.weekly_off_days, 0) AS weekly_off_days,
                COALESCE(a.leave_days, p.leave_days, 0) AS leave_days,
                COALESCE(a.half_days, p.half_days, 0) AS half_days,
                COALESCE(a.overtime_hours, p.overtime_hours, 0) AS overtime_hours,
                COALESCE(a.total_days, p.total_days, 30) AS total_days,
                a.day_wise_attendance,
                e.employee_code,
                e.first_name,
                e.last_name,
                e.full_name,
                e.father_name,
                e.mobile,
                e.designation,
                e.department,
                e.wage_type,
                e.basic_salary AS employee_basic_salary,
                e.ot_rate AS employee_ot_rate,
                e.bank_name,
                e.account_number,
                e.ifsc_code,
                s.site_id,
                s.site_name,
                s.site_code
            FROM payroll p
            JOIN employees e ON p.employee_id = e.employee_id
            LEFT JOIN sites s ON e.site_id = s.site_id
            LEFT JOIN attendance a ON p.attendance_id = a.attendance_id
            WHERE p.month = $1 AND p.year = $2
        `;
        const values = [month, year];
        if (siteId) {
            query += ' AND e.site_id = $3';
            values.push(siteId);
        }
        query += ' ORDER BY e.employee_code ASC';

        const result = await db.query(query, values);
        return result.rows;
    }

    async getPayrollByEmployee(employeeId, filters = {}) {
        let query = 'SELECT * FROM payroll WHERE employee_id = $1';
        const values = [employeeId];
        let paramCount = 2;

        if (filters.month) {
            query += ` AND month = $${paramCount}`;
            values.push(filters.month);
            paramCount++;
        }

        if (filters.year) {
            query += ` AND year = $${paramCount}`;
            values.push(filters.year);
            paramCount++;
        }

        query += ' ORDER BY year DESC, month DESC';

        const result = await db.query(query, values);
        return result.rows;
    }

    async updatePayroll(payrollId, updateData) {
        const existingRes = await db.query('SELECT * FROM payroll WHERE payroll_id = $1', [payrollId]);
        if (existingRes.rows.length === 0) {
            const err = new Error(`Payroll record with ID ${payrollId} not found`);
            err.status = 404;
            throw err;
        }
        const existing = existingRes.rows[0];

        const allowedFields = [
            'advance_deduction', 'other_deductions', 'tds', 'remarks',
            'payment_status', 'payment_date', 'payment_mode', 'payment_reference'
        ];

        const payload = { ...updateData };
        const affectsNet = ['advance_deduction', 'other_deductions', 'tds'].some(k => payload[k] !== undefined);
        if (affectsNet) {
            const adv = payload.advance_deduction !== undefined ? (parseFloat(payload.advance_deduction) || 0) : parseFloat(existing.advance_deduction || 0);
            const oth = payload.other_deductions !== undefined ? (parseFloat(payload.other_deductions) || 0) : parseFloat(existing.other_deductions || 0);
            const tds = payload.tds !== undefined ? (parseFloat(payload.tds) || 0) : parseFloat(existing.tds || 0);
            const totalDeductions = Math.round((
                parseFloat(existing.pf_employee || 0) +
                parseFloat(existing.esi_employee || 0) +
                parseFloat(existing.professional_tax || 0) +
                adv + oth + tds
            ) * 100) / 100;
            const netSalary = Math.max(0, Math.round((parseFloat(existing.gross_earnings || 0) - totalDeductions) * 100) / 100);
            payload.total_deductions = totalDeductions;
            payload.net_salary = netSalary;
            allowedFields.push('total_deductions', 'net_salary');
        }

        const updates = [];
        const values = [];
        let paramCount = 1;

        for (const [key, value] of Object.entries(payload)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = $${paramCount}`);
                values.push(value === '' ? null : value);
                paramCount++;
            }
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(payrollId);
        const query = `
            UPDATE payroll
            SET ${updates.join(', ')}
            WHERE payroll_id = $${paramCount}
            RETURNING *
        `;

        const result = await db.query(query, values);
        return result.rows[0];
    }

    async markAsPaid(payrollId, paymentData = {}) {
        const updateData = {
            payment_status: 'PAID',
            payment_date: paymentData.payment_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
            payment_mode: paymentData.payment_mode || 'BANK_TRANSFER',
            payment_reference: paymentData.payment_reference || null
        };

        return this.updatePayroll(payrollId, updateData);
    }

    async bulkCalculatePayroll(month, year, options = {}, employeeIds = []) {
        let attendanceRecords = await attendanceService.getAttendanceByPeriod(month, year);

        if (employeeIds && employeeIds.length > 0) {
            attendanceRecords = attendanceRecords.filter(record => employeeIds.includes(record.employee_id));
        }

        const results = {
            success: [],
            errors: []
        };

        for (const attendance of attendanceRecords) {
            try {
                const exists = await this.payrollExists(attendance.employee_id, month, year);
                if (exists) {
                    results.errors.push({
                        employee_code: attendance.employee_code,
                        employee_id: attendance.employee_id,
                        error: `Payroll for ${month}/${year} already exists`
                    });
                    continue;
                }

                const payrollData = await this.calculatePayroll(
                    attendance.employee_id,
                    month,
                    year,
                    options
                );

                const payroll = await this.createPayroll(payrollData);

                results.success.push({
                    employee_code: attendance.employee_code,
                    employee_id: attendance.employee_id,
                    payroll_id: payroll.payroll_id,
                    net_salary: payroll.net_salary,
                    message: 'Payroll calculated successfully'
                });
            } catch (error) {
                results.errors.push({
                    employee_code: attendance.employee_code || 'N/A',
                    employee_id: attendance.employee_id,
                    error: error.message
                });
            }
        }

        return results;
    }
}

module.exports = new PayrollService();
