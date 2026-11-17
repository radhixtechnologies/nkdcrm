const express = require('express');
const fs = require('fs');
const xlsx = require('xlsx');
const db = require('../config/database');
const upload = require('../config/multer');
const {
    authenticate,
    requirePermission,
    requireAnyPermission,
    checkUserPermission
} = require('../middleware/auth');

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
const vendorPaymentService = require('../services/vendorPaymentService');
const assetService = require('../services/assetService');
const aiService = require('../services/aiService');
const dprService = require('../services/dprService');
const trenchDewateringService = require('../services/trenchDewateringService');
const procurementService = require('../services/procurementService');
const siteOperationsService = require('../services/siteOperationsService');

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

// Helper to get requester's employee record (strict - never falls back to arbitrary employee)
const getRequesterEmployee = async (user) => {
    if (!user) return null;
    if (user.employeeId) {
        const emp = await resolveEmployee(user.employeeId);
        if (emp) return emp;
    }
    if (user.employeeCode) {
        const emp = await resolveEmployee(user.employeeCode);
        if (emp) return emp;
    }
    if (user.userId) {
        const res = await db.query('SELECT employee_id FROM users WHERE user_id = $1', [user.userId]);
        if (res.rows[0]?.employee_id) {
            const emp = await resolveEmployee(res.rows[0].employee_id);
            if (emp) return emp;
        }
    }
    if (user.email) {
        const res = await db.query(
            'SELECT employee_id, employee_code, first_name, last_name, full_name, email FROM employees WHERE LOWER(email) = LOWER($1) AND employment_status != $2 LIMIT 1',
            [user.email.trim(), 'TERMINATED']
        );
        if (res.rows.length > 0) return res.rows[0];
    }
    return null;
};

const isSelfScopedEmployee = (user) => String(user?.roleCode || '').toUpperCase() === 'EMPLOYEE';

const ALLOWED_SELF_PROFILE_FIELDS = new Set([
    'mobile', 'personal_email', 'emergency_contact', 'blood_group',
    'address', 'permanent_address', 'bank_name', 'account_number',
    'ifsc_code', 'aadhaar_number', 'pan_number', 'documents',
    'gender', 'father_name', 'dob', 'education'
]);

// Helper to get current Date (YYYY-MM-DD) and Time (HH:mm:ss) in Indian Standard Time (IST - Asia/Kolkata)
const getIstDateTime = () => {
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(now);

    const time = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).format(now).replace(/^24:/, '00:');

    return { date, time };
};

// Parse Excel serial / Date / string date into YYYY-MM-DD
const parseExcelDate = (val) => {
    if (val === undefined || val === null || val === '') return null;
    if (val instanceof Date && !Number.isNaN(val.getTime())) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    if (typeof val === 'number') {
        const utcMs = Date.UTC(1899, 11, 30) + Math.round(val) * 86400000;
        return new Date(utcMs).toISOString().slice(0, 10);
    }
    const raw = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(raw);
    if (dmy) {
        return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
    }
    return null;
};

// Parse Excel time fraction / Date / string into HH:mm:ss
const parseExcelTime = (val) => {
    if (val === undefined || val === null || val === '') return null;
    if (val instanceof Date && !Number.isNaN(val.getTime())) {
        return [
            String(val.getHours()).padStart(2, '0'),
            String(val.getMinutes()).padStart(2, '0'),
            String(val.getSeconds()).padStart(2, '0')
        ].join(':');
    }
    if (typeof val === 'number') {
        const frac = val % 1;
        const totalSecs = Math.round(frac * 86400);
        const h = Math.floor(totalSecs / 3600) % 24;
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    const raw = String(val).trim().toUpperCase();
    const ampmMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/.exec(raw);
    if (ampmMatch) {
        let h = parseInt(ampmMatch[1], 10);
        const m = ampmMatch[2];
        const s = ampmMatch[3] || '00';
        const mer = ampmMatch[4];
        if (mer === 'PM' && h < 12) h += 12;
        if (mer === 'AM' && h === 12) h = 0;
        return `${String(h).padStart(2, '0')}:${m}:${s}`;
    }
    return null;
};

// Helper to get file buffer from multer
const getFileBuffer = (file) => {
    if (!file) return null;
    if (file.buffer) return file.buffer;
    if (file.path && fs.existsSync(file.path)) {
        const buffer = fs.readFileSync(file.path);
        fs.unlink(file.path, () => {});
        return buffer;
    }
    return null;
};

// ==========================================
// 0. DASHBOARD STATS & CHARTS
// ==========================================
router.get('/dashboard/stats', requirePermission('DASHBOARD', 'can_view'), async (req, res, next) => {
    try {
        const isClient = String(req.user?.roleCode || '').toUpperCase() === 'CLIENT_LOGIN';
        const { date: istDate } = getIstDateTime();

        const sitesRes = await db.query('SELECT COUNT(*)::int as count FROM sites WHERE is_active = true');
        const totalSites = sitesRes.rows[0]?.count || 0;

        let invoiceStats = { total_invoiced: 0, total_received: 0, pending_amount: 0, overdue_amount: 0 };
        try {
            invoiceStats = await invoiceService.getInvoiceStats();
        } catch (e) {
            console.warn('Invoice stats fetch error:', e.message);
        }

        if (isClient) {
            const [dprRes, procRes] = await Promise.all([
                db.query('SELECT COUNT(*)::int AS count FROM daily_progress_reports').catch(() => ({ rows: [{ count: 0 }] })),
                db.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE milestone_stage = \'DELIVERED_AT_SITE\' OR receipt_actual IS NOT NULL)::int AS delivered FROM project_procurement_items').catch(() => ({ rows: [{ total: 0, delivered: 0 }] }))
            ]);

            return sendData(res, {
                totalEmployees: 0,
                presentToday: 0,
                absentToday: 0,
                onLeaveToday: 0,
                attendanceRate: 0,
                pendingLeaves: 0,
                pendingClaims: 0,
                totalSites,
                totalDprs: dprRes.rows[0]?.count || 0,
                procurementTotal: procRes.rows[0]?.total || 0,
                procurementDelivered: procRes.rows[0]?.delivered || 0,
                latestPayroll: { amount: 0, month: Number(istDate.slice(5, 7)), year: Number(istDate.slice(0, 4)) },
                complianceAlerts: { summary: {}, alerts: [] },
                invoiceStats
            });
        }

        const empCountRes = await db.query(
            "SELECT COUNT(*)::int as total FROM employees WHERE employment_status != 'TERMINATED'"
        );
        const totalEmployees = empCountRes.rows[0]?.total || 0;

        const todayAttendanceRes = await db.query(`
            SELECT
                COUNT(DISTINCT CASE WHEN status = 'P' OR check_in IS NOT NULL THEN employee_id END)::int as present,
                COUNT(DISTINCT CASE WHEN status = 'A' THEN employee_id END)::int as absent,
                COUNT(DISTINCT CASE WHEN status IN ('H', 'HD') THEN employee_id END)::int as half_day,
                COUNT(DISTINCT CASE WHEN status = 'L' THEN employee_id END)::int as on_leave
            FROM attendance_daily
            WHERE date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
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
        } : { amount: 0, month: Number(istDate.slice(5, 7)), year: Number(istDate.slice(0, 4)) };

        const attendanceRate = totalEmployees > 0
            ? Math.round((presentToday / totalEmployees) * 100)
            : 0;

        let complianceAlerts = { summary: {}, alerts: [] };
        try {
            complianceAlerts = await invoiceService.getComplianceAlerts();
        } catch (e) {
            console.warn('Compliance alerts fetch error:', e.message);
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

router.get('/dashboard/charts', requirePermission('DASHBOARD', 'can_view'), async (req, res, next) => {
    try {
        const isClient = String(req.user?.roleCode || '').toUpperCase() === 'CLIENT_LOGIN';
        if (isClient) {
            return sendData(res, {
                attendanceTrend: [],
                departmentBreakdown: [],
                siteDistribution: [],
                payrollTrend: [],
                recentActivity: []
            });
        }

        const trendRes = await db.query(`
            WITH dates AS (
                SELECT generate_series(
                    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '6 days',
                    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,
                    '1 day'::interval
                )::date AS day
            )
            SELECT
                TO_CHAR(d.day, 'YYYY-MM-DD') as date,
                TO_CHAR(d.day, 'Dy') as day_name,
                COUNT(CASE WHEN a.status = 'P' OR a.check_in IS NOT NULL THEN 1 END)::int as present,
                COUNT(CASE WHEN a.status = 'A' THEN 1 END)::int as absent,
                COUNT(CASE WHEN a.status IN ('H', 'HD') THEN 1 END)::int as half_day,
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
                TO_CHAR(a.date, 'YYYY-MM-DD') as date,
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
router.get('/employees', requirePermission('EMPLOYEES', 'can_view'), async (req, res, next) => {
    try { return sendData(res, await employeeService.getAllEmployees(req.query)); } catch (error) { return sendError(next, error); }
});

router.get('/employees/profile/me', async (req, res, next) => {
    try {
        const emp = await getRequesterEmployee(req.user);
        if (!emp) {
            return res.json({
                success: true,
                data: null,
                message: 'No linked employee profile found for this account'
            });
        }
        const full = await employeeService.getEmployeeByCode(emp.employee_code);
        return sendData(res, full);
    } catch (error) { return sendError(next, error); }
});

router.put('/employees/profile/update', async (req, res, next) => {
    try {
        const emp = await getRequesterEmployee(req.user);
        if (!emp) return res.status(400).json({ success: false, message: 'User is not linked to an employee' });

        const sanitized = {};
        for (const [k, v] of Object.entries(req.body || {})) {
            if (ALLOWED_SELF_PROFILE_FIELDS.has(k)) {
                sanitized[k] = v;
            }
        }
        if (Object.keys(sanitized).length === 0) {
            return res.status(400).json({ success: false, message: 'No valid profile fields supplied for update' });
        }

        return sendData(res, await employeeService.updateEmployee(emp.employee_code, sanitized));
    } catch (error) { return sendError(next, error); }
});

router.post(
    '/employees/upload-document',
    requireAnyPermission('EMPLOYEES.can_create', 'EMPLOYEES.can_update', 'RECRUITMENT.can_create', 'RECRUITMENT.can_update', 'BENEFITS.can_create'),
    upload.single('file'),
    (req, res, next) => {
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
    }
);

// Statutory Worker Appointment Letter under OSH Code 2020 (Annexure-I)
router.get('/employees/:id/osh-appointment-letter', async (req, res, next) => {
    try {
        const id = req.params.id;
        let employee = await employeeService.getEmployeeById(id);
        if (!employee) {
            employee = await employeeService.getEmployeeByCode(id);
        }
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Worker / Employee not found' });
        }

        const hasDirView = await checkUserPermission(req.user, 'EMPLOYEES', 'can_view');
        const reqEmp = await getRequesterEmployee(req.user);
        const isSelf = reqEmp && Number(reqEmp.employee_id) === Number(employee.employee_id);
        if (!hasDirView && !isSelf) {
            return res.status(403).json({ success: false, message: 'Access denied: missing EMPLOYEES.can_view permission' });
        }

        await pdfService.generateWorkerOshAppointmentLetter(employee, res);
    } catch (error) {
        return sendError(next, error);
    }
});

// Integrity and Confidentiality Agreement (NDA) for Workers & Site Staff
router.get('/employees/:id/integrity-agreement', async (req, res, next) => {
    try {
        const id = req.params.id;
        let employee = await employeeService.getEmployeeById(id);
        if (!employee) {
            employee = await employeeService.getEmployeeByCode(id);
        }
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Worker / Employee not found' });
        }

        const hasDirView = await checkUserPermission(req.user, 'EMPLOYEES', 'can_view');
        const reqEmp = await getRequesterEmployee(req.user);
        const isSelf = reqEmp && Number(reqEmp.employee_id) === Number(employee.employee_id);
        if (!hasDirView && !isSelf) {
            return res.status(403).json({ success: false, message: 'Access denied: missing EMPLOYEES.can_view permission' });
        }

        await pdfService.generateIntegrityAgreement(employee, res);
    } catch (error) {
        return sendError(next, error);
    }
});

// Official Staff Joining Letter (Corporate / Management / Site Staff)
router.get('/employees/:id/staff-joining-letter', async (req, res, next) => {
    try {
        const id = req.params.id;
        let employee = await employeeService.getEmployeeById(id);
        if (!employee) {
            employee = await employeeService.getEmployeeByCode(id);
        }
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Worker / Employee not found' });
        }

        const hasDirView = await checkUserPermission(req.user, 'EMPLOYEES', 'can_view');
        const reqEmp = await getRequesterEmployee(req.user);
        const isSelf = reqEmp && Number(reqEmp.employee_id) === Number(employee.employee_id);
        if (!hasDirView && !isSelf) {
            return res.status(403).json({ success: false, message: 'Access denied: missing EMPLOYEES.can_view permission' });
        }

        await pdfService.generateStaffJoiningLetter(employee, res);
    } catch (error) {
        return sendError(next, error);
    }
});

// IT Asset Handover Form (Internal Use Only) for Employees
router.get('/employees/:id/asset-handover-form', async (req, res, next) => {
    try {
        const id = req.params.id;
        let employee = await employeeService.getEmployeeById(id);
        if (!employee) {
            employee = await employeeService.getEmployeeByCode(id);
        }
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Worker / Employee not found' });
        }

        const hasDirView = (await checkUserPermission(req.user, 'EMPLOYEES', 'can_view')) || (await checkUserPermission(req.user, 'ASSETS', 'can_view'));
        const reqEmp = await getRequesterEmployee(req.user);
        const isSelf = reqEmp && Number(reqEmp.employee_id) === Number(employee.employee_id);
        if (!hasDirView && !isSelf) {
            return res.status(403).json({ success: false, message: 'Access denied: missing permission' });
        }

        const allocations = await assetService.getEmployeeAllocations(employee.employee_id);
        const assetPayload = {
            ...employee,
            employee_name: employee.full_name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
            assets: allocations.length > 0 ? allocations.map((al, idx) => ({
                sr_no: idx + 1,
                asset_type: al.category || al.asset_name || 'Laptop',
                brand_model: al.brand_model || al.asset_name || 'Dell 15 DC15250',
                serial_number: al.serial_number || '4GNZBH4',
                quantity: al.quantity || 1,
                accessories: al.remarks || al.asset_notes || 'Charger, Mouse'
            })) : undefined
        };

        await pdfService.generateAssetHandoverForm(assetPayload, res);
    } catch (error) {
        return sendError(next, error);
    }
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

        const hasDirView = await checkUserPermission(req.user, 'EMPLOYEES', 'can_view');
        const reqEmp = await getRequesterEmployee(req.user);
        const isSelf = reqEmp && Number(reqEmp.employee_id) === Number(employee.employee_id);
        if (!hasDirView && !isSelf) {
            return res.status(403).json({ success: false, message: 'Access denied: missing EMPLOYEES.can_view permission' });
        }

        return sendData(res, employee);
    } catch (error) { return sendError(next, error); }
});

