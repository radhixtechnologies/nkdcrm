const ExcelJS = require('exceljs');

class ExcelService {
    async generatePayrollExcel(payrollList, res) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Payroll Summary');

        sheet.columns = [
            { header: 'Emp Code', key: 'code', width: 12 },
            { header: 'Name', key: 'name', width: 28 },
            { header: 'Department', key: 'dept', width: 16 },
            { header: 'Designation', key: 'desig', width: 20 },
            { header: 'Bank A/c', key: 'bank', width: 20 },
            { header: 'IFSC', key: 'ifsc', width: 15 },
            { header: 'Present Days', key: 'present', width: 13 },
            { header: 'Basic', key: 'basic', width: 14 },
            { header: 'HRA', key: 'hra', width: 14 },
            { header: 'Allowances', key: 'allow', width: 14 },
            { header: 'Overtime', key: 'ot', width: 14 },
            { header: 'Gross Salary', key: 'gross', width: 16 },
            { header: 'PF (Emp)', key: 'pf', width: 14 },
            { header: 'ESI (Emp)', key: 'esi', width: 14 },
            { header: 'Prof Tax', key: 'pt', width: 12 },
            { header: 'TDS', key: 'tds', width: 12 },
            { header: 'Advance', key: 'advance', width: 14 },
            { header: 'Net Salary', key: 'net', width: 16 },
            { header: 'Status', key: 'status', width: 12 }
        ];

        payrollList.forEach(p => {
            const num = (v) => parseFloat(v || 0) || 0;
            const allowances = num(p.conveyance_earned) + num(p.special_allowance_earned) + num(p.other_allowance_earned);

            sheet.addRow({
                code: p.employee_code || '',
                name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                dept: p.department || '-',
                desig: p.designation || '-',
                bank: p.account_number || '-',
                ifsc: p.ifsc_code || '-',
                present: num(p.present_days),
                basic: num(p.basic_earned),
                hra: num(p.hra_earned),
                allow: allowances,
                ot: num(p.overtime_amount),
                gross: num(p.gross_earnings),
                pf: num(p.pf_employee),
                esi: num(p.esi_employee),
                pt: num(p.professional_tax),
                tds: num(p.tds),
                advance: num(p.advance_deduction),
                net: num(p.net_salary),
                status: p.payment_status || 'PENDING'
            });
        });

