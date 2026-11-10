const db = require('../config/database');

class BenefitService {
    // 1. Get All Benefit Types
    async getBenefitTypes() {
        const res = await db.query('SELECT * FROM benefit_types WHERE is_active = TRUE ORDER BY category, name');
        return res.rows;
    }

    // 2. Assign Benefit to Employee
    async assignBenefit(data) {
        const { employee_id, benefit_type_id, policy_number, details, start_date, end_date } = data;

        const query = `
            INSERT INTO employee_benefits
            (employee_id, benefit_type_id, policy_number, details, start_date, end_date, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
            RETURNING *
        `;
        const res = await db.query(query, [
            employee_id,
            benefit_type_id,
            policy_number || null,
            details || null,
            start_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
            end_date && String(end_date).trim() !== '' ? end_date : null
        ]);
        return res.rows[0];
    }

    // 3. Get Employee's Active Benefits
    async getEmployeeBenefits(employee_id) {
        const query = `
            SELECT eb.emp_benefit_id, eb.benefit_type_id, eb.policy_number, eb.details,
                   TO_CHAR(eb.start_date, 'YYYY-MM-DD') AS start_date,
                   TO_CHAR(eb.end_date, 'YYYY-MM-DD') AS end_date,
                   eb.status, bt.name, bt.category, bt.description
            FROM employee_benefits eb
            JOIN benefit_types bt ON eb.benefit_type_id = bt.benefit_type_id
            WHERE eb.employee_id = $1 AND eb.status = 'ACTIVE'
            ORDER BY bt.category, bt.name
        `;
        const res = await db.query(query, [employee_id]);
        return res.rows;
    }

    // 3b. Get ALL Assigned Benefits (HR View)
    async getAllAssignedBenefits() {
        const query = `
            SELECT eb.emp_benefit_id, eb.employee_id, eb.benefit_type_id, eb.policy_number, eb.details,
                   TO_CHAR(eb.start_date, 'YYYY-MM-DD') AS start_date,
                   TO_CHAR(eb.end_date, 'YYYY-MM-DD') AS end_date,
                   eb.status,
                   bt.name, bt.category, bt.description,
                   e.first_name, e.last_name, e.employee_code
            FROM employee_benefits eb
            JOIN benefit_types bt ON eb.benefit_type_id = bt.benefit_type_id
            JOIN employees e ON eb.employee_id = e.employee_id
            WHERE eb.status = 'ACTIVE'
            ORDER BY e.employee_code, bt.category
        `;
        const res = await db.query(query);
        return res.rows;
    }

    // 4. Apply for Reimbursement
    async applyReimbursement(data) {
        const { employee_id, benefit_type_id, amount, description, claim_date } = data;
        const parsedAmount = parseFloat(amount);
        if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
            const err = new Error('Claim amount must be greater than zero');
            err.status = 400;
            throw err;
        }

