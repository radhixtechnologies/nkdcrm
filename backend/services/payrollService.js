/**
 * Payroll Service
 * Business logic for payroll calculations
 * Handles PF, ESI, PT, TDS calculations and salary proration
 */

const db = require('../config/database');
const attendanceService = require('./attendanceService');
const employeeService = require('./employeeService');

class PayrollService {
    /**
     * Get payroll configuration values
     * @returns {Object} Configuration object
     */
    async getPayrollConfig() {
        const query = 'SELECT config_key, config_value FROM payroll_config';
        const result = await db.query(query);

        const config = {};
        result.rows.forEach(row => {
            config[row.config_key] = parseFloat(row.config_value);
        });

        return config;
    }

    /**
     * Calculate earnings based on attendance
     * @param {Object} employee - Employee object
     * @param {Object} attendance - Attendance object
     * @param {Object} config - Payroll config
     * @returns {Object} Calculated earnings
     */
    calculateEarnings(employee, attendance, config) {
        const workingDaysPerMonth = config.WORKING_DAYS_PER_MONTH || 26;
        const presentDays = parseFloat(attendance.present_days) || 0;
        const overtimeHours = parseFloat(attendance.overtime_hours) || 0;

        let basicEarned = 0;
        let hraEarned = 0;
        let conveyanceEarned = 0;
        let specialAllowanceEarned = 0;
        let otherAllowanceEarned = 0;
        let overtimeAmount = 0;

        if (employee.wage_type === 'MONTHLY') {
            // Monthly employees: Prorate based on present days
            const prorataFactor = presentDays / workingDaysPerMonth;

            basicEarned = parseFloat(employee.basic_salary) * prorataFactor;
            hraEarned = parseFloat(employee.hra || 0) * prorataFactor;
            conveyanceEarned = parseFloat(employee.conveyance || 0) * prorataFactor;
            specialAllowanceEarned = parseFloat(employee.special_allowance || 0) * prorataFactor;
            otherAllowanceEarned = parseFloat(employee.other_allowance || 0) * prorataFactor;

            // Overtime calculation for monthly employees
            if (overtimeHours > 0) {
                const hourlyRate = parseFloat(employee.basic_salary) / (workingDaysPerMonth * 8);
                const overtimeMultiplier = config.OVERTIME_MULTIPLIER || 2;
                overtimeAmount = hourlyRate * overtimeHours * overtimeMultiplier;
            }
        } else if (employee.wage_type === 'PER_DAY') {
            // Per-day employees: Daily wage × present days
            basicEarned = parseFloat(employee.basic_salary) * presentDays;
            hraEarned = parseFloat(employee.hra || 0) * presentDays;
            conveyanceEarned = parseFloat(employee.conveyance || 0) * presentDays;
            specialAllowanceEarned = parseFloat(employee.special_allowance || 0) * presentDays;
            otherAllowanceEarned = parseFloat(employee.other_allowance || 0) * presentDays;

            // Overtime calculation for per-day employees
            if (overtimeHours > 0) {
                const hourlyRate = parseFloat(employee.basic_salary) / 8;
                const overtimeMultiplier = config.OVERTIME_MULTIPLIER || 2;
                overtimeAmount = hourlyRate * overtimeHours * overtimeMultiplier;
            }
        }

        const grossEarnings = basicEarned + hraEarned + conveyanceEarned +
            specialAllowanceEarned + otherAllowanceEarned + overtimeAmount;

        return {
            basic_earned: Math.round(basicEarned * 100) / 100,
            hra_earned: Math.round(hraEarned * 100) / 100,
            conveyance_earned: Math.round(conveyanceEarned * 100) / 100,
            special_allowance_earned: Math.round(specialAllowanceEarned * 100) / 100,
            other_allowance_earned: Math.round(otherAllowanceEarned * 100) / 100,
            overtime_amount: Math.round(overtimeAmount * 100) / 100,
            gross_earnings: Math.round(grossEarnings * 100) / 100,
        };
    }

    /**
     * Calculate PF (Provident Fund)
     * @param {Object} employee - Employee object
     * @param {number} basicEarned - Basic salary earned
     * @param {Object} config - Payroll config
     * @returns {Object} { pf_employee, pf_employer }
     */
    calculatePF(employee, basicEarned, config) {
        if (!employee.pf_applicable) {
            return { pf_employee: 0, pf_employer: 0 };
        }

        const pfCeiling = config.PF_CEILING || 15000;
        const pfEmployeeRate = config.PF_EMPLOYEE_RATE || 12;
        const pfEmployerRate = config.PF_EMPLOYER_RATE || 12;

        // PF is calculated on basic salary, capped at ceiling
        const pfBase = Math.min(basicEarned, pfCeiling);

        const pfEmployee = (pfBase * pfEmployeeRate) / 100;
        const pfEmployer = (pfBase * pfEmployerRate) / 100;

        return {
            pf_employee: Math.round(pfEmployee * 100) / 100,
            pf_employer: Math.round(pfEmployer * 100) / 100,
        };
    }

