/**
 * Employee Service
 * Business logic for employee operations
 * Handles database interactions for employee master data
 */

const db = require('../config/database');
const bcrypt = require('bcrypt');

class EmployeeService {
    /**
     * Create a new employee
     * @param {Object} employeeData - Employee data object
     * @returns {Object} Created employee with employee_id
     */
    async createEmployee(employeeData) {
        let {
            employee_code,
            first_name,
            last_name,
            mobile,
            email,
            site_id,
            designation,
            department,
            date_of_joining,
            wage_type,
            basic_salary,
            hra,
            conveyance,
            special_allowance,
            other_allowance,
            pf_applicable,
            esi_applicable,
            pt_applicable,
            uan_number,
            esi_number,
            pan_number,
            aadhaar_number,
            bank_name,
            account_number,
            ifsc_code,
            shift_id,
            address,
            employment_type,
            ot_rate,
            documents,
            personal_email,
            emergency_contact,
            blood_group,
            manager_id,
            // Statutory Fields for Form XIII
            gender,
            father_name,
            dob,
            nationality,
            education,
            skill_category,
            permanent_address,
            service_book_no,
            date_of_exit,
            reason_for_exit,
            identification_mark,
            remarks,
            // Auth fields
            password_hash,
            userPassword,
            createUser,
            roleId,
            role_id,
            is_active,
            is_verified
        } = employeeData;

        // Auto-hash password if plain userPassword is provided
        if (userPassword && (!password_hash || password_hash === '')) {
            password_hash = await bcrypt.hash(userPassword, 10);
        }
        role_id = role_id || roleId || null;

        // Auto-generate employee code if not provided
        if (!employee_code || employee_code.trim() === '') {
            const seqResult = await db.query("SELECT nextval('employee_code_seq') as next_val");
            const nextVal = seqResult.rows[0].next_val;
            // Format: EMP-000001 (6 digits padded)
            employee_code = `EMP-${String(nextVal).padStart(6, '0')}`;
        } else {
            // Check if manually provided code exists
            const exists = await this.employeeExists(employee_code);
            if (exists) {
                throw new Error(`Employee code "${employee_code}" already exists`);
            }
        }

        const query = `
      INSERT INTO employees (
        employee_code, first_name, last_name, mobile, email,
        site_id, designation, department, date_of_joining,
        wage_type, basic_salary, hra, conveyance, special_allowance, other_allowance,
        pf_applicable, esi_applicable, pt_applicable,
        uan_number, esi_number, pan_number, aadhaar_number,
        bank_name, account_number, ifsc_code, shift_id,
        address, employment_type, ot_rate, documents, personal_email, emergency_contact, blood_group, manager_id,
        gender, father_name, dob, nationality, education, skill_category, permanent_address, 
        service_book_no, date_of_exit, reason_for_exit, identification_mark, remarks,
        password_hash, role_id, is_active, is_verified
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
        $27, $28, $29, $30, $31, $32, $33, $38,
        $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50,
        $34, $35, $36, $37
      )
      RETURNING *
    `;

        const values = [
            employee_code,
            first_name,
            last_name || null,
            mobile || null,
            email || null,
            site_id || null,
            designation || null,
            department || null,
            date_of_joining || null,
            wage_type,
            basic_salary,
            hra || 0,
            conveyance || 0,
            special_allowance || 0,
            other_allowance || 0,
            pf_applicable || false,
            esi_applicable || false,
            pt_applicable || false,
            uan_number || null,
            esi_number || null,
            pan_number || null,
            aadhaar_number || null,
            bank_name || null,
            account_number || null,
            ifsc_code || null,
            shift_id || null,
            address || null,
            employment_type || 'PERMANENT',
            ot_rate || 0,
            documents || {},
            personal_email || null,
            emergency_contact || null,
            blood_group || null,
            password_hash || null,
            role_id || null,
            is_active !== undefined ? is_active : true,
            is_verified || false,
            manager_id || null,
            // New statutory fields
            gender || null,
            father_name || null,
            dob || null,
            nationality || 'Indian',
            education || null,
            skill_category || null,
            permanent_address || null,
            service_book_no || null,
            date_of_exit || null,
            reason_for_exit || null,
            identification_mark || null,
            remarks || null
        ];

        try {
            const result = await db.query(query, values);
            const newEmployee = result.rows[0];

            // Auto-initialize leave balance (Lazy load service to avoid circular dependency)
            try {
                const leaveService = require('./leaveService');
                await leaveService.initializeLeaveBalance(newEmployee.employee_id);
                console.log(`Initialized leave balance for new employee: ${newEmployee.employee_code}`);
            } catch (leaveError) {
                console.error('Failed to auto-initialize leave balance:', leaveError);
                // Non-critical, continue
            }

            // Auto-create/sync login account in users table if login access was configured
            if ((createUser || userPassword || password_hash) && (email || newEmployee.email) && password_hash) {
                try {
                    const userEmail = (email || newEmployee.email).toLowerCase().trim();
                    const assignedRoleId = role_id || 5;
                    await db.query(`
                        INSERT INTO users (employee_id, email, password_hash, role_id, is_active, is_verified)
                        VALUES ($1, $2, $3, $4, TRUE, TRUE)
                        ON CONFLICT (email) DO UPDATE
                        SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id, employee_id = EXCLUDED.employee_id, is_active = TRUE
                    `, [newEmployee.employee_id, userEmail, password_hash, assignedRoleId]);
                    console.log(`Auto-created login account in users table for: ${userEmail}`);
                } catch (userErr) {
                    console.error('Failed to auto-create linked user record:', userErr);
                }
            }

            return newEmployee;
        } catch (error) {
            // Handle duplicate employee_code error
            if (error.code === '23505' && (error.constraint === 'employees_pkey' || error.constraint === 'employees_employee_code_key')) {
                const newError = new Error(`Employee code "${employee_code}" already exists`);
                newError.code = '23505'; // Preserve code just in case
                throw newError;
            }
            throw error;
        }
    }

