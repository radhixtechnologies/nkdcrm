const xlsx = require('xlsx');
const db = require('../config/database');
const employeeService = require('./employeeService');
const siteService = require('./siteService');

class StatutoryService {
    /**
     * Import Register (Form XIII)
     * Fault-tolerant import that sanitizes data and minimizes rejections
     */
    async importRegister(fileBuffer, siteIdentifier) {
        let workbook;
        try {
            workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        } catch (e) {
            throw new Error('Invalid Excel file format');
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        // Resolve Site ID
        let resolvedSiteId = await this.resolveSiteId(siteIdentifier);

        // 1. Dynamic Header Detection
        // Scan first 20 rows to find the header row containing key columns
        let headerRowIndex = -1;
        for (let r = 0; r < Math.min(data.length, 25); r++) {
            const rowStr = JSON.stringify(data[r]).toLowerCase();
            // Check for unique combination of headers to confirm
            if (rowStr.includes('name') && (rowStr.includes('mobile') || rowStr.includes('designation')) && rowStr.includes('gender')) {
                headerRowIndex = r;
                console.log(`Found Header at Row ${r}:`, data[r]);
                break;
            }
        }

        // Fallback if autodetection fails (Legacy support for Row 7 data start -> Header at 6?)
        // The previous code sliced 7 (Data starts at index 7, so headers are index 6 or before).
        // If we didn't find headers, we might assume standard format.
        // But safer to assume 0 if it's a raw CSV without metadata title blocks.
        if (headerRowIndex === -1) {
            console.warn("Could not auto-detect header row. Trying default offset (skipping first 7 rows).");
            headerRowIndex = 6;
        }

        const employeeRows = data.slice(headerRowIndex + 1);
        const results = {
            imported: 0,
            failed: 0,
            warnings: [],
            errors: [], // For UI compatibility
            success: [] // For UI compatibility
        };

        for (let i = 0; i < employeeRows.length; i++) {
            const row = employeeRows[i];
            const rowNum = headerRowIndex + 1 + i + 1; // Actual Excel Row Number (1-based)

            // Skip empty rows
            if (!row || row.length === 0 || !row[1]) continue;

            try {
                // ----------------------------------------------------
                // 1. SAFE PARSING (Normalize Data)
                // ----------------------------------------------------

                // Text Fields (Clean and Truncate)
                const name = this.cleanExcelText(row[1]);
                const designation = this.cleanExcelText(row[8]);

                // Identity Fields (Strict Numeric or Alphanumeric)
                const aadhaar = this.cleanIdentity(row[15], true);  // numeric only
                const uan = this.cleanIdentity(row[12], true);      // numeric only
                const mobile = this.cleanIdentity(row[11], true);   // numeric only
                const pan = this.cleanIdentity(row[13], false);     // alphanumeric allowed
                const esi = this.cleanIdentity(row[14], false);     // alphanumeric allowed

                // Dates
                const dob = this.parseDate(row[4]);
                const doj = this.parseDate(row[7]);
                const exitDate = this.parseDate(row[22]);

                // ----------------------------------------------------
                // 2. VALIDATION (Reject only if absolutely necessary)
                // ----------------------------------------------------

                // Rule: Reject only if BOTH Aadhaar AND Mobile are missing
                if (!aadhaar && !mobile) {
                    results.failed++;
                    results.warnings.push({
                        row: rowNum,
                        message: `Skipped: Missing both Aadhaar and Mobile. Name: ${name || 'Unknown'}`
                    });
                    continue;
                }

                // Collect warnings for partial failures (invalid formats that became null)
                if (row[15] && !aadhaar) results.warnings.push({ row: rowNum, message: `Invalid Aadhaar format for ${name}` });
                if (row[11] && !mobile) results.warnings.push({ row: rowNum, message: `Invalid Mobile format for ${name}` });
                if (row[4] && !dob) results.warnings.push({ row: rowNum, message: `Invalid DOB format for ${name}` });

                // Construct Employee Data
                const employeeData = {
                    first_name: name,
                    gender: this.cleanExcelText(row[2]),
                    father_name: this.cleanExcelText(row[3]),
                    dob: dob,
                    nationality: this.cleanExcelText(row[5]) || 'Indian',
                    education: this.cleanExcelText(row[6]),
                    date_of_joining: doj,
                    designation: designation,
                    skill_category: this.cleanExcelText(row[9]),
                    employment_type: this.cleanExcelText(row[10]),
                    mobile: mobile, // Safe null
                    uan_number: uan, // Safe null
                    pan_number: pan, // Safe null
                    esi_number: esi, // Safe null
                    aadhaar_number: aadhaar, // Safe null
                    account_number: this.cleanIdentity(row[16], false),
                    bank_name: this.cleanExcelText(row[17]),
                    ifsc_code: this.cleanIdentity(row[18], false),
                    address: this.cleanExcelText(row[19]),
                    permanent_address: this.cleanExcelText(row[20]),
                    service_book_no: this.cleanExcelText(row[21]),
                    date_of_exit: exitDate,
                    reason_for_exit: this.cleanExcelText(row[23]),
                    identification_mark: this.cleanExcelText(row[24]),
                    remarks: this.cleanExcelText(row[28]),

                    // Defaults
                    wage_type: 'MONTHLY',
                    basic_salary: 0,
                    site_id: resolvedSiteId,
                    is_active: !exitDate // Active if no exit date
                };

                // ----------------------------------------------------
                // 3. DATABASE OPERATION (Upsert)
                // ----------------------------------------------------

                // Find existing using cleaned identities
                let existingEmployee = null;
                const searchConditions = [];
                const searchValues = [];

                if (employeeData.aadhaar_number) {
                    searchConditions.push(`aadhaar_number = $${searchValues.length + 1}`);
                    searchValues.push(employeeData.aadhaar_number);
                }
                if (employeeData.mobile) {
                    searchConditions.push(`mobile = $${searchValues.length + 1}`);
                    searchValues.push(employeeData.mobile);
                }

                if (searchConditions.length > 0) {
                    const query = `SELECT * FROM employees WHERE ${searchConditions.join(' OR ')} LIMIT 1`;
                    const res = await db.query(query, searchValues);
                    existingEmployee = res.rows[0];
                }

                if (existingEmployee) {
                    await employeeService.updateEmployee(existingEmployee.employee_code, employeeData);
                    results.imported++;
                    results.success.push({ name: name, status: 'Updated' });
                } else {
                    try {
                        await employeeService.createEmployee(employeeData);
                        results.imported++;
                        results.success.push({ name: name, status: 'Created' });
                    } catch (createError) {
                        // Handle Unique Constraint Violations Gracefully
                        if (createError.code === '23505') {
                            const detail = createError.detail || '';
                            let conflictField = null;

                            if (detail.includes('uan_number')) conflictField = 'uan_number';
                            else if (detail.includes('pan_number')) conflictField = 'pan_number';
                            else if (detail.includes('esi_number')) conflictField = 'esi_number';
                            else if (detail.includes('account_number')) conflictField = 'account_number';

                            if (conflictField && employeeData[conflictField]) {
                                const conflictRes = await db.query(`SELECT * FROM employees WHERE ${conflictField} = $1`, [employeeData[conflictField]]);
                                if (conflictRes.rows.length > 0) {
                                    await employeeService.updateEmployee(conflictRes.rows[0].employee_code, employeeData);
                                    results.imported++;
                                    results.success.push({ name: name, status: 'Updated (Conflict Resolved)' });
                                    continue;
                                }
                            }
                            // If we can't resolve conflict, generic warning
                            results.warnings.push({ row: rowNum, message: `Duplicate data error: ${detail}` });
                            results.failed++;
                        } else {
                            throw createError; // Throw other errors
                        }
                    }
                }

            } catch (err) {
                // Catch-all for row failures
                console.error(`Row ${rowNum} Error:`, err.message);
                results.failed++;
                results.errors.push({ row: rowNum, error: err.message }); // For UI
            }
        }

        // Generate Summary of Warnings
        const warningSummary = results.warnings.reduce((acc, w) => {
            const key = w.message.split(':')[0] || 'Other';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        results.summary = warningSummary;

        // Write detailed logs to file for debugging
        try {
            const fs = require('fs');
            const path = require('path');
            const logDir = path.join(__dirname, '../logs');
            if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

            fs.writeFileSync(
                path.join(logDir, 'import_warnings.json'),
                JSON.stringify(results.warnings, null, 2)
            );
            console.log("Written import warnings to logs/import_warnings.json");
        } catch (e) {
            console.error("Failed to write log file:", e);
        }

        console.log("Import Summary:", JSON.stringify(results.summary));

        return results;
    }

    // ----------------------------------------------------
    // HELPER FUNCTIONS
    // ----------------------------------------------------

    async resolveSiteId(siteIdentifier) {
        if (!siteIdentifier) {
            const siteRes = await db.query('SELECT site_id FROM sites LIMIT 1');
            if (siteRes.rows.length > 0) return siteRes.rows[0].site_id;
            throw new Error('No sites found. Please create a site first.');
        }

        if (!isNaN(siteIdentifier)) return parseInt(siteIdentifier);

        const siteRes = await db.query('SELECT site_id FROM sites WHERE site_code = $1', [siteIdentifier]);
        if (siteRes.rows.length > 0) return siteRes.rows[0].site_id;

        try {
            return parseInt(siteIdentifier);
        } catch {
            throw new Error(`Invalid Site Code: ${siteIdentifier}`);
        }
    }

    /**
     * Clean Identity Fields (Aadhaar, UAN, Mobile, PAN)
     * @param {string} val - Input value
     * @param {boolean} numericOnly - If true, rejects values containing letters
     */
    cleanIdentity(val, numericOnly = false) {
        if (!val) return null;
        let str = String(val).trim();

        // Remove common placeholders
        if (['-', 'n/a', 'na', 'nil', 'null', 'applied', 'not available'].includes(str.toLowerCase())) return null;

        // Remove spaces and special chars, keep alphanumeric
        const clean = str.replace(/[^a-zA-Z0-9]/g, ''); // Remove spaces, dashes

        if (!clean) return null;

        if (numericOnly) {
            // If strictly numeric, check for any non-digits
            if (/[^0-9]/.test(clean)) return null;
        }

        return clean;
    }

    /**
     * Parse Date safely
     */
    parseDate(val) {
        if (!val) return null;
        if (val instanceof Date && !isNaN(val)) return val;

        let date = null;

        // Excel Serial Number
        if (typeof val === 'number') {
            const utc_days = Math.floor(val - 25569);
            const utc_value = utc_days * 86400;
            date = new Date(utc_value * 1000);
        } else if (typeof val === 'string') {
            const raw = val.trim();
            if (['-', 'n/a', 'na'].includes(raw.toLowerCase())) return null;

            // Try standard parse
            date = new Date(raw);

            // Try DD-MM-YYYY or DD/MM/YYYY
            if (isNaN(date.getTime())) {
                const parts = raw.split(/[-/.]/);
                if (parts.length === 3) {
                    const d = parseInt(parts[0]);
                    const m = parseInt(parts[1]) - 1; // Month index
                    const y = parseInt(parts[2]);
                    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                        date = new Date(y, m, d);
                    }
                }
            }
        }

        return (date && !isNaN(date.getTime())) ? date : null;
    }

    /**
     * Clean Text
     */
    cleanExcelText(val) {
        if (!val) return null;
        let str = String(val);
        // Normalize whitespace
        str = str.replace(/[\n\r\t]+/g, ' ').replace(/\s\s+/g, ' ').trim();

        if (['-', 'n/a', 'na', 'nil', 'null', 'applied', 'not available'].includes(str.toLowerCase())) return null;
        if (str === '') return null;

        // Safe truncate
        return str.substring(0, 145);
    }

    /**
     * Clean Number
     */
    cleanNumber(val) {
        const clean = this.cleanIdentity(val, true);
        return clean;
    }
}

module.exports = new StatutoryService();