        const query = `
            INSERT INTO reimbursements
            (employee_id, benefit_type_id, amount, description, claim_date, status)
            VALUES ($1, $2, $3, $4, $5, 'PENDING')
            RETURNING *, TO_CHAR(claim_date, 'YYYY-MM-DD') AS claim_date
        `;
        const res = await db.query(query, [
            employee_id,
            benefit_type_id,
            parsedAmount,
            description,
            claim_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        ]);
        return res.rows[0];
    }

    // 5. Get My Reimbursements
    async getMyReimbursements(employee_id) {
        const query = `
            SELECT r.*, TO_CHAR(r.claim_date, 'YYYY-MM-DD') AS claim_date,
                   bt.name AS benefit_name, bt.category
            FROM reimbursements r
            JOIN benefit_types bt ON r.benefit_type_id = bt.benefit_type_id
            WHERE r.employee_id = $1
            ORDER BY r.created_at DESC
        `;
        const res = await db.query(query, [employee_id]);
        return res.rows;
    }

    // 6. Get All Reimbursements (HR View - filtered by status optional)
    async getAllReimbursements(status = null) {
        let query = `
            SELECT r.*, TO_CHAR(r.claim_date, 'YYYY-MM-DD') AS claim_date,
                   bt.name AS benefit_name, bt.category,
                   e.first_name, e.last_name, e.employee_code
            FROM reimbursements r
            JOIN benefit_types bt ON r.benefit_type_id = bt.benefit_type_id
            JOIN employees e ON r.employee_id = e.employee_id
        `;

        const params = [];
        const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'PAID'];
        if (status && validStatuses.includes(String(status).toUpperCase())) {
            query += ` WHERE r.status = $1`;
            params.push(String(status).toUpperCase());
        }

        query += ` ORDER BY r.claim_date DESC, r.claim_id DESC`;

        const res = await db.query(query, params);
        return res.rows;
    }

    async getPendingReimbursements() {
        return this.getAllReimbursements('PENDING');
    }

    // 7. Approve/Reject Reimbursement (HR)
    async updateReimbursementStatus(claim_id, status, approver_id, reason) {
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            const err = new Error('Invalid status');
            err.status = 400;
            throw err;
        }

        const query = `
            UPDATE reimbursements
            SET status = $1, approved_by = $2, rejection_reason = $3, updated_at = CURRENT_TIMESTAMP
            WHERE claim_id = $4
            RETURNING *
        `;
        const res = await db.query(query, [status, approver_id || null, reason || null, claim_id]);
        if (res.rows.length === 0) {
            const err = new Error('Reimbursement claim not found');
            err.status = 404;
            throw err;
        }
        return res.rows[0];
    }

    // 8. Mark as Paid (Finance)
    async markAsPaid(claim_id) {
        const query = `
            UPDATE reimbursements
            SET status = 'PAID', paid_on = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
            WHERE claim_id = $1 AND status = 'APPROVED'
            RETURNING *
        `;
        const res = await db.query(query, [claim_id]);
        if (res.rowCount === 0) {
            const err = new Error('Claim not found or not in APPROVED state');
            err.status = 400;
            throw err;
        }
        return res.rows[0];
    }

    // 9. Insurance Policies Master (GMC, GPA, GTL)
    async getInsurancePolicies() {
        const query = `
            SELECT policy_id, policy_name, policy_type, provider_name, policy_number,
                   sum_insured,
                   TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
                   TO_CHAR(expiry_date, 'YYYY-MM-DD') AS expiry_date,
                   premium_amount, tpa_name, tpa_toll_free, status,
                   CASE
                       WHEN expiry_date < CURRENT_DATE THEN 'EXPIRED'
                       WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'RENEWAL_DUE'
                       ELSE 'ACTIVE'
                   END AS calculated_status,
                   GREATEST(0, (expiry_date - CURRENT_DATE)) AS days_to_expiry
            FROM insurance_policies
            ORDER BY policy_type, expiry_date
        `;
        const res = await db.query(query);
        return res.rows;
    }

    // 10. Employee Dependents Management
    async getEmployeeDependents(employee_id) {
        const query = `
            SELECT *, TO_CHAR(date_of_birth, 'YYYY-MM-DD') AS date_of_birth
            FROM employee_dependents
            WHERE employee_id = $1
            ORDER BY created_at
        `;
        const res = await db.query(query, [employee_id]);
        return res.rows;
    }

    async addEmployeeDependent(data) {
        const { employee_id, full_name, relationship, date_of_birth, gender, is_covered_under_insurance } = data;
        const query = `
            INSERT INTO employee_dependents
            (employee_id, full_name, relationship, date_of_birth, gender, is_covered_under_insurance)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *, TO_CHAR(date_of_birth, 'YYYY-MM-DD') AS date_of_birth
        `;
        const res = await db.query(query, [
            employee_id,
            full_name,
            relationship,
            date_of_birth && String(date_of_birth).trim() !== '' ? date_of_birth : null,
            gender || 'OTHER',
            is_covered_under_insurance !== false
        ]);
        return res.rows[0];
    }

    // 11. Benefits & Insurance MIS Reports (Independent subqueries avoid Cartesian inflation)
    async getBenefitsMISReports() {
        const coverageRes = await db.query(`
            SELECT
                (SELECT COUNT(DISTINCT employee_id)::int FROM employee_benefits WHERE status = 'ACTIVE') AS total_enrolled_employees,
                (SELECT COUNT(*)::int FROM employee_dependents WHERE is_covered_under_insurance = TRUE) AS total_dependents_covered,
                (SELECT COUNT(*)::int FROM insurance_policies WHERE expiry_date >= CURRENT_DATE) AS total_active_policies,
                (SELECT COALESCE(SUM(sum_insured), 0)::numeric FROM insurance_policies WHERE expiry_date >= CURRENT_DATE) AS total_insurance_pool
        `);

        const pendingClaimsRes = await db.query(`
            SELECT
                COUNT(*)::int AS pending_count,
                COALESCE(SUM(amount), 0)::numeric AS pending_amount,
                COALESCE(SUM(CASE WHEN bt.category = 'REIMBURSEMENT' THEN amount ELSE 0 END), 0)::numeric AS reimbursement_pending,
                COALESCE(SUM(CASE WHEN bt.category = 'INSURANCE' THEN amount ELSE 0 END), 0)::numeric AS insurance_pending
            FROM reimbursements r
            JOIN benefit_types bt ON r.benefit_type_id = bt.benefit_type_id
            WHERE r.status = 'PENDING'
        `);

        const utilizationRes = await db.query(`
            SELECT
                bt.name AS benefit_name,
                bt.category,
                COUNT(r.claim_id)::int AS total_claims,
                COALESCE(SUM(r.amount), 0)::numeric AS total_claimed_amount,
                COALESCE(SUM(CASE WHEN r.status IN ('APPROVED', 'PAID') THEN r.amount ELSE 0 END), 0)::numeric AS approved_amount,
                COALESCE(SUM(CASE WHEN r.status = 'PAID' THEN r.amount ELSE 0 END), 0)::numeric AS disbursed_amount
            FROM benefit_types bt
            LEFT JOIN reimbursements r ON bt.benefit_type_id = r.benefit_type_id
            GROUP BY bt.benefit_type_id, bt.name, bt.category
            ORDER BY total_claimed_amount DESC
        `);

        return {
            coverage: coverageRes.rows[0] || {},
            pendingClaims: pendingClaimsRes.rows[0] || {},
            utilization: utilizationRes.rows || []
        };
    }

    async getAllBenefitTypes() {
        return this.getBenefitTypes();
    }

    async getPendingClaims() {
        return this.getPendingReimbursements();
    }

    async getAllClaims(status = null) {
        return this.getAllReimbursements(status);
    }
}

module.exports = new BenefitService();
