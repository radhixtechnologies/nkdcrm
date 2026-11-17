const db = require('../config/database');
const { parseData } = require('./test_parse_oct_payroll');

async function importPayroll() {
    console.log('🚀 Starting Import of October 2026 Payroll for CGPL MUNDRA & ADANI WATER...');
    const records = parseData();
    console.log(`Found ${records.length} records to process.\n`);

    let totalGross = 0;
    let totalPF = 0;
    let totalESI = 0;
    let totalPT = 0;
    let totalAdvance = 0;
    let totalFinal = 0;
    let totalDays = 0;

    let createdCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < records.length; i++) {
        const w = records[i];

        // Determine site ID
        let siteId = 15; // default CGPL Mundra (TATA CGPL)
        if (w.site.toUpperCase().includes('ADANI')) {
            siteId = 14; // ADANI WATER
        }

        // Check if employee exists
        let empRes = null;
        if (w.account) {
            empRes = await db.query(
                'SELECT employee_id, employee_code, full_name FROM employees WHERE account_number = $1 LIMIT 1',
                [w.account]
            );
        }

        if (!empRes || empRes.rows.length === 0) {
            empRes = await db.query(
                `SELECT employee_id, employee_code, full_name 
                 FROM employees 
                 WHERE LOWER(TRIM(full_name)) = LOWER(TRIM($1)) 
                 LIMIT 1`,
                [w.name]
            );
        }

        let employeeId;
        let empCode;

        if (empRes && empRes.rows.length > 0) {
            employeeId = empRes.rows[0].employee_id;
            empCode = empRes.rows[0].employee_code;
            updatedCount++;

            await db.query(`
                UPDATE employees SET
                    site_id = $1,
                    designation = COALESCE($2, designation),
                    wage_type = COALESCE($3, wage_type),
                    basic_salary = $4,
                    ot_rate = $5,
                    father_name = COALESCE($6, father_name),
                    account_number = COALESCE($7, account_number),
                    ifsc_code = COALESCE($8, ifsc_code),
                    mobile = COALESCE($9, mobile),
                    pf_applicable = TRUE,
                    esi_applicable = TRUE
                WHERE employee_id = $10
            `, [siteId, w.designation, w.wageType, w.actualWages, w.otRate, w.father, w.account, w.ifsc, w.mobile, employeeId]);
        } else {
            createdCount++;
            const seqRes = await db.query("SELECT nextval('employee_code_seq') AS next_val");
            empCode = `EMP-${String(seqRes.rows[0].next_val).padStart(6, '0')}`;
            const parts = w.name.split(' ');
            const firstName = parts[0];
            const lastName = parts.slice(1).join(' ') || '';

            const insEmp = await db.query(`
                INSERT INTO employees (
                    employee_code, first_name, last_name, full_name, father_name,
                    designation, department, site_id, wage_type, basic_salary, ot_rate,
                    account_number, ifsc_code, mobile, pf_applicable, esi_applicable,
                    date_of_joining, employment_type, employment_status, is_active
                ) VALUES (
                    $1, $2, $3, $4, $5,
                    $6, 'Operations', $7, $8, $9, $10,
                    $11, $12, $13, TRUE, TRUE,
                    '2026-10-01', 'CONTRACT', 'ACTIVE', TRUE
                ) RETURNING employee_id
            `, [
                empCode, firstName, lastName, w.name, w.father,
                w.designation, siteId, w.wageType, w.actualWages, w.otRate,
                w.account, w.ifsc, w.mobile
            ]);
            employeeId = insEmp.rows[0].employee_id;
        }

        // Build Day-wise Attendance JSON
        const dayWiseJson = {};
        for (let d = 1; d <= 31; d++) {
            dayWiseJson[d] = w.attendanceDays[d - 1] || 'A';
        }

        // Upsert Attendance Record (Month: 10, Year: 2026)
        const attRes = await db.query(`
            INSERT INTO attendance (
                employee_id, month, year, total_days,
                present_days, absent_days, weekly_off_days, leave_days, half_days,
                overtime_hours, day_wise_attendance, remarks, updated_at
            ) VALUES (
                $1, 10, 2026, 31,
                $2, $3, $4, $5, 0,
                $6, $7, $8, CURRENT_TIMESTAMP
            )
            ON CONFLICT (employee_id, month, year) DO UPDATE SET
                total_days = EXCLUDED.total_days,
                present_days = EXCLUDED.present_days,
                absent_days = EXCLUDED.absent_days,
                weekly_off_days = EXCLUDED.weekly_off_days,
                leave_days = EXCLUDED.leave_days,
                half_days = EXCLUDED.half_days,
                overtime_hours = EXCLUDED.overtime_hours,
                day_wise_attendance = EXCLUDED.day_wise_attendance,
                remarks = EXCLUDED.remarks,
                updated_at = CURRENT_TIMESTAMP
            RETURNING attendance_id
        `, [
            employeeId,
            w.totalPresent,
            w.totalAbsent,
            w.weekOff,
            w.holidays,
            w.otHours,
            JSON.stringify(dayWiseJson),
            `${w.site} Oct 2026 Attendance`
        ]);
        const attendanceId = attRes.rows[0].attendance_id;

        // Upsert Payroll Record (Month: 10, Year: 2026)
        const totalDeductions = w.pf + w.esi + w.pt + w.advance;
        const netSalary = w.finalPayment;

        await db.query(`
            INSERT INTO payroll (
                employee_id, attendance_id, month, year,
                total_days, present_days, absent_days, weekly_off_days, leave_days, half_days, overtime_hours,
                basic_earned, hra_earned, conveyance_earned, special_allowance_earned,
                other_allowance_earned, overtime_amount, gross_earnings,
                pf_employee, pf_employer, esi_employee, esi_employer,
                professional_tax, tds, advance_deduction, other_deductions,
                total_deductions, net_salary, payment_status, payment_mode, remarks
            ) VALUES (
                $1, $2, 10, 2026,
                31, $3, $4, $5, $6, 0, $7,
                $8, $9, 0, $10,
                $11, 0, $12,
                $13, $14, $15, $16,
                $17, 0, $18, 0,
                $19, $20, 'FINALIZED', 'BANK_TRANSFER', $21
            )
            ON CONFLICT (employee_id, month, year) DO UPDATE SET
                attendance_id = EXCLUDED.attendance_id,
                total_days = EXCLUDED.total_days,
                present_days = EXCLUDED.present_days,
                absent_days = EXCLUDED.absent_days,
                weekly_off_days = EXCLUDED.weekly_off_days,
                leave_days = EXCLUDED.leave_days,
                overtime_hours = EXCLUDED.overtime_hours,
                basic_earned = EXCLUDED.basic_earned,
                hra_earned = EXCLUDED.hra_earned,
                special_allowance_earned = EXCLUDED.special_allowance_earned,
                other_allowance_earned = EXCLUDED.other_allowance_earned,
                gross_earnings = EXCLUDED.gross_earnings,
                pf_employee = EXCLUDED.pf_employee,
                pf_employer = EXCLUDED.pf_employer,
                esi_employee = EXCLUDED.esi_employee,
                esi_employer = EXCLUDED.esi_employer,
                professional_tax = EXCLUDED.professional_tax,
                advance_deduction = EXCLUDED.advance_deduction,
                total_deductions = EXCLUDED.total_deductions,
                net_salary = EXCLUDED.net_salary,
                payment_status = EXCLUDED.payment_status,
                payment_mode = EXCLUDED.payment_mode,
                remarks = EXCLUDED.remarks,
                updated_at = CURRENT_TIMESTAMP
        `, [
            employeeId, attendanceId,
            w.totalPresent, w.totalAbsent, w.weekOff, w.holidays, w.otHours,
            w.earnedBasic, w.hra, w.incentives,
            w.otherAll, w.gross,
            w.pf, w.pf, w.esi, Math.round(w.gross * 0.0325),
            w.pt, w.advance,
            totalDeductions, netSalary,
            w.remarks || `${w.site} Oct 2026 Final Payout`
        ]);

        totalGross += w.gross;
        totalPF += w.pf;
        totalESI += w.esi;
        totalPT += w.pt;
        totalAdvance += w.advance;
        totalFinal += w.finalPayment;
        totalDays += w.totalPresent;

        console.log(`[${i + 1}/${records.length}] Processed: ${empCode} - ${w.name} (${w.site}) -> Gross: ₹${w.gross}, Final: ₹${w.finalPayment}`);
    }

    console.log('\n=============================================');
    console.log('🎉 CGPL MUNDRA & ADANI WATER OCTOBER 2026 IMPORT COMPLETE!');
    console.log(`   Employees Created:   ${createdCount}`);
    console.log(`   Employees Updated:   ${updatedCount}`);
    console.log(`   Total Processed:     ${records.length}`);
    console.log(`   Total Present Days:  ${totalDays}`);
    console.log(`   Total Gross:         ₹${totalGross.toLocaleString('en-IN')}`);
    console.log(`   Total PF:            ₹${totalPF.toLocaleString('en-IN')}`);
    console.log(`   Total ESI:           ₹${totalESI.toLocaleString('en-IN')}`);
    console.log(`   Total PT:            ₹${totalPT.toLocaleString('en-IN')}`);
    console.log(`   Total Advances:      ₹${totalAdvance.toLocaleString('en-IN')}`);
    console.log(`   Total Final Bank:    ₹${totalFinal.toLocaleString('en-IN')}`);
    console.log('=============================================\n');

    process.exit(0);
}

importPayroll().catch(err => {
    console.error('❌ Import failed:', err);
    process.exit(1);
});
