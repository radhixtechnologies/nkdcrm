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
        // Scan first 25 rows to find the header row containing key columns
        let headerRowIndex = -1;
        let colMap = null;

        for (let r = 0; r < Math.min(data.length, 25); r++) {
            const row = data[r];
            if (!row || !Array.isArray(row)) continue;
            const mapped = this.buildColumnMap(row);
            if (mapped.name !== undefined && (mapped.aadhaar !== undefined || mapped.mobile !== undefined || mapped.uan !== undefined || mapped.account_number !== undefined || mapped.father_name !== undefined)) {
                headerRowIndex = r;
                colMap = mapped;
                console.log(`Smart Detected Header at Row ${r}:`, colMap);
                break;
            }
        }

        // Fallback if autodetection fails (Legacy support for Form XIII Row 7 data start -> Header at 6)
        if (headerRowIndex === -1) {
            console.warn("Could not auto-detect smart header row. Trying default Form XIII offset (skipping first 7 rows).");
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
            const testNameIdx = colMap ? colMap.name : 1;
            if (!row || row.length === 0 || !row[testNameIdx]) continue;

            try {
                // ----------------------------------------------------
                // 1. SAFE PARSING (Normalize Data)
                // ----------------------------------------------------
                let rawName, firstName, lastName, designation, aadhaar, uan, mobile, pan, esi;
                let dob, doj, exitDate, gender, fatherName, nationality, education, skillCategory;
                let empType, accountNo, bankName, ifsc, address, permAddress, serviceBook, exitReason;
                let identMark, remarks, photoUrl;

                if (colMap) {
                    // Smart Column Mapped Parsing
                    rawName = this.cleanExcelText(row[colMap.name]);
                    if (rawName && rawName.includes(' ')) {
                        const parts = rawName.split(/\s+/);
                        firstName = parts[0];
                        lastName = parts.slice(1).join(' ');
                    } else {
                        firstName = rawName;
                        lastName = null;
                    }

                    designation = colMap.designation !== undefined ? this.cleanExcelText(row[colMap.designation]) : 'Worker';
                    aadhaar = colMap.aadhaar !== undefined ? this.cleanIdentity(row[colMap.aadhaar], true) : null;
                    uan = colMap.uan !== undefined ? this.cleanIdentity(row[colMap.uan], true) : null;
                    mobile = colMap.mobile !== undefined ? this.cleanIdentity(row[colMap.mobile], true) : null;
                    pan = colMap.pan !== undefined ? this.cleanIdentity(row[colMap.pan], false) : null;
                    esi = colMap.esi !== undefined ? this.cleanIdentity(row[colMap.esi], false) : null;

                    dob = colMap.dob !== undefined ? this.parseDate(row[colMap.dob]) : null;
                    doj = colMap.doj !== undefined ? this.parseDate(row[colMap.doj]) : new Date();
                    exitDate = colMap.exit_date !== undefined ? this.parseDate(row[colMap.exit_date]) : null;

                    gender = colMap.gender !== undefined ? this.cleanExcelText(row[colMap.gender]) : 'Male';
                    fatherName = colMap.father_name !== undefined ? this.cleanExcelText(row[colMap.father_name]) : null;
                    nationality = colMap.nationality !== undefined ? (this.cleanExcelText(row[colMap.nationality]) || 'Indian') : 'Indian';
                    education = colMap.education !== undefined ? this.cleanExcelText(row[colMap.education]) : null;
                    skillCategory = colMap.skill !== undefined ? this.cleanExcelText(row[colMap.skill]) : 'Skilled';
                    empType = colMap.employment_type !== undefined ? (this.cleanExcelText(row[colMap.employment_type]) || 'CONTRACT') : 'CONTRACT';

                    accountNo = colMap.account_number !== undefined ? this.cleanIdentity(row[colMap.account_number], false) : null;
                    ifsc = colMap.ifsc !== undefined ? this.cleanIdentity(row[colMap.ifsc], false) : null;
                    bankName = colMap.bank_name !== undefined ? this.cleanExcelText(row[colMap.bank_name]) : this.deduceBankFromIfsc(ifsc);

                    address = colMap.address !== undefined ? this.cleanExcelText(row[colMap.address]) : null;
                    permAddress = colMap.permanent_address !== undefined ? this.cleanExcelText(row[colMap.permanent_address]) : address;
                    serviceBook = colMap.service_book_no !== undefined ? this.cleanExcelText(row[colMap.service_book_no]) : null;
                    exitReason = colMap.reason_for_exit !== undefined ? this.cleanExcelText(row[colMap.reason_for_exit]) : null;
                    identMark = colMap.identification_mark !== undefined ? this.cleanExcelText(row[colMap.identification_mark]) : null;
                    remarks = colMap.remarks !== undefined ? this.cleanExcelText(row[colMap.remarks]) : null;
                    photoUrl = colMap.photo !== undefined ? this.cleanExcelText(row[colMap.photo]) : null;
                } else {
                    // Legacy Form XIII Fallback
                    rawName = this.cleanExcelText(row[1]);
                    firstName = rawName;
                    lastName = null;
                    designation = this.cleanExcelText(row[8]) || 'Worker';

                    aadhaar = this.cleanIdentity(row[15], true);
                    uan = this.cleanIdentity(row[12], true);
                    mobile = this.cleanIdentity(row[11], true);
                    pan = this.cleanIdentity(row[13], false);
                    esi = this.cleanIdentity(row[14], false);

                    dob = this.parseDate(row[4]);
                    doj = this.parseDate(row[7]) || new Date();
                    exitDate = this.parseDate(row[22]);

                    gender = this.cleanExcelText(row[2]) || 'Male';
                    fatherName = this.cleanExcelText(row[3]);
                    nationality = this.cleanExcelText(row[5]) || 'Indian';
                    education = this.cleanExcelText(row[6]);
                    skillCategory = this.cleanExcelText(row[9]);
                    empType = this.cleanExcelText(row[10]) || 'CONTRACT';

                    accountNo = this.cleanIdentity(row[16], false);
                    bankName = this.cleanExcelText(row[17]) || this.deduceBankFromIfsc(this.cleanIdentity(row[18], false));
                    ifsc = this.cleanIdentity(row[18], false);

                    address = this.cleanExcelText(row[19]);
                    permAddress = this.cleanExcelText(row[20]);
                    serviceBook = this.cleanExcelText(row[21]);
                    exitReason = this.cleanExcelText(row[23]);
                    identMark = this.cleanExcelText(row[24]);
                    remarks = this.cleanExcelText(row[28]);
                    photoUrl = null;
                }

                // Clean mobile if 11 digits starting with 0 or has country code
                if (mobile && mobile.length > 10) {
                    if (mobile.startsWith('91') && mobile.length === 12) mobile = mobile.substring(2);
                    else if (mobile.startsWith('0') && mobile.length === 11) mobile = mobile.substring(1);
                    else mobile = mobile.slice(-10);
                }

                // ----------------------------------------------------
                // 2. VALIDATION (Reject only if absolutely necessary)
                // ----------------------------------------------------
                if (!aadhaar && !mobile && !rawName) {
                    results.failed++;
                    results.warnings.push({
                        row: rowNum,
                        message: `Skipped: Missing Name, Aadhaar and Mobile.`
                    });
                    continue;
                }

                const docsPayload = {};
                if (photoUrl && (photoUrl.startsWith('http') || photoUrl.startsWith('/uploads') || photoUrl.includes('.'))) {
                    docsPayload.employee_photo = photoUrl;
                }

                // Construct Employee Data
                const employeeData = {
                    first_name: firstName,
                    last_name: lastName,
                    full_name: rawName,
                    gender: gender,
                    father_name: fatherName,
                    dob: dob,
                    nationality: nationality,
                    education: education,
                    date_of_joining: doj,
                    designation: designation,
                    department: 'Operations',
                    skill_category: skillCategory,
                    employment_type: empType,
                    mobile: mobile,
                    uan_number: uan,
                    pan_number: pan,
                    esi_number: esi,
                    aadhaar_number: aadhaar,
                    account_number: accountNo,
                    bank_name: bankName,
                    ifsc_code: ifsc,
                    address: address,
                    permanent_address: permAddress,
                    service_book_no: serviceBook,
                    date_of_exit: exitDate,
                    reason_for_exit: exitReason,
                    identification_mark: identMark,
                    remarks: remarks,
                    documents: docsPayload,

                    // Defaults
                    wage_type: 'MONTHLY',
                    basic_salary: 0,
                    site_id: resolvedSiteId,
                    is_active: !exitDate
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

        // Write detailed logs to file for debugging with safe temp fallback
        try {
            const fs = require('fs');
            const path = require('path');
            const os = require('os');
            let logDir = path.join(__dirname, '../logs');
            try {
                if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
                fs.accessSync(logDir, fs.constants.W_OK);
            } catch (_) {
                logDir = os.tmpdir();
            }

            fs.writeFileSync(
                path.join(logDir, 'import_warnings.json'),
                JSON.stringify(results.warnings, null, 2)
            );
        } catch (e) {
            console.warn('Note writing import log file:', e.message);
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
     * Build dynamic column map from header row
     */
    buildColumnMap(headerRow) {
        const colMap = {};
        if (!Array.isArray(headerRow)) return colMap;

        headerRow.forEach((col, idx) => {
            if (col === undefined || col === null) return;
            const h = String(col).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!h) return;

            if (/^(slno|srno|sno|serialno|id)$/.test(h)) colMap.slno = idx;
            else if (h.includes('nameofemployee') || h.includes('employeename') || h.includes('workername') || h === 'name' || h === 'employees') colMap.name = idx;
            else if (h.includes('father') || h.includes('husband') || h.includes('spouse')) colMap.father_name = idx;
            else if (h.includes('adhar') || h.includes('aadhaar')) colMap.aadhaar = idx;
            else if (h.includes('bankac') || h.includes('accountno') || h.includes('acno') || h.includes('bankaccount') || h.includes('accountnumber')) colMap.account_number = idx;
            else if (h.includes('ifsc')) colMap.ifsc = idx;
            else if (h.includes('uan')) colMap.uan = idx;
            else if (h.includes('pan')) colMap.pan = idx;
            else if (h.includes('mobile') || h.includes('phone') || h.includes('contact')) colMap.mobile = idx;
            else if (h.includes('dateofjoining') || h.includes('doj') || h.includes('joiningdate')) colMap.doj = idx;
            else if (h.includes('photo') || h.includes('image') || h.includes('picture')) colMap.photo = idx;
            else if (h.includes('remark')) colMap.remarks = idx;
            else if (h.includes('designation') || h.includes('trade') || h.includes('post') || h.includes('role')) colMap.designation = idx;
            else if (h.includes('department') || h.includes('dept')) colMap.department = idx;
            else if (h.includes('gender') || h.includes('sex')) colMap.gender = idx;
            else if (h.includes('dob') || h.includes('dateofbirth') || h.includes('birthdate')) colMap.dob = idx;
            else if (h.includes('skill') || h.includes('category')) colMap.skill = idx;
            else if (h.includes('esi') || h.includes('esic')) colMap.esi = idx;
            else if (h.includes('permanentaddress')) colMap.permanent_address = idx;
            else if (h.includes('address')) colMap.address = idx;
            else if (h.includes('servicebook')) colMap.service_book_no = idx;
            else if (h.includes('exitdate') || h.includes('dateofexit')) colMap.exit_date = idx;
            else if (h.includes('reasonforexit') || h.includes('exitreason')) colMap.reason_for_exit = idx;
            else if (h.includes('identification') || h.includes('mark')) colMap.identification_mark = idx;
            else if (h.includes('bankname') || h.includes('nameofbank')) colMap.bank_name = idx;
        });

        return colMap;
    }

    /**
     * Deduce bank name from IFSC 4-letter prefix
     */
    deduceBankFromIfsc(ifsc) {
        if (!ifsc || typeof ifsc !== 'string') return null;
        const prefix = ifsc.trim().toUpperCase().substring(0, 4);
        const bankMap = {
            'SBIN': 'State Bank of India',
            'UBIN': 'Union Bank of India',
            'BARB': 'Bank of Baroda',
            'PUNB': 'Punjab National Bank',
            'ICIC': 'ICICI Bank',
            'HDFC': 'HDFC Bank',
            'UTIB': 'Axis Bank',
            'CNRB': 'Canara Bank',
            'BKID': 'Bank of India',
            'CBIN': 'Central Bank of India',
            'IDIB': 'Indian Bank',
            'IOBA': 'Indian Overseas Bank',
            'KKBK': 'Kotak Mahindra Bank',
            'YESB': 'Yes Bank',
            'IDFB': 'IDFC First Bank',
            'INDB': 'IndusInd Bank',
            'BDBL': 'Bandhan Bank',
            'FDRL': 'Federal Bank',
            'MAHB': 'Bank of Maharashtra',
            'PSIB': 'Punjab & Sind Bank',
            'UCBA': 'UCO Bank'
        };
        return bankMap[prefix] || null;
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
