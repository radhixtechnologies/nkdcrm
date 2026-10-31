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

        // Check if already assigned active benefit of same type?
        // Let's allow multiple if needed (e.g. 2 policies), but usually unique per type.
        // For simplicity, just insert.

        const query = `
            INSERT INTO employee_benefits 
            (employee_id, benefit_type_id, policy_number, details, start_date, end_date, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
            RETURNING *
        `;
        const res = await db.query(query, [employee_id, benefit_type_id, policy_number, details, start_date, end_date]);
        return res.rows[0];
    }

    // 3. Get Employee's Active Benefits
    async getEmployeeBenefits(employee_id) {
        const query = `
            SELECT eb.emp_benefit_id, eb.benefit_type_id, eb.policy_number, eb.details, eb.start_date, eb.end_date, eb.status, bt.name, bt.category, bt.description
            FROM employee_benefits eb
            JOIN benefit_types bt ON eb.benefit_type_id = bt.benefit_type_id
            WHERE eb.employee_id = $1 AND eb.status = 'ACTIVE'
            ORDER BY bt.category
        `;
        const res = await db.query(query, [employee_id]);
        return res.rows;
    }

    // 3b. Get ALL Assigned Benefits (HR View)
    async getAllAssignedBenefits() {
        const query = `
            SELECT eb.emp_benefit_id, eb.benefit_type_id, eb.policy_number, eb.details, eb.start_date, eb.end_date, eb.status, 
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

        // Validate if employee has this benefit assigned?
        // Not strictly required for all types (e.g., universal travel allowance), 
        // but good practice. For now, we trust the UI/Input.

        const query = `
            INSERT INTO reimbursements 
            (employee_id, benefit_type_id, amount, description, claim_date, status)
            VALUES ($1, $2, $3, $4, $5, 'PENDING')
            RETURNING *
        `;
        const res = await db.query(query, [employee_id, benefit_type_id, amount, description, claim_date || new Date()]);
        return res.rows[0];
    }

    // 5. Get My Reimbursements
    async getMyReimbursements(employee_id) {
        const query = `
            SELECT r.*, bt.name as benefit_name, bt.category
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
            SELECT r.*, bt.name as benefit_name, bt.category, 
                   e.first_name, e.last_name, e.employee_code
            FROM reimbursements r
            JOIN benefit_types bt ON r.benefit_type_id = bt.benefit_type_id
            JOIN employees e ON r.employee_id = e.employee_id
        `;

        const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'PAID'];
        if (status && validStatuses.includes(status.toUpperCase())) {
            query += ` WHERE r.status = '${status.toUpperCase()}'`;
        }

        query += ` ORDER BY r.claim_date DESC`; // Newest first

        const res = await db.query(query);
        return res.rows;
    }

    // Legacy support alias if needed, or keeps as specific helper
    async getPendingReimbursements() {
        return this.getAllReimbursements('PENDING');
    }

    // 7. Approve/Reject Reimbursement (HR)
    async updateReimbursementStatus(claim_id, status, approver_id, reason) {
        // Status: APPROVED, REJECTED
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            throw new Error('Invalid status');
        }

        const query = `
            UPDATE reimbursements 
            SET status = $1, approved_by = $2, rejection_reason = $3, updated_at = CURRENT_TIMESTAMP
            WHERE claim_id = $4
            RETURNING *
        `;
        const res = await db.query(query, [status, approver_id, reason, claim_id]);
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
            throw new Error('Claim not found or not in APPROVED state');
        }
        return res.rows[0];
    }

    // 9. Insurance Policies Master (GMC, GPA, GTL)
    async getInsurancePolicies() {
        const query = `
            SELECT policy_id, policy_name, policy_type, provider_name, policy_number, 
                   sum_insured, start_date, expiry_date, premium_amount, tpa_name, tpa_toll_free, status,
                   CASE 
                       WHEN expiry_date < CURRENT_DATE THEN 'EXPIRED'
                       WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'RENEWAL_DUE'
                       ELSE 'ACTIVE'
                   END as calculated_status,
                   GREATEST(0, (expiry_date - CURRENT_DATE)) as days_to_expiry
            FROM insurance_policies
            ORDER BY policy_type, expiry_date
        `;
        const res = await db.query(query);
        return res.rows;
    }

    // 10. Employee Dependents Management
    async getEmployeeDependents(employee_id) {
        const query = `
            SELECT * FROM employee_dependents
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
            RETURNING *
        `;
        const res = await db.query(query, [
            employee_id, full_name, relationship, date_of_birth || null, gender || 'OTHER', is_covered_under_insurance !== false
        ]);
        return res.rows[0];
    }

    // 11. Benefits & Insurance MIS Reports (Coverage, Pending Claims, Utilization)
    async getBenefitsMISReports() {
        // A. Coverage Stats
        const coverageRes = await db.query(`
            SELECT 
                COUNT(DISTINCT eb.employee_id)::int as total_enrolled_employees,
                COUNT(DISTINCT ed.dependent_id)::int as total_dependents_covered,
                COUNT(DISTINCT ip.policy_id)::int as total_active_policies,
                COALESCE(SUM(ip.sum_insured), 0)::numeric as total_insurance_pool
            FROM insurance_policies ip
            LEFT JOIN employee_benefits eb ON eb.status = 'ACTIVE'
            LEFT JOIN employee_dependents ed ON ed.is_covered_under_insurance = TRUE
        `);

        // B. Pending Claims Summary
        const pendingClaimsRes = await db.query(`
            SELECT 
                COUNT(*)::int as pending_count,
                COALESCE(SUM(amount), 0)::numeric as pending_amount,
                COALESCE(SUM(CASE WHEN bt.category = 'REIMBURSEMENT' THEN amount ELSE 0 END), 0)::numeric as reimbursement_pending,
                COALESCE(SUM(CASE WHEN bt.category = 'INSURANCE' THEN amount ELSE 0 END), 0)::numeric as insurance_pending
            FROM reimbursements r
            JOIN benefit_types bt ON r.benefit_type_id = bt.benefit_type_id
            WHERE r.status = 'PENDING'
        `);

        // C. Utilization by Category
        const utilizationRes = await db.query(`
            SELECT 
                bt.name as benefit_name,
                bt.category,
                COUNT(r.claim_id)::int as total_claims,
                COALESCE(SUM(r.amount), 0)::numeric as total_claimed_amount,
                COALESCE(SUM(CASE WHEN r.status IN ('APPROVED', 'PAID') THEN r.amount ELSE 0 END), 0)::numeric as approved_amount,
                COALESCE(SUM(CASE WHEN r.status = 'PAID' THEN r.amount ELSE 0 END), 0)::numeric as disbursed_amount
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

    // Aliases for compatibility
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
