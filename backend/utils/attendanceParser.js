/**
 * Attendance Parser Utility
 * Parses attendance Excel files with day-wise data
 * Calculates totals and validates attendance codes
 */

/**
 * Valid attendance codes
 */
const VALID_ATTENDANCE_CODES = ['P', 'A', 'WO', 'L', 'H', 'HD', 'PL', 'CL', 'SL', ''];

/**
 * Parse day-wise attendance from Excel row
 * Expects columns named: 1, 2, 3, ..., 31 (or 28/30 depending on month)
 * @param {Object} row - Excel row object
 * @param {number} totalDays - Total days in the month
 * @returns {Object} { dayWise: {}, totals: {} }
 */
const parseDayWiseAttendance = (row, totalDays) => {
    const dayWise = {};
    const totals = {
        present: 0,
        absent: 0,
        weeklyOff: 0,
        leave: 0,
        halfDay: 0,
    };

    for (let day = 1; day <= totalDays; day++) {
        const dayKey = String(day);
        let code = String(row[dayKey] || '').trim().toUpperCase();

        // If empty, treat as absent
        if (code === '') {
            code = 'A';
        }

        // Validate attendance code
        if (!VALID_ATTENDANCE_CODES.includes(code) && code !== 'A') {
            // If invalid code, treat as present (P) and log warning
            console.warn(`Invalid attendance code "${code}" for day ${day}, treating as Present`);
            code = 'P';
        }

        // Store in day-wise object
        dayWise[dayKey] = code;

        // Calculate totals
        switch (code) {
            case 'P':
                totals.present += 1;
                break;
            case 'A':
                totals.absent += 1;
                break;
            case 'WO':
                totals.weeklyOff += 1;
                break;
            case 'L':
            case 'PL':
            case 'CL':
            case 'SL':
                totals.leave += 1;
                break;
            case 'H':
            case 'HD':
                totals.halfDay += 1;
                totals.present += 0.5; // Half day counts as 0.5 present
                break;
            default:
                // Unknown code, treat as present
                totals.present += 1;
        }
    }

    return { dayWise, totals };
};

/**
 * Get total days in a month
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {number} Total days in month
 */
const getTotalDaysInMonth = (month, year) => {
    return new Date(year, month, 0).getDate();
};

/**
 * Validate month and year
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Object} { valid: boolean, error: string }
 */
const validatePeriod = (month, year) => {
    if (!month || month < 1 || month > 12) {
        return { valid: false, error: 'Month must be between 1 and 12' };
    }

    if (!year || year < 2020 || year > 2100) {
        return { valid: false, error: 'Year must be between 2020 and 2100' };
    }

    return { valid: true };
};

/**
 * Parse attendance Excel row to database format
 * @param {Object} row - Excel row object
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @param {Object} employeeMap - Map of employee_code to employee_id
 * @returns {Object} Attendance data ready for database
 */
const parseAttendanceRow = (row, month, year, employeeMap) => {
    const employeeCode = String(row['Employee Code'] || '').trim();

    if (!employeeCode) {
        throw new Error('Employee Code is required');
    }

    const employeeId = employeeMap[employeeCode];
    if (!employeeId) {
        throw new Error(`Employee with code "${employeeCode}" not found in database`);
    }

    // Get total days in month
    const totalDays = getTotalDaysInMonth(month, year);

    // Parse day-wise attendance
    const { dayWise, totals } = parseDayWiseAttendance(row, totalDays);

    // Parse overtime hours (if provided)
    const overtimeHours = parseFloat(row['Overtime Hours'] || row['OT Hours'] || 0) || 0;

    return {
        employee_id: employeeId,
        employee_code: employeeCode,
        month,
        year,
        total_days: totalDays,
        present_days: totals.present,
        absent_days: totals.absent,
        weekly_off_days: totals.weeklyOff,
        leave_days: totals.leave,
        half_days: totals.halfDay,
        overtime_hours: overtimeHours,
        day_wise_attendance: dayWise,
        remarks: row['Remarks'] || null,
    };
};

/**
 * Validate attendance Excel columns
 * @param {Array} headers - Array of column headers
 * @param {number} totalDays - Total days in month
 * @returns {Object} { valid: boolean, missing: Array }
 */
const validateAttendanceColumns = (headers, totalDays) => {
    const required = ['Employee Code'];

    // Check for day columns (1, 2, 3, ..., totalDays)
    for (let day = 1; day <= totalDays; day++) {
        required.push(String(day));
    }

    const missing = required.filter(col => !headers.includes(col));

    return {
        valid: missing.length === 0,
        missing,
    };
};

module.exports = {
    parseDayWiseAttendance,
    getTotalDaysInMonth,
    validatePeriod,
    parseAttendanceRow,
    validateAttendanceColumns,
    VALID_ATTENDANCE_CODES,
};
