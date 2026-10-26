const ExcelJS = require('exceljs');

class ExcelService {
    async generatePayrollExcel(payrollList, res) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Payroll Summary');

        // Headers
        sheet.columns = [
            { header: 'Emp Code', key: 'code', width: 10 },
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Department', key: 'dept', width: 15 },
            { header: 'Designation', key: 'desig', width: 20 },
            { header: 'Bank A/c', key: 'bank', width: 20 },
            { header: 'IFSC', key: 'ifsc', width: 15 },
            { header: 'Present Days', key: 'present', width: 12 },
            { header: 'Basic', key: 'basic', width: 15 },
            { header: 'HRA', key: 'hra', width: 15 },
            { header: 'Allowances', key: 'allow', width: 15 },
            { header: 'Overtime', key: 'ot', width: 15 },
            { header: 'Gross Salary', key: 'gross', width: 18 },
            { header: 'PF (Emp)', key: 'pf', width: 15 },
            { header: 'ESI (Emp)', key: 'esi', width: 15 },
            { header: 'Prof Tax', key: 'pt', width: 15 },
            { header: 'TDS', key: 'tds', width: 15 },
            { header: 'Net Salary', key: 'net', width: 18 },
            { header: 'Status', key: 'status', width: 12 },
        ];

        // Rows
        payrollList.forEach(p => {
            const allowances = parseFloat(p.conveyance_earned) + parseFloat(p.special_allowance_earned) + parseFloat(p.other_allowance_earned);

            sheet.addRow({
                code: p.employee_code,
                name: p.full_name,
                dept: p.department,
                desig: p.designation,
                bank: p.account_number,
                ifsc: p.ifsc_code,
                present: p.present_days, // This might need joining with attendance table if not in payroll object
                basic: p.basic_earned,
                hra: p.hra_earned,
                allow: allowances,
                ot: p.overtime_amount,
                gross: p.gross_earnings,
                pf: p.pf_employee,
                esi: p.esi_employee,
                pt: p.professional_tax,
                tds: p.tds,
                net: p.net_salary,
                status: p.payment_status
            });
        });

        // Styling
        sheet.getRow(1).font = { bold: true };
        sheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Payroll_Summary.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    }
}

module.exports = new ExcelService();
