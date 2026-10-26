const express = require('express');
const fs = require('fs');
const xlsx = require('xlsx');
const db = require('../config/database');
const upload = require('../config/multer');
const { authenticate } = require('../middleware/auth');

// Service imports
const employeeService = require('../services/employeeService');
const siteService = require('../services/siteService');
const shiftService = require('../services/shiftService');
const statutoryService = require('../services/statutoryService');
const attendanceDailyService = require('../services/attendanceDailyService');
const attendanceService = require('../services/attendanceService');
const biometricService = require('../services/biometricService');
const leaveService = require('../services/leaveService');
const payrollService = require('../services/payrollService');
const benefitService = require('../services/benefitService');
const perkService = require('../services/perkService');
const reportsService = require('../services/reportsService');
const pdfService = require('../services/pdfService');
const excelService = require('../services/excelService');
const invoiceService = require('../services/invoiceService');
const recruitmentService = require('../services/recruitmentService');
const vendorService = require('../services/vendorService');
const assetService = require('../services/assetService');
const aiService = require('../services/aiService');

const router = express.Router();
router.use(authenticate);

const sendData = (res, data, status = 200) => res.status(status).json({ success: true, data });
const sendError = (next, error) => next(error);

// Helper to resolve employee by code or id
const resolveEmployee = async (codeOrId) => {
    if (!codeOrId) return null;
    if (typeof codeOrId === 'number' || (/^\d+$/.test(String(codeOrId)) && !String(codeOrId).startsWith('EMP-'))) {
        const res = await db.query(
            'SELECT employee_id, employee_code, first_name, last_name, full_name, email FROM employees WHERE employee_id = $1',
            [parseInt(codeOrId)]
        );
        if (res.rows.length > 0) return res.rows[0];
    }
    const res = await db.query(
        'SELECT employee_id, employee_code, first_name, last_name, full_name, email FROM employees WHERE LOWER(employee_code) = LOWER($1)',
        [String(codeOrId).trim()]
    );
    return res.rows[0] || null;
};

// Helper to get requester's employee record
const getRequesterEmployee = async (user) => {
    if (user.employeeId) {
        return resolveEmployee(user.employeeId);
    }
    if (user.employeeCode) {
        return resolveEmployee(user.employeeCode);
    }
    const res = await db.query('SELECT employee_id FROM users WHERE user_id = $1', [user.userId]);
    if (res.rows[0]?.employee_id) {
        return resolveEmployee(res.rows[0].employee_id);
    }
    return null;
};

// Helper to get file buffer from multer
const getFileBuffer = (file) => {
    if (!file) return null;
    if (file.buffer) return file.buffer;
    if (file.path && fs.existsSync(file.path)) {
        const buffer = fs.readFileSync(file.path);
        // Clean up temporary file
        fs.unlink(file.path, () => {});
        return buffer;
    }
    return null;
};

// ==========================================
// 0. DASHBOARD STATS & CHARTS
// ==========================================
router.get('/dashboard/stats', async (req, res, next) => {
    try {
        const empCountRes = await db.query(
            "SELECT COUNT(*)::int as total FROM employees WHERE employment_status != 'TERMINATED'"
        );
        const totalEmployees = empCountRes.rows[0]?.total || 0;

        const todayAttendanceRes = await db.query(`
            SELECT 
                COUNT(DISTINCT CASE WHEN status = 'P' OR check_in IS NOT NULL THEN employee_id END)::int as present,
                COUNT(DISTINCT CASE WHEN status = 'A' THEN employee_id END)::int as absent,
                COUNT(DISTINCT CASE WHEN status = 'HD' THEN employee_id END)::int as half_day,
                COUNT(DISTINCT CASE WHEN status = 'L' THEN employee_id END)::int as on_leave
            FROM attendance_daily 
            WHERE date = CURRENT_DATE
        `);
        const presentToday = todayAttendanceRes.rows[0]?.present || 0;
        const absentToday = todayAttendanceRes.rows[0]?.absent || 0;
        const onLeaveToday = todayAttendanceRes.rows[0]?.on_leave || 0;

        const pendingLeavesRes = await db.query(
            "SELECT COUNT(*)::int as count FROM leave_requests WHERE status = 'PENDING'"
        );
        const pendingLeaves = pendingLeavesRes.rows[0]?.count || 0;

        const pendingClaimsRes = await db.query(
            "SELECT COUNT(*)::int as count FROM reimbursements WHERE status = 'PENDING'"
        );
        const pendingClaims = pendingClaimsRes.rows[0]?.count || 0;

        const sitesRes = await db.query("SELECT COUNT(*)::int as count FROM sites WHERE is_active = true");
        const totalSites = sitesRes.rows[0]?.count || 0;

        const payrollRes = await db.query(`
            SELECT COALESCE(SUM(net_salary), 0)::numeric as total, month, year 
            FROM payroll 
            GROUP BY month, year 
            ORDER BY year DESC, month DESC 
            LIMIT 1
        `);
        const latestPayroll = payrollRes.rows[0] ? {
            amount: parseFloat(payrollRes.rows[0].total) || 0,
            month: payrollRes.rows[0].month,
            year: payrollRes.rows[0].year
        } : { amount: 0, month: new Date().getMonth() + 1, year: new Date().getFullYear() };

        const attendanceRate = totalEmployees > 0 
            ? Math.round((presentToday / totalEmployees) * 100) 
            : 0;

        let complianceAlerts = { summary: {}, alerts: [] };
        try {
            complianceAlerts = await invoiceService.getComplianceAlerts();
        } catch (e) {
            console.warn('Compliance alerts fetch error:', e.message);
        }

        let invoiceStats = { total_invoiced: 0, total_received: 0, pending_amount: 0, overdue_amount: 0 };
        try {
            invoiceStats = await invoiceService.getInvoiceStats();
        } catch (e) {
            console.warn('Invoice stats fetch error:', e.message);
        }

        return sendData(res, {
            totalEmployees,
            presentToday,
            absentToday,
            onLeaveToday,
            attendanceRate,
            pendingLeaves,
            pendingClaims,
            totalSites,
            latestPayroll,
            complianceAlerts,
            invoiceStats
        });
    } catch (error) { return sendError(next, error); }
});

