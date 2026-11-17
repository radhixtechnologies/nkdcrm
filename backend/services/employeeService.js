/**
 * Employee Service
 * Business logic for employee operations
 * Handles database interactions for employee master data
 */

const db = require('../config/database');
const bcrypt = require('bcrypt');

const cleanDate = (val) => {
    if (val === undefined || val === null) return null;
    const str = String(val).trim();
    return str === '' ? null : str;
};

const cleanInt = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? null : n;
};

const cleanNum = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = parseFloat(val);
    return Number.isNaN(n) ? fallback : n;
};

class EmployeeService {
    async getDefaultEmployeeRoleId() {
        const res = await db.query("SELECT role_id FROM roles WHERE role_code = 'EMPLOYEE' LIMIT 1");
        if (res.rows.length > 0) return res.rows[0].role_id;
        const anyRole = await db.query('SELECT role_id FROM roles ORDER BY role_id ASC LIMIT 1');
        return anyRole.rows[0]?.role_id || null;
    }

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
            password_hash,
            userPassword,
            createUser,
            roleId,
            role_id,
            is_active,
            is_verified
        } = employeeData;

        if (userPassword && (!password_hash || password_hash === '')) {
            password_hash = await bcrypt.hash(userPassword, 10);
        }
        role_id = cleanInt(role_id || roleId);

        if (!employee_code || String(employee_code).trim() === '') {
            const seqRes = await db.query(`
                SELECT COALESCE(
                    MAX(SUBSTRING(employee_code FROM 'NKD-([0-9]+)')::INTEGER), 
                    0
                ) + 1 AS next_num
                FROM employees
                WHERE employee_code ~ '^NKD-[0-9]+'
            `);
            const nextNum = parseInt(seqRes.rows[0]?.next_num, 10) || 1;
            let candidateCode = `NKD-${String(nextNum).padStart(5, '0')}`;
            let counter = nextNum;
            while (await this.employeeExists(candidateCode)) {
                counter++;
                candidateCode = `NKD-${String(counter).padStart(5, '0')}`;
            }
            employee_code = candidateCode;
        } else {
            employee_code = String(employee_code).trim().toUpperCase();
            const exists = await this.employeeExists(employee_code);
            if (exists) {
                const err = new Error(`Employee code "${employee_code}" already exists`);
                err.status = 409;
                throw err;
            }
        }

        const fullName = `${first_name || ''} ${last_name || ''}`.trim();

        const query = `
            INSERT INTO employees (
                employee_code, first_name, last_name, full_name, mobile, email,
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
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16,
                $17, $18, $19,
                $20, $21, $22, $23,
                $24, $25, $26, $27,
                $28, $29, $30, $31, $32, $33, $34, $35,
                $36, $37, $38, $39, $40, $41, $42,
                $43, $44, $45, $46, $47,
                $48, $49, $50, $51
            )
            RETURNING *
        `;

        const values = [
            employee_code,
            first_name,
            last_name || null,
            fullName || first_name,
            mobile || null,
            email ? String(email).trim().toLowerCase() : null,
            cleanInt(site_id),
            designation || null,
            department || null,
            cleanDate(date_of_joining),
            wage_type || 'MONTHLY',
            cleanNum(basic_salary, 0),
            cleanNum(hra, 0),
            cleanNum(conveyance, 0),
            cleanNum(special_allowance, 0),
            cleanNum(other_allowance, 0),
            Boolean(pf_applicable),
            Boolean(esi_applicable),
            Boolean(pt_applicable),
            uan_number || null,
            esi_number || null,
            pan_number || null,
            aadhaar_number || null,
            bank_name || null,
            account_number || null,
            ifsc_code || null,
            cleanInt(shift_id),
            address || null,
            employment_type || 'PERMANENT',
            cleanNum(ot_rate, 0),
            documents || {},
            personal_email || null,
            emergency_contact || null,
            blood_group || null,
            cleanInt(manager_id),
            gender || null,
            father_name || null,
            cleanDate(dob),
            nationality || 'Indian',
            education || null,
            skill_category || null,
            permanent_address || null,
            service_book_no || null,
            cleanDate(date_of_exit),
            reason_for_exit || null,
            identification_mark || null,
            remarks || null,
            password_hash || null,
            role_id,
            is_active !== undefined ? Boolean(is_active) : true,
            Boolean(is_verified)
        ];

        try {
            const result = await db.query(query, values);
            const newEmployee = result.rows[0];

            try {
                const leaveService = require('./leaveService');
                await leaveService.initializeLeaveBalance(newEmployee.employee_id);
            } catch (leaveError) {
                console.error('Failed to auto-initialize leave balance:', leaveError);
            }

            if (createUser !== false && (createUser || userPassword || password_hash) && (email || newEmployee.email) && password_hash) {
                try {
                    const userEmail = (email || newEmployee.email).toLowerCase().trim();
                    const assignedRoleId = role_id || await this.getDefaultEmployeeRoleId();
                    if (assignedRoleId) {
                        await db.query(`
                            INSERT INTO users (employee_id, email, password_hash, role_id, is_active, is_verified)
                            VALUES ($1, $2, $3, $4, TRUE, TRUE)
                            ON CONFLICT (email) DO UPDATE
                            SET password_hash = EXCLUDED.password_hash,
                                role_id = EXCLUDED.role_id,
                                employee_id = EXCLUDED.employee_id,
                                is_active = TRUE
                        `, [newEmployee.employee_id, userEmail, password_hash, assignedRoleId]);
                    }
                } catch (userErr) {
                    console.error('Failed to auto-create linked user record:', userErr);
                }
            }

            delete newEmployee.password_hash;
            return newEmployee;
        } catch (error) {
            if (error.code === '23505' && (error.constraint === 'employees_pkey' || error.constraint === 'employees_employee_code_key')) {
                const newError = new Error(`Employee code "${employee_code}" already exists`);
                newError.code = '23505';
                newError.status = 409;
                throw newError;
            }
            throw error;
        }
    }

    async employeeExists(employeeCode) {
        const query = 'SELECT employee_id FROM employees WHERE LOWER(employee_code) = LOWER($1)';
        const result = await db.query(query, [employeeCode]);
        return result.rows.length > 0;
    }

    async getEmployeeById(employeeId) {
        const query = `
            SELECT
                e.*,
                s.site_name,
                s.site_code,
                s.principal_employer_name,
                s.city AS site_city,
                s.state AS site_state,
                sh.shift_name,
                sh.start_time,
                sh.end_time
            FROM employees e
            LEFT JOIN sites s ON e.site_id = s.site_id
            LEFT JOIN shifts sh ON e.shift_id = sh.shift_id
            WHERE e.employee_id = $1
        `;
        const result = await db.query(query, [employeeId]);
        const employee = result.rows[0];
        if (employee) delete employee.password_hash;
        return employee || null;
    }

    async getEmployeeByCode(employeeCode) {
        const query = `
            SELECT
                e.*,
                s.site_name,
                s.site_code,
                s.principal_employer_name,
                s.city AS site_city,
                s.state AS site_state,
                sh.shift_name,
                sh.start_time,
                sh.end_time
            FROM employees e
            LEFT JOIN sites s ON e.site_id = s.site_id
            LEFT JOIN shifts sh ON e.shift_id = sh.shift_id
            WHERE LOWER(e.employee_code) = LOWER($1)
        `;
        const result = await db.query(query, [employeeCode]);
        const employee = result.rows[0];

        if (employee) {
            delete employee.password_hash;
        }

        return employee || null;
    }

    async getAllEmployees(filters = {}) {
        let query = `
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
        `;
        const values = [];
        let paramCount = 1;

        if (filters.employment_status && filters.employment_status !== 'ALL') {
            query += ` WHERE e.employment_status = $${paramCount}`;
            values.push(filters.employment_status);
            paramCount++;
        } else if (filters.includeTerminated || filters.employment_status === 'ALL') {
            query += ` WHERE 1=1`;
        } else {
            query += ` WHERE e.employment_status != 'TERMINATED'`;
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

        return result.rows.map(emp => {
            const { password_hash, ...empData } = emp;
            return empData;
        });
    }

    async updateEmployee(employeeCode, updateData) {
        const payload = { ...updateData };

        if (payload.userPassword && (!payload.password_hash || payload.password_hash === '')) {
            payload.password_hash = await bcrypt.hash(payload.userPassword, 10);
            delete payload.userPassword;
        }
        if (payload.roleId && !payload.role_id) {
            payload.role_id = payload.roleId;
            delete payload.roleId;
        }

        const existingRes = await db.query('SELECT * FROM employees WHERE LOWER(employee_code) = LOWER($1)', [employeeCode]);
        if (existingRes.rows.length === 0) {
            const err = new Error(`Employee with code "${employeeCode}" not found`);
            err.status = 404;
            throw err;
        }
        const existingEmp = existingRes.rows[0];

        const allowedFields = [
            'first_name', 'last_name', 'mobile', 'email', 'site_id',
            'designation', 'department', 'date_of_joining', 'employment_status',
            'basic_salary', 'hra', 'conveyance', 'special_allowance', 'other_allowance',
            'incentive_allowance', 'gratuity_amount', 'insurance_amount', 'total_ctc', 'net_take_home',
            'pf_applicable', 'esi_applicable', 'pt_applicable',
            'uan_number', 'esi_number', 'pan_number', 'aadhaar_number',
            'bank_name', 'account_number', 'ifsc_code', 'shift_id',
            'address', 'wage_type', 'employment_type', 'ot_rate', 'documents',
            'personal_email', 'emergency_contact', 'blood_group', 'manager_id',
            'gender', 'father_name', 'dob', 'nationality', 'education', 'skill_category',
            'permanent_address', 'service_book_no', 'date_of_exit', 'reason_for_exit',
            'identification_mark', 'remarks',
            'password_hash', 'role_id', 'is_active', 'is_verified'
        ];

        const dateFields = new Set(['dob', 'date_of_joining', 'date_of_exit']);
        const intFields = new Set(['site_id', 'shift_id', 'manager_id', 'role_id']);
        const numFields = new Set(['basic_salary', 'hra', 'conveyance', 'special_allowance', 'other_allowance', 'incentive_allowance', 'gratuity_amount', 'insurance_amount', 'total_ctc', 'net_take_home', 'ot_rate']);

        const updates = [];
        const values = [];
        let paramCount = 1;

        for (const [key, rawVal] of Object.entries(payload)) {
            if (!allowedFields.includes(key)) continue;

            let val = rawVal;
            if (dateFields.has(key)) val = cleanDate(rawVal);
            else if (intFields.has(key)) val = cleanInt(rawVal);
            else if (numFields.has(key)) val = cleanNum(rawVal, 0);
            else if (key === 'email' && rawVal) val = String(rawVal).trim().toLowerCase();

            updates.push(`${key} = $${paramCount}`);
            values.push(val);
            paramCount++;
        }

        if (payload.first_name !== undefined || payload.last_name !== undefined) {
            const nextFirst = payload.first_name !== undefined ? payload.first_name : existingEmp.first_name;
            const nextLast = payload.last_name !== undefined ? payload.last_name : existingEmp.last_name;
            updates.push(`full_name = $${paramCount}`);
            values.push(`${nextFirst || ''} ${nextLast || ''}`.trim());
            paramCount++;
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(existingEmp.employee_id);
        const query = `
            UPDATE employees
            SET ${updates.join(', ')}
            WHERE employee_id = $${paramCount}
            RETURNING *
        `;

        const result = await db.query(query, values);
        const updatedEmp = result.rows[0];

        if (
            payload.password_hash ||
            payload.role_id !== undefined ||
            payload.createUser ||
            payload.email !== undefined ||
            payload.is_active !== undefined
        ) {
            try {
                const existingUserRes = await db.query(
                    'SELECT user_id, email FROM users WHERE employee_id = $1 LIMIT 1',
                    [updatedEmp.employee_id]
                );
                const userEmail = (updatedEmp.email || payload.email || '').toLowerCase().trim();
                const assignedRoleId = updatedEmp.role_id || await this.getDefaultEmployeeRoleId();

                if (existingUserRes.rows.length > 0) {
                    const userRow = existingUserRes.rows[0];
                    await db.query(`
                        UPDATE users
                        SET email = COALESCE($1, email),
                            password_hash = COALESCE($2, password_hash),
                            role_id = COALESCE($3, role_id),
                            is_active = COALESCE($4, is_active),
                            updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = $5
                    `, [
                        userEmail || null,
                        payload.password_hash || null,
                        assignedRoleId,
                        payload.is_active !== undefined ? Boolean(payload.is_active) : null,
                        userRow.user_id
                    ]);
                } else if (
                    payload.createUser !== false &&
                    (payload.createUser || payload.password_hash) &&
                    userEmail &&
                    updatedEmp.password_hash &&
                    assignedRoleId
                ) {
                    await db.query(`
                        INSERT INTO users (employee_id, email, password_hash, role_id, is_active, is_verified)
                        VALUES ($1, $2, $3, $4, TRUE, TRUE)
                        ON CONFLICT (email) DO UPDATE
                        SET password_hash = EXCLUDED.password_hash,
                            role_id = EXCLUDED.role_id,
                            employee_id = EXCLUDED.employee_id,
                            is_active = TRUE
                    `, [updatedEmp.employee_id, userEmail, updatedEmp.password_hash, assignedRoleId]);
                }
            } catch (userErr) {
                console.error('Failed to sync updated user record:', userErr);
            }
        }

        delete updatedEmp.password_hash;
        return updatedEmp;
    }

    async deleteEmployee(employeeCode) {
        const checkQuery = `
            SELECT e.employee_id, r.role_code
            FROM employees e
            LEFT JOIN roles r ON e.role_id = r.role_id
            WHERE LOWER(e.employee_code) = LOWER($1)
        `;
        const checkRes = await db.query(checkQuery, [employeeCode]);

        if (checkRes.rows.length === 0) {
            const err = new Error(`Employee with code "${employeeCode}" not found`);
            err.status = 404;
            throw err;
        }

        const employee = checkRes.rows[0];

        if (employee.role_code === 'SUPER_ADMIN' || employee.role_code === 'ADMIN') {
            const err = new Error('Cannot delete an Administrator account');
            err.status = 403;
            throw err;
        }

        const query = `
            UPDATE employees
            SET employment_status = 'TERMINATED',
                is_active = FALSE,
                employee_code = employee_code || '_DEL_' || floor(extract(epoch from now())),
                updated_at = CURRENT_TIMESTAMP
            WHERE employee_id = $1
            RETURNING *
        `;

        const result = await db.query(query, [employee.employee_id]);
        await db.query('UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE employee_id = $1', [employee.employee_id]);

        const deleted = result.rows[0];
        if (deleted) delete deleted.password_hash;
        return deleted;
    }

    async bulkImportEmployees(employeesData) {
        const results = {
            success: [],
            errors: []
        };

        for (const empData of employeesData) {
            try {
                const employee = await this.createEmployee(empData);
                results.success.push({
                    employee_code: employee.employee_code,
                    employee_id: employee.employee_id,
                    message: 'Imported successfully'
                });
            } catch (error) {
                results.errors.push({
                    employee_code: empData.employee_code,
                    row_number: empData._rowNumber,
                    error: error.message
                });
            }
        }

        return results;
    }
}

module.exports = new EmployeeService();
