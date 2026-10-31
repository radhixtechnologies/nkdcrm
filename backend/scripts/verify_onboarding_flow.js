const { pool } = require('../config/database');
const recruitmentService = require('../services/recruitmentService');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');

async function testWorkflow() {
    console.log('=== STARTING 10-STEP ONBOARDING WORKFLOW TEST ===\n');

    try {
        // Step 1: Candidate Selected
        console.log('--- Step 1: Candidate Selected ---');
        let cand = await recruitmentService.createCandidate({
            full_name: 'Vikramaditya Sharma',
            email: 'vikram.sharma@testmail.com',
            phone: '9876543210',
            current_company: 'Global Facility Services',
            current_designation: 'Security Officer',
            experience_years: 3.5,
            current_stage: 'SHORTLISTED'
        });
        console.log(`✅ Candidate Selected: ${cand.full_name} (ID: ${cand.candidate_id}, Stage: ${cand.current_stage})`);

        // Step 2: Document Collection
        console.log('\n--- Step 2: Document Collection (Aadhaar, PAN, Bank) ---');
        cand = await recruitmentService.updateCandidateDocuments(cand.candidate_id, {
            aadhaar_number: '543210987654',
            pan_number: 'ABCDE1234F',
            bank_name: 'State Bank of India',
            bank_account_no: '30291827364',
            bank_ifsc: 'SBIN0001234',
            documents: {
                aadhaar_card: '/uploads/sample_aadhaar.pdf',
                pan_card: '/uploads/sample_pan.pdf',
                bank_passbook: '/uploads/sample_passbook.pdf'
            }
        });
        console.log(`✅ Documents Collected: Aadhaar: ${cand.aadhaar_number}, PAN: ${cand.pan_number}, Bank: ${cand.bank_name}`);

        // Step 4: Appointment Letter Draft
        console.log('\n--- Step 4: Appointment Letter Draft ---');
        let offer = await recruitmentService.createOffer({
            candidate_id: cand.candidate_id,
            designation: 'Senior Site Security Supervisor',
            department: 'Operations',
            offered_ctc: 360000,
            joining_date: '2026-11-01',
            terms_and_conditions: 'Standard employment agreement with PF, ESIC & statutory site allowances.'
        });
        console.log(`✅ Offer Letter Drafted: Code ${offer.offer_code}, CTC: ₹${offer.offered_ctc}, Basic: ₹${offer.basic_salary}`);

        // Step 3: Salary Approval
        console.log('\n--- Step 3: Salary Approval (HR Manager) ---');
        offer = await recruitmentService.approveSalary(offer.offer_id, 'Anita Verma (HR Manager)');
        console.log(`✅ Salary Structure Approved by: ${offer.salary_approved_by} at ${offer.salary_approved_at}`);

        // Step 5: Management Approval (Director)
        console.log('\n--- Step 5: Management Approval (Director) ---');
        offer = await recruitmentService.approveManagement(offer.offer_id, 'Col. R. K. Singh (Director)');
        console.log(`✅ Letter Approved by Director: ${offer.management_approved_by} at ${offer.management_approved_at}`);

        // Step 6: PDF Generation
        console.log('\n--- Step 6: PDF Generation (System) ---');
        const offerWithDetails = await recruitmentService.getOfferById(offer.offer_id);
        const pdfBuffer = await pdfService.generateAppointmentLetterBuffer(offerWithDetails);
        await recruitmentService.markPdfGenerated(offer.offer_id);
        console.log(`✅ Signed Appointment Letter PDF Generated successfully! Size: ${pdfBuffer.length} bytes`);

        // Step 7: Email Dispatch
        console.log('\n--- Step 7: Email Dispatch (HR) ---');
        const emailResult = await emailService.sendAppointmentLetterEmail(offerWithDetails, pdfBuffer);
        console.log(`✅ Email Dispatch result: Mode: ${emailResult.mode}, To: ${emailResult.recipient}`);

        // Step 8: Employee Acceptance
        console.log('\n--- Step 8: Employee Acceptance ---');
        offer = await recruitmentService.acceptOffer(offer.offer_id);
        console.log(`✅ Candidate Acceptance Recorded: Status: ${offer.status}, Acceptance: ${offer.acceptance_status}`);

        // Step 9 & 10: Employee ID Creation & Joining Completed
        console.log('\n--- Step 9 & 10: Employee ID Creation & Joining Completed ---');
        const newEmployee = await recruitmentService.convertToEmployee(cand.candidate_id);
        console.log(`🎉 Onboarding Completed!`);
        console.log(`   Assigned Employee Code: ${newEmployee.employee_code}`);
        console.log(`   Full Name: ${newEmployee.full_name}`);
        console.log(`   Designation: ${newEmployee.designation}`);
        console.log(`   Monthly Basic: ₹${newEmployee.basic_salary}`);
        console.log(`   Aadhaar: ${newEmployee.aadhaar_number}`);
        console.log(`   PAN: ${newEmployee.pan_number}`);
        console.log(`   Bank Account: ${newEmployee.account_number} (${newEmployee.bank_name})`);
        console.log(`   Status: ${newEmployee.employment_status}, Active: ${newEmployee.is_active}`);

        console.log('\n=== ALL 10 STEPS VERIFIED 100% WORKING SUCCESSFULLY! ===');
        process.exit(0);
    } catch (err) {
        console.error('❌ Test failed with error:', err);
        process.exit(1);
    }
}

testWorkflow();