    /**
     * Calculate ESI (Employee State Insurance)
     * @param {Object} employee - Employee object
     * @param {number} grossEarnings - Gross earnings
     * @param {Object} config - Payroll config
     * @returns {Object} { esi_employee, esi_employer }
     */
    calculateESI(employee, grossEarnings, config) {
        if (!employee.esi_applicable) {
            return { esi_employee: 0, esi_employer: 0 };
        }

        const esiCeiling = config.ESI_CEILING || 21000;
        const esiEmployeeRate = config.ESI_EMPLOYEE_RATE || 0.75;
        const esiEmployerRate = config.ESI_EMPLOYER_RATE || 3.25;

        // ESI is only applicable if gross salary is below ceiling
        if (grossEarnings > esiCeiling) {
            return { esi_employee: 0, esi_employer: 0 };
        }

        const esiEmployee = (grossEarnings * esiEmployeeRate) / 100;
        const esiEmployer = (grossEarnings * esiEmployerRate) / 100;

        return {
            esi_employee: Math.round(esiEmployee * 100) / 100,
            esi_employer: Math.round(esiEmployer * 100) / 100,
        };
    }

    /**
     * Calculate Professional Tax (PT)
     * @param {Object} employee - Employee object
     * @param {number} grossEarnings - Gross earnings
     * @param {Object} config - Payroll config
     * @returns {number} PT amount
     */
    calculatePT(employee, grossEarnings, config) {
        if (!employee.pt_applicable) {
            return 0;
        }

        // Simple PT slab (can be customized based on state)
        // Example: Maharashtra PT slabs
        if (grossEarnings <= 10000) {
            return config.PT_SLAB_1 || 0;
        } else if (grossEarnings <= 15000) {
            return config.PT_SLAB_2 || 200;
        } else {
            return 200; // Standard PT for higher salaries
        }
    }

    /**
     * Calculate complete payroll for an employee
     * @param {number} employeeId - Employee ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {Object} options - Additional options (advance_deduction, other_deductions, etc.)
     * @returns {Object} Complete payroll calculation
     */
    async calculatePayroll(employeeId, month, year, options = {}) {
        // Get employee details
        const employeeQuery = 'SELECT * FROM employees WHERE employee_id = $1';
        const employeeResult = await db.query(employeeQuery, [employeeId]);

        if (employeeResult.rows.length === 0) {
            throw new Error(`Employee with ID ${employeeId} not found`);
        }
        const employee = employeeResult.rows[0];

        // Get attendance for the month
        const attendance = await attendanceService.getAttendanceByEmployee(employeeId, { month, year });

        if (attendance.length === 0) {
            throw new Error(`Attendance for employee ${employee.employee_code} for ${month}/${year} not found`);
        }
        const attendanceRecord = attendance[0];

        // Get payroll configuration
        const config = await this.getPayrollConfig();

        // Calculate earnings
        const earnings = this.calculateEarnings(employee, attendanceRecord, config);

        // Calculate deductions
        const pf = this.calculatePF(employee, earnings.basic_earned, config);
        const esi = this.calculateESI(employee, earnings.gross_earnings, config);
        const pt = this.calculatePT(employee, earnings.gross_earnings, config);

        // Additional deductions
        const advanceDeduction = parseFloat(options.advance_deduction || 0);
        const otherDeductions = parseFloat(options.other_deductions || 0);
        const tds = parseFloat(options.tds || 0);

        // Total deductions
        const totalDeductions = pf.pf_employee + esi.esi_employee + pt +
            advanceDeduction + otherDeductions + tds;

        // Net salary
        const netSalary = earnings.gross_earnings - totalDeductions;

        return {
            employee_id: employeeId,
            attendance_id: attendanceRecord.attendance_id,
            month,
            year,
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
            remarks: options.remarks || null,
        };
    }

    /**
     * Create payroll record in database
     * @param {Object} payrollData - Payroll data object
     * @returns {Object} Created payroll record
     */
    async createPayroll(payrollData) {
        const query = `
      INSERT INTO payroll (
        employee_id, attendance_id, month, year,
        basic_earned, hra_earned, conveyance_earned, special_allowance_earned,
        other_allowance_earned, overtime_amount, gross_earnings,
        pf_employee, pf_employer, esi_employee, esi_employer,
        professional_tax, tds, advance_deduction, other_deductions,
        total_deductions, net_salary, payment_status,
        calculated_by, remarks
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24
      )
      RETURNING *
    `;

        const values = [
            payrollData.employee_id,
            payrollData.attendance_id,
            payrollData.month,
            payrollData.year,
            payrollData.basic_earned,
            payrollData.hra_earned,
            payrollData.conveyance_earned,
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
            payrollData.remarks,
        ];

        try {
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            // Handle duplicate payroll error
            if (error.code === '23505') {
                throw new Error(`Payroll for employee ${payrollData.employee_id} for ${payrollData.month}/${payrollData.year} already exists`);
            }
            throw error;
        }
    }

