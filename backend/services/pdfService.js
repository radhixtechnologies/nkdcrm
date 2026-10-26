const PDFDocument = require('pdfkit');

class PDFService {
    generatePayslip(payroll, employee, res) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });

                // Set response headers for download
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=Payslip_${employee.employee_code}_${payroll.month}_${payroll.year}.pdf`);

                doc.pipe(res);

                // --- HEADER ---
                doc.fontSize(20).text('COMPANY NAME', { align: 'center' });
                doc.fontSize(10).text('123, Street Name, City, State, Country', { align: 'center' });
                doc.moveDown();
                doc.fontSize(16).text('PAYSLIP', { align: 'center', underline: true });
                doc.fontSize(12).text(`For the month of: ${this.getMonthName(payroll.month)} ${payroll.year}`, { align: 'center' });
                doc.moveDown();

                // --- EMPLOYEE DETAILS ---
                doc.rect(50, 150, 500, 80).stroke();

                const leftX = 60;
                const rightX = 300;
                let y = 160;

                doc.fontSize(10);
                doc.text(`Employee Name: ${employee.full_name}`, leftX, y);
                doc.text(`Employee Code: ${employee.employee_code}`, rightX, y);
                y += 15;
                doc.text(`Designation: ${employee.designation || 'N/A'}`, leftX, y);
                doc.text(`Department: ${employee.department || 'N/A'}`, rightX, y);
                y += 15;
                doc.text(`Date of Joining: ${new Date(employee.date_of_joining).toLocaleDateString()}`, leftX, y);
                doc.text(`Bank Account: ${employee.account_number || 'N/A'}`, rightX, y);
                y += 15;
                doc.text(`PF UAN: ${employee.uan_number || 'N/A'}`, leftX, y);
                doc.text(`ESI No: ${employee.esi_number || 'N/A'}`, rightX, y);

                doc.moveDown(4);

                // --- ATTENDANCE ---
                y = 250;
                doc.text(`Total Days: ${payroll.total_days || 30} | Paid Days: ${parseFloat(payroll.present_days || 0) + parseFloat(payroll.weekly_off_days || 0) + parseFloat(payroll.leave_days || 0)} | Absent: ${payroll.absent_days || 0}`, { align: 'center' });
                doc.moveDown();

                // --- SALARY TABLE ---
                y = 280;
                const col1 = 50;
                const col2 = 200;
                const col3 = 350;
                const col4 = 500;

                // Header
                doc.font('Helvetica-Bold');
                doc.text('EARNINGS', col1, y);
                doc.text('AMOUNT (INR)', col2, y, { width: 100, align: 'right' });
                doc.text('DEDUCTIONS', col3, y);
                doc.text('AMOUNT (INR)', col4, y, { width: 50, align: 'right' });

                doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
                y += 25;
                doc.font('Helvetica');

                // Rows
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
                        doc.text(parseFloat(earn.value || 0).toFixed(2), col2, y, { width: 100, align: 'right' });
                    }

                    if (ded.label) {
                        doc.text(ded.label, col3, y);
                        doc.text(parseFloat(ded.value || 0).toFixed(2), col4, y, { width: 50, align: 'right' });
                    }
                    y += 15;
                }

                doc.moveTo(50, y + 10).lineTo(550, y + 10).stroke();
                y += 20;

                // Totals
                doc.font('Helvetica-Bold');
                doc.text('Total Earnings', col1, y);
                doc.text(parseFloat(payroll.gross_earnings).toFixed(2), col2, y, { width: 100, align: 'right' });

                doc.text('Total Deductions', col3, y);
                doc.text(parseFloat(payroll.total_deductions).toFixed(2), col4, y, { width: 50, align: 'right' });

                y += 30;
                doc.rect(50, y, 500, 40).fillAndStroke('#f0f0f0', '#000000');
                doc.fillColor('black');
                doc.fontSize(14).text(`NET SALARY PAYABLE: Rs. ${parseFloat(payroll.net_salary).toFixed(2)}`, 60, y + 12);

                // Footer
                doc.moveDown(5);
                doc.fontSize(10).text('This is a computer-generated payslip and does not require a signature.', { align: 'center' });

                doc.end();
                resolve();

            } catch (error) {
                reject(error);
            }
        });
    }

    getMonthName(monthIndex) {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return months[monthIndex - 1] || "Unknown";
    }
}

module.exports = new PDFService();
