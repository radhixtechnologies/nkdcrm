const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const numberToWords = (num) => {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const n = Math.floor(Math.abs(Number(num) || 0));
    if (n === 0) return 'Zero';

    function inWords(n) {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + a[n % 10] : '');
        if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + inWords(n % 100) : '');
        if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
        if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
        return inWords(Math.floor(n / 10000000)) + ' Crore';
    }

    return inWords(n);
};

class PDFService {
    generatePayslip(payroll, employee, res) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=Payslip_${employee.employee_code || 'EMP'}_${payroll.month}_${payroll.year}.pdf`);

                doc.pipe(res);

                // --- HEADER ---
                doc.fontSize(18).font('Helvetica-Bold').text('NKD POWER SOLUTIONS PVT LTD', { align: 'center' });
                doc.fontSize(9.5).font('Helvetica').text('Corporate Office: Sector 62, Noida, Uttar Pradesh - 201301 | Navi Mumbai Operations', { align: 'center' });
                doc.moveDown(0.8);
                doc.fontSize(15).font('Helvetica-Bold').text('PAYSLIP', { align: 'center', underline: true });
                doc.fontSize(11).font('Helvetica').text(`For the month of: ${this.getMonthName(payroll.month)} ${payroll.year}`, { align: 'center' });
                doc.moveDown();

                // --- EMPLOYEE DETAILS ---
                doc.rect(50, 150, 500, 82).stroke();

                const leftX = 60;
                const rightX = 310;
                let y = 160;

                const fullName = employee.full_name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Employee';
                const dojText = employee.date_of_joining
                    ? new Date(employee.date_of_joining).toLocaleDateString('en-IN')
                    : 'N/A';

                doc.fontSize(10);
                doc.text(`Employee Name: ${fullName}`, leftX, y);
                doc.text(`Employee Code: ${employee.employee_code || 'N/A'}`, rightX, y);
                y += 16;
                doc.text(`Designation: ${employee.designation || 'N/A'}`, leftX, y);
                doc.text(`Department: ${employee.department || 'N/A'}`, rightX, y);
                y += 16;
                doc.text(`Date of Joining: ${dojText}`, leftX, y);
                doc.text(`Bank Account: ${employee.account_number || 'N/A'}`, rightX, y);
                y += 16;
                doc.text(`PF UAN: ${employee.uan_number || 'N/A'}`, leftX, y);
                doc.text(`ESI No: ${employee.esi_number || 'N/A'}`, rightX, y);

                // --- ATTENDANCE ---
                y = 250;
                const paidDays = (parseFloat(payroll.present_days || 0) || 0)
                    + (parseFloat(payroll.weekly_off_days || 0) || 0)
                    + (parseFloat(payroll.leave_days || 0) || 0);
                doc.text(
                    `Total Days: ${payroll.total_days || 30} | Paid Days: ${paidDays} | Absent: ${payroll.absent_days || 0}`,
                    50, y, { align: 'center', width: 500 }
                );

                // --- SALARY TABLE ---
                y = 280;
                const col1 = 50;
                const col2 = 195;
                const col3 = 335;
                const col4 = 470;

                doc.font('Helvetica-Bold');
                doc.text('EARNINGS', col1, y);
                doc.text('AMOUNT (INR)', col2, y, { width: 100, align: 'right' });
                doc.text('DEDUCTIONS', col3, y);
                doc.text('AMOUNT (INR)', col4, y, { width: 80, align: 'right' });

                doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
                y += 25;
                doc.font('Helvetica');

                const earnings = [
                    { label: 'Basic Salary', value: payroll.basic_earned },
                    { label: 'HRA', value: payroll.hra_earned },
                    { label: 'Conveyance', value: payroll.conveyance_earned },
                    { label: 'Special Allowance', value: payroll.special_allowance_earned },
                    { label: 'Other Allowance', value: payroll.other_allowance_earned },
                    { label: 'Overtime', value: payroll.overtime_amount }
                ];

                const deductions = [
                    { label: 'Provident Fund', value: payroll.pf_employee },
                    { label: 'ESI', value: payroll.esi_employee },
                    { label: 'Professional Tax', value: payroll.professional_tax },
                    { label: 'TDS', value: payroll.tds },
                    { label: 'Advance/Loan', value: payroll.advance_deduction },
                    { label: 'Other Deductions', value: payroll.other_deductions }
                ];

                const maxRows = Math.max(earnings.length, deductions.length);

                for (let i = 0; i < maxRows; i++) {
                    const earn = earnings[i] || { label: '', value: '' };
                    const ded = deductions[i] || { label: '', value: '' };

                    if (earn.label) {
                        doc.text(earn.label, col1, y);
                        doc.text((parseFloat(earn.value || 0) || 0).toFixed(2), col2, y, { width: 100, align: 'right' });
                    }

                    if (ded.label) {
                        doc.text(ded.label, col3, y);
                        doc.text((parseFloat(ded.value || 0) || 0).toFixed(2), col4, y, { width: 80, align: 'right' });
                    }
                    y += 16;
                }

                doc.moveTo(50, y + 8).lineTo(550, y + 8).stroke();
                y += 18;

                doc.font('Helvetica-Bold');
                doc.text('Total Earnings', col1, y);
                doc.text((parseFloat(payroll.gross_earnings || 0) || 0).toFixed(2), col2, y, { width: 100, align: 'right' });

                doc.text('Total Deductions', col3, y);
                doc.text((parseFloat(payroll.total_deductions || 0) || 0).toFixed(2), col4, y, { width: 80, align: 'right' });

                y += 30;
                doc.rect(50, y, 500, 40).fillAndStroke('#f0f4f8', '#334155');
                doc.fillColor('#0f172a');
                doc.fontSize(13).text(`NET SALARY PAYABLE: Rs. ${(parseFloat(payroll.net_salary || 0) || 0).toFixed(2)}`, 60, y + 13);

                doc.fontSize(9.5).font('Helvetica').fillColor('#64748b').text(
                    'This is a computer-generated payslip and does not require a physical signature.',
                    50, y + 65, { align: 'center', width: 500 }
                );

                doc.end();
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    generateAppointmentLetter(offer, res) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 40, size: 'A4' });

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename=Appointment_Letter_${offer.offer_code || 'OFR'}.pdf`);

                doc.pipe(res);
                this.buildAppointmentLetterDoc(offer, doc);
                doc.end();
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    generateAppointmentLetterBuffer(offer) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 40, size: 'A4' });
                const buffers = [];

                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                this.buildAppointmentLetterDoc(offer, doc);
                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    buildAppointmentLetterDoc(offer, doc) {
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e293b').text('NKD POWER SOLUTIONS PVT LTD', { align: 'center' });
        doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('Corporate Office: Sector 62, Noida, Uttar Pradesh - 201301', { align: 'center' });
        doc.text('CIN: U74999UP2020PTC123456 | GSTIN: 09AAACN1234F1Z5 | hr@nkdpowersolutions.com', { align: 'center' });
        doc.moveDown(0.8);

        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cbd5e1').lineWidth(1.5).stroke();
        doc.moveDown(1);

        doc.fontSize(14).font('Helvetica-Bold').fillColor('#0f172a').text('FORMAL APPOINTMENT / OFFER LETTER', { align: 'center' });
        doc.moveDown(0.6);

        const startY = doc.y;
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#334155').text(`Ref No: ${offer.offer_code || 'OFR-2026-001'}`, 45, startY);
        doc.font('Helvetica').text(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 380, startY, { align: 'right', width: 170 });
        doc.moveDown(1.5);

        doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(9.5).text('To,', 45);
        doc.text(`${offer.candidate_name || 'Candidate'}`);
        doc.font('Helvetica').fillColor('#475569');
        if (offer.candidate_email) doc.text(`Email: ${offer.candidate_email}`);
        if (offer.candidate_phone) doc.text(`Phone: ${offer.candidate_phone}`);
        doc.moveDown(0.8);

        doc.font('Helvetica-Bold').fillColor('#0f172a').text(`Subject: Appointment Letter for the post of ${offer.designation}`);
        doc.moveDown(0.5);
        doc.font('Helvetica').fillColor('#1e293b').text(`Dear ${offer.candidate_name || 'Candidate'},`);
        doc.moveDown(0.4);

        doc.text(
            `With reference to your application and interview, we are pleased to appoint you as ${offer.designation} in the ${offer.department || 'Operations'} Department. Your primary deployment will be at ${offer.site_name || 'Assigned Client Site / Headquarters'}.`,
            { align: 'justify', lineGap: 2.5 }
        );
        doc.moveDown(0.4);
        doc.text(
            `Your appointment takes effect from your joining date: ${offer.joining_date ? new Date(offer.joining_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Immediately'}.`,
            { align: 'justify', lineGap: 2.5 }
        );
        doc.moveDown(0.8);

        const annualCTC = parseFloat(offer.offered_ctc) || 0;
        const monthlyGross = Math.round(annualCTC / 12);
        const basicMonthly = parseFloat(offer.basic_salary) || Math.round(monthlyGross * 0.50);
        const hraMonthly = parseFloat(offer.hra) || Math.round(monthlyGross * 0.30);
        const specialAllowance = parseFloat(offer.special_allowance) || Math.max(0, monthlyGross - basicMonthly - hraMonthly);

        doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text('Compensation & Salary Structure (Annual CTC: INR ' + annualCTC.toLocaleString('en-IN') + '):');
        doc.moveDown(0.4);

        const tableTopY = doc.y;
        let tableY = tableTopY;
        doc.rect(45, tableY, 510, 18).fill('#f1f5f9');
        doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8.5);
        doc.text('Salary Component', 55, tableY + 5);
        doc.text('Monthly (INR)', 280, tableY + 5, { width: 110, align: 'right' });
        doc.text('Annual (INR)', 420, tableY + 5, { width: 110, align: 'right' });

        tableY += 18;
        const rows = [
            { comp: 'Basic Salary', m: basicMonthly, a: basicMonthly * 12 },
            { comp: 'House Rent Allowance (HRA)', m: hraMonthly, a: hraMonthly * 12 },
            { comp: 'Special / Site Allowance', m: specialAllowance, a: specialAllowance * 12 },
            { comp: 'Statutory Benefits (PF, ESIC, Gratuity)', m: 'As per Act', a: 'As per Act' },
            { comp: 'Gross Total Compensation', m: monthlyGross, a: annualCTC, isBold: true }
        ];

        rows.forEach((r, idx) => {
            if (r.isBold) {
                doc.rect(45, tableY, 510, 18).fill('#e2e8f0');
                doc.fillColor('#0f172a').font('Helvetica-Bold');
            } else {
                if (idx % 2 === 1) doc.rect(45, tableY, 510, 18).fill('#f8fafc');
                doc.fillColor('#334155').font('Helvetica');
            }
            doc.text(r.comp, 55, tableY + 4);
            doc.text(typeof r.m === 'number' ? `Rs. ${r.m.toLocaleString('en-IN')}` : r.m, 280, tableY + 4, { width: 110, align: 'right' });
            doc.text(typeof r.a === 'number' ? `Rs. ${r.a.toLocaleString('en-IN')}` : r.a, 420, tableY + 4, { width: 110, align: 'right' });
            tableY += 18;
        });

        doc.rect(45, tableTopY, 510, tableY - tableTopY).strokeColor('#cbd5e1').lineWidth(0.8).stroke();
        doc.y = tableY + 12;

        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text('Key Terms & Conditions:', 45);
        doc.font('Helvetica').fontSize(8).fillColor('#334155');
        const defaultTerms = [
            '1. Probation: You will be on probation for 3 months from your joining date.',
            '2. Document Verification: Validated submission of Aadhaar, PAN, and Bank Account is mandatory.',
            '3. Site Compliance: You will follow client site working hours, biometric punch protocols, and security guidelines.',
            '4. Termination & Notice: Either party may terminate with 30 days written notice or salary in lieu thereof.'
        ];
        if (offer.terms_and_conditions && String(offer.terms_and_conditions).trim()) {
            doc.text(String(offer.terms_and_conditions).trim(), { lineGap: 2 });
        } else {
            defaultTerms.forEach(t => doc.text(t, { lineGap: 2 }));
        }

        doc.moveDown(0.8);

        let sigY = doc.y + 5;
        if (sigY > 670) {
            doc.addPage();
            sigY = 50;
        }

        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('For NKD Power Solutions Pvt Ltd', 45, sigY);
        doc.font('Helvetica').fontSize(8).fillColor('#475569');
        doc.text(`Salary Structure: ${offer.salary_approved_by ? `Approved by ${offer.salary_approved_by}` : 'Verified'}`, 45, sigY + 14);
        doc.text(`Director Approval: ${offer.management_approved_by ? `Approved by ${offer.management_approved_by}` : 'Executive Director'}`, 45, sigY + 26);
        doc.text('[Digitally Verified & Signed]', 45, sigY + 38);

        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('Candidate Acceptance', 340, sigY);
        doc.font('Helvetica').fontSize(8).fillColor('#475569');
        doc.text('I accept the appointment and terms stated above.', 340, sigY + 14);
        doc.text(`Status: ${offer.acceptance_status === 'ACCEPTED' ? 'ACCEPTED & SIGNED' : 'Offer Extended'}`, 340, sigY + 26);
        doc.text('Candidate Signature: _______________________', 340, sigY + 40);

        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#94a3b8').text(
            'This is an official system-generated appointment document issued via NKD CRM.',
            45, 785, { align: 'center', width: 510 }
        );
    }

    /**
     * Statutory Worker Appointment Letter under OSH Code 2020 (Annexure-I)
     * Section 6(1)(i) of Occupational Safety, Health and Working Conditions Code, 2020
     */
    generateWorkerOshAppointmentLetter(employee, res) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 38, size: 'A4' });

                const empCode = employee.employee_code || employee.employee_id || 'EMP';
                const filename = `Appointment_Letter_OSH_Annexure_I_${empCode}.pdf`;

                if (typeof res.setHeader === 'function') {
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
                }

                doc.pipe(res);

                this.buildWorkerOshAppointmentDoc(employee, doc);

                doc.end();
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    buildWorkerOshAppointmentDoc(employee, doc) {
        const logoPath = path.join(__dirname, '../assets/nkd_logo.png');
        const stampPath = path.join(__dirname, '../assets/nkd_stamp.png');

        const fullName = employee.full_name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Worker';
        const fatherName = employee.father_name || 'As per record';
        const address = employee.address || employee.permanent_address || employee.current_address || `${fatherName}, Bhojpur, Bihar`;
        const dobStr = employee.dob
            ? new Date(employee.dob).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
            : '02-04-2001';
        const aadhaarRaw = String(employee.aadhaar_number || '').trim();
        const aadhaarStr = aadhaarRaw || '441819500059';
        const designation = employee.designation || 'Electrician';

        const dojDate = new Date(employee.date_of_joining || Date.now());
        const formattedDoj = dojDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
        const formattedDojLong = dojDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

        const dailyWages = employee.daily_wages
            ? Number(employee.daily_wages)
            : (employee.basic_salary ? Math.round(Number(employee.basic_salary) / 30) : 867);
        const dailyWagesWords = numberToWords(dailyWages);

        const placeName = employee.site_location || employee.site_name || 'Assam';

        // ==========================================
        // PAGE 1: OFFICIAL WORKER APPOINTMENT LETTER
        // ==========================================
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 38, 30, { width: 115 });
        }

        doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text('NKD POWER SOLUTIONS PVT LTD', 230, 30, { align: 'right', width: 327 });
        doc.fontSize(7.5).font('Helvetica-Bold').text('A-41 GROUND FLOOR, PARK ELITE, SEC-85', 230, 44, { align: 'right', width: 327 });
        doc.text('FARIDABAD, HARYANA-121002', 230, 54, { align: 'right', width: 327 });
        doc.font('Helvetica').fontSize(7.5).text('CIN: U45309HR2021PTC097238', 230, 64, { align: 'right', width: 327 });
        doc.text('Email ID- info@nkdpowersolutions.com', 230, 74, { align: 'right', width: 327 });
        doc.text('Mobile- 9313513366, 9358555155', 230, 84, { align: 'right', width: 327 });

        doc.moveTo(38, 100).lineTo(557, 100).lineWidth(1.5).strokeColor('#000000').stroke();

        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('APPOINTMENT LETTER', 38, 114, { align: 'center', width: 519 });
        doc.fontSize(8.5).font('Helvetica-Bold').text(`Date: ${formattedDoj}`, 38, 130, { align: 'right', width: 519 });

        let curY = 145;
        doc.fontSize(8.5).font('Helvetica-Bold').text('To,', 38, curY);
        curY += 13;

        const drawField = (label, value) => {
            doc.font('Helvetica-Bold').fontSize(8.5).text(label, 38, curY, { width: 85, continued: false });
            doc.font('Helvetica').fontSize(8.5).text(`: ${value}`, 125, curY, { width: 430 });
            curY += 13;
        };

        drawField('Name', `Mr. ${fullName}`);
        drawField('Address', address);
        drawField('Date of Birth', dobStr);
        drawField('Aadhaar Number', aadhaarStr);

        curY += 4;
        doc.font('Helvetica-Bold').fontSize(8.5).text(`Subject: Appointment as ${designation}`, 38, curY);
        curY += 14;

        doc.font('Helvetica').fontSize(8.5).text(`Dear Mr. ${fullName},`, 38, curY);
        curY += 13;

        doc.text(
            `With reference to your recent interview, we are pleased to offer you the position of ${designation} with NKD Power Solutions Pvt. Ltd., effective from ${formattedDojLong}, on the following terms and conditions:`,
            38,
            curY,
            { width: 519, align: 'left', lineGap: 1 }
        );
        curY += 24;

        const terms = [
            { num: '1.', title: 'Wages:', body: `Your wages will be Rs. ${dailyWages} (Rupees ${dailyWagesWords} only) per day. Monthly wages will be paid for 30 days, based on your skill set.` },
            { num: '2.', title: 'Statutory Deductions:', body: 'Provident Fund (PF), Employees’ State Insurance (ESI) and Professional Tax (PT) will be deducted from your wages as applicable under the prevailing labour laws, and all benefits due under those laws will be provided to you.' },
            { num: '3.', title: 'Accommodation:', body: 'For employees deployed at project locations, the Company will provide lodging, along with vehicle facility between the site and the guesthouse. Food expenses will be borne by you as per your own use.' },
            { num: '4.', title: 'Transfer:', body: 'Depending on work requirements, you may be transferred, without any increase in wages, to any location, department or contract of the Company, including the contract of another organisation.' },
            { num: '5.', title: 'Notice Period:', body: 'Either party may end this employment by giving one (1) month’s notice.' },
            { num: '6.', title: 'Retirement Age:', body: 'The retirement age will be 58 years.' },
            {
                num: '7.',
                title: 'Termination without Notice:',
                body: 'Your employment may be terminated without notice in any of the following cases:\n  (a) Violation of serious Company policies;\n  (b) Unauthorised absence for more than 15 days; or\n  (c) Violation of safety rules that puts life at risk.'
            },
            { num: '8.', title: 'False Information:', body: 'If any information provided by you in connection with this employment is found to be false, your appointment will be cancelled.' }
        ];

        terms.forEach((t) => {
            doc.font('Helvetica-Bold').fontSize(8).text(t.num, 38, curY, { width: 14 });
            doc.font('Helvetica-Bold').fontSize(8).text(t.title, 54, curY, { continued: true });
            doc.font('Helvetica').fontSize(8).text(` ${t.body}`, { width: 503, lineGap: 1 });
            curY = doc.y + 3;
        });

        curY = Math.max(curY + 6, 680);

        doc.font('Helvetica-Bold').fontSize(8.5).text('For NKD Power Solutions Pvt. Ltd.', 38, curY);

        if (fs.existsSync(stampPath)) {
            doc.image(stampPath, 42, curY + 12, { width: 68 });
        }

        doc.font('Helvetica-Bold').fontSize(8.5).text('Authorised Signatory', 38, curY + 84);

        const rightX = 330;
        doc.font('Helvetica').fontSize(8.5).text('Employee Signature: ______________________', rightX, curY + 45);
        doc.text(`Name: ${fullName}`, rightX, curY + 62);
        doc.text(`Place: ${placeName}`, rightX, curY + 77);

        // ==========================================
        // PAGE 2: STATUTORY ANNEXURE-I (OSH CODE)
        // ==========================================
        doc.addPage();

        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 38, 30, { width: 95 });
        }
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('NKD POWER SOLUTIONS PVT LTD', 200, 30, { align: 'right', width: 357 });
        doc.fontSize(7).font('Helvetica').text('A-41 Ground Floor, Park Elite, Sec-85, Faridabad, Haryana-121002 | CIN: U45309HR2021PTC097238', 200, 43, { align: 'right', width: 357 });
        doc.moveTo(38, 62).lineTo(557, 62).lineWidth(1).strokeColor('#cbd5e1').stroke();

        doc.y = 70;
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text('Annexure-I', { align: 'center' });
        doc.moveDown(0.2);
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b').text(
            'Letter of appointment to employee under clause (i) of sub-section (1) of',
            { align: 'center' }
        );
        doc.text(
            'Section 6 of Occupational Safety, Health and Working Conditions (OSH SWC) Code, 2020',
            { align: 'center' }
        );
        doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#64748b').text(
            '(To be issued in English or Hindi and in local language)',
            { align: 'center' }
        );
        doc.moveDown(0.4);

        const bannerY = doc.y;
        doc.rect(38, bannerY, 519, 18).fill('#f1f5f9');
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0369a1').text(
            'Format for Appointment Letter (Workers / Contractual Employees)',
            38,
            bannerY + 4,
            { align: 'center', width: 519 }
        );
        doc.y = bannerY + 24;

        const desigLower = (employee.designation || '').toLowerCase();
        const autoSkill = employee.skill_category
            || (desigLower.includes('helper') || desigLower.includes('labour') ? 'Unskilled'
                : desigLower.includes('electrician') || desigLower.includes('jointer') || desigLower.includes('fitter') || desigLower.includes('welder') || desigLower.includes('engineer') ? 'Skilled'
                : 'Semi-Skilled');

        const linNo = employee.labour_license_no
            ? `LIN: ${employee.labour_license_no} (${employee.site_name || 'Assigned Site'})`
            : 'LIN-1982749502 (NKD Power Solutions Pvt Ltd)';
        const uanEsic = `UAN: ${employee.uan_number || 'Allotted on Joining'}  |  ESIC No: ${employee.esi_number || 'Allotted on Joining'}`;
        const isFemale = String(employee.gender || '').toUpperCase() === 'FEMALE';
        const maternityBenefit = isFemale
            ? 'Applicable under Chapter IV (Maternity Benefit) of Code on Social Security, 2020'
            : 'No Women Workers Engaged';

        const statutoryItems = [
            { label: 'Name of employee:', value: fullName },
            { label: 'Date of birth:', value: dobStr },
            { label: 'Father’s / Mother’s name:', value: fatherName },
            { label: 'Aadhaar number (after obtaining consent):', value: aadhaarStr },
            { label: 'Labour Identification Number (LIN) of the establishment:', value: linNo },
            { label: 'Universal Account Number (UAN) and / or Insurance Number (ESIC) (if available):', value: uanEsic },
            { label: 'Designation:', value: designation },
            { label: 'Type of Employment: Regular/Fresher-cum-employment/Contractual:', value: 'Contract Basis' },
            { label: 'Category of skill:', value: autoSkill },
            { label: 'Date of joining:', value: formattedDoj },
            { label: 'Wages/Basic Pay and Dearness Allowance:', value: `As Per Minimum Wages Rate Notification approved by Central Govt or State Govt. (Daily Wages: Rs. ${dailyWages} / Day)` },
            { label: 'Other allowance including accommodation whichever is applicable:', value: 'Company-provided accommodation and vehicle facility will be provided.' },
            { label: 'Applicability of social security [EPFO and ESIC] benefit:', value: 'Applicable [Employee Provident Fund Organization (EPFO) and Employees’ State Insurance Corporation (ESIC)]' },
            { label: 'Benefit available under chapter IV (Maternity Benefit) of Code on Social Security, 2020 (in case of women employee):', value: maternityBenefit },
            { label: 'Any other information:', value: `NA (Assigned for site work at: ${employee.site_name || placeName})` }
        ];

        const tableStartX = 38;
        const labelColWidth = 230;
        const valColWidth = 289;
        const totalTableWidth = labelColWidth + valColWidth;

        statutoryItems.forEach((item, idx) => {
            const rowY = doc.y;
            doc.font('Helvetica-Bold').fontSize(7.5);
            const labelH = doc.heightOfString(item.label, { width: labelColWidth - 10 });
            doc.font('Helvetica').fontSize(8);
            const valH = doc.heightOfString(item.value, { width: valColWidth - 10 });
            const rowH = Math.max(labelH, valH) + 6;

            if (idx % 2 === 0) {
                doc.rect(tableStartX, rowY, totalTableWidth, rowH).fill('#fafafa');
            }

            doc.rect(tableStartX, rowY, labelColWidth, rowH).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
            doc.rect(tableStartX + labelColWidth, rowY, valColWidth, rowH).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#1e293b').text(
                item.label,
                tableStartX + 5,
                rowY + 3.5,
                { width: labelColWidth - 10 }
            );

            doc.font('Helvetica').fontSize(8).fillColor('#0f172a').text(
                item.value,
                tableStartX + labelColWidth + 5,
                rowY + 3.5,
                { width: valColWidth - 10 }
            );

            doc.y = rowY + rowH;
        });

        const sig2Y = Math.max(doc.y + 12, 720);
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('Employee Acknowledgment', 45, sig2Y);
        doc.font('Helvetica').fontSize(7.5).fillColor('#475569').text('Signature / Thumb Impression: ____________________', 45, sig2Y + 25);

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('For NKD POWER SOLUTIONS PVT LTD', 340, sig2Y);
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('Signature / Digital Signature', 340, sig2Y + 25);
        doc.font('Helvetica').fontSize(7.5).fillColor('#475569').text('Employer', 340, sig2Y + 37);

        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#94a3b8').text(
            'Statutory Appointment Record under clause (i) of sub-section (1) of Section 6 of OSH SWC Code, 2020 • NKD CRM',
            38,
            800,
            { align: 'center', width: 519 }
        );
    }

    /**
     * Integrity and Confidentiality Agreement (NDA)
     * For Manpower & Contract Labour Deployment at Client Sites
     */
    generateIntegrityAgreement(employee, res) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 42, size: 'A4', bufferPages: true });

                const empCode = employee.employee_code || employee.employee_id || 'EMP';
                const filename = `Integrity_Confidentiality_Agreement_${empCode}.pdf`;

                if (typeof res.setHeader === 'function') {
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
                }

                doc.pipe(res);

                this.buildIntegrityAgreementDoc(employee, doc);

                doc.end();
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    buildIntegrityAgreementDoc(employee, doc) {
        const stampPath = path.join(__dirname, '../assets/nkd_stamp.png');

        const primaryColor = '#000000';
        const fullName = employee.full_name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Worker / Employee';
        const fatherName = employee.father_name || 'As per Aadhaar record';
        const designation = employee.designation || 'Technician / Site Worker';
        const employeeCode = employee.employee_code || employee.employee_id || 'NKD-EMP';
        const siteName = employee.site_name || 'Assigned Project Site';
        const principalEmployer = employee.principal_employer_name || employee.site_name || 'As Assigned by NKD Power Solutions';

        const doj = new Date(employee.date_of_joining || Date.now());
        const dayNum = doj.getDate();
        const monthName = doj.toLocaleDateString('en-GB', { month: 'long' });
        const yearNum = doj.getFullYear();
        const locationStr = employee.site_city || employee.site_state || employee.site_location || 'Faridabad';

        // Top Header
        doc.fontSize(13).font('Helvetica-Bold').fillColor(primaryColor).text('NKD POWER SOLUTIONS PVT LTD', { align: 'center' });
        doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#475569').text('A-41, GF, Park Elite Floor, Sec-85, Faridabad, Haryana-121002', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor).text('INTEGRITY AND CONFIDENTIALITY AGREEMENT', { align: 'center', underline: true });
        doc.moveDown(0.5);

        doc.moveTo(42, doc.y).lineTo(553, doc.y).lineWidth(1).strokeColor('#000000').stroke();
        doc.moveDown(0.7);

        doc.fontSize(9).font('Helvetica').fillColor(primaryColor).text(
            `This Agreement is made on this ${dayNum}th day of ${monthName}, ${yearNum}, at ${locationStr}, and is entered into between:`,
            { lineGap: 1.5 }
        );
        doc.moveDown(0.7);

        // Fill-in Details block
        const detailsX = 42;
        const labelW = 160;
        const valW = 350;

        const drawRow = (label, val) => {
            const y = doc.y;
            doc.font('Helvetica-Bold').fontSize(8.5).text(label, detailsX, y, { width: labelW });
            doc.font('Helvetica').fontSize(8.5).text(`: ${val}`, detailsX + labelW, y, { width: valW });
            doc.y = y + 14;
        };

        drawRow('Employee Full Name', fullName);
        drawRow("Father's / Husband's Name", fatherName);
        drawRow('Designation', designation);
        drawRow('Employee Code / ID', String(employeeCode));
        drawRow('Project / Site Location', siteName);
        drawRow('Principal Employer (if contract labour)', principalEmployer);

        doc.moveDown(0.5);
        doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#334155').text(
            '(hereinafter referred to as the "Employee", which expression shall, unless repugnant to the context, include his/her heirs, legal representatives and permitted assigns)',
            { lineGap: 1.5 }
        );
        doc.moveDown(0.6);

        doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryColor).text('AND', { align: 'center' });
        doc.moveDown(0.6);

        doc.fontSize(8.5).font('Helvetica').fillColor(primaryColor).text(
            'NKD POWER SOLUTIONS PVT LTD, a company incorporated under the Companies Act, 2013, having its registered office at A-41, GF, Park Elite Floor, Sec-85, Faridabad, Haryana-121002 (hereinafter referred to as the "Company", which expression shall, unless repugnant to the context, include its successors and permitted assigns).',
            { lineGap: 1.5 }
        );
        doc.moveDown(0.4);
        doc.fontSize(8.5).font('Helvetica-Oblique').text('Collectively referred to as the "Parties".');
        doc.moveDown(0.8);

        // Clause helpers
        const printClauseHeader = (title) => {
            doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text(title);
            doc.moveDown(0.3);
        };

        const printBullet = (text) => {
            const bulletX = 48;
            const textX = 58;
            const w = 495;
            const y = doc.y;
            doc.font('Helvetica').fontSize(8.5).fillColor(primaryColor).text('•', bulletX, y);
            doc.text(text, textX, y, { width: w, lineGap: 1.5 });
            doc.moveDown(0.4);
        };

        const printPara = (text) => {
            doc.font('Helvetica').fontSize(8.5).fillColor(primaryColor).text(text, 42, doc.y, { width: 511, lineGap: 1.5 });
            doc.moveDown(0.5);
        };

        // 1. Purpose
        printClauseHeader('1. Purpose');
        printPara(
            'The Company is engaged in the deployment of contract labour and manpower at various project sites of its principal employers. In the course of such engagement, the Employee may access, handle, or generate data, documents, and information belonging to the Company, its principal employers, clients, or vendors. This Agreement sets out the terms on which the Employee shall handle, use, and protect such data and information, both during and after the term of engagement.'
        );

        // 2. Confidentiality Obligations
        printClauseHeader('2. Confidentiality Obligations');
        printBullet(
            'The Employee acknowledges that in the course of work, they may have access to confidential and proprietary information relating to the Company, its principal employers, clients, vendors, or ongoing/future projects.'
        );
        printBullet(
            'The Employee agrees to hold all such information in strict confidence, and shall not disclose, share, copy, publish, reproduce, or transfer it to any third party, nor use it for personal, academic, financial, or commercial gain, without the prior written consent of the Company.'
        );
        printBullet(
            '"Confidential Information" includes, without limitation: project and site data, statutory compliance records (PF/ESIC/PT/labour licence data), technical drawings, commercial terms, wage and payroll records, customer and vendor details, and any other proprietary information, whether in physical, electronic, or verbal form.'
        );
        printBullet(
            'This obligation extends to information belonging to the Company’s principal employers and clients, and the Employee agrees to comply with any site-specific confidentiality or data-security protocols applicable at the principal employer’s premises.'
        );

        // 3. Data Ownership and Return of Materials
        printClauseHeader('3. Data Ownership and Return of Materials');
        printBullet(
            'All data, documents, and records collected, created, or processed by the Employee during the course of engagement remain the sole and exclusive property of the Company (or, where applicable, its principal employer).'
        );
        printBullet(
            'Upon cessation of employment/engagement, or earlier upon request by the Company, the Employee shall immediately return all such data, documents, access cards, IDs, and equipment (including originals, copies, and backups, in any form) without tampering, deletion, or alteration.'
        );
        printBullet(
            'No data, document, or record shall be retained by the Employee, in any form, after cessation of employment/engagement.'
        );

        // 4. Prohibited Use and Conflict of Interest
        printClauseHeader('4. Prohibited Use and Conflict of Interest');
        printBullet(
            'The Employee shall not use any data or information accessed during the engagement for personal, academic, freelance, or commercial purposes, whether during or after the term of engagement.'
        );
        printBullet(
            'The Employee shall not, during the term of engagement, undertake any work directly or indirectly competing with the Company’s business, or engage with a competing contractor/vendor at the same principal employer site, without prior written consent of the Company.'
        );
        printBullet(
            'Any unauthorized use, retention, or distribution of Company or principal employer data shall be treated as a material breach of this Agreement.'
        );

        // 5. Legal Consequences
        printClauseHeader('5. Legal Consequences');
        printBullet(
            'Any violation of this Agreement shall be treated as misconduct under the Company’s HR policy and applicable Standing Orders, and may result in disciplinary action, including termination of employment/engagement, without prejudice to the Company’s other rights and remedies.'
        );
        printBullet(
            'In the event of breach, the Company reserves the right to initiate civil and/or criminal proceedings, including recovery of damages, loss, or injury caused, and to inform the concerned principal employer and statutory authorities where the breach affects site security or statutory compliance.'
        );
        printBullet(
            'This clause shall not be construed to override the Employee’s statutory rights, including those under the Industrial Disputes Act, 1947, and other applicable labour legislations.'
        );

        // 6. Term and Survival
        printClauseHeader('6. Term and Survival');
        printPara(
            'This Agreement shall remain in force for the entire duration of the Employee’s engagement with the Company, and the obligations of confidentiality and non-use under Clauses 2 and 4 shall survive termination or cessation of employment/engagement for a period of 3 (three) years thereafter, or such longer period as may be required to protect statutory or contractual confidentiality obligations owed to a principal employer.'
        );

        // 7. Governing Law and Jurisdiction
        printClauseHeader('7. Governing Law and Jurisdiction');
        printPara(
            'This Agreement shall be governed by the laws of India. Subject to applicable statutory forums (e.g., Labour Court/Industrial Tribunal), the courts at Faridabad, Haryana shall have exclusive jurisdiction over any dispute arising out of or in connection with this Agreement.'
        );

        // 8. Declaration and Acknowledgement
        printClauseHeader('8. Declaration and Acknowledgement');
        printPara(
            'I, the undersigned, have read, understood, and voluntarily agree to abide by the terms stated in this Integrity and Confidentiality Agreement. I understand that any breach may result in disciplinary action and legal consequences as stated above, and I confirm that I have received a copy of this Agreement for my records.'
        );
        doc.moveDown(0.4);

        doc.font('Helvetica-Bold').fontSize(8.5).text(`Signed on this ${dayNum}th day of ${monthName}, ${yearNum}, at ${locationStr}.`);
        doc.moveDown(1.2);

        // Check if we have enough space for signature block, else add page
        if (doc.y > 660) {
            doc.addPage();
        }

        const sigY = doc.y;

        // Left: For the Employee
        doc.font('Helvetica-Bold').fontSize(9).text('For the Employee:', 42, sigY);
        doc.font('Helvetica').fontSize(8.5).text('Employee Signature: _________________________________________', 42, sigY + 22);
        doc.text(`Name: ${fullName}`, 42, sigY + 38);
        doc.text(`Date: ${doj.toLocaleDateString('en-GB')}`, 42, sigY + 52);

        // Right: For NKD Power Solutions Pvt Ltd
        const compX = 310;
        doc.font('Helvetica-Bold').fontSize(9).text('For NKD Power Solutions Pvt Ltd:', compX, sigY);

        if (fs.existsSync(stampPath)) {
            doc.image(stampPath, compX + 10, sigY + 14, { width: 55 });
        }

        doc.font('Helvetica').fontSize(8.5).text('Authorized Signatory: ___________________________________', compX, sigY + 22);
        doc.text('Name & Designation: HR & Compliance Manager', compX, sigY + 38);
        doc.text(`Date: ${doj.toLocaleDateString('en-GB')}`, compX, sigY + 52);

        // Witness
        const witY = sigY + 75;
        doc.font('Helvetica').fontSize(8.5).text('Witness (Name & Signature): ________________________________________________________________', 42, witY);

        // Add running headers & footers on all pages
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#94a3b8').text(
                `NKD Power Solutions Pvt Ltd • Integrity & Confidentiality Agreement • Page ${i + 1} of ${pages.count}`,
                42,
                810,
                { align: 'center', width: 511 }
            );
        }
    }

    getMonthName(monthIndex) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return months[(parseInt(monthIndex, 10) || 1) - 1] || 'Unknown';
    }
}

module.exports = new PDFService();