router.post('/employees', requirePermission('EMPLOYEES', 'can_create'), async (req, res, next) => {
    try { return sendData(res, await employeeService.createEmployee(req.body), 201); } catch (error) { return sendError(next, error); }
});

router.put('/employees/:employeeCode', requirePermission('EMPLOYEES', 'can_update'), async (req, res, next) => {
    try {
        let code = req.params.employeeCode;
        if (/^\d+$/.test(code)) {
            const byId = await resolveEmployee(code);
            if (byId) code = byId.employee_code;
        }
        return sendData(res, await employeeService.updateEmployee(code, req.body));
    } catch (error) { return sendError(next, error); }
});

router.delete('/employees/:employeeCode', requirePermission('EMPLOYEES', 'can_delete'), async (req, res, next) => {
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
router.get(
    '/sites',
    requireAnyPermission('SITES.can_view', 'EMPLOYEES.can_view', 'DPR.can_view', 'PROCUREMENT.can_view', 'ATTENDANCE.can_view', 'INVOICES.can_view', 'ASSETS.can_view', 'RECRUITMENT.can_view'),
    async (req, res, next) => {
        try { return sendData(res, await siteService.getAllSites()); } catch (error) { return sendError(next, error); }
    }
);
router.post('/sites', requirePermission('SITES', 'can_create'), async (req, res, next) => {
    try { return sendData(res, await siteService.createSite(req.body), 201); } catch (error) { return sendError(next, error); }
});
router.put('/sites/:id', requirePermission('SITES', 'can_update'), async (req, res, next) => {
    try { return sendData(res, await siteService.updateSite(req.params.id, req.body)); } catch (error) { return sendError(next, error); }
});
router.delete('/sites/:id', requirePermission('SITES', 'can_delete'), async (req, res, next) => {
    try { return sendData(res, await siteService.deleteSite(req.params.id)); } catch (error) { return sendError(next, error); }
});

router.get(
    '/shifts',
    requireAnyPermission('SITES.can_view', 'EMPLOYEES.can_view', 'ATTENDANCE.can_view'),
    async (req, res, next) => {
        try { return sendData(res, await shiftService.getAllShifts()); } catch (error) { return sendError(next, error); }
    }
);
router.post('/shifts', requirePermission('SITES', 'can_create'), async (req, res, next) => {
    try { return sendData(res, await shiftService.createShift(req.body), 201); } catch (error) { return sendError(next, error); }
});
router.put('/shifts/:id', requirePermission('SITES', 'can_update'), async (req, res, next) => {
    try { return sendData(res, await shiftService.updateShift(req.params.id, req.body)); } catch (error) { return sendError(next, error); }
});
router.delete('/shifts/:id', requirePermission('SITES', 'can_delete'), async (req, res, next) => {
    try { return sendData(res, await shiftService.deleteShift(req.params.id)); } catch (error) { return sendError(next, error); }
});
router.put('/shifts/:employeeCode/assign', requireAnyPermission('SITES.can_update', 'EMPLOYEES.can_update'), async (req, res, next) => {
    try { return sendData(res, await shiftService.assignShiftToEmployee(req.params.employeeCode, req.body.shift_id)); } catch (error) { return sendError(next, error); }
});

// ==========================================
// 3. STATUTORY REGISTER IMPORT
// ==========================================
router.post(
    '/statutory/import-register',
    requireAnyPermission('EMPLOYEES.can_create', 'REPORTS.can_export'),
    upload.uploadExcel.single('file'),
    async (req, res, next) => {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
            const fileBuffer = getFileBuffer(req.file);
            const result = await statutoryService.importRegister(fileBuffer, req.body.site_id || 1);
            return res.json({ success: true, data: result });
        } catch (error) { return sendError(next, error); }
    }
);

// ==========================================
// 4. DAILY ATTENDANCE & TRACKER
// ==========================================
router.post(
    '/daily-attendance/import',
    requirePermission('ATTENDANCE', 'can_create'),
    upload.uploadExcel.single('file'),
    async (req, res, next) => {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
            const fileBuffer = getFileBuffer(req.file);
            const workbook = xlsx.read(fileBuffer, { type: 'buffer', cellDates: false });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows = xlsx.utils.sheet_to_json(sheet);

            const rows = rawRows.map((r, idx) => ({
                _rowNumber: idx + 2,
                employee_code: r.employee_code || r['Employee Code'] || r['Emp Code'] || r['emp_code'] || r.code,
                date: parseExcelDate(r.date || r['Date'] || r['punch_date'] || r['Punch Date']),
                status: r.status || r['Status'] || 'P',
                check_in: parseExcelTime(r.check_in || r['Check In'] || r['in_time'] || r['In Time']),
                check_out: parseExcelTime(r.check_out || r['Check Out'] || r['out_time'] || r['Out Time'])
            })).filter(r => r.employee_code || r.date);

            const results = await attendanceDailyService.bulkImport(rows);
            return res.json({ success: true, summary: results, errors: results.errors, data: results });
        } catch (error) { return sendError(next, error); }
    }
);