router.get('/dashboard/charts', async (req, res, next) => {
    try {
        const trendRes = await db.query(`
            WITH dates AS (
                SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval)::date AS day
            )
            SELECT 
                d.day as date,
                TO_CHAR(d.day, 'Dy') as day_name,
                COUNT(CASE WHEN a.status = 'P' OR a.check_in IS NOT NULL THEN 1 END)::int as present,
                COUNT(CASE WHEN a.status = 'A' THEN 1 END)::int as absent,
                COUNT(CASE WHEN a.status = 'HD' THEN 1 END)::int as half_day,
                COUNT(CASE WHEN a.status = 'L' THEN 1 END)::int as on_leave
            FROM dates d
            LEFT JOIN attendance_daily a ON a.date = d.day
            GROUP BY d.day
            ORDER BY d.day ASC
        `);

        const deptRes = await db.query(`
            SELECT 
                COALESCE(NULLIF(TRIM(department), ''), 'General') as label,
                COUNT(*)::int as value
            FROM employees
            WHERE employment_status != 'TERMINATED'
            GROUP BY label
            ORDER BY value DESC
            LIMIT 6
        `);

        const siteRes = await db.query(`
            SELECT 
                COALESCE(s.site_name, 'Head Office') as label,
                COUNT(e.employee_id)::int as value
            FROM employees e
            LEFT JOIN sites s ON e.site_id = s.site_id
            WHERE e.employment_status != 'TERMINATED'
            GROUP BY s.site_name
            ORDER BY value DESC
            LIMIT 5
        `);

        const payrollTrendRes = await db.query(`
            SELECT 
                month,
                year,
                TO_CHAR(TO_DATE(month::text, 'MM'), 'Mon') as month_name,
                COALESCE(SUM(net_salary), 0)::numeric as net_total,
                COALESCE(SUM(gross_earnings), 0)::numeric as gross_total
            FROM payroll
            GROUP BY year, month
            ORDER BY year DESC, month DESC
            LIMIT 6
        `);

        const recentAttendance = await db.query(`
            SELECT 
                a.attendance_id, 
                a.date, 
                TO_CHAR(a.check_in, 'HH24:MI') as time, 
                a.status,
                e.first_name, 
                e.last_name, 
                e.employee_code
            FROM attendance_daily a
            JOIN employees e ON a.employee_id = e.employee_id
            ORDER BY a.updated_at DESC
            LIMIT 5
        `);

        return sendData(res, {
            attendanceTrend: trendRes.rows,
            departmentBreakdown: deptRes.rows,
            siteDistribution: siteRes.rows,
            payrollTrend: payrollTrendRes.rows.reverse(),
            recentActivity: recentAttendance.rows
        });
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// 1. EMPLOYEES
// ==========================================
router.get('/employees', async (req, res, next) => {
    try { return sendData(res, await employeeService.getAllEmployees(req.query)); } catch (error) { return sendError(next, error); }
});

router.get('/employees/:employeeCode', async (req, res, next) => {
    try {
        let employee = await employeeService.getEmployeeByCode(req.params.employeeCode);
        if (!employee && /^\d+$/.test(req.params.employeeCode)) {
            const byId = await resolveEmployee(req.params.employeeCode);
            if (byId) {
                employee = await employeeService.getEmployeeByCode(byId.employee_code);
            }
        }
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
        return sendData(res, employee);
    } catch (error) { return sendError(next, error); }
});

router.post('/employees', async (req, res, next) => {
    try { return sendData(res, await employeeService.createEmployee(req.body), 201); } catch (error) { return sendError(next, error); }
});

router.post('/employees/upload-document', upload.single('file'), (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        return res.json({
            success: true,
            url: fileUrl,
            message: 'Document uploaded successfully',
            data: {
                url: fileUrl,
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            }
        });
    } catch (error) {
        return sendError(next, error);
    }
});

router.put('/employees/profile/update', async (req, res, next) => {
    try {
        const emp = await getRequesterEmployee(req.user);
        if (!emp) return res.status(400).json({ success: false, message: 'User is not linked to an employee' });
        return sendData(res, await employeeService.updateEmployee(emp.employee_code, req.body));
    } catch (error) { return sendError(next, error); }
});

router.put('/employees/:employeeCode', async (req, res, next) => {
    try {
        let code = req.params.employeeCode;
        if (/^\d+$/.test(code)) {
            const byId = await resolveEmployee(code);
            if (byId) code = byId.employee_code;
        }
        return sendData(res, await employeeService.updateEmployee(code, req.body));
    } catch (error) { return sendError(next, error); }
});

router.delete('/employees/:employeeCode', async (req, res, next) => {
    try {
        let code = req.params.employeeCode;
        if (/^\d+$/.test(code)) {
            const byId = await resolveEmployee(code);
            if (byId) code = byId.employee_code;
        }
        return sendData(res, await employeeService.deleteEmployee(code));
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// 2. SITES & SHIFTS
// ==========================================
router.get('/sites', async (req, res, next) => {
    try { return sendData(res, await siteService.getAllSites()); } catch (error) { return sendError(next, error); }
});
router.post('/sites', async (req, res, next) => {
    try { return sendData(res, await siteService.createSite(req.body), 201); } catch (error) { return sendError(next, error); }
});
router.put('/sites/:id', async (req, res, next) => {
    try { return sendData(res, await siteService.updateSite(req.params.id, req.body)); } catch (error) { return sendError(next, error); }
});
router.delete('/sites/:id', async (req, res, next) => {
    try { return sendData(res, await siteService.deleteSite(req.params.id)); } catch (error) { return sendError(next, error); }
});

router.get('/shifts', async (req, res, next) => {
    try { return sendData(res, await shiftService.getAllShifts()); } catch (error) { return sendError(next, error); }
});
router.post('/shifts', async (req, res, next) => {
    try { return sendData(res, await shiftService.createShift(req.body), 201); } catch (error) { return sendError(next, error); }
});
router.put('/shifts/:id', async (req, res, next) => {
    try { return sendData(res, await shiftService.updateShift(req.params.id, req.body)); } catch (error) { return sendError(next, error); }
});
router.delete('/shifts/:id', async (req, res, next) => {
    try { return sendData(res, await shiftService.deleteShift(req.params.id)); } catch (error) { return sendError(next, error); }
});
router.put('/shifts/:employeeCode/assign', async (req, res, next) => {
    try { return sendData(res, await shiftService.assignShiftToEmployee(req.params.employeeCode, req.body.shift_id)); } catch (error) { return sendError(next, error); }
});

// ==========================================
// 3. STATUTORY REGISTER IMPORT
// ==========================================
router.post('/statutory/import-register', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
        const fileBuffer = getFileBuffer(req.file);
        const result = await statutoryService.importRegister(fileBuffer, req.body.site_id || 1);
        return res.json({ success: true, data: result });
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// 4. DAILY ATTENDANCE & TRACKER
// ==========================================
router.post('/daily-attendance/import', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
        const fileBuffer = getFileBuffer(req.file);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = xlsx.utils.sheet_to_json(sheet);

        const rows = rawRows.map(r => ({
            employee_code: r.employee_code || r['Employee Code'] || r['Emp Code'] || r['emp_code'] || r.code,
            date: r.date || r['Date'] || r['punch_date'] || r['Punch Date'],
            status: r.status || r['Status'] || 'P',
            check_in: r.check_in || r['Check In'] || r['in_time'] || r['In Time'],
            check_out: r.check_out || r['Check Out'] || r['out_time'] || r['Out Time']
        })).filter(r => r.employee_code && r.date);

        const results = await attendanceDailyService.bulkImport(rows);
        return res.json({ success: true, summary: results, errors: results.errors, data: results });
    } catch (error) { return sendError(next, error); }
});

router.get('/daily-attendance/list', async (req, res, next) => {
    try {
        const { startDate, endDate, employeeId } = req.query;
        const start = startDate || new Date().toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];
        const logs = await attendanceDailyService.getAttendanceByDateRange(start, end, employeeId);
        return sendData(res, logs);
    } catch (error) { return sendError(next, error); }
});

// Time tracker endpoints
router.get('/attendance/tracker/history', async (req, res, next) => {
    try {
        const emp = await getRequesterEmployee(req.user);
        if (!emp) return res.json([]);
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const start = thirtyDaysAgo.toISOString().split('T')[0];
        const end = today.toISOString().split('T')[0];
        const logs = await attendanceDailyService.getAttendanceByDateRange(start, end, emp.employee_id);
        return res.json(logs);
    } catch (error) { return sendError(next, error); }
});

router.post('/attendance/tracker/check-in', async (req, res, next) => {
    try {
        const emp = await getRequesterEmployee(req.user);
        if (!emp) return res.status(400).json({ success: false, msg: 'Employee not found for current user' });
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const check_in = now.toTimeString().split(' ')[0];
        const { latitude, longitude, location_accuracy, punch_address } = req.body;

        const log = await attendanceDailyService.upsertAttendance({
            employee_id: emp.employee_id,
            date,
            status: 'P',
            source: latitude ? 'GPS' : 'WEB_PORTAL',
            check_in,
            latitude: latitude || null,
            longitude: longitude || null,
            location_accuracy: location_accuracy || null,
            punch_address: punch_address || null
        });
        return res.json({ success: true, check_in, data: log });
    } catch (error) { return sendError(next, error); }
});

router.post('/attendance/tracker/check-out', async (req, res, next) => {
    try {
        const emp = await getRequesterEmployee(req.user);
        if (!emp) return res.status(400).json({ success: false, msg: 'Employee not found for current user' });
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const check_out = now.toTimeString().split(' ')[0];
        const { latitude, longitude, location_accuracy, punch_address } = req.body;

        const log = await attendanceDailyService.upsertAttendance({
            employee_id: emp.employee_id,
            date,
            status: 'P',
            source: latitude ? 'GPS' : 'WEB_PORTAL',
            check_out,
            latitude: latitude || null,
            longitude: longitude || null,
            location_accuracy: location_accuracy || null,
            punch_address: punch_address || null
        });
        return res.json({ success: true, check_out, data: log });
    } catch (error) { return sendError(next, error); }
});

router.post('/attendance/gps-punch', async (req, res, next) => {
    try {
        const { employee_id, latitude, longitude, location_accuracy, punch_address, punch_type } = req.body;
        const targetEmp = employee_id ? await resolveEmployee(employee_id) : await getRequesterEmployee(req.user);
        if (!targetEmp) return res.status(400).json({ success: false, message: 'Employee not found' });

        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0];

        const payload = {
            employee_id: targetEmp.employee_id,
            date,
            status: 'P',
            source: 'GPS',
            latitude,
            longitude,
            location_accuracy,
            punch_address
        };

        if (punch_type === 'OUT') {
            payload.check_out = timeStr;
        } else {
            payload.check_in = timeStr;
        }

        const log = await attendanceDailyService.upsertAttendance(payload);
        return res.json({
            success: true,
            message: `GPS punch recorded successfully at ${timeStr}`,
            data: log
        });
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// 5. BIOMETRIC LOGS
// ==========================================
router.post('/biometric/import', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
        const fileBuffer = getFileBuffer(req.file);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = xlsx.utils.sheet_to_json(sheet);

        const logs = rawRows.map(r => ({
            employee_code: r.employee_code || r['Employee Code'] || r['Emp Code'] || r['emp_code'],
            punch_date: r.punch_date || r['Punch Date'] || r.date || r['Date'],
            in_time: r.in_time || r['In Time'] || r.check_in || r['Check In'],
            out_time: r.out_time || r['Out Time'] || r.check_out || r['Check Out'],
            device_id: r.device_id || r['Device ID'] || 'BIOMETRIC-1'
        })).filter(r => r.employee_code && r.punch_date);

        const results = await biometricService.importBiometricLogs(logs, {
            upload_batch_id: `BATCH-${Date.now()}`,
            uploaded_by: req.user.email || 'Admin'
        });
        return res.json({ success: true, summary: results, errors: results.errors, data: results });
    } catch (error) { return sendError(next, error); }
});

router.get('/biometric/pending', async (req, res, next) => {
    try {
        const result = await db.query('SELECT * FROM biometric_logs WHERE is_processed = FALSE ORDER BY punch_date DESC LIMIT 100');
        return sendData(res, result.rows);
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// 6. LEAVES
// ==========================================
router.get('/leave-types', async (req, res, next) => {
    try { return sendData(res, await leaveService.getLeaveTypes()); } catch (error) { return sendError(next, error); }
});

router.get('/leaves/types', async (req, res, next) => {
    try { return sendData(res, await leaveService.getLeaveTypes()); } catch (error) { return sendError(next, error); }
});

router.get('/leaves/balance/:code', async (req, res, next) => {
    try {
        const emp = await resolveEmployee(req.params.code);
        if (!emp) return sendData(res, []);
        const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
        const balances = await leaveService.getLeaveBalance(emp.employee_id, year);
        return sendData(res, balances);
    } catch (error) { return sendError(next, error); }
});

router.post('/leaves/apply', async (req, res, next) => {
    try {
        let emp = null;
        const empIdentifier = req.body.employee_code || req.body.employee_id;
        if (empIdentifier) {
            emp = await resolveEmployee(empIdentifier);
        } else {
            emp = await getRequesterEmployee(req.user);
        }

        if (!emp) return res.status(400).json({ success: false, message: 'Employee not found. Please select a valid employee.' });
        const empId = emp.employee_id;

        const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'].includes(req.user?.roleCode);
        const autoApprove = isAdmin && (req.body.auto_approve === true || req.body.auto_approve === 'true');

        const leave = await leaveService.applyLeave({
            ...req.body,
            employee_id: parseInt(empId)
        });

        // If requested by Admin to auto-approve directly
        if (autoApprove && leave && leave.request_id) {
            const approver = await getRequesterEmployee(req.user);
            const approverId = approver ? approver.employee_id : null;
            const remarks = req.body.remarks || `Directly granted by ${req.user?.firstName || 'Admin'}`;
            const approved = await leaveService.approveLeave(leave.request_id, approverId, remarks);
            return sendData(res, approved, 201);
        }

        return sendData(res, leave, 201);
    } catch (error) { return sendError(next, error); }
});

router.get('/leaves/history/:code', async (req, res, next) => {
    try {
        const emp = await resolveEmployee(req.params.code);
        if (!emp) return sendData(res, []);
        const history = await leaveService.getLeaveHistory(emp.employee_id);
        return sendData(res, history);
    } catch (error) { return sendError(next, error); }
});

router.get('/leaves/pending', async (req, res, next) => {
    try { return sendData(res, await leaveService.getPendingRequests()); } catch (error) { return sendError(next, error); }
});

router.get('/leaves/all-requests', async (req, res, next) => {
    try { return sendData(res, await leaveService.getAllRequests(req.query)); } catch (error) { return sendError(next, error); }
});

router.post('/leaves/:id/approve', async (req, res, next) => {
    try {
        const approver = await getRequesterEmployee(req.user);
        const approverId = approver ? approver.employee_id : null;
        const updated = await leaveService.approveLeave(req.params.id, approverId, req.body.remarks);
        return sendData(res, updated);
    } catch (error) { return sendError(next, error); }
});

router.post('/leaves/:id/reject', async (req, res, next) => {
    try {
        const approver = await getRequesterEmployee(req.user);
        const approverId = approver ? approver.employee_id : null;
        const updated = await leaveService.rejectLeave(req.params.id, approverId, req.body.rejection_reason || 'Rejected by HR');
        return sendData(res, updated);
    } catch (error) { return sendError(next, error); }
});

router.post('/leaves/balance/:code/initialize', async (req, res, next) => {
    try {
        const emp = await resolveEmployee(req.params.code);
        if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
        const year = req.body.year ? parseInt(req.body.year) : new Date().getFullYear();
        const init = await leaveService.initializeLeaveBalance(emp.employee_id, year);
        return sendData(res, init);
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// 7. PAYROLL
// ==========================================
router.post('/payroll/generate', async (req, res, next) => {
    try {
        const month = parseInt(req.body.month);
        const year = parseInt(req.body.year);
        if (!month || !year) {
            return res.status(400).json({ success: false, message: 'Month and year are required' });
        }

        // Auto-compile attendance if not present for the period
        const existingAttendance = await attendanceService.getAttendanceByPeriod(month, year);
        if (existingAttendance.length === 0) {
            const employees = await db.query("SELECT employee_id FROM employees WHERE employment_status = 'ACTIVE'");
            for (const emp of employees.rows) {
                const dailyRes = await db.query(`
                    SELECT 
                        COUNT(CASE WHEN status = 'P' THEN 1 END) as p_cnt,
                        COUNT(CASE WHEN status = 'A' THEN 1 END) as a_cnt,
                        COUNT(CASE WHEN status = 'L' THEN 1 END) as l_cnt,
                        COUNT(CASE WHEN status = 'WO' THEN 1 END) as wo_cnt
                    FROM attendance_daily 
                    WHERE employee_id = $1 
                      AND EXTRACT(MONTH FROM date) = $2 
                      AND EXTRACT(YEAR FROM date) = $3
                `, [emp.employee_id, month, year]);

                const daily = dailyRes.rows[0];
                const totalLogged = parseInt(daily.p_cnt) + parseInt(daily.a_cnt) + parseInt(daily.l_cnt) + parseInt(daily.wo_cnt);

                try {
                    await attendanceService.createAttendance({
                        employee_id: emp.employee_id,
                        month,
                        year,
                        total_days: 30,
                        present_days: totalLogged > 0 ? parseFloat(daily.p_cnt) : 26,
                        absent_days: totalLogged > 0 ? parseFloat(daily.a_cnt) : 0,
                        weekly_off_days: totalLogged > 0 ? parseFloat(daily.wo_cnt) : 4,
                        leave_days: totalLogged > 0 ? parseFloat(daily.l_cnt) : 0,
                        half_days: 0,
                        overtime_hours: 0,
                        day_wise_attendance: {},
                        uploaded_by: 'AutoSync',
                        remarks: 'Compiled from system logs'
                    });
                } catch {
                    // Ignore duplicate
                }
            }
        }

        const results = await payrollService.bulkCalculatePayroll(month, year);
        return res.json({ success: true, summary: results, data: results });
    } catch (error) { return sendError(next, error); }
});

router.get('/payroll/list', async (req, res, next) => {
    try {
        const month = parseInt(req.query.month);
        const year = parseInt(req.query.year);
        const list = await payrollService.getPayrollByPeriod(month, year);
        return sendData(res, list);
    } catch (error) { return sendError(next, error); }
});

router.post('/payroll/finalize', async (req, res, next) => {
    try {
        const { payroll_ids } = req.body;
        if (!payroll_ids || !Array.isArray(payroll_ids) || payroll_ids.length === 0) {
            return res.status(400).json({ success: false, message: 'No payroll IDs selected' });
        }
        await db.query(`
            UPDATE payroll 
            SET payment_status = 'PAID', payment_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
            WHERE payroll_id = ANY($1::int[])
        `, [payroll_ids]);
        return res.json({ success: true, message: `Finalized ${payroll_ids.length} payroll records` });
    } catch (error) { return sendError(next, error); }
});

router.get('/payroll/config', async (req, res, next) => {
    try { return sendData(res, await payrollService.getPayrollConfig()); } catch (error) { return sendError(next, error); }
});

router.get('/payroll/my-history', async (req, res, next) => {
    try {
        const emp = await getRequesterEmployee(req.user);
        if (!emp) return sendData(res, []);
        const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
        const records = await payrollService.getPayrollByEmployee(emp.employee_id, { year });
        return sendData(res, records);
    } catch (error) { return sendError(next, error); }
});

router.get('/payroll/:id', async (req, res, next) => {
    try {
        const record = await payrollService.getPayrollById(req.params.id);
        if (!record) return res.status(404).json({ success: false, message: 'Payroll not found' });
        return sendData(res, record);
    } catch (error) { return sendError(next, error); }
});

router.get('/payroll/payslip/:id/pdf', async (req, res, next) => {
    try {
        const payroll = await payrollService.getPayrollById(req.params.id);
        if (!payroll) return res.status(404).send('Payslip not found');
        const employee = await employeeService.getEmployeeById(payroll.employee_id);
        await pdfService.generatePayslip(payroll, employee, res);
    } catch (error) { return sendError(next, error); }
});

router.get('/payroll/export/excel', async (req, res, next) => {
    try {
        const month = parseInt(req.query.month);
        const year = parseInt(req.query.year);
        const payrollList = await payrollService.getPayrollByPeriod(month, year);
        await excelService.generatePayrollExcel(payrollList, res);
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// 8. BENEFITS & REIMBURSEMENTS
// ==========================================
router.get('/benefits/types', async (req, res, next) => {
    try { return sendData(res, await benefitService.getBenefitTypes()); } catch (error) { return sendError(next, error); }
});

router.post('/benefits/assign', async (req, res, next) => {
    try {
        let empId = req.body.employee_id;
        if (req.body.employee_code && !empId) {
            const emp = await resolveEmployee(req.body.employee_code);
            if (emp) empId = emp.employee_id;
        } else if (empId) {
            const emp = await resolveEmployee(empId);
            if (emp) empId = emp.employee_id;
        }
        if (!empId) {
            return res.status(400).json({ success: false, message: 'Please select an employee' });
        }
        const assigned = await benefitService.assignBenefit({ ...req.body, employee_id: parseInt(empId) });
        return sendData(res, assigned, 201);
    } catch (error) { return sendError(next, error); }
});

router.get('/benefits/my-benefits/:employeeCode', async (req, res, next) => {
    try {
        const emp = await resolveEmployee(req.params.employeeCode);
        if (!emp) return sendData(res, []);
        const benefits = await benefitService.getEmployeeBenefits(emp.employee_id);
        return sendData(res, benefits);
    } catch (error) { return sendError(next, error); }
});

router.post('/reimbursements/apply', async (req, res, next) => {
    try {
        let emp = null;
        const empIdentifier = req.body.employee_code || req.body.employee_id;
        if (empIdentifier) {
            emp = await resolveEmployee(empIdentifier);
        } else {
            emp = await getRequesterEmployee(req.user);
        }

        if (!emp) return res.status(400).json({ success: false, message: 'Please select an employee' });
        const empId = emp.employee_id;

        const claim = await benefitService.applyReimbursement({ ...req.body, employee_id: parseInt(empId) });
        return sendData(res, claim, 201);
    } catch (error) { return sendError(next, error); }
});

router.get('/reimbursements/my/:employeeCode', async (req, res, next) => {
    try {
        const emp = await resolveEmployee(req.params.employeeCode);
        if (!emp) return sendData(res, []);
        const claims = await benefitService.getMyReimbursements(emp.employee_id);
        return sendData(res, claims);
    } catch (error) { return sendError(next, error); }
});

router.get('/reimbursements/pending', async (req, res, next) => {
    try { return sendData(res, await benefitService.getPendingReimbursements()); } catch (error) { return sendError(next, error); }
});

router.get('/reimbursements/all', async (req, res, next) => {
    try { return sendData(res, await benefitService.getAllReimbursements(req.query.status)); } catch (error) { return sendError(next, error); }
});

router.post('/reimbursements/approve', async (req, res, next) => {
    try {
        const approver = await getRequesterEmployee(req.user);
        const approverId = approver ? approver.employee_id : null;
        const updated = await benefitService.updateReimbursementStatus(req.body.claim_id, 'APPROVED', approverId, req.body.reason);
        return sendData(res, updated);
    } catch (error) { return sendError(next, error); }
});

router.post('/reimbursements/reject', async (req, res, next) => {
    try {
        const approver = await getRequesterEmployee(req.user);
        const approverId = approver ? approver.employee_id : null;
        const updated = await benefitService.updateReimbursementStatus(req.body.claim_id, 'REJECTED', approverId, req.body.reason || 'Rejected by HR');
        return sendData(res, updated);
    } catch (error) { return sendError(next, error); }
});

router.post('/reimbursements/mark-paid', async (req, res, next) => {
    try {
        const updated = await benefitService.markAsPaid(req.body.claim_id);
        return sendData(res, updated);
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// 9. PERKS
// ==========================================
router.get('/perks', async (req, res, next) => {
    try { return sendData(res, await perkService.getAllPerkTypes()); } catch (error) { return sendError(next, error); }
});

router.post('/perks/create', async (req, res, next) => {
    try { return sendData(res, await perkService.createPerkType(req.body), 201); } catch (error) { return sendError(next, error); }
});

router.post('/perks/assign', async (req, res, next) => {
    try {
        let empId = req.body.employee_id;
        if (req.body.employee_code && !empId) {
            const emp = await resolveEmployee(req.body.employee_code);
            if (emp) empId = emp.employee_id;
        } else if (empId) {
            const emp = await resolveEmployee(empId);
            if (emp) empId = emp.employee_id;
        }
        if (!empId) {
            return res.status(400).json({ success: false, message: 'Please select an employee' });
        }
        const assigned = await perkService.assignPerk({ ...req.body, employee_id: parseInt(empId) });
        return sendData(res, assigned, 201);
    } catch (error) { return sendError(next, error); }
});

router.get('/perks/my/:employeeCode', async (req, res, next) => {
    try {
        const emp = await resolveEmployee(req.params.employeeCode);
        if (!emp) return sendData(res, []);
        const perks = await perkService.getEmployeePerks(emp.employee_id);
        return sendData(res, perks);
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// 10. REPORTS
// ==========================================
router.get('/reports/pf', async (req, res, next) => {
    try {
        const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year) || new Date().getFullYear();
        return sendData(res, await reportsService.getPFReport(m, y));
    } catch (error) { return sendError(next, error); }
});

router.get('/reports/esi', async (req, res, next) => {
    try {
        const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year) || new Date().getFullYear();
        return sendData(res, await reportsService.getESIReport(m, y));
    } catch (error) { return sendError(next, error); }
});

router.get('/reports/pt', async (req, res, next) => {
    try {
        const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year) || new Date().getFullYear();
        return sendData(res, await reportsService.getPTReport(m, y));
    } catch (error) { return sendError(next, error); }
});

router.get('/reports/bank-transfer', async (req, res, next) => {
    try {
        const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year) || new Date().getFullYear();
        return sendData(res, await reportsService.getBankTransferStatement(m, y));
    } catch (error) { return sendError(next, error); }
});

router.get('/reports/attendance-summary', async (req, res, next) => {
    try {
        const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year) || new Date().getFullYear();
        return sendData(res, await reportsService.getAttendanceSummaryReport(m, y));
    } catch (error) { return sendError(next, error); }
});

router.get('/reports/department-cost', async (req, res, next) => {
    try {
        const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year) || new Date().getFullYear();
        return sendData(res, await reportsService.getDepartmentCostReport(m, y));
    } catch (error) { return sendError(next, error); }
});

router.get('/reports/overtime', async (req, res, next) => {
    try {
        const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year) || new Date().getFullYear();
        return sendData(res, await reportsService.getOvertimeReport(m, y));
    } catch (error) { return sendError(next, error); }
});

// Generic download reports endpoint
router.get('/reports/download/:type', async (req, res, next) => {
    try {
        const { type } = req.params;
        const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year) || new Date().getFullYear();

        let data;
        if (type === 'pf') data = await reportsService.getPFReport(m, y);
        else if (type === 'esi') data = await reportsService.getESIReport(m, y);
        else if (type === 'pt') data = await reportsService.getPTReport(m, y);
        else if (type === 'bank') data = await reportsService.getBankTransferStatement(m, y);
        else if (type === 'attendance') data = await reportsService.getAttendanceSummaryReport(m, y);
        else if (type === 'overtime') data = await reportsService.getOvertimeReport(m, y);
        else if (type === 'dept') data = await reportsService.getDepartmentCostReport(m, y);
        else return res.status(400).json({ success: false, message: 'Invalid report type' });

        return res.json({ success: true, reportType: type, period: { month: m, year: y }, data });
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// CLIENT MASTER & INVOICES
// ==========================================
router.get('/clients', async (req, res, next) => {
    try {
        return sendData(res, await invoiceService.getClients());
    } catch (error) { return sendError(next, error); }
});

router.post('/clients', async (req, res, next) => {
    try {
        return sendData(res, await invoiceService.createClient(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/clients/:id', async (req, res, next) => {
    try {
        return sendData(res, await invoiceService.updateClient(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.get('/invoices', async (req, res, next) => {
    try {
        return sendData(res, await invoiceService.getInvoices(req.query));
    } catch (error) { return sendError(next, error); }
});

router.post('/invoices', async (req, res, next) => {
    try {
        return sendData(res, await invoiceService.createInvoice(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/invoices/:id/status', async (req, res, next) => {
    try {
        const { status, payment_mode } = req.body;
        return sendData(res, await invoiceService.updateInvoiceStatus(req.params.id, status, { payment_mode }));
    } catch (error) { return sendError(next, error); }
});

router.get('/invoices/stats', async (req, res, next) => {
    try {
        return sendData(res, await invoiceService.getInvoiceStats());
    } catch (error) { return sendError(next, error); }
});

router.get('/compliance/alerts', async (req, res, next) => {
    try {
        return sendData(res, await invoiceService.getComplianceAlerts());
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// RECRUITMENT & ONBOARDING
// ==========================================
router.get('/recruitment/requisitions', async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.getRequisitions());
    } catch (error) { return sendError(next, error); }
});

router.post('/recruitment/requisitions', async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.createRequisition(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/recruitment/requisitions/:id', async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.updateRequisition(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.get('/recruitment/candidates', async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.getCandidates(req.query));
    } catch (error) { return sendError(next, error); }
});

router.post('/recruitment/candidates', async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.createCandidate(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/recruitment/candidates/:id/stage', async (req, res, next) => {
    try {
        const { stage, interview_date, interviewer_name, interview_feedback, rating } = req.body;
        return sendData(res, await recruitmentService.updateCandidateStage(req.params.id, stage, {
            interview_date, interviewer_name, interview_feedback, rating
        }));
    } catch (error) { return sendError(next, error); }
});

router.get('/recruitment/offers', async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.getOffers());
    } catch (error) { return sendError(next, error); }
});

router.post('/recruitment/offers', async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.createOffer(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/recruitment/offers/:id/status', async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.updateOfferStatus(req.params.id, req.body.status));
    } catch (error) { return sendError(next, error); }
});

router.post('/recruitment/candidates/:id/convert-to-employee', async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.convertToEmployee(req.params.id, req.body), 201);
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// VENDOR MANAGEMENT ROUTES
// ==========================================
router.get('/vendors/stats', async (req, res, next) => {
    try {
        return sendData(res, await vendorService.getVendorStats());
    } catch (error) { return sendError(next, error); }
});

router.get('/vendors', async (req, res, next) => {
    try {
        return sendData(res, await vendorService.getVendors(req.query));
    } catch (error) { return sendError(next, error); }
});

router.post('/vendors', async (req, res, next) => {
    try {
        return sendData(res, await vendorService.createVendor(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/vendors/:id', async (req, res, next) => {
    try {
        return sendData(res, await vendorService.updateVendor(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.delete('/vendors/:id', async (req, res, next) => {
    try {
        return sendData(res, await vendorService.deleteVendor(req.params.id));
    } catch (error) { return sendError(next, error); }
});

router.get('/vendors/agreements', async (req, res, next) => {
    try {
        return sendData(res, await vendorService.getAgreements(req.query.vendor_id));
    } catch (error) { return sendError(next, error); }
});

router.post('/vendors/agreements', async (req, res, next) => {
    try {
        return sendData(res, await vendorService.createAgreement(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.delete('/vendors/agreements/:id', async (req, res, next) => {
    try {
        return sendData(res, await vendorService.deleteAgreement(req.params.id));
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// ASSET MANAGEMENT ROUTES
// ==========================================
router.get('/assets/stats', async (req, res, next) => {
    try {
        return sendData(res, await assetService.getAssetStats());
    } catch (error) { return sendError(next, error); }
});

router.get('/assets', async (req, res, next) => {
    try {
        return sendData(res, await assetService.getAssets(req.query));
    } catch (error) { return sendError(next, error); }
});

router.post('/assets', async (req, res, next) => {
    try {
        return sendData(res, await assetService.createAsset(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/assets/:id', async (req, res, next) => {
    try {
        return sendData(res, await assetService.updateAsset(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.delete('/assets/:id', async (req, res, next) => {
    try {
        return sendData(res, await assetService.deleteAsset(req.params.id));
    } catch (error) { return sendError(next, error); }
});

router.get('/assets/allocations', async (req, res, next) => {
    try {
        return sendData(res, await assetService.getAllocations(req.query));
    } catch (error) { return sendError(next, error); }
});

router.post('/assets/allocate', async (req, res, next) => {
    try {
        return sendData(res, await assetService.allocateAsset(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.post('/assets/return/:id', async (req, res, next) => {
    try {
        return sendData(res, await assetService.returnAsset(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// AI FEATURES ROUTES
// ==========================================
router.post('/ai/chat', async (req, res, next) => {
    try {
        const { message, context } = req.body;
        return sendData(res, await aiService.handleChatMessage(message, context));
    } catch (error) { return sendError(next, error); }
});

router.post('/ai/screen-candidate/:id', async (req, res, next) => {
    try {
        return sendData(res, await aiService.screenCandidate(req.params.id));
    } catch (error) { return sendError(next, error); }
});

router.get('/ai/compliance-prediction', async (req, res, next) => {
    try {
        return sendData(res, await aiService.getPredictiveCompliance());
    } catch (error) { return sendError(next, error); }
});

router.get('/health/db', async (req, res, next) => {
    try {
        const result = await db.query('SELECT current_database() AS database');
        return sendData(res, result.rows[0]);
    } catch (error) { return sendError(next, error); }
});

module.exports = router;