    /**
     * Check if employee code already exists
     * @param {string} employeeCode - Employee code to check
     * @returns {boolean} True if exists
     */
    async employeeExists(employeeCode) {
        const query = 'SELECT employee_id FROM employees WHERE employee_code = $1';
        const result = await db.query(query, [employeeCode]);
        return result.rows.length > 0;
    }

    /**
     * Get employee by employee_code
     * @param {string} employeeCode - Employee code
     * @returns {Object|null} Employee object or null
     */
    async getEmployeeByCode(employeeCode) {
        const query = `
            SELECT 
                e.*,
                s.site_name,
                s.site_code,
                sh.shift_name,
                sh.start_time,
                sh.end_time
            FROM employees e
            LEFT JOIN sites s ON e.site_id = s.site_id
            LEFT JOIN shifts sh ON e.shift_id = sh.shift_id
            WHERE e.employee_code = $1
        `;
        const result = await db.query(query, [employeeCode]);
        const employee = result.rows[0];

        if (employee) {
            delete employee.password_hash;
        }

        return employee || null;
    }

    /**
     * Get all employees
     * @param {Object} filters - Optional filters (status, site_id, etc.)
     * @returns {Array} Array of employees
     */
    async getAllEmployees(filters = {}) {
        let query = `
            SELECT 
                e.*,
                s.site_name,
                sh.shift_name,
                sh.start_time,
                sh.end_time
            FROM employees e
            LEFT JOIN sites s ON e.site_id = s.site_id
            LEFT JOIN shifts sh ON e.shift_id = sh.shift_id
            WHERE employment_status != 'TERMINATED'
        `;
        const values = [];
        let paramCount = 1;

        if (filters.employment_status) {
            query += ` AND e.employment_status = $${paramCount}`;
            values.push(filters.employment_status);
            paramCount++;
        }

        if (filters.site_id) {
            query += ` AND e.site_id = $${paramCount}`;
            values.push(filters.site_id);
            paramCount++;
        }

        if (filters.employee_id) {
            query += ` AND e.employee_id = $${paramCount}`;
            values.push(filters.employee_id);
            paramCount++;
        }

        query += ' ORDER BY e.employee_code ASC';

        const result = await db.query(query, values);

        // Remove password_hash from results
        return result.rows.map(emp => {
            const { password_hash, ...empData } = emp;
            return empData;
        });
    }

