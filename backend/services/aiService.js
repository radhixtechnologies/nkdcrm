const db = require('../config/database');

const aiService = {
    // --- 1. AI Assistant / Chatbot Engine ---
    async handleChatMessage(message, context = {}) {
        const text = (message || '').toLowerCase().trim();

        // 1A. Optional Live Cloud LLM Call (if GEMINI_API_KEY is configured in .env)
        if (process.env.GEMINI_API_KEY) {
            try {
                const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `You are the NKD CRM AI Smart Assistant for NKD Power Solutions (Indian Facilities, Substation & Manpower company). Answer concisely with bullet points.\nUser role: ${context.role || 'User'}\nUser asked: "${message}". Indian compliance: EPF 12%, ESIC 0.75%/3.25%, PT ₹200, 194C TDS 1%/2%, 15th monthly ECR deadline. Modules: Attendance, Leaves, Payroll, Benefits, DPR & Site Operations (/dpr), Procurement Tracker (/procurement), Invoices, Vendors, Assets.`
                            }]
                        }]
                    })
                });
                if (response.ok) {
                    const data = await response.json();
                    const geminiReply = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (geminiReply) {
                        return {
                            reply: geminiReply,
                            category: 'LIVE_AI',
                            suggestedActions: [
                                { label: 'Attendance', link: '/attendance' },
                                { label: 'DPR Hub', link: '/dpr' },
                                { label: 'Leaves', link: '/leaves' }
                            ]
                        };
                    }
                }
            } catch (err) {
                console.warn('Gemini API call note, fallback to built-in knowledge base:', err.message);
            }
        }

        // 1B. Built-in Standalone Knowledge Base (100% Free, Zero API cost, Instant)
        if (text.includes('dpr') || text.includes('daily progress') || text.includes('trench') || text.includes('dewater') || text.includes('measurement') || text.includes('concern') || text.includes('tool')) {
            return {
                reply: "📋 **DPR & Site Operations Hub (`/dpr`):**\n- **Daily Progress Reports:** Create site-wise & backdated DPRs with PO billing, today/next-day activities, manpower table, show stoppers, and PDF export.\n- **Concern / Issue Reporting:** Log site blockers & safety issues with severity and responsible agency.\n- **Measurement Sheets:** Track item-wise quantity execution (`L x B x D = Qty`) and billing progress.\n- **Vendor Mapping & Inventory Register:** Manage site vendors plus tools/tackles calibration & TPI validity.",
                category: 'SITE_OPERATIONS',
                suggestedActions: [
                    { label: 'Open DPR Hub', link: '/dpr' },
                    { label: 'Procurement Tracker', link: '/procurement' }
                ]
            };
        }

        if (text.includes('procurement') || text.includes('material') || text.includes('td') || text.includes('dispatch') || text.includes('polycab') || text.includes('cable')) {
            return {
                reply: "📦 **Procurement Tracker (`/procurement`):**\n- Track GTPL & site material lifecycle across **9 stages**: PO Placement, TDS Submission, Approval, Mfg Clearance, Mfg Start/End, Inspection, Dispatch & Site Receipt.\n- Export full Excel supply chain trackers or update Planned vs Actual milestones site-wise.",
                category: 'PROCUREMENT',
                suggestedActions: [
                    { label: 'Procurement Tracker', link: '/procurement' },
                    { label: 'DPR Hub', link: '/dpr' }
                ]
            };
        }

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
                reply: "🏥 **ESIC & Corporate Insurance:**\n- **Eligibility:** Employees earning up to ₹21,000 gross monthly wage.\n- **Employee Contribution:** 0.75% of Gross Wage.\n- **Employer Contribution:** 3.25% of Gross Wage.\n- **Filing Deadline:** 15th of every month. Manage GMC/GPA/GTL insurance & dependents under `/benefits`.",
                category: 'COMPLIANCE',
                suggestedActions: [
                    { label: 'View ESI Report', link: '/reports' },
                    { label: 'Benefits & Insurance', link: '/benefits' }
                ]
            };
        }

        if (text.includes('leave') || text.includes('holiday') || text.includes('balance') || text.includes('apply leave')) {
            return {
                reply: "🏖️ **Leave Management Guidelines:**\n- **Casual Leave (CL):** 12 days per year for personal errands.\n- **Sick Leave (SL):** Up to 12 days upon medical intimation.\n- **Privilege Leave (PL):** 15 days earned leave.\n- Apply directly from the **Leaves** page (`/leaves`); approvals automatically update Daily Attendance.",
                category: 'LEAVE',
                suggestedActions: [
                    { label: 'Apply Leave Now', link: '/leaves' },
                    { label: 'Check Leave Balances', link: '/leaves' }
                ]
            };
        }

        if (text.includes('salary') || text.includes('payslip') || text.includes('payroll') || text.includes('payout')) {
            return {
                reply: "💰 **Salary & Payroll Processing:**\n- Salaries prorate based on paid days against monthly working days (default 26).\n- Standard statutory deductions: PF (12% up to ₹15k basic), ESI (0.75% up to ₹21k gross), PT (₹200), and TDS.\n- Download official PDF Payslips or Excel bank registers from `/payroll`.",
                category: 'PAYROLL',
                suggestedActions: [
                    { label: 'View Payslips', link: '/payroll' },
                    { label: 'Bank Statement', link: '/reports' }
                ]
            };
        }

        if (text.includes('attendance') || text.includes('punch') || text.includes('gps') || text.includes('biometric') || text.includes('check')) {
            return {
                reply: "📍 **Attendance & GPS Punching:**\n- **GPS Punch:** Use Smart Check-In on your Dashboard or `/mobile` to record live IST check-in & check-out with GPS coordinates.\n- **Overnight Shifts:** Checking out next morning automatically closes yesterday's open shift.\n- **Biometric & Muster Import:** Upload Excel registers in `/attendance`.",
                category: 'ATTENDANCE',
                suggestedActions: [
                    { label: 'Daily Attendance', link: '/attendance' },
                    { label: 'Mobile Punch', link: '/mobile' }
                ]
            };
        }

        if (text.includes('invoice') || text.includes('bill') || text.includes('client') || text.includes('gst') || text.includes('tds')) {
            return {
                reply: "📑 **Billing & Invoicing:**\n- Generate deployment invoices in `/invoices` with GST (CGST+SGST or IGST) and Section 194C TDS (1% or 2%).\n- Track pending and overdue receivables across client sites.",
                category: 'BILLING',
                suggestedActions: [
                    { label: 'Open Invoices', link: '/invoices' }
                ]
            };
        }

        if (text.includes('asset') || text.includes('uniform') || text.includes('helmet') || text.includes('laptop')) {
            return {
                reply: "🦺 **Asset Management:**\n- Track Uniforms, Safety Helmets (PPE), Laptops, and Security Gear.\n- Issue assets to employees and log returns/lost/damaged items in `/assets`.",
                category: 'ASSETS',
                suggestedActions: [
                    { label: 'Manage Assets', link: '/assets' }
                ]
            };
        }

        if (text.includes('vendor') || text.includes('contractor') || text.includes('supplier')) {
            return {
                reply: "🤝 **Vendor Management:**\n- Manage manpower, security, uniform, and electrical contractors.\n- Track agreements, expiry alerts, PF/ESIC compliance, and SLA ratings in `/vendors`.",
                category: 'VENDORS',
                suggestedActions: [
                    { label: 'Vendor Directory', link: '/vendors' }
                ]
            };
        }

        return {
            reply: "👋 Hello! I am the **NKD CRM Smart AI Assistant**.\n\nI can help you with:\n1. **Attendance & GPS Punching**\n2. **DPR, Concerns, Measurement & Tools Register**\n3. **GTPL Material Procurement Tracker**\n4. **Leaves, Salary & PDF Payslips**\n5. **PF, ESIC, Client Invoicing & Vendors**\n\nWhat would you like help with?",
            category: 'GENERAL',
            suggestedActions: [
                { label: 'My Dashboard', link: '/' },
                { label: 'DPR Hub', link: '/dpr' },
                { label: 'Attendance', link: '/attendance' }
            ]
        };
    },

    // --- 2. AI Resume Screening Engine ---
    async screenCandidate(candidateId) {
        const candRes = await db.query(`
            SELECT c.*, r.title AS req_title, r.department AS req_dept,
                   r.experience_required, r.job_description
            FROM candidates c
            LEFT JOIN job_requisitions r ON c.requisition_id = r.requisition_id
            WHERE c.candidate_id = $1
        `, [candidateId]);

        if (candRes.rows.length === 0) {
            const err = new Error('Candidate not found');
            err.status = 404;
            throw err;
        }
        const cand = candRes.rows[0];

        let matchScore = 65;
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
            strengths.push(`Previously worked with ${cand.current_company}`);
        }

        matchScore = Math.min(96, Math.max(35, matchScore));

        let recommendation = 'CONSIDER';
        if (matchScore >= 80) recommendation = 'STRONG_HIRE';
        else if (matchScore < 60) recommendation = 'NOT_RECOMMENDED';

        const summary = `AI Candidate Evaluation:\n• ${strengths.join('\n• ')}${gaps.length ? '\n• ' + gaps.join('\n• ') : ''}`;

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
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const daysTo15th = 15 >= currentDay ? (15 - currentDay) : (daysInMonth - currentDay + 15);

        const empRes = await db.query(`
            SELECT
                COUNT(*)::int AS total_active,
                COUNT(CASE WHEN uan_number IS NULL OR uan_number = '' THEN 1 END)::int AS missing_uan,
                COUNT(CASE WHEN esi_number IS NULL OR esi_number = '' THEN 1 END)::int AS missing_esi,
                COUNT(CASE WHEN account_number IS NULL OR account_number = '' THEN 1 END)::int AS missing_bank
            FROM employees
            WHERE employment_status = 'ACTIVE'
        `);
        const stats = empRes.rows[0];

        const licenseRes = await db.query(`
            SELECT COUNT(*)::int AS expired_licenses
            FROM sites
            WHERE labour_license_expiry IS NOT NULL AND labour_license_expiry < CURRENT_DATE
        `);
        const expiredLicenses = licenseRes.rows[0]?.expired_licenses || 0;

        let riskScore = 95;
        const riskFactors = [];

        if (daysTo15th <= 3) {
            riskScore -= 20;
            riskFactors.push(`Critical deadline: Only ${daysTo15th} day(s) remaining for monthly PF/ESIC ECR filing.`);
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