    /**
     * Check if payroll exists for employee in a specific month/year
     * @param {number} employeeId - Employee ID
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {boolean} True if exists
     */
    async payrollExists(employeeId, month, year) {
        const query = `
      SELECT payroll_id 
      FROM payroll 
      WHERE employee_id = $1 AND month = $2 AND year = $3
    `;
        const result = await db.query(query, [employeeId, month, year]);
        return result.rows.length > 0;
    }

    /**
     * Get payroll by ID
     * @param {number} payrollId - Payroll ID
     * @returns {Object|null} Payroll object or null
     */
    async getPayrollById(payrollId) {
        const query = `
            SELECT 
                p.*,
                e.employee_code, e.first_name, e.last_name, e.full_name, 
                e.designation, e.department, e.date_of_joining, e.pan_number, e.uan_number,
                a.present_days, a.absent_days, a.weekly_off_days, a.leave_days, a.half_days, a.overtime_hours, a.total_days
            FROM payroll p
            LEFT JOIN employees e ON p.employee_id = e.employee_id
            LEFT JOIN attendance a ON p.attendance_id = a.attendance_id
            WHERE p.payroll_id = $1
        `;
        const result = await db.query(query, [payrollId]);
        return result.rows[0] || null;
    }

    /**
     * Get all payroll records for a specific month/year
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {Array} Array of payroll records with employee details
     */
    async getPayrollByPeriod(month, year) {
        const query = `
      SELECT 
        p.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.full_name,
        e.designation,
        e.department,
        e.bank_name,
        e.account_number,
        e.ifsc_code
      FROM payroll p
      JOIN employees e ON p.employee_id = e.employee_id
      WHERE p.month = $1 AND p.year = $2
      ORDER BY e.employee_code ASC
    `;

        const result = await db.query(query, [month, year]);
        return result.rows;
    }

    /**
     * Get payroll for a specific employee
     * @param {number} employeeId - Employee ID
     * @param {Object} filters - Optional filters (month, year)
     * @returns {Array} Array of payroll records
     */
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

    /**
     * Update payroll record
     * @param {number} payrollId - Payroll ID
     * @param {Object} updateData - Fields to update
     * @returns {Object} Updated payroll record
     */
    async updatePayroll(payrollId, updateData) {
        const allowedFields = [
            'advance_deduction', 'other_deductions', 'tds', 'remarks',
            'payment_status', 'payment_date', 'payment_mode', 'payment_reference',
        ];

        const updates = [];
        const values = [];
        let paramCount = 1;

        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(payrollId);
        const query = `
      UPDATE payroll 
      SET ${updates.join(', ')}
      WHERE payroll_id = $${paramCount}
      RETURNING *
    `;

        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            throw new Error(`Payroll record with ID ${payrollId} not found`);
        }

        return result.rows[0];
    }

    /**
     * Mark payroll as paid
     * @param {number} payrollId - Payroll ID
     * @param {Object} paymentData - Payment details
     * @returns {Object} Updated payroll record
     */
    async markAsPaid(payrollId, paymentData) {
        const updateData = {
            payment_status: 'PAID',
            payment_date: paymentData.payment_date || new Date().toISOString().split('T')[0],
            payment_mode: paymentData.payment_mode || 'BANK_TRANSFER',
            payment_reference: paymentData.payment_reference || null,
        };

        return this.updatePayroll(payrollId, updateData);
    }

    /**
     * Bulk calculate payroll for all employees with attendance
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @param {Object} options - Additional options
     * @returns {Object} { success: [], errors: [] }
     */
    async bulkCalculatePayroll(month, year, options = {}, employeeIds = []) {
        // Get all attendance records for the period
        let attendanceRecords = await attendanceService.getAttendanceByPeriod(month, year);

        // Filter by employee IDs if provided
        if (employeeIds && employeeIds.length > 0) {
            attendanceRecords = attendanceRecords.filter(record => employeeIds.includes(record.employee_id));
        }

        const results = {
            success: [],
            errors: [],
        };

        for (const attendance of attendanceRecords) {
            try {
                // Check if payroll already exists
                const exists = await this.payrollExists(attendance.employee_id, month, year);
                if (exists) {
                    results.errors.push({
                        employee_code: attendance.employee_code,
                        employee_id: attendance.employee_id,
                        error: `Payroll for ${month}/${year} already exists`,
                    });
                    continue;
                }

                // Calculate payroll
                const payrollData = await this.calculatePayroll(
                    attendance.employee_id,
                    month,
                    year,
                    options
                );

                // Create payroll record
                const payroll = await this.createPayroll(payrollData);

                results.success.push({
                    employee_code: attendance.employee_code,
                    employee_id: attendance.employee_id,
                    payroll_id: payroll.payroll_id,
                    net_salary: payroll.net_salary,
                    message: 'Payroll calculated successfully',
                });
            } catch (error) {
                results.errors.push({
                    employee_code: attendance.employee_code || 'N/A',
                    employee_id: attendance.employee_id,
                    error: error.message,
                });
            }
        }

        return results;
    }
}

module.exports = new PayrollService();