        sheet.getRow(1).font = { bold: true };
        sheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Payroll_Summary.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    }

    /**
     * Generate Client Wage Register (NTPC Korba / Form XVII Muster-cum-Wage Sheet)
     */
    async generateNtpcWageRegisterExcel(payrollList, month, year, res) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Wage Register Form XVII');

        const monthNames = [
            'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
            'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
        ];
        const monthName = monthNames[(parseInt(month, 10) || 1) - 1] || 'OCTOBER';
        const daysInMonth = new Date(year, month, 0).getDate();

        // 1. Company & Project Title Headers
        sheet.mergeCells('A1:BK1');
        sheet.getCell('A1').value = 'NKD POWER SOLUTIONS PVT LTD';
        sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
        sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.mergeCells('A2:BK2');
        sheet.getCell('A2').value = 'A-41, GROUND FLOOR, PARK ELITE, SEC-85, FARIDABAD, HARYANA-121002 | CIN: U45309HR2021PTC097238';
        sheet.getCell('A2').font = { size: 9, italic: true };
        sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.mergeCells('A3:BK3');
        sheet.getCell('A3').value = `MONTHLY MUSTER ROLL & WAGE REGISTER (FORM XVII - UNDER CLRA & OSH CODE)`;
        sheet.getCell('A3').font = { size: 12, bold: true };
        sheet.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.mergeCells('A4:BK4');
        sheet.getCell('A4').value = `PROJECT SITE: NTPC KORBA THERMAL POWER STATION | MONTH & YEAR: ${monthName} ${year}`;
        sheet.getCell('A4').font = { size: 11, bold: true, color: { argb: 'FF0F766E' } };
        sheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.addRow([]); // Blank row at Row 5

        // Row 6: Column Headers
        const headerRow = [
            'SN', 'EMP CODE', 'NAME', 'FATHER NAME', 'ACCOUNT NO', 'IFSC CODE', 'CONTACT NUMBER',
            'DESIGNATION', 'ACTUAL WAGES', 'OVERTIME RATE', 'WAGE TYPE', 'SITE'
        ];

        // 1 to 31 Day Headers
        for (let d = 1; d <= daysInMonth; d++) {
            headerRow.push(String(d));
        }

        headerRow.push(
            'DAYS PRESENT', 'TOTAL WEEK OFF', 'TOTAL PAID HOLIDAYS', 'TOTAL PRESENT', 'TOTAL ABSENT', 'OVER TIME',
            'GROSS PAYMENT', 'BASIC SALARY', 'EARNED SALARY', 'HRA', 'INCENTIVES', 'OTH ALL', 'TOTAL',
            'PF', 'ESI', 'PT', 'TOTAL DEDUCTION', 'NET PAID', 'ADVANCE', 'FINAL PAYMENT', 'REMARKS'
        );

        const tableHead = sheet.addRow(headerRow);
        tableHead.height = 28;
        tableHead.eachCell((cell) => {
            cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E293B' } // Dark Slate
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'medium' },
                right: { style: 'thin' }
            };
        });

        // Totals accumulators
        let sumTotalPresent = 0;
        let sumGross = 0;
        let sumEarnedBasic = 0;
        let sumHra = 0;
        let sumIncentives = 0;
        let sumOtherAll = 0;
        let sumPf = 0;
        let sumEsi = 0;
        let sumPt = 0;
        let sumDeduction = 0;
        let sumNetPaid = 0;
        let sumAdvance = 0;
        let sumFinal = 0;

        payrollList.forEach((p, idx) => {
            const num = (v) => parseFloat(v || 0) || 0;
            let dayWise = {};
            if (p.day_wise_attendance) {
                dayWise = typeof p.day_wise_attendance === 'string'
                    ? JSON.parse(p.day_wise_attendance)
                    : p.day_wise_attendance;
            }

            const rowData = [
                idx + 1,
                p.employee_code || '',
                p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                p.father_name || '',
                p.account_number || '',
                p.ifsc_code || '',
                p.mobile || '',
                p.designation || 'Worker',
                num(p.employee_basic_salary || p.basic_earned),
                num(p.employee_ot_rate || 0),
                p.wage_type || 'PER DAY',
                p.site_code || 'KORBA'
            ];

            // Add 1..daysInMonth attendance
            for (let d = 1; d <= daysInMonth; d++) {
                rowData.push(dayWise[d] || (num(p.present_days) > 0 ? 'P' : 'A'));
            }

            const daysPresent = Math.max(0, num(p.present_days) - num(p.leave_days));
            const paidHolidays = num(p.leave_days);
            const totalPresent = num(p.present_days);
            const absentDays = num(p.absent_days);
            const otHours = num(p.overtime_hours);

            const gross = num(p.gross_earnings);
            const basicSalary = num(p.employee_basic_salary || p.basic_earned);
            const earnedSalary = num(p.basic_earned);
            const hra = num(p.hra_earned);
            const incentives = num(p.special_allowance_earned);
            const otherAll = num(p.other_allowance_earned);
            const totalEarned = gross;

            const pf = num(p.pf_employee);
            const esi = num(p.esi_employee);
            const pt = num(p.professional_tax);
            const statutoryDed = pf + esi + pt;
            const netBeforeAdvance = Math.max(0, gross - statutoryDed);
            const advance = num(p.advance_deduction);
            const finalPayment = num(p.net_salary);

            rowData.push(
                daysPresent,
                num(p.weekly_off_days),
                paidHolidays,
                totalPresent,
                absentDays,
                otHours,
                gross,
                basicSalary,
                earnedSalary,
                hra,
                incentives,
                otherAll,
                totalEarned,
                pf,
                esi,
                pt,
                statutoryDed,
                netBeforeAdvance,
                advance,
                finalPayment,
                p.remarks || ''
            );

            const row = sheet.addRow(rowData);
            row.height = 20;
            row.eachCell((cell, colNumber) => {
                cell.font = { size: 9 };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                // Align numbers to right, text/attendance to center
                if (colNumber >= 3 && colNumber <= 4) {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                } else if (colNumber >= 13 && colNumber <= 12 + daysInMonth) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    // Highlight Absent/Holiday
                    const val = String(cell.value || '').trim();
                    if (val === 'A') cell.font = { color: { argb: 'FFEF4444' }, size: 9, bold: true };
                    else if (val === 'P') cell.font = { color: { argb: 'FF10B981' }, size: 9, bold: true };
                    else if (val === 'NH' || val === 'PH') cell.font = { color: { argb: 'FF3B82F6' }, size: 9, bold: true };
                } else if (colNumber > 12 + daysInMonth) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                } else {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }
            });

            sumTotalPresent += totalPresent;
            sumGross += gross;
            sumEarnedBasic += earnedSalary;
            sumHra += hra;
            sumIncentives += incentives;
            sumOtherAll += otherAll;
            sumPf += pf;
            sumEsi += esi;
            sumPt += pt;
            sumDeduction += statutoryDed;
            sumNetPaid += netBeforeAdvance;
            sumAdvance += advance;
            sumFinal += finalPayment;
        });

        // Totals Row
        const totalRowData = [
            '', '', 'TOTAL', '', '', '', '', '', '', '', '', ''
        ];
        for (let d = 1; d <= daysInMonth; d++) {
            totalRowData.push('');
        }
        totalRowData.push(
            '', '', '', sumTotalPresent, '', '',
            sumGross, '', sumEarnedBasic, sumHra, sumIncentives, sumOtherAll, sumGross,
            sumPf, sumEsi, sumPt, sumDeduction, sumNetPaid, sumAdvance, sumFinal, ''
        );

        const totalRow = sheet.addRow(totalRowData);
        totalRow.height = 24;
        totalRow.eachCell((cell) => {
            cell.font = { bold: true, size: 10, color: { argb: 'FF1E3A8A' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE2E8F0' }
            };
            cell.border = {
                top: { style: 'medium' },
                left: { style: 'thin' },
                bottom: { style: 'double' },
                right: { style: 'thin' }
            };
        });

        // Signatures Block
        sheet.addRow([]);
        sheet.addRow([]);
        const sigRow = sheet.addRow([
            '', 'Prepared By: Timekeeper / Site HR', '', '', '', '', '', '', '', '', '', '',
            'Checked By: Project Coordinator', '', '', '', '', '', '', '', '', '', '', '',
            'Authorised Signatory (NKD Power Solutions)', '', '', '', '', '', '', '', '', '', '', '',
            'Verified By: Principal Employer (NTPC Korba)'
        ]);
        sigRow.font = { bold: true, size: 10 };

        // Column widths
        sheet.columns.forEach((col, idx) => {
            if (idx === 0) col.width = 6;
            else if (idx === 1) col.width = 14;
            else if (idx === 2) col.width = 24;
            else if (idx === 3) col.width = 22;
            else if (idx === 4) col.width = 18;
            else if (idx === 5) col.width = 14;
            else if (idx >= 12 && idx < 12 + daysInMonth) col.width = 4.5;
            else col.width = 13;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=NTPC_Korba_Wage_Register_${monthName}_${year}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    }

    /**
     * Generate Bank Transfer NEFT Disbursal Excel
     */
    async generateBankNeftExcel(payrollList, month, year, res) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Bank NEFT Disbursal');

        const monthNames = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        const monthShort = monthNames[(parseInt(month, 10) || 1) - 1] || 'Oct';

        sheet.columns = [
            { header: 'Sr No', key: 'sr', width: 8 },
            { header: 'Beneficiary Account No', key: 'account', width: 22 },
            { header: 'Beneficiary Name', key: 'name', width: 28 },
            { header: 'IFSC Code', key: 'ifsc', width: 16 },
            { header: 'Disbursal Amount (Rs)', key: 'amount', width: 20 },
            { header: 'Payment Narration', key: 'narration', width: 26 },
            { header: 'Mobile Number', key: 'mobile', width: 16 },
            { header: 'Bank Name', key: 'bank', width: 24 }
        ];

        let totalDisbursed = 0;
        let count = 0;

        payrollList.forEach((p, idx) => {
            const num = (v) => parseFloat(v || 0) || 0;
            const finalAmount = num(p.net_salary);
            if (finalAmount <= 0) return; // Skip zero payouts

            sheet.addRow({
                sr: ++count,
                account: p.account_number || 'N/A',
                name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                ifsc: p.ifsc_code || 'N/A',
                amount: finalAmount,
                narration: `Salary ${monthShort} ${year} NKD Korba`,
                mobile: p.mobile || '',
                bank: p.bank_name || ''
            });

            totalDisbursed += finalAmount;
        });

        // Totals Row
        const totRow = sheet.addRow({
            sr: '',
            account: '',
            name: 'TOTAL DISBURSAL',
            ifsc: '',
            amount: totalDisbursed,
            narration: '',
            mobile: '',
            bank: ''
        });

        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF15803D' } // Emerald green for banking
        };

        totRow.font = { bold: true, size: 11, color: { argb: 'FF15803D' } };

        sheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Bank_NEFT_Disbursal_${monthShort}_${year}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    }
}

module.exports = new ExcelService();
