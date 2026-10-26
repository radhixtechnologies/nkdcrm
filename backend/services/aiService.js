const db = require('../config/database');

const aiService = {
    // --- 1. AI Assistant / Chatbot Engine ---
    async handleChatMessage(message, context = {}) {
        const text = (message || '').toLowerCase().trim();

        // Knowledge Base & Intelligent NLP Matching for HR, Compliance, Payroll & Portal
        if (text.includes('pf') || text.includes('provident fund') || text.includes('uan')) {
            return {
                reply: "📌 **EPF (Provident Fund) Compliance Rules:**\n- **Employee Contribution:** 12% of Basic + DA (capped at ₹15,000 basic = ₹1,800/month).\n- **Employer Contribution:** 12% (3.67% to EPF, 8.33% to EPS).\n- **Filing Deadline:** 15th of every month on the EPFO Unified Portal.\n- Employees must have an active 12-digit UAN linked to Aadhaar & Bank Account.",
                category: 'COMPLIANCE',
                suggestedActions: [
                    { label: 'View PF Report', link: '/reports' },
                    { label: 'Check Missing UANs', link: '/employees' }
                ]
            };
        }

        if (text.includes('esic') || text.includes('esi') || text.includes('insurance')) {
            return {
                reply: "🏥 **ESIC (Employee State Insurance) Rules:**\n- **Eligibility:** Employees earning up to ₹21,000 gross monthly wage.\n- **Employee Contribution:** 0.75% of Gross Wage.\n- **Employer Contribution:** 3.25% of Gross Wage.\n- **Filing Deadline:** 15th of every month. Benefits include medical care, sickness benefit, and maternity relief.",
                category: 'COMPLIANCE',
                suggestedActions: [
                    { label: 'View ESI Report', link: '/reports' }
                ]
            };
        }

        if (text.includes('leave') || text.includes('holiday') || text.includes('balance') || text.includes('apply leave')) {
            return {
                reply: "🏖️ **Leave Management Guidelines:**\n- **Casual Leave (CL):** 12 days per year for personal errands.\n- **Sick Leave (SL):** Up to 10 days upon medical intimation.\n- **Earned Leave (EL/PL):** Accrued on continuous working days.\n- To apply, go to the **Leave** module or click your balance on the Employee Dashboard. Approvals are processed by your site manager.",
                category: 'LEAVE',
                suggestedActions: [
                    { label: 'Apply Leave Now', link: '/leaves' },
                    { label: 'Check Leave Balances', link: '/leaves' }
                ]
            };
        }

        if (text.includes('salary') || text.includes('payslip') || text.includes('payroll') || text.includes('payout')) {
            return {
                reply: "💰 **Salary & Payroll Processing:**\n- Salaries are calculated based on monthly attendance days and shift timings.\n- Proration formula: `(Basic + Allowances) * (Present Days / 26)`.\n- Deductions: PF (12%), ESI (0.75%), PT (₹200), and TDS (if applicable).\n- You can download your official PDF Payslip from the **Payroll** tab.",
                category: 'PAYROLL',
                suggestedActions: [
                    { label: 'View Payslips', link: '/payroll' },
                    { label: 'Bank Statement', link: '/reports' }
                ]
            };
        }

        if (text.includes('attendance') || text.includes('punch') || text.includes('gps') || text.includes('biometric')) {
            return {
                reply: "📍 **Attendance & Punching:**\n- **GPS Punch:** Use the Time Tracker on your Dashboard to Punch-In and Punch-Out with live coordinates.\n- **Biometric Sync:** Site biometric devices upload logs automatically or via excel upload in `/attendance`.\n- Overtime is calculated at 2x hourly rate for hours worked beyond shift timings.",
                category: 'ATTENDANCE',
                suggestedActions: [
                    { label: 'Daily Attendance Register', link: '/attendance' },
                    { label: 'Shift Configuration', link: '/site-shift' }
                ]
            };
        }

        if (text.includes('invoice') || text.includes('bill') || text.includes('client') || text.includes('gst') || text.includes('tds')) {
            return {
                reply: "📑 **Billing & Invoicing:**\n- Generate deployment invoices in `/invoices` with auto-calculated 18% GST (CGST/SGST/IGST).\n- Section 194C TDS (1% for Individual/HUF, 2% for Corporate) is deducted from base value to calculate Net Receivable.\n- Track pending and overdue receivables with aging reports.",
                category: 'BILLING',
                suggestedActions: [
                    { label: 'Open Invoices', link: '/invoices' }
                ]
            };
        }

        if (text.includes('asset') || text.includes('uniform') || text.includes('helmet') || text.includes('laptop')) {
            return {
                reply: "🦺 **Asset Management:**\n- Track company property including Uniforms, Safety Helmets (PPE), Laptops, and Security Gear.\n- Issue assets to employees and record returns, condition checks, and replacements in `/assets`.",
                category: 'ASSETS',
                suggestedActions: [
                    { label: 'Manage Assets', link: '/assets' }
                ]
            };
        }

        if (text.includes('vendor') || text.includes('contractor') || text.includes('supplier')) {
            return {
                reply: "🤝 **Vendor Management:**\n- Manage manpower, security, uniform and hardware vendors.\n- Track contract agreements, statutory compliance certifications, and SLA performance ratings in `/vendors`.",
                category: 'VENDORS',
                suggestedActions: [
                    { label: 'Vendor Directory', link: '/vendors' }
                ]
            };
        }

        // Default friendly AI Response
        return {
            reply: `👋 Hello! I am the **NKD CRM Smart AI Assistant**.\n\nI can help you with:\n1. **Attendance & GPS Punching**\n2. **Leave Balance & Applications**\n3. **Salary & PDF Payslips**\n4. **Statutory PF, ESIC & Labour License Compliance**\n5. **Client Invoicing & 194C TDS**\n6. **Assets & Vendor Agreements**\n\nWhat would you like assistance with today?`,
            category: 'GENERAL',
            suggestedActions: [
                { label: 'My Dashboard', link: '/' },
                { label: 'Attendance', link: '/attendance' },
                { label: 'Leaves', link: '/leaves' }
            ]
        };
    },

    // --- 2. AI Resume Screening Engine ---
    async screenCandidate(candidateId) {
        const candRes = await db.query(`
            SELECT c.*, r.title as req_title, r.department as req_dept,
                   r.experience_required, r.job_description
            FROM candidates c
            LEFT JOIN job_requisitions r ON c.requisition_id = r.requisition_id
            WHERE c.candidate_id = $1
        `, [candidateId]);

        if (candRes.rows.length === 0) throw new Error('Candidate not found');
        const cand = candRes.rows[0];

        // Intelligent Screening Heuristics
        let matchScore = 65; // Base score
        const strengths = [];
        const gaps = [];

        const experienceYears = parseFloat(cand.experience_years) || 0;
        if (experienceYears >= 3) {
            matchScore += 15;
            strengths.push(`${experienceYears} years of verified industry experience`);
        } else if (experienceYears >= 1) {
            matchScore += 8;
            strengths.push('Meets entry-level experience baseline');
        } else {
            gaps.push('Fresh candidate; will require initial supervisor orientation');
        }

        if (cand.current_designation) {
            matchScore += 10;
            strengths.push(`Prior experience as ${cand.current_designation}`);
        }

        if (cand.current_company) {
            matchScore += 5;
            strengths.push(`Currently active with ${cand.current_company}`);
        }

        // Cap score between 30 and 96
        matchScore = Math.min(96, Math.max(35, matchScore));

        let recommendation = 'CONSIDER';
        if (matchScore >= 80) recommendation = 'STRONG_HIRE';
        else if (matchScore < 60) recommendation = 'NOT_RECOMMENDED';

        const summary = `AI Candidate Evaluation:\n• ${strengths.join('\n• ')}${gaps.length ? '\n• ' + gaps.join('\n• ') : ''}`;

        // Save AI screening result into candidate record
        await db.query(`
            UPDATE candidates SET
                ai_match_score = $1,
                ai_recommendation = $2,
                ai_screening_summary = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE candidate_id = $4
        `, [matchScore, recommendation, summary, candidateId]);

        return {
            candidate_id: candidateId,
            match_score: matchScore,
            recommendation,
            summary
        };
    },

    // --- 3. AI Predictive Compliance Health Score ---
    async getPredictiveCompliance() {
        const today = new Date();
        const currentDay = today.getDate();
        const daysTo15th = 15 >= currentDay ? 15 - currentDay : (30 - currentDay + 15);

        // Fetch counts
        const empRes = await db.query(`
            SELECT
                COUNT(*)::int as total_active,
                COUNT(CASE WHEN uan_number IS NULL OR uan_number = '' THEN 1 END)::int as missing_uan,
                COUNT(CASE WHEN esi_number IS NULL OR esi_number = '' THEN 1 END)::int as missing_esi,
                COUNT(CASE WHEN account_number IS NULL OR account_number = '' THEN 1 END)::int as missing_bank
            FROM employees
            WHERE employment_status = 'ACTIVE'
        `);
        const stats = empRes.rows[0];

        const licenseRes = await db.query(`
            SELECT COUNT(*)::int as expired_licenses
            FROM sites
            WHERE labour_license_expiry IS NOT NULL AND labour_license_expiry < CURRENT_DATE
        `);
        const expiredLicenses = licenseRes.rows[0]?.expired_licenses || 0;

        let riskScore = 95; // Start with healthy 95%
        const riskFactors = [];

        if (daysTo15th <= 3) {
            riskScore -= 20;
            riskFactors.push(`Critical deadline: Only ${daysTo15th} days remaining for monthly PF/ESIC ECR filing.`);
        } else if (daysTo15th <= 7) {
            riskScore -= 8;
            riskFactors.push(`${daysTo15th} days to PF/ESIC monthly statutory deadline.`);
        }

        if (stats.missing_uan > 0) {
            const deduction = Math.min(25, stats.missing_uan * 5);
            riskScore -= deduction;
            riskFactors.push(`${stats.missing_uan} employee(s) have unlinked UAN numbers.`);
        }

        if (stats.missing_bank > 0) {
            const deduction = Math.min(15, stats.missing_bank * 3);
            riskScore -= deduction;
            riskFactors.push(`${stats.missing_bank} employee(s) missing bank disbursement details.`);
        }

        if (expiredLicenses > 0) {
            riskScore -= 25;
            riskFactors.push(`${expiredLicenses} deployment site(s) operating with expired Labour License under CLRA.`);
        }

        riskScore = Math.max(20, Math.min(100, riskScore));

        let riskLevel = 'LOW_RISK';
        if (riskScore < 60) riskLevel = 'HIGH_RISK';
        else if (riskScore < 80) riskLevel = 'MODERATE_RISK';

        return {
            compliance_health_score: riskScore,
            risk_level: riskLevel,
            days_to_pf_esic_deadline: daysTo15th,
            risk_factors: riskFactors,
            total_active_staff: stats.total_active
        };
    }
};

module.exports = aiService;

