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
}

module.exports = new ExcelService();