router.get('/daily-attendance/list', requirePermission('ATTENDANCE', 'can_view'), async (req, res, next) => {
    try {
        const { startDate, endDate, employeeId } = req.query;
        const now = new Date();
        const istToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
        const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const istDefaultStart = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(past);

        const start = startDate || istDefaultStart;
        const end = endDate || istToday;

        let scopedEmployeeId = employeeId || null;
        if (isSelfScopedEmployee(req.user)) {
            const reqEmp = await getRequesterEmployee(req.user);
            if (!reqEmp) return sendData(res, []);
            scopedEmployeeId = reqEmp.employee_id;
        }

        const logs = await attendanceDailyService.getAttendanceByDateRange(start, end, scopedEmployeeId);
        return sendData(res, logs);
    } catch (error) { return sendError(next, error); }
});

// Time tracker endpoints (always scoped to requester's own employee record)
router.get('/attendance/tracker/history', requirePermission('ATTENDANCE', 'can_view'), async (req, res, next) => {
    try {
        const emp = await getRequesterEmployee(req.user);
        if (!emp) return res.json([]);
        const now = new Date();
        const end = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
        const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const start = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(past);
        const logs = await attendanceDailyService.getTrackerHistory(emp.employee_id, start, end);
        return res.json(logs);
    } catch (error) { return sendError(next, error); }
});

router.post('/attendance/tracker/check-in', requirePermission('ATTENDANCE', 'can_create'), async (req, res, next) => {
    try {
        const emp = await getRequesterEmployee(req.user);
        if (!emp) {
            return res.status(400).json({
                success: false,
                msg: 'No employee profile linked to current user',
                message: 'No employee profile linked to current user'
            });
        }

        const { date, time: check_in } = getIstDateTime();
        const { latitude, longitude, location_accuracy, punch_address } = req.body;
        const hasCoords = latitude !== undefined && latitude !== null && latitude !== '' && !Number.isNaN(Number(latitude));

        const log = await attendanceDailyService.recordPunch({
            employee_id: emp.employee_id,
            punch_type: 'IN',
            date,
            time: check_in,
            source: hasCoords ? 'GPS' : 'WEB_PORTAL',
            latitude: hasCoords ? latitude : null,
            longitude: hasCoords ? longitude : null,
            location_accuracy: location_accuracy || null,
            punch_address: punch_address || null
        });
        return res.json({ success: true, date, check_in, data: log });
    } catch (error) { return sendError(next, error); }
});

router.post('/attendance/tracker/check-out', requirePermission('ATTENDANCE', 'can_create'), async (req, res, next) => {
    try {
        const emp = await getRequesterEmployee(req.user);
        if (!emp) {
            return res.status(400).json({
                success: false,
                msg: 'No employee profile linked to current user',
                message: 'No employee profile linked to current user'
            });
        }

        const { date, time: check_out } = getIstDateTime();
        const { latitude, longitude, location_accuracy, punch_address } = req.body;
        const hasCoords = latitude !== undefined && latitude !== null && latitude !== '' && !Number.isNaN(Number(latitude));

        const log = await attendanceDailyService.recordPunch({
            employee_id: emp.employee_id,
            punch_type: 'OUT',
            date,
            time: check_out,
            source: hasCoords ? 'GPS' : 'WEB_PORTAL',
            latitude: hasCoords ? latitude : null,
            longitude: hasCoords ? longitude : null,
            location_accuracy: location_accuracy || null,
            punch_address: punch_address || null
        });
        return res.json({ success: true, check_out, date: log?.date || date, data: log });
    } catch (error) { return sendError(next, error); }
});