    /**
     * Update employee
     * @param {string} employeeCode - Employee code
     * @param {Object} updateData - Fields to update
     * @returns {Object} Updated employee
     */
    async updateEmployee(employeeCode, updateData) {
        if (updateData.userPassword && (!updateData.password_hash || updateData.password_hash === '')) {
            updateData.password_hash = await bcrypt.hash(updateData.userPassword, 10);
            delete updateData.userPassword;
        }
        if (updateData.roleId && !updateData.role_id) {
            updateData.role_id = updateData.roleId;
            delete updateData.roleId;
        }

        const allowedFields = [
            'first_name', 'last_name', 'mobile', 'email', 'site_id',
            'designation', 'department', 'employment_status',
            'basic_salary', 'hra', 'conveyance', 'special_allowance', 'other_allowance',
            'pf_applicable', 'esi_applicable', 'pt_applicable',
            'uan_number', 'esi_number', 'pan_number', 'aadhaar_number',
            'bank_name', 'account_number', 'ifsc_code', 'shift_id',
            'address', 'employment_type', 'ot_rate', 'documents',
            'personal_email', 'emergency_contact', 'blood_group', 'manager_id',
            'gender', 'father_name', 'dob', 'nationality', 'education', 'skill_category',
            'permanent_address', 'service_book_no', 'date_of_exit', 'reason_for_exit',
            'identification_mark', 'remarks',
            'password_hash', 'role_id', 'is_active', 'is_verified'
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

        values.push(employeeCode);
        const query = `
      UPDATE employees 
      SET ${updates.join(', ')}
      WHERE employee_code = $${paramCount}
      RETURNING *
    `;

        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            throw new Error(`Employee with code "${employeeCode}" not found`);
        }

        const updatedEmp = result.rows[0];

        // Sync to users table if login credentials/role were updated
        if (updateData.password_hash || updateData.role_id || updateData.createUser) {
            try {
                const userEmail = (updatedEmp.email || updateData.email || '').toLowerCase().trim();
                if (userEmail && updatedEmp.password_hash) {
                    const assignedRoleId = updatedEmp.role_id || 5;
                    await db.query(`
                        INSERT INTO users (employee_id, email, password_hash, role_id, is_active, is_verified)
                        VALUES ($1, $2, $3, $4, TRUE, TRUE)
                        ON CONFLICT (email) DO UPDATE
                        SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id, employee_id = EXCLUDED.employee_id, is_active = TRUE
                    `, [updatedEmp.employee_id, userEmail, updatedEmp.password_hash, assignedRoleId]);
                    console.log(`Synced user login account in users table for: ${userEmail}`);
                }
            } catch (userErr) {
                console.error('Failed to sync updated user record:', userErr);
            }
        }

        return updatedEmp;
    }

    /**
     * Delete employee (soft delete by setting status to TERMINATED)
     * @param {string} employeeCode - Employee code
     * @returns {Object} Updated employee
     */
    async deleteEmployee(employeeCode) {
        // 1. Check if employee exists and get role
        const checkQuery = `
            SELECT e.employee_id, r.role_code 
            FROM employees e
            LEFT JOIN roles r ON e.role_id = r.role_id
            WHERE e.employee_code = $1
        `;
        const checkRes = await db.query(checkQuery, [employeeCode]);

        if (checkRes.rows.length === 0) {
            throw new Error(`Employee with code "${employeeCode}" not found`);
        }

        const employee = checkRes.rows[0];

        // 2. Prevent deleting SUPER_ADMIN or specific protected roles
        if (employee.role_code === 'SUPER_ADMIN' || employee.role_code === 'ADMIN') {
            throw new Error('Cannot delete an Administrator account');
        }

        // 3. Perform Soft Delete
        const query = `
            UPDATE employees 
            SET employment_status = 'TERMINATED', 
                is_active = false,
                employee_code = employee_code || '_DEL_' || floor(extract(epoch from now()))
            WHERE employee_code = $1
            RETURNING *
        `;

        const result = await db.query(query, [employeeCode]);
        return result.rows[0];
    }

    /**
     * Bulk import employees from Excel data
     * @param {Array} employeesData - Array of employee objects
     * @returns {Object} { success: [], errors: [] }
     */
    async bulkImportEmployees(employeesData) {
        const results = {
            success: [],
            errors: [],
        };

        for (const empData of employeesData) {
            try {
                const employee = await this.createEmployee(empData);
                results.success.push({
                    employee_code: empData.employee_code,
                    employee_id: employee.employee_id,
                    message: 'Imported successfully',
                });
            } catch (error) {
                results.errors.push({
                    employee_code: empData.employee_code,
                    row_number: empData._rowNumber,
                    error: error.message,
                });
            }
        }

        return results;
    }
}

module.exports = new EmployeeService();
