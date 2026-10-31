const db = require('../config/database');

const recruitmentService = {
    // --- 1. Job Requisitions ---
    async getRequisitions() {
        const query = `
            SELECT r.*,
                   COUNT(c.candidate_id)::int as total_candidates,
                   COUNT(CASE WHEN c.current_stage = 'INTERVIEW_SCHEDULED' THEN 1 END)::int as in_interview,
                   COUNT(CASE WHEN c.current_stage = 'HIRED' THEN 1 END)::int as hired_count
            FROM job_requisitions r
            LEFT JOIN candidates c ON c.requisition_id = r.requisition_id
            GROUP BY r.requisition_id
            ORDER BY r.created_at DESC
        `;
        const res = await db.query(query);
        return res.rows;
    },

    async createRequisition(data) {
        const code = `REQ-${Date.now().toString().slice(-5)}`;
        const query = `
            INSERT INTO job_requisitions (
                requisition_code, title, department, job_location, vacancies,
                experience_required, min_salary, max_salary, employment_type, status, job_description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `;
        const params = [
            code,
            data.title,
            data.department,
            data.job_location || 'Head Office',
            parseInt(data.vacancies) || 1,
            data.experience_required || '1-3 Years',
            parseFloat(data.min_salary) || 0,
            parseFloat(data.max_salary) || 0,
            data.employment_type || 'FULL_TIME',
            data.status || 'OPEN',
            data.job_description || null
        ];
        const res = await db.query(query, params);
        return res.rows[0];
    },

    async updateRequisition(id, data) {
        const query = `
            UPDATE job_requisitions SET
                title = COALESCE($1, title),
                department = COALESCE($2, department),
                job_location = COALESCE($3, job_location),
                vacancies = COALESCE($4, vacancies),
                experience_required = COALESCE($5, experience_required),
                min_salary = COALESCE($6, min_salary),
                max_salary = COALESCE($7, max_salary),
                employment_type = COALESCE($8, employment_type),
                status = COALESCE($9, status),
                job_description = COALESCE($10, job_description),
                updated_at = CURRENT_TIMESTAMP
            WHERE requisition_id = $11
            RETURNING *
        `;
        const params = [
            data.title, data.department, data.job_location,
            data.vacancies ? parseInt(data.vacancies) : null,
            data.experience_required, data.min_salary, data.max_salary,
            data.employment_type, data.status, data.job_description, id
        ];
        const res = await db.query(query, params);
        return res.rows[0];
    },

    // --- 2. Candidates & Interviews ---
    async getCandidates(filters = {}) {
        let query = `
            SELECT c.*, 
                   r.title as requisition_title, r.requisition_code, r.department,
                   o.offer_id, o.offer_code, o.status as offer_status, o.offered_ctc, o.joining_date
            FROM candidates c
            LEFT JOIN job_requisitions r ON c.requisition_id = r.requisition_id
            LEFT JOIN offer_letters o ON o.candidate_id = c.candidate_id
            WHERE 1=1
        `;
        const params = [];

        if (filters.stage && filters.stage !== 'ALL') {
            params.push(filters.stage);
            query += ` AND c.current_stage = $${params.length}`;
        }
        if (filters.requisitionId) {
            params.push(filters.requisitionId);
            query += ` AND c.requisition_id = $${params.length}`;
        }

        query += ` ORDER BY c.created_at DESC`;
        const res = await db.query(query, params);
        return res.rows;
    },

    async createCandidate(data) {
        const query = `
            INSERT INTO candidates (
                requisition_id, full_name, email, phone, current_company,
                current_designation, experience_years, current_stage,
                interview_date, interviewer_name, interview_feedback, rating, resume_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `;
        const params = [
            data.requisition_id || null,
            data.full_name,
            data.email,
            data.phone,
            data.current_company || null,
            data.current_designation || null,
            parseFloat(data.experience_years) || 0,
            data.current_stage || 'APPLIED',
            data.interview_date || null,
            data.interviewer_name || null,
            data.interview_feedback || null,
            data.rating ? parseInt(data.rating) : null,
            data.resume_url || null
        ];
        const res = await db.query(query, params);
        return res.rows[0];
    },

    async updateCandidateStage(candidateId, stage, feedbackData = {}) {
        const query = `
            UPDATE candidates SET
                current_stage = $1,
                interview_date = COALESCE($2, interview_date),
                interviewer_name = COALESCE($3, interviewer_name),
                interview_feedback = COALESCE($4, interview_feedback),
                rating = COALESCE($5, rating),
                updated_at = CURRENT_TIMESTAMP
            WHERE candidate_id = $6
            RETURNING *
        `;
        const res = await db.query(query, [
            stage,
            feedbackData.interview_date || null,
            feedbackData.interviewer_name || null,
            feedbackData.interview_feedback || null,
            feedbackData.rating ? parseInt(feedbackData.rating) : null,
            candidateId
        ]);
        return res.rows[0];
    },

    // --- 3. Offer Letters ---
    async getOffers() {
        const query = `
            SELECT o.*,
                   c.full_name as candidate_name, c.email as candidate_email, c.phone as candidate_phone,
                   c.aadhaar_number, c.pan_number, c.bank_name, c.bank_account_no, c.bank_ifsc, c.documents as candidate_documents,
                   s.site_name, s.site_code
            FROM offer_letters o
            JOIN candidates c ON o.candidate_id = c.candidate_id
            LEFT JOIN sites s ON o.site_id = s.site_id
            ORDER BY o.created_at DESC
        `;
        const res = await db.query(query);
        return res.rows;
    },

    async getOfferById(offerId) {
        const query = `
            SELECT o.*,
                   c.full_name as candidate_name, c.email as candidate_email, c.phone as candidate_phone,
                   c.aadhaar_number, c.pan_number, c.bank_name, c.bank_account_no, c.bank_ifsc, c.documents as candidate_documents,
                   s.site_name, s.site_code
            FROM offer_letters o
            JOIN candidates c ON o.candidate_id = c.candidate_id
            LEFT JOIN sites s ON o.site_id = s.site_id
            WHERE o.offer_id = $1
        `;
        const res = await db.query(query, [offerId]);
        return res.rows[0];
    },

    async createOffer(data) {
        const offerCode = `OFR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
        const annualCTC = parseFloat(data.offered_ctc) || 0;
        const monthlyGross = Math.round(annualCTC / 12);
        const basic = Math.round(monthlyGross * 0.50);
        const hra = Math.round(monthlyGross * 0.30);
        const special = Math.max(0, monthlyGross - basic - hra);

        const query = `
            INSERT INTO offer_letters (
                offer_code, candidate_id, designation, department,
                site_id, offered_ctc, basic_salary, hra, special_allowance,
                joining_date, status, terms_and_conditions
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `;
        const params = [
            offerCode,
            data.candidate_id,
            data.designation,
            data.department,
            data.site_id || null,
            annualCTC,
            basic,
            hra,
            special,
            data.joining_date,
            data.status || 'OFFERED',
            data.terms_and_conditions || 'Standard company employment agreement and statutory benefits apply.'
        ];
        const res = await db.query(query, params);

        // Update candidate stage to OFFER_EXTENDED
        await db.query(
            "UPDATE candidates SET current_stage = 'OFFER_EXTENDED', updated_at = CURRENT_TIMESTAMP WHERE candidate_id = $1",
            [data.candidate_id]
        );

        return res.rows[0];
    },

    async approveSalary(offerId, approver = 'HR Manager') {
        const query = `
            UPDATE offer_letters SET
                salary_approved_by = $1,
                salary_approved_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE offer_id = $2
            RETURNING *
        `;
        const res = await db.query(query, [approver, offerId]);
        return res.rows[0];
    },

    async approveManagement(offerId, approver = 'Director') {
        const query = `
            UPDATE offer_letters SET
                management_approved_by = $1,
                management_approved_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE offer_id = $2
            RETURNING *
        `;
        const res = await db.query(query, [approver, offerId]);
        return res.rows[0];
    },

    async markPdfGenerated(offerId) {
        const query = `
            UPDATE offer_letters SET
                pdf_generated_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE offer_id = $1
            RETURNING *
        `;
        const res = await db.query(query, [offerId]);
        return res.rows[0];
    },

    async dispatchEmail(offerId) {
        const offer = await this.getOfferById(offerId);
        if (!offer) throw new Error('Offer letter not found');

        const pdfService = require('./pdfService');
        const emailService = require('./emailService');
        const pdfBuffer = await pdfService.generateAppointmentLetterBuffer(offer);

        const dispatchResult = await emailService.sendAppointmentLetterEmail(offer, pdfBuffer);

        const query = `
            UPDATE offer_letters SET
                email_dispatched_at = CURRENT_TIMESTAMP,
                email_dispatch_status = 'SENT',
                updated_at = CURRENT_TIMESTAMP
            WHERE offer_id = $1
            RETURNING *
        `;
        await db.query(query, [offerId]);

        return {
            ...dispatchResult,
            offer_id: offerId,
            offer_code: offer.offer_code
        };
    },

    async acceptOffer(offerId) {
        const query = `
            UPDATE offer_letters SET
                acceptance_status = 'ACCEPTED',
                status = 'ACCEPTED',
                acceptance_date = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE offer_id = $1
            RETURNING *
        `;
        const res = await db.query(query, [offerId]);
        const offer = res.rows[0];
        if (offer?.candidate_id) {
            await db.query(
                "UPDATE candidates SET current_stage = 'HIRED', updated_at = CURRENT_TIMESTAMP WHERE candidate_id = $1",
                [offer.candidate_id]
            );
        }
        return offer;
    },

    async updateCandidateDocuments(candidateId, data) {
        const query = `
            UPDATE candidates SET
                aadhaar_number = COALESCE($1, aadhaar_number),
                pan_number = COALESCE($2, pan_number),
                bank_name = COALESCE($3, bank_name),
                bank_account_no = COALESCE($4, bank_account_no),
                bank_ifsc = COALESCE($5, bank_ifsc),
                documents = COALESCE($6, documents),
                updated_at = CURRENT_TIMESTAMP
            WHERE candidate_id = $7
            RETURNING *
        `;
        const res = await db.query(query, [
            data.aadhaar_number || null,
            data.pan_number || null,
            data.bank_name || null,
            data.bank_account_no || null,
            data.bank_ifsc || null,
            data.documents ? JSON.stringify(data.documents) : null,
            candidateId
        ]);
        return res.rows[0];
    },

    async updateOfferStatus(offerId, status) {
        const query = `
            UPDATE offer_letters SET
                status = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE offer_id = $2
            RETURNING *
        `;
        const res = await db.query(query, [status, offerId]);
        const offer = res.rows[0];

        if (status === 'ACCEPTED' && offer?.candidate_id) {
            await db.query(
                "UPDATE candidates SET current_stage = 'HIRED', updated_at = CURRENT_TIMESTAMP WHERE candidate_id = $1",
                [offer.candidate_id]
            );
        }
        return offer;
    },

    // --- 4. Convert Candidate directly to Employee (1-Click Onboarding) ---
    async convertToEmployee(candidateId, employeePayload = {}) {
        // Fetch candidate details
        const candRes = await db.query("SELECT * FROM candidates WHERE candidate_id = $1", [candidateId]);
        if (candRes.rows.length === 0) throw new Error("Candidate not found");
        const candidate = candRes.rows[0];

        // Fetch offer details if any
        const offerRes = await db.query("SELECT * FROM offer_letters WHERE candidate_id = $1 ORDER BY created_at DESC LIMIT 1", [candidateId]);
        const offer = offerRes.rows[0] || {};

        // Generate next employee code
        const seqRes = await db.query("SELECT nextval('employee_code_seq') as seq");
        const nextVal = seqRes.rows[0]?.seq || Math.floor(Math.random() * 900000 + 100000);
        const employeeCode = `EMP-${String(nextVal).padStart(6, '0')}`;

        const nameParts = candidate.full_name.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        const basicSalary = offer.basic_salary ? parseFloat(offer.basic_salary) : (offer.offered_ctc ? Math.round(parseFloat(offer.offered_ctc) / 24) : 25000);

        const panNumber = candidate.pan_number || employeePayload.pan_number || null;
        const aadhaarNumber = candidate.aadhaar_number || employeePayload.aadhaar_number || null;
        const bankName = candidate.bank_name || employeePayload.bank_name || null;
        const accountNumber = candidate.bank_account_no || employeePayload.account_number || null;
        const ifscCode = candidate.bank_ifsc || employeePayload.ifsc_code || null;
        const docs = candidate.documents || employeePayload.documents || {};

        const insertQuery = `
            INSERT INTO employees (
                employee_code, first_name, last_name, full_name, email, mobile,
                designation, department, site_id, basic_salary, date_of_joining,
                pan_number, aadhaar_number, bank_name, account_number, ifsc_code, documents,
                employment_status, employment_type, wage_type, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'ACTIVE', 'PERMANENT', 'MONTHLY', TRUE)
            RETURNING *
        `;

        const newEmp = await db.query(insertQuery, [
            employeeCode,
            firstName,
            lastName,
            candidate.full_name,
            candidate.email,
            candidate.phone,
            offer.designation || candidate.current_designation || 'Staff',
            offer.department || 'Operations',
            offer.site_id || null,
            basicSalary,
            offer.joining_date || new Date().toISOString().split('T')[0],
            panNumber,
            aadhaarNumber,
            bankName,
            accountNumber,
            ifscCode,
            JSON.stringify(docs)
        ]);

        // Mark candidate as HIRED
        await db.query("UPDATE candidates SET current_stage = 'HIRED', updated_at = CURRENT_TIMESTAMP WHERE candidate_id = $1", [candidateId]);
        if (offer.offer_id) {
            await db.query("UPDATE offer_letters SET status = 'JOINED', acceptance_status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP WHERE offer_id = $1", [offer.offer_id]);
        }

        return newEmp.rows[0];
    }
};

module.exports = recruitmentService;