router.post('/attendance/gps-punch', requirePermission('ATTENDANCE', 'can_create'), async (req, res, next) => {
    try {
        const { employee_id, latitude, longitude, location_accuracy, punch_address, punch_type } = req.body;
        const targetEmp = (!isSelfScopedEmployee(req.user) && employee_id)
            ? await resolveEmployee(employee_id)
            : await getRequesterEmployee(req.user);
        if (!targetEmp) {
            return res.status(400).json({
                success: false,
                msg: 'No employee profile linked or found',
                message: 'No employee profile linked or found'
            });
        }

        const { date, time: timeStr } = getIstDateTime();
        const normalizedType = String(punch_type || 'IN').toUpperCase() === 'OUT' ? 'OUT' : 'IN';

        const log = await attendanceDailyService.recordPunch({
            employee_id: targetEmp.employee_id,
            punch_type: normalizedType,
            date,
            time: timeStr,
            source: 'GPS',
            latitude,
            longitude,
            location_accuracy,
            punch_address
        });
        return res.json({
            success: true,
            date: log?.date || date,
            time: timeStr,
            punch_type: normalizedType,
            message: `GPS punch ${normalizedType} recorded successfully at ${timeStr} IST`,
            data: log
        });
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// 5. BIOMETRIC LOGS
// ==========================================
router.post(
    '/biometric/import',
    requirePermission('ATTENDANCE', 'can_create'),
    upload.uploadExcel.single('file'),
    async (req, res, next) => {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
            const fileBuffer = getFileBuffer(req.file);
            const workbook = xlsx.read(fileBuffer, { type: 'buffer', cellDates: false });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows = xlsx.utils.sheet_to_json(sheet);

            const logs = rawRows.map((r, idx) => ({
                _rowNumber: idx + 2,
                employee_code: r.employee_code || r['Employee Code'] || r['Emp Code'] || r['emp_code'],
                punch_date: parseExcelDate(r.punch_date || r['Punch Date'] || r.date || r['Date']),
                in_time: parseExcelTime(r.in_time || r['In Time'] || r.check_in || r['Check In']),
                out_time: parseExcelTime(r.out_time || r['Out Time'] || r.check_out || r['Check Out']),
                device_id: r.device_id || r['Device ID'] || 'BIOMETRIC-1'
            })).filter(r => r.employee_code || r.punch_date);

            const results = await biometricService.importBiometricLogs(logs, {
                upload_batch_id: `BATCH-${Date.now()}`,
                uploaded_by: req.user.email || 'Admin'
            });
            return res.json({ success: true, summary: results, errors: results.errors, data: results });
        } catch (error) { return sendError(next, error); }
    }
);

router.get('/biometric/pending', requireAnyPermission('ATTENDANCE.can_update', 'ATTENDANCE.can_approve'), async (req, res, next) => {
    try {
        const result = await db.query('SELECT * FROM biometric_logs WHERE is_processed = FALSE ORDER BY punch_date DESC LIMIT 100');
        return sendData(res, result.rows);
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// 6. LEAVES
// ==========================================
router.get('/leave-types', requirePermission('LEAVES', 'can_view'), async (req, res, next) => {
    try { return sendData(res, await leaveService.getLeaveTypes()); } catch (error) { return sendError(next, error); }
});

router.get('/leaves/types', requirePermission('LEAVES', 'can_view'), async (req, res, next) => {
    try { return sendData(res, await leaveService.getLeaveTypes()); } catch (error) { return sendError(next, error); }
});

router.get('/leaves/balance/:code', requirePermission('LEAVES', 'can_view'), async (req, res, next) => {
    try {
        const emp = await resolveEmployee(req.params.code);
        if (!emp) return sendData(res, []);

        if (isSelfScopedEmployee(req.user)) {
            const reqEmp = await getRequesterEmployee(req.user);
            if (!reqEmp || Number(reqEmp.employee_id) !== Number(emp.employee_id)) {
                return res.status(403).json({ success: false, message: 'Access denied: cannot view other employees leave balances' });
            }
        }

        const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();
        const balances = await leaveService.getLeaveBalance(emp.employee_id, year);
        return sendData(res, balances);
    } catch (error) { return sendError(next, error); }
});

router.post('/leaves/apply', requirePermission('LEAVES', 'can_create'), async (req, res, next) => {
    try {
        let emp = null;
        const empIdentifier = req.body.employee_code || req.body.employee_id;
        if (isSelfScopedEmployee(req.user)) {
            const reqEmp = await getRequesterEmployee(req.user);
            if (!reqEmp) return res.status(400).json({ success: false, message: 'No employee profile linked to your account' });
            if (empIdentifier) {
                const requestedEmp = await resolveEmployee(empIdentifier);
                if (!requestedEmp || Number(requestedEmp.employee_id) !== Number(reqEmp.employee_id)) {
                    return res.status(403).json({ success: false, message: 'Access denied: employees can only apply leave for themselves' });
                }
            }
            emp = reqEmp;
        } else if (empIdentifier) {
            emp = await resolveEmployee(empIdentifier);
        } else {
            emp = await getRequesterEmployee(req.user);
        }

        if (!emp) return res.status(400).json({ success: false, message: 'Employee not found. Please select a valid employee.' });
        const empId = emp.employee_id;

        const isApprover = ['SUPER_ADMIN', 'HR_ADMIN', 'SITE_MANAGER', 'DEPT_MANAGER'].includes(String(req.user?.roleCode || '').toUpperCase());
        const autoApprove = isApprover && (req.body.auto_approve === true || req.body.auto_approve === 'true');

        const leave = await leaveService.applyLeave({
            ...req.body,
            employee_id: parseInt(empId, 10)
        });

        if (autoApprove && leave && leave.request_id) {
            const approver = await getRequesterEmployee(req.user);
            const approverId = approver ? approver.employee_id : null;
            const remarks = req.body.remarks || `Directly granted by ${req.user?.firstName || 'Manager'}`;
            const approved = await leaveService.approveLeave(leave.request_id, approverId, remarks);
            return sendData(res, approved, 201);
        }

        return sendData(res, leave, 201);
    } catch (error) { return sendError(next, error); }
});

router.get('/leaves/history/:code', requirePermission('LEAVES', 'can_view'), async (req, res, next) => {
    try {
        const emp = await resolveEmployee(req.params.code);
        if (!emp) return sendData(res, []);

        if (isSelfScopedEmployee(req.user)) {
            const reqEmp = await getRequesterEmployee(req.user);
            if (!reqEmp || Number(reqEmp.employee_id) !== Number(emp.employee_id)) {
                return res.status(403).json({ success: false, message: 'Access denied: cannot view other employees leave history' });
            }
        }

        const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();
        const history = await leaveService.getLeaveHistory(emp.employee_id, year);
        return sendData(res, history);
    } catch (error) { return sendError(next, error); }
});

router.get('/leaves/pending', requirePermission('LEAVES', 'can_approve'), async (req, res, next) => {
    try { return sendData(res, await leaveService.getPendingRequests()); } catch (error) { return sendError(next, error); }
});

router.get('/leaves/all-requests', requirePermission('LEAVES', 'can_view'), async (req, res, next) => {
    try {
        if (isSelfScopedEmployee(req.user)) {
            const reqEmp = await getRequesterEmployee(req.user);
            if (!reqEmp) return sendData(res, []);
            return sendData(res, await leaveService.getLeaveRequests(reqEmp.employee_id, req.query));
        }
        return sendData(res, await leaveService.getAllRequests(req.query));
    } catch (error) { return sendError(next, error); }
});

router.post('/leaves/:id/approve', requirePermission('LEAVES', 'can_approve'), async (req, res, next) => {
    try {
        const approver = await getRequesterEmployee(req.user);
        const approverId = approver ? approver.employee_id : null;
        const updated = await leaveService.approveLeave(req.params.id, approverId, req.body.remarks);
        return sendData(res, updated);
    } catch (error) { return sendError(next, error); }
});

router.post('/leaves/:id/reject', requirePermission('LEAVES', 'can_approve'), async (req, res, next) => {
    try {
        const approver = await getRequesterEmployee(req.user);
        const approverId = approver ? approver.employee_id : null;
        const updated = await leaveService.rejectLeave(req.params.id, approverId, req.body.rejection_reason || 'Rejected by Manager');
        return sendData(res, updated);
    } catch (error) { return sendError(next, error); }
});

router.post('/leaves/:id/cancel', requireAnyPermission('LEAVES.can_create', 'LEAVES.can_update', 'LEAVES.can_delete'), async (req, res, next) => {
    try {
        let empId = null;
        if (isSelfScopedEmployee(req.user)) {
            const reqEmp = await getRequesterEmployee(req.user);
            if (!reqEmp) return res.status(403).json({ success: false, message: 'No linked employee profile' });
            empId = reqEmp.employee_id;
        }
        const cancelled = await leaveService.cancelLeave(req.params.id, empId);
        return sendData(res, cancelled);
    } catch (error) { return sendError(next, error); }
});

router.post('/leaves/balance/:code/initialize', requireAnyPermission('LEAVES.can_create', 'LEAVES.can_update'), async (req, res, next) => {
    try {
        const emp = await resolveEmployee(req.params.code);
        if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
        if (isSelfScopedEmployee(req.user)) {
            const reqEmp = await getRequesterEmployee(req.user);
            if (!reqEmp || Number(reqEmp.employee_id) !== Number(emp.employee_id)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
        }
        const year = req.body.year ? parseInt(req.body.year, 10) : new Date().getFullYear();
        const init = await leaveService.initializeLeaveBalance(emp.employee_id, year);
        return sendData(res, init);
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// 7. PAYROLL
// ==========================================
router.post('/payroll/generate', requirePermission('PAYROLL', 'can_create'), async (req, res, next) => {
    try {
        const month = parseInt(req.body.month, 10);
        const year = parseInt(req.body.year, 10);
        if (!month || !year || month < 1 || month > 12) {
            return res.status(400).json({ success: false, message: 'Valid month (1-12) and year are required' });
        }

        // First aggregate any real daily/biometric/GPS attendance logs into monthly attendance table
        await attendanceService.aggregateDailyLogs(month, year);

        // For active employees with zero daily logs for the month, generate baseline attendance row
        const daysInMonth = new Date(year, month, 0).getDate();
        const defaultWo = Math.floor(daysInMonth / 7);
        const defaultPresent = daysInMonth - defaultWo;

        const existingAttendance = await attendanceService.getAttendanceByPeriod(month, year);
        const presentEmpIds = new Set(existingAttendance.map(a => a.employee_id));
        const activeEmps = await db.query("SELECT employee_id FROM employees WHERE employment_status = 'ACTIVE'");

        for (const emp of activeEmps.rows) {
            if (presentEmpIds.has(emp.employee_id)) continue;
            try {
                await attendanceService.createAttendance({
                    employee_id: emp.employee_id,
                    month,
                    year,
                    total_days: daysInMonth,
                    present_days: defaultPresent,
                    absent_days: 0,
                    weekly_off_days: defaultWo,
                    leave_days: 0,
                    half_days: 0,
                    overtime_hours: 0,
                    day_wise_attendance: {},
                    uploaded_by: 'AutoSync',
                    remarks: 'Default active cycle compiled by system'
                });
            } catch {
                // Ignore duplicate
            }
        }

        const results = await payrollService.bulkCalculatePayroll(month, year);
        return res.json({ success: true, summary: results, data: results });
    } catch (error) { return sendError(next, error); }
});

router.get('/payroll/list', requireAnyPermission('PAYROLL.can_create', 'PAYROLL.can_update', 'PAYROLL.can_approve'), async (req, res, next) => {
    try {
        const month = parseInt(req.query.month, 10);
        const year = parseInt(req.query.year, 10);
        const siteId = req.query.site_id ? parseInt(req.query.site_id, 10) : null;
        const list = await payrollService.getPayrollByPeriod(month, year, siteId);
        return sendData(res, list);
    } catch (error) { return sendError(next, error); }
});

router.post('/payroll/finalize', requirePermission('PAYROLL', 'can_approve'), async (req, res, next) => {
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

router.get('/payroll/config', requireAnyPermission('PAYROLL.can_create', 'PAYROLL.can_update', 'PAYROLL.can_approve'), async (req, res, next) => {
    try { return sendData(res, await payrollService.getPayrollConfig()); } catch (error) { return sendError(next, error); }
});

router.get('/payroll/my-history', requirePermission('PAYROLL', 'can_view'), async (req, res, next) => {
    try {
        const emp = await getRequesterEmployee(req.user);
        if (!emp) return sendData(res, []);
        const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();
        const records = await payrollService.getPayrollByEmployee(emp.employee_id, { year });
        return sendData(res, records);
    } catch (error) { return sendError(next, error); }
});

router.get('/payroll/export/excel', requireAnyPermission('PAYROLL.can_create', 'PAYROLL.can_update', 'PAYROLL.can_approve'), async (req, res, next) => {
    try {
        const month = parseInt(req.query.month, 10);
        const year = parseInt(req.query.year, 10);
        const siteId = req.query.site_id ? parseInt(req.query.site_id, 10) : null;
        const payrollList = await payrollService.getPayrollByPeriod(month, year, siteId);
        await excelService.generatePayrollExcel(payrollList, res);
    } catch (error) { return sendError(next, error); }
});

router.get('/payroll/export/client-wage-sheet', requireAnyPermission('PAYROLL.can_create', 'PAYROLL.can_update', 'PAYROLL.can_approve'), async (req, res, next) => {
    try {
        const month = parseInt(req.query.month, 10);
        const year = parseInt(req.query.year, 10);
        const siteId = req.query.site_id ? parseInt(req.query.site_id, 10) : null;
        const payrollList = await payrollService.getPayrollByPeriod(month, year, siteId);
        await excelService.generateNtpcWageRegisterExcel(payrollList, month, year, res);
    } catch (error) { return sendError(next, error); }
});

router.get('/payroll/export/bank-neft', requireAnyPermission('PAYROLL.can_create', 'PAYROLL.can_update', 'PAYROLL.can_approve'), async (req, res, next) => {
    try {
        const month = parseInt(req.query.month, 10);
        const year = parseInt(req.query.year, 10);
        const siteId = req.query.site_id ? parseInt(req.query.site_id, 10) : null;
        const payrollList = await payrollService.getPayrollByPeriod(month, year, siteId);
        await excelService.generateBankNeftExcel(payrollList, month, year, res);
    } catch (error) { return sendError(next, error); }
});

router.get('/payroll/:id(\\d+)', requirePermission('PAYROLL', 'can_view'), async (req, res, next) => {
    try {
        const record = await payrollService.getPayrollById(req.params.id);
        if (!record) return res.status(404).json({ success: false, message: 'Payroll not found' });
        if (isSelfScopedEmployee(req.user)) {
            const reqEmp = await getRequesterEmployee(req.user);
            if (!reqEmp || Number(record.employee_id) !== Number(reqEmp.employee_id)) {
                return res.status(403).json({ success: false, message: 'Access denied: cannot view other employees payroll records' });
            }
        }
        return sendData(res, record);
    } catch (error) { return sendError(next, error); }
});

router.get('/payroll/payslip/:id(\\d+)/pdf', requirePermission('PAYROLL', 'can_view'), async (req, res, next) => {
    try {
        const payroll = await payrollService.getPayrollById(req.params.id);
        if (!payroll) return res.status(404).send('Payslip not found');
        if (isSelfScopedEmployee(req.user)) {
            const reqEmp = await getRequesterEmployee(req.user);
            if (!reqEmp || Number(payroll.employee_id) !== Number(reqEmp.employee_id)) {
                return res.status(403).json({ success: false, message: 'Access denied: cannot download other employees payslips' });
            }
        }
        const employee = await employeeService.getEmployeeById(payroll.employee_id);
        await pdfService.generatePayslip(payroll, employee, res);
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// 8. BENEFITS & REIMBURSEMENTS
// ==========================================
router.get('/benefits', requirePermission('BENEFITS', 'can_view'), async (req, res, next) => {
    try { return sendData(res, await benefitService.getBenefitTypes()); } catch (error) { return sendError(next, error); }
});

router.get('/benefits/types', requirePermission('BENEFITS', 'can_view'), async (req, res, next) => {
    try { return sendData(res, await benefitService.getBenefitTypes()); } catch (error) { return sendError(next, error); }
});

router.get('/benefits/assigned', requireAnyPermission('BENEFITS.can_update', 'BENEFITS.can_approve'), async (req, res, next) => {
    try { return sendData(res, await benefitService.getAllAssignedBenefits()); } catch (error) { return sendError(next, error); }
});

router.post('/benefits/assign', requireAnyPermission('BENEFITS.can_update', 'BENEFITS.can_approve'), async (req, res, next) => {
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
        const assigned = await benefitService.assignBenefit({ ...req.body, employee_id: parseInt(empId, 10) });
        return sendData(res, assigned, 201);
    } catch (error) { return sendError(next, error); }
});

router.get('/benefits/my-benefits/:employeeCode', requirePermission('BENEFITS', 'can_view'), async (req, res, next) => {
    try {
        const emp = await resolveEmployee(req.params.employeeCode);
        if (!emp) return sendData(res, []);
        if (isSelfScopedEmployee(req.user)) {
            const reqEmp = await getRequesterEmployee(req.user);
            if (!reqEmp || Number(reqEmp.employee_id) !== Number(emp.employee_id)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
        }
        const benefits = await benefitService.getEmployeeBenefits(emp.employee_id);
        return sendData(res, benefits);
    } catch (error) { return sendError(next, error); }
});

router.post('/reimbursements/apply', requirePermission('BENEFITS', 'can_create'), async (req, res, next) => {
    try {
        let emp = null;
        const empIdentifier = req.body.employee_code || req.body.employee_id;
        if (isSelfScopedEmployee(req.user)) {
            const reqEmp = await getRequesterEmployee(req.user);
            if (!reqEmp) return res.status(400).json({ success: false, message: 'No linked employee profile' });
            if (empIdentifier) {
                const target = await resolveEmployee(empIdentifier);
                if (!target || Number(target.employee_id) !== Number(reqEmp.employee_id)) {
                    return res.status(403).json({ success: false, message: 'Access denied: cannot claim reimbursement for another employee' });
                }
            }
            emp = reqEmp;
        } else if (empIdentifier) {
            emp = await resolveEmployee(empIdentifier);
        } else {
            emp = await getRequesterEmployee(req.user);
        }

        if (!emp) return res.status(400).json({ success: false, message: 'Please select an employee' });
        const claim = await benefitService.applyReimbursement({ ...req.body, employee_id: parseInt(emp.employee_id, 10) });
        return sendData(res, claim, 201);
    } catch (error) { return sendError(next, error); }
});

router.get('/reimbursements/my/:employeeCode', requirePermission('BENEFITS', 'can_view'), async (req, res, next) => {
    try {
        const emp = await resolveEmployee(req.params.employeeCode);
        if (!emp) return sendData(res, []);
        if (isSelfScopedEmployee(req.user)) {
            const reqEmp = await getRequesterEmployee(req.user);
            if (!reqEmp || Number(reqEmp.employee_id) !== Number(emp.employee_id)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
        }
        const claims = await benefitService.getMyReimbursements(emp.employee_id);
        return sendData(res, claims);
    } catch (error) { return sendError(next, error); }
});

router.get('/reimbursements/pending', requirePermission('BENEFITS', 'can_approve'), async (req, res, next) => {
    try { return sendData(res, await benefitService.getPendingReimbursements()); } catch (error) { return sendError(next, error); }
});

router.get('/reimbursements/all', requireAnyPermission('BENEFITS.can_update', 'BENEFITS.can_approve'), async (req, res, next) => {
    try { return sendData(res, await benefitService.getAllReimbursements(req.query.status)); } catch (error) { return sendError(next, error); }
});

router.post('/reimbursements/approve', requirePermission('BENEFITS', 'can_approve'), async (req, res, next) => {
    try {
        const approver = await getRequesterEmployee(req.user);
        const approverId = approver ? approver.employee_id : null;
        const updated = await benefitService.updateReimbursementStatus(req.body.claim_id, 'APPROVED', approverId, req.body.reason);
        return sendData(res, updated);
    } catch (error) { return sendError(next, error); }
});

router.post('/reimbursements/reject', requirePermission('BENEFITS', 'can_approve'), async (req, res, next) => {
    try {
        const approver = await getRequesterEmployee(req.user);
        const approverId = approver ? approver.employee_id : null;
        const updated = await benefitService.updateReimbursementStatus(req.body.claim_id, 'REJECTED', approverId, req.body.reason || 'Rejected by HR');
        return sendData(res, updated);
    } catch (error) { return sendError(next, error); }
});

router.post('/reimbursements/mark-paid', requireAnyPermission('BENEFITS.can_approve', 'BENEFITS.can_update'), async (req, res, next) => {
    try {
        const updated = await benefitService.markAsPaid(req.body.claim_id);
        return sendData(res, updated);
    } catch (error) { return sendError(next, error); }
});

router.get('/insurance/policies', requirePermission('BENEFITS', 'can_view'), async (req, res, next) => {
    try {
        return sendData(res, await benefitService.getInsurancePolicies());
    } catch (error) { return sendError(next, error); }
});

router.get('/insurance/dependents/:employeeCode', requirePermission('BENEFITS', 'can_view'), async (req, res, next) => {
    try {
        const emp = await resolveEmployee(req.params.employeeCode);
        if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
        if (isSelfScopedEmployee(req.user)) {
            const reqEmp = await getRequesterEmployee(req.user);
            if (!reqEmp || Number(reqEmp.employee_id) !== Number(emp.employee_id)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
        }
        return sendData(res, await benefitService.getEmployeeDependents(emp.employee_id));
    } catch (error) { return sendError(next, error); }
});

router.post('/insurance/dependents', requirePermission('BENEFITS', 'can_create'), async (req, res, next) => {
    try {
        let empId = null;
        if (isSelfScopedEmployee(req.user)) {
            const reqEmp = await getRequesterEmployee(req.user);
            if (!reqEmp) return res.status(400).json({ success: false, message: 'No linked employee profile' });
            empId = reqEmp.employee_id;
        } else {
            const identifier = req.body.employee_id || req.body.employee_code;
            if (identifier) {
                const emp = await resolveEmployee(identifier);
                if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
                empId = emp.employee_id;
            } else {
                const reqEmp = await getRequesterEmployee(req.user);
                empId = reqEmp ? reqEmp.employee_id : null;
            }
        }
        if (!empId) return res.status(400).json({ success: false, message: 'Please select an employee' });
        return sendData(res, await benefitService.addEmployeeDependent({ ...req.body, employee_id: parseInt(empId, 10) }), 201);
    } catch (error) { return sendError(next, error); }
});

router.get('/benefits/mis-reports', requireAnyPermission('BENEFITS.can_update', 'BENEFITS.can_approve'), async (req, res, next) => {
    try {
        return sendData(res, await benefitService.getBenefitsMISReports());
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// 9. PERKS
// ==========================================
router.get('/perks', requirePermission('BENEFITS', 'can_view'), async (req, res, next) => {
    try { return sendData(res, await perkService.getAllPerkTypes()); } catch (error) { return sendError(next, error); }
});

router.post('/perks/create', requireAnyPermission('BENEFITS.can_update', 'BENEFITS.can_approve'), async (req, res, next) => {
    try { return sendData(res, await perkService.createPerkType(req.body), 201); } catch (error) { return sendError(next, error); }
});

router.post('/perks/assign', requireAnyPermission('BENEFITS.can_update', 'BENEFITS.can_approve'), async (req, res, next) => {
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
        const assigned = await perkService.assignPerk({ ...req.body, employee_id: parseInt(empId, 10) });
        return sendData(res, assigned, 201);
    } catch (error) { return sendError(next, error); }
});

router.get('/perks/my/:employeeCode', requirePermission('BENEFITS', 'can_view'), async (req, res, next) => {
    try {
        const emp = await resolveEmployee(req.params.employeeCode);
        if (!emp) return sendData(res, []);
        if (isSelfScopedEmployee(req.user)) {
            const reqEmp = await getRequesterEmployee(req.user);
            if (!reqEmp || Number(reqEmp.employee_id) !== Number(emp.employee_id)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
        }
        const perks = await perkService.getEmployeePerks(emp.employee_id);
        return sendData(res, perks);
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// 10. REPORTS
// ==========================================
router.get('/reports/pf', requirePermission('REPORTS', 'can_view'), async (req, res, next) => {
    try {
        const m = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year, 10) || new Date().getFullYear();
        return sendData(res, await reportsService.getPFReport(m, y));
    } catch (error) { return sendError(next, error); }
});

router.get('/reports/esi', requirePermission('REPORTS', 'can_view'), async (req, res, next) => {
    try {
        const m = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year, 10) || new Date().getFullYear();
        return sendData(res, await reportsService.getESIReport(m, y));
    } catch (error) { return sendError(next, error); }
});

router.get('/reports/pt', requirePermission('REPORTS', 'can_view'), async (req, res, next) => {
    try {
        const m = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year, 10) || new Date().getFullYear();
        return sendData(res, await reportsService.getPTReport(m, y));
    } catch (error) { return sendError(next, error); }
});

router.get('/reports/bank-transfer', requirePermission('REPORTS', 'can_view'), async (req, res, next) => {
    try {
        const m = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year, 10) || new Date().getFullYear();
        return sendData(res, await reportsService.getBankTransferStatement(m, y));
    } catch (error) { return sendError(next, error); }
});

router.get('/reports/attendance-summary', requirePermission('REPORTS', 'can_view'), async (req, res, next) => {
    try {
        const m = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year, 10) || new Date().getFullYear();
        return sendData(res, await reportsService.getAttendanceSummaryReport(m, y));
    } catch (error) { return sendError(next, error); }
});

router.get('/reports/department-cost', requirePermission('REPORTS', 'can_view'), async (req, res, next) => {
    try {
        const m = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year, 10) || new Date().getFullYear();
        return sendData(res, await reportsService.getDepartmentCostReport(m, y));
    } catch (error) { return sendError(next, error); }
});

router.get('/reports/overtime', requirePermission('REPORTS', 'can_view'), async (req, res, next) => {
    try {
        const m = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year, 10) || new Date().getFullYear();
        return sendData(res, await reportsService.getOvertimeReport(m, y));
    } catch (error) { return sendError(next, error); }
});

router.get('/reports/download/:type', requirePermission('REPORTS', 'can_view'), async (req, res, next) => {
    try {
        const { type } = req.params;
        const m = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
        const y = parseInt(req.query.year, 10) || new Date().getFullYear();

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
router.get('/clients', requireAnyPermission('INVOICES.can_view', 'SITES.can_view', 'DPR.can_view'), async (req, res, next) => {
    try {
        return sendData(res, await invoiceService.getClients());
    } catch (error) { return sendError(next, error); }
});

router.post('/clients', requirePermission('INVOICES', 'can_create'), async (req, res, next) => {
    try {
        return sendData(res, await invoiceService.createClient(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/clients/:id', requirePermission('INVOICES', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await invoiceService.updateClient(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.get('/invoices/stats', requirePermission('INVOICES', 'can_view'), async (req, res, next) => {
    try {
        return sendData(res, await invoiceService.getInvoiceStats());
    } catch (error) { return sendError(next, error); }
});

router.get('/invoices', requirePermission('INVOICES', 'can_view'), async (req, res, next) => {
    try {
        return sendData(res, await invoiceService.getInvoices(req.query));
    } catch (error) { return sendError(next, error); }
});

router.post('/invoices', requirePermission('INVOICES', 'can_create'), async (req, res, next) => {
    try {
        return sendData(res, await invoiceService.createInvoice(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/invoices/:id/status', requirePermission('INVOICES', 'can_update'), async (req, res, next) => {
    try {
        const { status, payment_mode } = req.body;
        return sendData(res, await invoiceService.updateInvoiceStatus(req.params.id, status, { payment_mode }));
    } catch (error) { return sendError(next, error); }
});

router.put('/invoices/:id(\\d+)', requirePermission('INVOICES', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await invoiceService.updateInvoice(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.delete('/invoices/:id(\\d+)', requirePermission('INVOICES', 'can_delete'), async (req, res, next) => {
    try {
        return sendData(res, await invoiceService.deleteInvoice(req.params.id));
    } catch (error) { return sendError(next, error); }
});

router.get('/compliance/alerts', requireAnyPermission('REPORTS.can_view', 'EMPLOYEES.can_view', 'SITES.can_view', 'INVOICES.can_view'), async (req, res, next) => {
    try {
        if (String(req.user?.roleCode || '').toUpperCase() === 'CLIENT_LOGIN') {
            return sendData(res, { summary: {}, alerts: [] });
        }
        return sendData(res, await invoiceService.getComplianceAlerts());
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// RECRUITMENT & ONBOARDING
// ==========================================
router.get('/recruitment/requisitions', requirePermission('RECRUITMENT', 'can_view'), async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.getRequisitions());
    } catch (error) { return sendError(next, error); }
});

router.post('/recruitment/requisitions', requirePermission('RECRUITMENT', 'can_create'), async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.createRequisition(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/recruitment/requisitions/:id', requirePermission('RECRUITMENT', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.updateRequisition(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.delete('/recruitment/requisitions/:id', requirePermission('RECRUITMENT', 'can_delete'), async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.deleteRequisition(req.params.id));
    } catch (error) { return sendError(next, error); }
});

router.get('/recruitment/candidates', requirePermission('RECRUITMENT', 'can_view'), async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.getCandidates(req.query));
    } catch (error) { return sendError(next, error); }
});

router.post('/recruitment/candidates', requirePermission('RECRUITMENT', 'can_create'), async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.createCandidate(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.delete('/recruitment/candidates/:id', requirePermission('RECRUITMENT', 'can_delete'), async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.deleteCandidate(req.params.id));
    } catch (error) { return sendError(next, error); }
});

router.put('/recruitment/candidates/:id/stage', requirePermission('RECRUITMENT', 'can_update'), async (req, res, next) => {
    try {
        const { stage, interview_date, interviewer_name, interview_feedback, rating } = req.body;
        return sendData(res, await recruitmentService.updateCandidateStage(req.params.id, stage, {
            interview_date, interviewer_name, interview_feedback, rating
        }));
    } catch (error) { return sendError(next, error); }
});

router.get('/recruitment/offers', requirePermission('RECRUITMENT', 'can_view'), async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.getOffers());
    } catch (error) { return sendError(next, error); }
});

router.post('/recruitment/offers', requirePermission('RECRUITMENT', 'can_create'), async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.createOffer(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.get('/recruitment/offers/:id/pdf', requirePermission('RECRUITMENT', 'can_view'), async (req, res, next) => {
    try {
        const offer = await recruitmentService.getOfferById(req.params.id);
        if (!offer) return res.status(404).json({ success: false, message: 'Offer letter not found' });
        await recruitmentService.markPdfGenerated(req.params.id);
        await pdfService.generateAppointmentLetter(offer, res);
    } catch (error) { return sendError(next, error); }
});

router.post('/recruitment/offers/:id/approve-salary', requirePermission('RECRUITMENT', 'can_approve'), async (req, res, next) => {
    try {
        const approver = req.body.approver || req.user?.fullName || req.user?.username || 'HR Manager';
        return sendData(res, await recruitmentService.approveSalary(req.params.id, approver));
    } catch (error) { return sendError(next, error); }
});

router.post('/recruitment/offers/:id/approve-management', requirePermission('RECRUITMENT', 'can_approve'), async (req, res, next) => {
    try {
        const approver = req.body.approver || req.user?.fullName || req.user?.username || 'Director';
        return sendData(res, await recruitmentService.approveManagement(req.params.id, approver));
    } catch (error) { return sendError(next, error); }
});

router.post('/recruitment/offers/:id/dispatch-email', requireAnyPermission('RECRUITMENT.can_create', 'RECRUITMENT.can_update'), async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.dispatchEmail(req.params.id));
    } catch (error) { return sendError(next, error); }
});

router.post('/recruitment/offers/:id/accept', requirePermission('RECRUITMENT', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.acceptOffer(req.params.id));
    } catch (error) { return sendError(next, error); }
});

router.put('/recruitment/candidates/:id/documents', requirePermission('RECRUITMENT', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.updateCandidateDocuments(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.put('/recruitment/offers/:id/status', requirePermission('RECRUITMENT', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.updateOfferStatus(req.params.id, req.body.status));
    } catch (error) { return sendError(next, error); }
});

router.post('/recruitment/candidates/:id/convert-to-employee', requireAnyPermission('RECRUITMENT.can_approve', 'EMPLOYEES.can_create'), async (req, res, next) => {
    try {
        return sendData(res, await recruitmentService.convertToEmployee(req.params.id, req.body), 201);
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// VENDOR MANAGEMENT ROUTES
// ==========================================
router.get('/vendors/stats', requireAnyPermission('VENDORS.can_view', 'DPR.can_view', 'PROCUREMENT.can_view'), async (req, res, next) => {
    try {
        return sendData(res, await vendorService.getVendorStats());
    } catch (error) { return sendError(next, error); }
});

router.get('/vendors/agreements', requirePermission('VENDORS', 'can_view'), async (req, res, next) => {
    try {
        return sendData(res, await vendorService.getAgreements(req.query.vendor_id));
    } catch (error) { return sendError(next, error); }
});

router.post('/vendors/agreements', requirePermission('VENDORS', 'can_create'), async (req, res, next) => {
    try {
        return sendData(res, await vendorService.createAgreement(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/vendors/agreements/:id', requirePermission('VENDORS', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await vendorService.updateAgreement(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.delete('/vendors/agreements/:id', requirePermission('VENDORS', 'can_delete'), async (req, res, next) => {
    try {
        return sendData(res, await vendorService.deleteAgreement(req.params.id));
    } catch (error) { return sendError(next, error); }
});

router.get('/vendors', requireAnyPermission('VENDORS.can_view', 'DPR.can_view', 'PROCUREMENT.can_view'), async (req, res, next) => {
    try {
        return sendData(res, await vendorService.getVendors(req.query));
    } catch (error) { return sendError(next, error); }
});

router.post('/vendors', requirePermission('VENDORS', 'can_create'), async (req, res, next) => {
    try {
        return sendData(res, await vendorService.createVendor(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/vendors/:id(\\d+)', requirePermission('VENDORS', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await vendorService.updateVendor(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.delete('/vendors/:id(\\d+)', requirePermission('VENDORS', 'can_delete'), async (req, res, next) => {
    try {
        return sendData(res, await vendorService.deleteVendor(req.params.id));
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// VENDOR PAYMENT TRACKER & DASHBOARD ROUTES (FY 2026-27)
// ==========================================
router.get('/vendor-payments/stats', requireAnyPermission('VENDORS.can_view', 'PROCUREMENT.can_view'), async (req, res, next) => {
    try {
        return sendData(res, await vendorPaymentService.getDashboardStats());
    } catch (error) { return sendError(next, error); }
});

router.get('/vendor-payments/export/excel', requireAnyPermission('VENDORS.can_view', 'PROCUREMENT.can_view'), async (req, res, next) => {
    try {
        const buffer = await vendorPaymentService.generateVendorPaymentsExcel();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Vendor_Payment_Tracker_FY-2026-27.xlsx"');
        return res.send(buffer);
    } catch (error) { return sendError(next, error); }
});

router.get('/vendor-payments/invoices', requireAnyPermission('VENDORS.can_view', 'PROCUREMENT.can_view'), async (req, res, next) => {
    try {
        return sendData(res, await vendorPaymentService.getInvoices(req.query));
    } catch (error) { return sendError(next, error); }
});

router.get('/vendor-payments/invoices/:id(\\d+)', requireAnyPermission('VENDORS.can_view', 'PROCUREMENT.can_view'), async (req, res, next) => {
    try {
        return sendData(res, await vendorPaymentService.getInvoiceById(req.params.id));
    } catch (error) { return sendError(next, error); }
});

router.post('/vendor-payments/invoices', requirePermission('VENDORS', 'can_create'), async (req, res, next) => {
    try {
        return sendData(res, await vendorPaymentService.createInvoice(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/vendor-payments/invoices/:id(\\d+)', requirePermission('VENDORS', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await vendorPaymentService.updateInvoice(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.delete('/vendor-payments/invoices/:id(\\d+)', requirePermission('VENDORS', 'can_delete'), async (req, res, next) => {
    try {
        return sendData(res, await vendorPaymentService.deleteInvoice(req.params.id));
    } catch (error) { return sendError(next, error); }
});

router.post('/vendor-payments/invoices/:id(\\d+)/payments', requirePermission('VENDORS', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await vendorPaymentService.recordPayment(req.params.id, req.body), 201);
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// ASSET MANAGEMENT ROUTES
// ==========================================
router.get('/assets/stats', requirePermission('ASSETS', 'can_view'), async (req, res, next) => {
    try {
        return sendData(res, await assetService.getAssetStats());
    } catch (error) { return sendError(next, error); }
});

router.get('/assets/allocations', requirePermission('ASSETS', 'can_view'), async (req, res, next) => {
    try {
        return sendData(res, await assetService.getAllocations(req.query));
    } catch (error) { return sendError(next, error); }
});

// IT Asset Handover Form by allocation ID
router.get('/assets/allocations/:id/handover-form', async (req, res, next) => {
    try {
        const allocation = await assetService.getAllocationById(req.params.id);
        if (!allocation) {
            return res.status(404).json({ success: false, message: 'Asset allocation not found' });
        }

        const hasDirView = (await checkUserPermission(req.user, 'ASSETS', 'can_view')) || (await checkUserPermission(req.user, 'EMPLOYEES', 'can_view'));
        const reqEmp = await getRequesterEmployee(req.user);
        const isSelf = reqEmp && Number(reqEmp.employee_id) === Number(allocation.employee_id);
        if (!hasDirView && !isSelf) {
            return res.status(403).json({ success: false, message: 'Access denied: missing ASSETS.can_view permission' });
        }

        await pdfService.generateAssetHandoverForm(allocation, res);
    } catch (error) {
        return sendError(next, error);
    }
});

router.post('/assets/allocate', requirePermission('ASSETS', 'can_create'), async (req, res, next) => {
    try {
        return sendData(res, await assetService.allocateAsset(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.post('/assets/return/:id', requirePermission('ASSETS', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await assetService.returnAsset(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.get('/assets', requirePermission('ASSETS', 'can_view'), async (req, res, next) => {
    try {
        return sendData(res, await assetService.getAssets(req.query));
    } catch (error) { return sendError(next, error); }
});

router.post('/assets', requirePermission('ASSETS', 'can_create'), async (req, res, next) => {
    try {
        return sendData(res, await assetService.createAsset(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/assets/:id(\\d+)', requirePermission('ASSETS', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await assetService.updateAsset(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.delete('/assets/:id(\\d+)', requirePermission('ASSETS', 'can_delete'), async (req, res, next) => {
    try {
        return sendData(res, await assetService.deleteAsset(req.params.id));
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// AI FEATURES ROUTES
// ==========================================
router.post('/ai/chat', async (req, res, next) => {
    try {
        const { message, context } = req.body;
        return sendData(res, await aiService.handleChatMessage(message, {
            role: req.user?.roleCode,
            ...(context || {})
        }));
    } catch (error) { return sendError(next, error); }
});

router.post('/ai/screen-candidate/:id', requireAnyPermission('RECRUITMENT.can_view', 'RECRUITMENT.can_update'), async (req, res, next) => {
    try {
        return sendData(res, await aiService.screenCandidate(req.params.id));
    } catch (error) { return sendError(next, error); }
});

router.get('/ai/compliance-prediction', requireAnyPermission('REPORTS.can_view', 'DASHBOARD.can_view'), async (req, res, next) => {
    try {
        if (String(req.user?.roleCode || '').toUpperCase() === 'CLIENT_LOGIN') {
            return sendData(res, {
                compliance_health_score: 100,
                risk_level: 'LOW_RISK',
                days_to_pf_esic_deadline: 0,
                risk_factors: [],
                total_active_staff: 0
            });
        }
        return sendData(res, await aiService.getPredictiveCompliance());
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// DPR (DAILY PROGRESS REPORT) ROUTES
// ==========================================
router.get('/dpr', requirePermission('DPR', 'can_view'), async (req, res, next) => {
    try {
        const { site_id, search, start_date, end_date } = req.query;
        return sendData(res, await dprService.getAllDprs({ site_id, search, start_date, end_date }));
    } catch (error) { return sendError(next, error); }
});

router.get('/dpr/template/:siteId', requirePermission('DPR', 'can_view'), async (req, res, next) => {
    try {
        const template = await dprService.getSiteTemplate(req.params.siteId);
        if (!template) return res.status(404).json({ success: false, message: 'Site not found' });
        return sendData(res, template);
    } catch (error) { return sendError(next, error); }
});

router.get('/dpr/archive/site-wise', requirePermission('DPR', 'can_view'), async (req, res, next) => {
    try {
        const { site_id } = req.query;
        const archive = await dprService.getSiteWiseArchive({ site_id });
        return sendData(res, archive);
    } catch (error) { return sendError(next, error); }
});

router.post('/dpr/upload-photo', requireAnyPermission('DPR.can_create', 'DPR.can_update'), upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No photo file uploaded' });
        }
        const fileUrl = `/uploads/${req.file.filename}`;
        return res.json({
            success: true,
            url: fileUrl,
            message: 'DPR photo uploaded successfully',
            filename: req.file.originalname,
            storage_filename: req.file.filename
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/dpr/import-excel', requireAnyPermission('DPR.can_create', 'DPR.can_update'), upload.uploadExcel.single('file'), async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ success: false, message: 'Please upload an Excel file (.xlsx, .xls)' });
        }
        const filePath = file.path;
        const parsed = await dprService.parseExcelFile(filePath);
        try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
        return sendData(res, parsed);
    } catch (error) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (_) {}
        }
        return sendError(next, error);
    }
});

router.get('/dpr/site-sheet/:siteId', requirePermission('DPR', 'can_view'), async (req, res, next) => {
    try {
        const sheet = await dprService.getSiteSheet(req.params.siteId);
        if (!sheet) return res.status(404).json({ success: false, message: 'Site not found' });
        return sendData(res, sheet);
    } catch (error) { return sendError(next, error); }
});

router.put('/dpr/site-sheet/:siteId', requireAnyPermission('DPR.can_create', 'DPR.can_update'), async (req, res, next) => {
    try {
        const updated = await dprService.saveSiteSheet(req.params.siteId, req.body);
        return sendData(res, updated);
    } catch (error) { return sendError(next, error); }
});

router.get('/dpr/:id(\\d+)', requirePermission('DPR', 'can_view'), async (req, res, next) => {
    try {
        const dpr = await dprService.getDprById(req.params.id);
        if (!dpr) return res.status(404).json({ success: false, message: 'DPR not found' });
        return sendData(res, dpr);
    } catch (error) { return sendError(next, error); }
});

router.post('/dpr', requirePermission('DPR', 'can_create'), async (req, res, next) => {
    try {
        const dpr = await dprService.createDpr(req.body, req.user?.userId);
        return sendData(res, dpr, 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/dpr/:id(\\d+)', requirePermission('DPR', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await dprService.updateDpr(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.delete('/dpr/:id(\\d+)', requirePermission('DPR', 'can_delete'), async (req, res, next) => {
    try {
        return sendData(res, await dprService.deleteDpr(req.params.id));
    } catch (error) { return sendError(next, error); }
});

router.get('/dpr/:id(\\d+)/pdf', requirePermission('DPR', 'can_view'), async (req, res, next) => {
    try {
        const dpr = await dprService.getDprById(req.params.id);
        if (!dpr) return res.status(404).json({ success: false, message: 'DPR not found' });
        await dprService.generateDprPdf(dpr, res);
    } catch (error) { return sendError(next, error); }
});

router.get('/dpr/:id(\\d+)/excel', requirePermission('DPR', 'can_view'), async (req, res, next) => {
    try {
        const dpr = await dprService.getDprById(req.params.id);
        if (!dpr) return res.status(404).json({ success: false, message: 'DPR not found' });
        await dprService.generateDprExcel(dpr, res);
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// TRENCH DEWATERING & SPECIAL SITE LOGS
// ==========================================
router.get('/dpr/trench-logs/export-pdf', requirePermission('DPR', 'can_view'), async (req, res, next) => {
    try {
        const { site_id, month, year, search, start_date, end_date } = req.query;
        await trenchDewateringService.generatePdf({ site_id, month, year, search, start_date, end_date }, res);
    } catch (error) { return sendError(next, error); }
});

router.get('/dpr/trench-logs/stats', requirePermission('DPR', 'can_view'), async (req, res, next) => {
    try {
        const { site_id, month, year } = req.query;
        return sendData(res, await trenchDewateringService.getStats({ site_id, month, year }));
    } catch (error) { return sendError(next, error); }
});

router.get('/dpr/trench-logs', requirePermission('DPR', 'can_view'), async (req, res, next) => {
    try {
        const { site_id, month, year, search, start_date, end_date } = req.query;
        return sendData(res, await trenchDewateringService.getLogs({ site_id, month, year, search, start_date, end_date }));
    } catch (error) { return sendError(next, error); }
});

router.post('/dpr/trench-logs', requirePermission('DPR', 'can_create'), async (req, res, next) => {
    try {
        const log = await trenchDewateringService.createLog(req.body, req.user?.userId);
        return sendData(res, log, 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/dpr/trench-logs/:id', requirePermission('DPR', 'can_update'), async (req, res, next) => {
    try {
        const log = await trenchDewateringService.updateLog(req.params.id, req.body);
        return sendData(res, log);
    } catch (error) { return sendError(next, error); }
});

router.delete('/dpr/trench-logs/:id', requirePermission('DPR', 'can_delete'), async (req, res, next) => {
    try {
        return sendData(res, await trenchDewateringService.deleteLog(req.params.id));
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// PROCUREMENT & MATERIAL TRACKER ROUTES
// ==========================================
router.get('/procurement/export-pdf', requirePermission('PROCUREMENT', 'can_view'), async (req, res, next) => {
    try {
        const { site_id, po_status, vendor, search, stage } = req.query;
        await procurementService.generatePdf({ site_id, po_status, vendor, search, stage }, res);
    } catch (error) { return sendError(next, error); }
});

router.get('/procurement/stats', requirePermission('PROCUREMENT', 'can_view'), async (req, res, next) => {
    try {
        const { site_id } = req.query;
        return sendData(res, await procurementService.getStats({ site_id }));
    } catch (error) { return sendError(next, error); }
});

router.get('/procurement', requirePermission('PROCUREMENT', 'can_view'), async (req, res, next) => {
    try {
        const { site_id, po_status, vendor, search, stage } = req.query;
        return sendData(res, await procurementService.getAllItems({ site_id, po_status, vendor, search, stage }));
    } catch (error) { return sendError(next, error); }
});

router.post('/procurement', requirePermission('PROCUREMENT', 'can_create'), async (req, res, next) => {
    try {
        return sendData(res, await procurementService.createItem(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/procurement/:id(\\d+)', requirePermission('PROCUREMENT', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await procurementService.updateItem(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.delete('/procurement/:id(\\d+)', requirePermission('PROCUREMENT', 'can_delete'), async (req, res, next) => {
    try {
        return sendData(res, await procurementService.deleteItem(req.params.id));
    } catch (error) { return sendError(next, error); }
});

// ==========================================
// SITE OPERATIONS & DPR HUB ROUTES
// ==========================================
router.get('/site-operations/stats', requirePermission('DPR', 'can_view'), async (req, res, next) => {
    try {
        const { site_id } = req.query;
        return sendData(res, await siteOperationsService.getOperationsStats(site_id));
    } catch (error) { return sendError(next, error); }
});

// Concerns / Issues
router.get('/site-operations/concerns', requirePermission('DPR', 'can_view'), async (req, res, next) => {
    try {
        const { site_id, status, severity, search } = req.query;
        return sendData(res, await siteOperationsService.getConcerns({ site_id, status, severity, search }));
    } catch (error) { return sendError(next, error); }
});

router.post('/site-operations/concerns', requirePermission('DPR', 'can_create'), async (req, res, next) => {
    try {
        return sendData(res, await siteOperationsService.createConcern(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/site-operations/concerns/:id', requirePermission('DPR', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await siteOperationsService.updateConcern(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.delete('/site-operations/concerns/:id', requirePermission('DPR', 'can_delete'), async (req, res, next) => {
    try {
        return sendData(res, await siteOperationsService.deleteConcern(req.params.id));
    } catch (error) { return sendError(next, error); }
});

// Measurements (M-Book)
router.get('/site-operations/measurements', requirePermission('DPR', 'can_view'), async (req, res, next) => {
    try {
        const { site_id, search, start_date, end_date, status } = req.query;
        return sendData(res, await siteOperationsService.getMeasurements({ site_id, search, start_date, end_date, status }));
    } catch (error) { return sendError(next, error); }
});

router.post('/site-operations/measurements', requirePermission('DPR', 'can_create'), async (req, res, next) => {
    try {
        return sendData(res, await siteOperationsService.createMeasurement(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/site-operations/measurements/:id', requirePermission('DPR', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await siteOperationsService.updateMeasurement(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.delete('/site-operations/measurements/:id', requirePermission('DPR', 'can_delete'), async (req, res, next) => {
    try {
        return sendData(res, await siteOperationsService.deleteMeasurement(req.params.id));
    } catch (error) { return sendError(next, error); }
});

// Vendor Mapping with Scope of Work
router.get('/site-operations/vendors', requireAnyPermission('DPR.can_view', 'VENDORS.can_view'), async (req, res, next) => {
    try {
        const { site_id, category, search } = req.query;
        return sendData(res, await siteOperationsService.getVendorsWithScope({ site_id, category, search }));
    } catch (error) { return sendError(next, error); }
});

router.put('/site-operations/vendors/:id', requireAnyPermission('DPR.can_update', 'VENDORS.can_update'), async (req, res, next) => {
    try {
        return sendData(res, await siteOperationsService.updateVendorScope(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

// Tools & Tackles / TPI Calibration
router.get('/site-operations/tools', requirePermission('DPR', 'can_view'), async (req, res, next) => {
    try {
        const { site_id, status, category, search } = req.query;
        return sendData(res, await siteOperationsService.getToolsAndTackles({ site_id, status, category, search }));
    } catch (error) { return sendError(next, error); }
});

router.post('/site-operations/tools', requirePermission('DPR', 'can_create'), async (req, res, next) => {
    try {
        return sendData(res, await siteOperationsService.createTool(req.body), 201);
    } catch (error) { return sendError(next, error); }
});

router.put('/site-operations/tools/:id', requirePermission('DPR', 'can_update'), async (req, res, next) => {
    try {
        return sendData(res, await siteOperationsService.updateTool(req.params.id, req.body));
    } catch (error) { return sendError(next, error); }
});

router.delete('/site-operations/tools/:id', requirePermission('DPR', 'can_delete'), async (req, res, next) => {
    try {
        return sendData(res, await siteOperationsService.deleteTool(req.params.id));
    } catch (error) { return sendError(next, error); }
});

router.post('/site-operations/tools/upload-certificate', requireAnyPermission('DPR.can_create', 'DPR.can_update'), upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No certificate file uploaded' });
        }
        const fileUrl = `/uploads/${req.file.filename}`;
        return res.json({
            success: true,
            url: fileUrl,
            message: 'Certificate uploaded successfully',
            filename: req.file.originalname
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/health/db', requirePermission('DASHBOARD', 'can_view'), async (req, res, next) => {
    try {
        const result = await db.query('SELECT current_database() AS database');
        return sendData(res, result.rows[0]);
    } catch (error) { return sendError(next, error); }
});

module.exports = router;
