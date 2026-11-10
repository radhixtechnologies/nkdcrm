const PDFDocument = require('pdfkit');

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

    getMonthName(monthIndex) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return months[(parseInt(monthIndex, 10) || 1) - 1] || 'Unknown';
    }
}

module.exports = new PDFService();
