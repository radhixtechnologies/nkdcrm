const { pool } = require('../config/database');
const PDFDocument = require('pdfkit');

const cleanInt = (val, fallback = null) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? fallback : n;
};

const cleanNum = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = parseFloat(val);
    return Number.isNaN(n) ? fallback : n;
};

const cleanDate = (val) => {
    if (val === undefined || val === null) return null;
    const s = String(val).trim();
    return s === '' ? null : s.slice(0, 10);
};

const SEED_PROCUREMENT_DATA = [
    {
        sl_no: 1,
        item_description: '11KV 1CX1000 Sqmm AL Cable',
        uom: 'Meter',
        qty: 9000,
        po_status: 'Complete',
        vendor_name: 'Polycab',
        vendor_contact: '',
        po_schedule_date: '2026-04-26',
        po_actual_date: '2026-04-29',
        po_number: 'NKD POWER/2026-27/004',
        tds_planned_date: '2026-04-17',
        tds_actual_date: '2026-04-22',
        approval_planned_date: '2026-04-23',
        approval_actual_date: '2026-04-29',
        mfg_clearance_planned: '2026-04-24',
        mfg_clearance_actual: '2026-05-08',
        mfg_start_planned: '2026-05-07',
        mfg_start_actual: '2026-05-08',
        mfg_end_planned: '2026-06-22',
        mfg_end_actual: '2026-05-27',
        inspection_planned: '2026-06-22',
        inspection_actual: '2026-06-22',
        dispatch_planned: '2026-06-25',
        dispatch_actual: '2026-07-03',
        receipt_planned: '2026-07-06',
        receipt_actual: '2026-07-06',
        location: 'Gujarat',
        contact_person: 'Sudhir Jadaun',
        contact_number: '9358555155',
        contact_email: 'Sudhir.jadaun@nkdpowersolutions.com',
        remarks: 'Delivered at site & joint inspection verified',
        milestone_stage: 'DELIVERED_AT_SITE'
    },
    {
        sl_no: 2,
        item_description: '600 mm Hot dip galvenised Cable Tray',
        uom: 'Meter',
        qty: 875,
        po_status: 'Complete',
        vendor_name: 'DMP Projects',
        vendor_contact: '',
        po_schedule_date: '2026-04-26',
        po_actual_date: '2026-05-01',
        po_number: 'NKD POWER/2026-27/006',
        tds_planned_date: '2026-04-17',
        tds_actual_date: '2026-04-18',
        approval_planned_date: '2026-04-23',
        approval_actual_date: '2026-04-27',
        mfg_clearance_planned: '2026-04-24',
        mfg_clearance_actual: '2026-05-04',
        mfg_start_planned: '2026-04-26',
        mfg_start_actual: '2026-05-06',
        mfg_end_planned: '2026-06-16',
        mfg_end_actual: '2026-06-16',
        inspection_planned: '2026-06-18',
        inspection_actual: '2026-06-17',
        dispatch_planned: '2026-06-21',
        dispatch_actual: '2026-06-22',
        receipt_planned: '2026-06-24',
        receipt_actual: '2026-06-26',
        location: 'West Bengal',
        contact_person: 'Sudhir Jadaun',
        contact_number: '9358555155',
        contact_email: 'Sudhir.jadaun@nkdpowersolutions.com',
        remarks: 'Delivered at site',
        milestone_stage: 'DELIVERED_AT_SITE'
    },
    {
        sl_no: 3,
        item_description: '75x12 Earthing Strip',
        uom: 'Meter',
        qty: 500,
        po_status: 'Complete',
        vendor_name: 'DMP Projects',
        vendor_contact: '',
        po_schedule_date: '2026-04-26',
        po_actual_date: '2026-05-01',
        po_number: 'NKD POWER/2026-27/006',
        tds_planned_date: '2026-04-17',
        tds_actual_date: '2026-04-20',
        approval_planned_date: '2026-04-23',
        approval_actual_date: '2026-04-29',
        mfg_clearance_planned: '2026-04-24',
        mfg_clearance_actual: '2026-05-04',
        mfg_start_planned: '2026-04-26',
        mfg_start_actual: '2026-05-06',
        mfg_end_planned: '2026-06-05',
        mfg_end_actual: '2026-06-16',
        inspection_planned: '2026-06-07',
        inspection_actual: '2026-06-17',
        dispatch_planned: '2026-06-10',
        dispatch_actual: '2026-06-22',
        receipt_planned: '2026-06-13',
        receipt_actual: '2026-06-26',
        location: 'West Bengal',
        contact_person: 'Sudhir Jadaun',
        contact_number: '9358555155',
        contact_email: 'Sudhir.jadaun@nkdpowersolutions.com',
        remarks: 'Delivered at site',
        milestone_stage: 'DELIVERED_AT_SITE'
    },
    {
        sl_no: 4,
        item_description: '75x75x10 Angle and Insert Plate',
        uom: 'Nos',
        qty: 750,
        po_status: 'Complete',
        vendor_name: 'SAIL',
        vendor_contact: '',
        po_schedule_date: '2026-04-26',
        po_actual_date: '2026-04-27',
        po_number: 'NKD/26-27/002',
        tds_planned_date: '2026-04-17',
        tds_actual_date: '2026-04-22',
        approval_planned_date: '2026-04-23',
        approval_actual_date: '2026-04-27',
        mfg_clearance_planned: '2026-04-23',
        mfg_clearance_actual: '2026-04-27',
        mfg_start_planned: '2026-04-28',
        mfg_start_actual: '2026-04-27',
        mfg_end_planned: '2026-05-17',
        mfg_end_actual: '2026-05-13',
        inspection_planned: null,
        inspection_actual: null,
        dispatch_planned: '2026-05-18',
        dispatch_actual: '2026-05-14',
        receipt_planned: '2026-05-18',
        receipt_actual: '2026-05-14',
        location: 'Turbhe, Navi Mumbai',
        contact_person: 'Sudhir Jadaun',
        contact_number: '9358555155',
        contact_email: 'Sudhir.jadaun@nkdpowersolutions.com',
        remarks: 'Delivered at site',
        milestone_stage: 'DELIVERED_AT_SITE'
    },
    {
        sl_no: 5,
        item_description: '11KV 1CX1000 SQmm End Termination',
        uom: 'Nos',
        qty: 72,
        po_status: 'Complete',
        vendor_name: '3M / Raychem RPG (P)Ltd',
        vendor_contact: '',
        po_schedule_date: '2026-05-02',
        po_actual_date: '2026-04-29',
        po_number: 'NKD/26-27/005',
        tds_planned_date: '2026-04-17',
        tds_actual_date: '2026-04-20',
        approval_planned_date: '2026-04-23',
        approval_actual_date: '2026-04-27',
        mfg_clearance_planned: '2026-08-12',
        mfg_clearance_actual: null,
        mfg_start_planned: null,
        mfg_start_actual: null,
        mfg_end_planned: null,
        mfg_end_actual: null,
        inspection_planned: null,
        inspection_actual: null,
        dispatch_planned: null,
        dispatch_actual: null,
        receipt_planned: null,
        receipt_actual: null,
        location: 'Mumbai',
        contact_person: 'Sudhir Jadaun',
        contact_number: '9358555155',
        contact_email: 'Sudhir.jadaun@nkdpowersolutions.com',
        remarks: 'Raychem Heat Shrinkable Termination Kits',
        milestone_stage: 'MANUFACTURING'
    },
    {
        sl_no: 6,
        item_description: 'FO Cable',
        uom: 'Meter',
        qty: 1000,
        po_status: 'Pending',
        vendor_name: 'Commscope',
        vendor_contact: '',
        po_schedule_date: '2026-04-26',
        po_actual_date: null,
        po_number: '',
        tds_planned_date: '2026-04-18',
        tds_actual_date: '2026-07-20',
        approval_planned_date: '2026-07-22',
        approval_actual_date: '2026-07-27',
        mfg_clearance_planned: null,
        mfg_clearance_actual: null,
        mfg_start_planned: null,
        mfg_start_actual: null,
        mfg_end_planned: null,
        mfg_end_actual: null,
        inspection_planned: null,
        inspection_actual: null,
        dispatch_planned: null,
        dispatch_actual: null,
        receipt_planned: '2026-10-08',
        receipt_actual: '2026-10-08',
        location: 'Delhi',
        contact_person: 'Sudhir Jadaun',
        contact_number: '9358555155',
        contact_email: 'Sudhir.jadaun@nkdpowersolutions.com',
        remarks: 'Fiber Optic Cable delivered at site',
        milestone_stage: 'DELIVERED_AT_SITE'
    },
    {
        sl_no: 7,
        item_description: 'DWC Conduit/ PVC Conduit',
        uom: 'Meter',
        qty: 1000,
        po_status: 'Pending',
        vendor_name: 'Supreme',
        vendor_contact: '',
        po_schedule_date: '2026-05-05',
        po_actual_date: null,
        po_number: '',
        tds_planned_date: '2026-04-17',
        tds_actual_date: '2026-07-01',
        approval_planned_date: '2026-07-03',
        approval_actual_date: '2026-07-27',
        mfg_clearance_planned: null,
        mfg_clearance_actual: null,
        mfg_start_planned: null,
        mfg_start_actual: null,
        mfg_end_planned: null,
        mfg_end_actual: null,
        inspection_planned: null,
        inspection_actual: null,
        dispatch_planned: null,
        dispatch_actual: null,
        receipt_planned: '2026-08-24',
        receipt_actual: '2026-08-24',
        location: 'Maharashtra',
        contact_person: 'Sudhir Jadaun',
        contact_number: '9358555155',
        contact_email: 'Sudhir.jadaun@nkdpowersolutions.com',
        remarks: 'Underground conduit delivered at site',
        milestone_stage: 'DELIVERED_AT_SITE'
    },
    {
        sl_no: 8,
        item_description: 'Heat Sensing Cable',
        uom: 'Meter',
        qty: 1000,
        po_status: 'Pending',
        vendor_name: 'ProReact',
        vendor_contact: '',
        po_schedule_date: '2026-05-05',
        po_actual_date: null,
        po_number: '',
        tds_planned_date: '2026-04-17',
        tds_actual_date: '2026-07-20',
        approval_planned_date: '2026-07-22',
        approval_actual_date: '2026-07-28',
        mfg_clearance_planned: null,
        mfg_clearance_actual: null,
        mfg_start_planned: null,
        mfg_start_actual: null,
        mfg_end_planned: null,
        mfg_end_actual: null,
        inspection_planned: null,
        inspection_actual: null,
        dispatch_planned: null,
        dispatch_actual: null,
        receipt_planned: '2026-10-08',
        receipt_actual: '2026-10-08',
        location: 'Client Warehouse',
        contact_person: 'Sudhir Jadaun',
        contact_number: '9358555155',
        contact_email: 'Sudhir.jadaun@nkdpowersolutions.com',
        remarks: "RECEIVED FROM CLIENT'S SIDE",
        milestone_stage: 'DELIVERED_AT_SITE'
    },
    {
        sl_no: 9,
        item_description: 'Cable Sealing Material',
        uom: 'Nos',
        qty: 4,
        po_status: 'Complete',
        vendor_name: 'Roxtec',
        vendor_contact: '',
        po_schedule_date: '2026-05-05',
        po_actual_date: '2026-06-26',
        po_number: 'NKD/26-27/009',
        tds_planned_date: '2026-04-17',
        tds_actual_date: '2026-05-11',
        approval_planned_date: '2026-05-13',
        approval_actual_date: '2026-05-14',
        mfg_clearance_planned: null,
        mfg_clearance_actual: null,
        mfg_start_planned: null,
        mfg_start_actual: null,
        mfg_end_planned: null,
        mfg_end_actual: null,
        inspection_planned: null,
        inspection_actual: null,
        dispatch_planned: null,
        dispatch_actual: null,
        receipt_planned: '2026-10-23',
        receipt_actual: '2026-10-23',
        location: 'Mumbai',
        contact_person: 'Sudhir Jadaun',
        contact_number: '9358555155',
        contact_email: 'Sudhir.jadaun@nkdpowersolutions.com',
        remarks: 'Roxtec sealing modular frames received & shifted',
        milestone_stage: 'DELIVERED_AT_SITE'
    },
    {
        sl_no: 10,
        item_description: 'Trefoil clamp',
        uom: 'Nos',
        qty: 2000,
        po_status: 'Complete',
        vendor_name: 'SG Powers',
        vendor_contact: '',
        po_schedule_date: '2026-05-15',
        po_actual_date: '2026-06-26',
        po_number: 'NKD/26-27/010',
        tds_planned_date: '2026-05-10',
        tds_actual_date: '2026-05-12',
        approval_planned_date: '2026-05-14',
        approval_actual_date: '2026-05-26',
        mfg_clearance_planned: null,
        mfg_clearance_actual: null,
        mfg_start_planned: null,
        mfg_start_actual: null,
        mfg_end_planned: null,
        mfg_end_actual: null,
        inspection_planned: null,
        inspection_actual: null,
        dispatch_planned: null,
        dispatch_actual: null,
        receipt_planned: '2026-09-07',
        receipt_actual: '2026-09-08',
        location: 'Navi Mumbai',
        contact_person: 'Sudhir Jadaun',
        contact_number: '9358555155',
        contact_email: 'Sudhir.jadaun@nkdpowersolutions.com',
        remarks: 'Aluminum trefoil cable clamps received at site',
        milestone_stage: 'DELIVERED_AT_SITE'
    }
];

const DATE_SELECT_SQL = `
    TO_CHAR(p.po_schedule_date, 'YYYY-MM-DD') AS po_schedule_date,
    TO_CHAR(p.po_actual_date, 'YYYY-MM-DD') AS po_actual_date,
    TO_CHAR(p.tds_planned_date, 'YYYY-MM-DD') AS tds_planned_date,
    TO_CHAR(p.tds_actual_date, 'YYYY-MM-DD') AS tds_actual_date,
    TO_CHAR(p.approval_planned_date, 'YYYY-MM-DD') AS approval_planned_date,
    TO_CHAR(p.approval_actual_date, 'YYYY-MM-DD') AS approval_actual_date,
    TO_CHAR(p.mfg_clearance_planned, 'YYYY-MM-DD') AS mfg_clearance_planned,
    TO_CHAR(p.mfg_clearance_actual, 'YYYY-MM-DD') AS mfg_clearance_actual,
    TO_CHAR(p.mfg_start_planned, 'YYYY-MM-DD') AS mfg_start_planned,
    TO_CHAR(p.mfg_start_actual, 'YYYY-MM-DD') AS mfg_start_actual,
    TO_CHAR(p.mfg_end_planned, 'YYYY-MM-DD') AS mfg_end_planned,
    TO_CHAR(p.mfg_end_actual, 'YYYY-MM-DD') AS mfg_end_actual,
    TO_CHAR(p.inspection_planned, 'YYYY-MM-DD') AS inspection_planned,
    TO_CHAR(p.inspection_actual, 'YYYY-MM-DD') AS inspection_actual,
    TO_CHAR(p.dispatch_planned, 'YYYY-MM-DD') AS dispatch_planned,
    TO_CHAR(p.dispatch_actual, 'YYYY-MM-DD') AS dispatch_actual,
    TO_CHAR(p.receipt_planned, 'YYYY-MM-DD') AS receipt_planned,
    TO_CHAR(p.receipt_actual, 'YYYY-MM-DD') AS receipt_actual,
    TO_CHAR(p.po_schedule_date, 'DD-Mon-YYYY') AS po_schedule_fmt,
    TO_CHAR(p.po_actual_date, 'DD-Mon-YYYY') AS po_actual_fmt,
    TO_CHAR(p.tds_planned_date, 'DD-Mon-YYYY') AS tds_planned_fmt,
    TO_CHAR(p.tds_actual_date, 'DD-Mon-YYYY') AS tds_actual_fmt,
    TO_CHAR(p.approval_planned_date, 'DD-Mon-YYYY') AS approval_planned_fmt,
    TO_CHAR(p.approval_actual_date, 'DD-Mon-YYYY') AS approval_actual_fmt,
    TO_CHAR(p.mfg_clearance_planned, 'DD-Mon-YYYY') AS mfg_clearance_planned_fmt,
    TO_CHAR(p.mfg_clearance_actual, 'DD-Mon-YYYY') AS mfg_clearance_actual_fmt,
    TO_CHAR(p.mfg_start_planned, 'DD-Mon-YYYY') AS mfg_start_planned_fmt,
    TO_CHAR(p.mfg_start_actual, 'DD-Mon-YYYY') AS mfg_start_actual_fmt,
    TO_CHAR(p.mfg_end_planned, 'DD-Mon-YYYY') AS mfg_end_planned_fmt,
    TO_CHAR(p.mfg_end_actual, 'DD-Mon-YYYY') AS mfg_end_actual_fmt,
    TO_CHAR(p.inspection_planned, 'DD-Mon-YYYY') AS inspection_planned_fmt,
    TO_CHAR(p.inspection_actual, 'DD-Mon-YYYY') AS inspection_actual_fmt,
    TO_CHAR(p.dispatch_planned, 'DD-Mon-YYYY') AS dispatch_planned_fmt,
    TO_CHAR(p.dispatch_actual, 'DD-Mon-YYYY') AS dispatch_actual_fmt,
    TO_CHAR(p.receipt_planned, 'DD-Mon-YYYY') AS receipt_planned_fmt,
    TO_CHAR(p.receipt_actual, 'DD-Mon-YYYY') AS receipt_actual_fmt
`;

class ProcurementService {
    constructor() {
        this.initPromise = null;
    }

    /**
     * Ensure table exists and seed GTPL items once per server lifecycle
     */
    async ensureTable() {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS project_procurement_items (
                        item_id SERIAL PRIMARY KEY,
                        site_id INTEGER REFERENCES sites(site_id) ON DELETE SET NULL,
                        sl_no INTEGER NOT NULL,
                        item_description VARCHAR(255) NOT NULL,
                        uom VARCHAR(50) NOT NULL DEFAULT 'Nos',
                        qty NUMERIC(12, 2) NOT NULL DEFAULT 1,
                        po_status VARCHAR(50) DEFAULT 'Pending',
                        vendor_name VARCHAR(150) NOT NULL,
                        vendor_contact VARCHAR(150),
                        po_schedule_date DATE,
                        po_actual_date DATE,
                        po_number VARCHAR(100),
                        tds_planned_date DATE,
                        tds_actual_date DATE,
                        approval_planned_date DATE,
                        approval_actual_date DATE,
                        mfg_clearance_planned DATE,
                        mfg_clearance_actual DATE,
                        mfg_start_planned DATE,
                        mfg_start_actual DATE,
                        mfg_end_planned DATE,
                        mfg_end_actual DATE,
                        inspection_planned DATE,
                        inspection_actual DATE,
                        dispatch_planned DATE,
                        dispatch_actual DATE,
                        receipt_planned DATE,
                        receipt_actual DATE,
                        location VARCHAR(150),
                        contact_person VARCHAR(150) DEFAULT 'Sudhir Jadaun',
                        contact_number VARCHAR(50) DEFAULT '9358555155',
                        contact_email VARCHAR(150) DEFAULT 'Sudhir.jadaun@nkdpowersolutions.com',
                        remarks TEXT,
                        milestone_stage VARCHAR(50) DEFAULT 'PO_ISSUED',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_proc_site ON project_procurement_items(site_id);
                    CREATE INDEX IF NOT EXISTS idx_proc_stage ON project_procurement_items(milestone_stage);
                `);

                const countRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM project_procurement_items');
                if ((countRes.rows[0]?.cnt || 0) === 0) {
                    let siteId = null;
                    const siteCheck = await pool.query("SELECT site_id FROM sites WHERE site_name ILIKE '%Lumina%' OR site_code = 'GTPL-LUMINA' LIMIT 1");
                    if (siteCheck.rows.length > 0) {
                        siteId = siteCheck.rows[0].site_id;
                    } else {
                        const sIns = await pool.query(`
                            INSERT INTO sites (site_code, site_name, address, city, state, pincode, is_active, nature_of_work)
                            VALUES ('GTPL-LUMINA', 'GTPL LUMINA Data Center', 'Airoli Knowledge Park', 'Airoli, Navi Mumbai', 'Maharashtra', '400708', TRUE, '11kV Substation & Power Infrastructure')
                            ON CONFLICT (site_code) DO UPDATE SET is_active = TRUE
                            RETURNING site_id
                        `);
                        siteId = sIns.rows[0]?.site_id || null;
                    }

                    for (const item of SEED_PROCUREMENT_DATA) {
                        await pool.query(`
                            INSERT INTO project_procurement_items (
                                site_id, sl_no, item_description, uom, qty, po_status,
                                vendor_name, vendor_contact,
                                po_schedule_date, po_actual_date, po_number,
                                tds_planned_date, tds_actual_date,
                                approval_planned_date, approval_actual_date,
                                mfg_clearance_planned, mfg_clearance_actual,
                                mfg_start_planned, mfg_start_actual,
                                mfg_end_planned, mfg_end_actual,
                                inspection_planned, inspection_actual,
                                dispatch_planned, dispatch_actual,
                                receipt_planned, receipt_actual,
                                location, contact_person, contact_number, contact_email,
                                remarks, milestone_stage
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                                $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
                                $31, $32, $33
                            )
                        `, [
                            siteId, item.sl_no, item.item_description, item.uom, item.qty, item.po_status,
                            item.vendor_name, item.vendor_contact,
                            item.po_schedule_date, item.po_actual_date, item.po_number,
                            item.tds_planned_date, item.tds_actual_date,
                            item.approval_planned_date, item.approval_actual_date,
                            item.mfg_clearance_planned, item.mfg_clearance_actual,
                            item.mfg_start_planned, item.mfg_start_actual,
                            item.mfg_end_planned, item.mfg_end_actual,
                            item.inspection_planned, item.inspection_actual,
                            item.dispatch_planned, item.dispatch_actual,
                            item.receipt_planned, item.receipt_actual,
                            item.location, item.contact_person, item.contact_number, item.contact_email,
                            item.remarks, item.milestone_stage
                        ]);
                    }
                }
            } catch (err) {
                this.initPromise = null;
                console.warn('project_procurement_items ensureTable notice:', err.message);
            }
        })();

        return this.initPromise;
    }

    /**
     * Get all items with optional filters
     */
    async getAllItems({ site_id, po_status, vendor, search, stage } = {}) {
        await this.ensureTable();

        let query = `
            SELECT
                p.item_id, p.site_id, p.sl_no, p.item_description, p.uom, p.qty, p.po_status,
                p.vendor_name, p.vendor_contact, p.po_number, p.location,
                p.contact_person, p.contact_number, p.contact_email, p.remarks, p.milestone_stage,
                p.created_at, p.updated_at,
                ${DATE_SELECT_SQL},
                s.site_name,
                s.site_code
            FROM project_procurement_items p
            LEFT JOIN sites s ON p.site_id = s.site_id
            WHERE 1=1
        `;
        const params = [];

        if (site_id && site_id !== 'ALL') {
            const parsedSite = cleanInt(site_id);
            if (parsedSite) {
                params.push(parsedSite);
                query += ` AND p.site_id = $${params.length}`;
            }
        }

        if (po_status && po_status !== 'ALL') {
            params.push(po_status);
            query += ` AND p.po_status ILIKE $${params.length}`;
        }

        if (stage && stage !== 'ALL') {
            params.push(stage);
            query += ` AND p.milestone_stage = $${params.length}`;
        }

        if (vendor && vendor !== 'ALL') {
            params.push(`%${vendor}%`);
            query += ` AND p.vendor_name ILIKE $${params.length}`;
        }

        if (search && String(search).trim() !== '') {
            params.push(`%${String(search).trim()}%`);
            query += ` AND (p.item_description ILIKE $${params.length} OR p.vendor_name ILIKE $${params.length} OR COALESCE(p.po_number, '') ILIKE $${params.length} OR COALESCE(p.remarks, '') ILIKE $${params.length})`;
        }

        query += ` ORDER BY p.sl_no ASC, p.item_id ASC`;
        const res = await pool.query(query, params);
        return res.rows;
    }

    /**
     * Get Procurement KPI Stats
     */
    async getStats({ site_id } = {}) {
        await this.ensureTable();

        let baseWhere = 'WHERE 1=1';
        const params = [];

        if (site_id && site_id !== 'ALL') {
            const parsedSite = cleanInt(site_id);
            if (parsedSite) {
                params.push(parsedSite);
                baseWhere += ` AND site_id = $${params.length}`;
            }
        }

        const statsQuery = `
            SELECT
                COUNT(*)::int AS total_items,
                COUNT(CASE WHEN LOWER(po_status) = 'complete' THEN 1 END)::int AS po_completed,
                COUNT(CASE WHEN LOWER(COALESCE(po_status, 'pending')) != 'complete' THEN 1 END)::int AS po_pending,
                COUNT(CASE WHEN milestone_stage = 'DELIVERED_AT_SITE' OR receipt_actual IS NOT NULL THEN 1 END)::int AS delivered_at_site,
                COUNT(CASE WHEN COALESCE(remarks, '') ILIKE '%CLIENT%SIDE%' THEN 1 END)::int AS client_free_issue,
                COUNT(CASE WHEN milestone_stage = 'MANUFACTURING' THEN 1 END)::int AS in_manufacturing,
                COALESCE(SUM(CASE WHEN LOWER(uom) = 'meter' THEN qty ELSE 0 END), 0)::int AS total_cable_meters
            FROM project_procurement_items
            ${baseWhere}
        `;
        const res = await pool.query(statsQuery, params);
        return res.rows[0] || {};
    }

    /**
     * Create single item
     */
    async createItem(data) {
        await this.ensureTable();
        if (!data.item_description || !data.vendor_name) {
            const err = new Error('Item description and Vendor name are required');
            err.status = 400;
            throw err;
        }

        const maxSl = await pool.query('SELECT COALESCE(MAX(sl_no), 0) + 1 AS next_sl FROM project_procurement_items');
        const nextSlNo = cleanInt(data.sl_no, maxSl.rows[0].next_sl);
        const receiptActual = cleanDate(data.receipt_actual);

        const query = `
            INSERT INTO project_procurement_items (
                site_id, sl_no, item_description, uom, qty, po_status,
                vendor_name, vendor_contact, po_schedule_date, po_actual_date, po_number,
                tds_planned_date, tds_actual_date, approval_planned_date, approval_actual_date,
                mfg_clearance_planned, mfg_clearance_actual, mfg_start_planned, mfg_start_actual,
                mfg_end_planned, mfg_end_actual, inspection_planned, inspection_actual,
                dispatch_planned, dispatch_actual, receipt_planned, receipt_actual,
                location, contact_person, contact_number, contact_email, remarks, milestone_stage
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11,
                $12, $13, $14, $15,
                $16, $17, $18, $19,
                $20, $21, $22, $23,
                $24, $25, $26, $27,
                $28, $29, $30, $31, $32, $33
            ) RETURNING *
        `;
        const res = await pool.query(query, [
            cleanInt(data.site_id),
            nextSlNo,
            String(data.item_description).trim(),
            data.uom || 'Nos',
            cleanNum(data.qty, 1),
            data.po_status || 'Pending',
            String(data.vendor_name).trim(),
            data.vendor_contact || '',
            cleanDate(data.po_schedule_date),
            cleanDate(data.po_actual_date),
            data.po_number || '',
            cleanDate(data.tds_planned_date),
            cleanDate(data.tds_actual_date),
            cleanDate(data.approval_planned_date),
            cleanDate(data.approval_actual_date),
            cleanDate(data.mfg_clearance_planned),
            cleanDate(data.mfg_clearance_actual),
            cleanDate(data.mfg_start_planned),
            cleanDate(data.mfg_start_actual),
            cleanDate(data.mfg_end_planned),
            cleanDate(data.mfg_end_actual),
            cleanDate(data.inspection_planned),
            cleanDate(data.inspection_actual),
            cleanDate(data.dispatch_planned),
            cleanDate(data.dispatch_actual),
            cleanDate(data.receipt_planned),
            receiptActual,
            data.location || '',
            data.contact_person || 'Sudhir Jadaun',
            data.contact_number || '9358555155',
            data.contact_email || 'Sudhir.jadaun@nkdpowersolutions.com',
            data.remarks || '',
            data.milestone_stage || (receiptActual ? 'DELIVERED_AT_SITE' : 'PO_ISSUED')
        ]);
        return res.rows[0];
    }

    /**
     * Update item (supports all 9 procurement stages cleanly)
     */
    async updateItem(id, data) {
        await this.ensureTable();
        const itemId = cleanInt(id);
        const existingRes = await pool.query('SELECT * FROM project_procurement_items WHERE item_id = $1', [itemId]);
        if (existingRes.rows.length === 0) {
            const err = new Error('Procurement item not found');
            err.status = 404;
            throw err;
        }
        const ex = existingRes.rows[0];

        const query = `
            UPDATE project_procurement_items SET
                site_id = $1,
                sl_no = $2,
                item_description = $3,
                uom = $4,
                qty = $5,
                po_status = $6,
                vendor_name = $7,
                vendor_contact = $8,
                po_number = $9,
                po_schedule_date = $10,
                po_actual_date = $11,
                tds_planned_date = $12,
                tds_actual_date = $13,
                approval_planned_date = $14,
                approval_actual_date = $15,
                mfg_clearance_planned = $16,
                mfg_clearance_actual = $17,
                mfg_start_planned = $18,
                mfg_start_actual = $19,
                mfg_end_planned = $20,
                mfg_end_actual = $21,
                inspection_planned = $22,
                inspection_actual = $23,
                dispatch_planned = $24,
                dispatch_actual = $25,
                receipt_planned = $26,
                receipt_actual = $27,
                location = $28,
                contact_person = $29,
                contact_number = $30,
                contact_email = $31,
                remarks = $32,
                milestone_stage = $33,
                updated_at = CURRENT_TIMESTAMP
            WHERE item_id = $34
            RETURNING *
        `;
        const res = await pool.query(query, [
            data.site_id !== undefined ? cleanInt(data.site_id, null) : ex.site_id,
            data.sl_no !== undefined ? cleanInt(data.sl_no, ex.sl_no) : ex.sl_no,
            data.item_description !== undefined ? data.item_description : ex.item_description,
            data.uom !== undefined ? data.uom : ex.uom,
            data.qty !== undefined ? cleanNum(data.qty, ex.qty) : ex.qty,
            data.po_status !== undefined ? data.po_status : ex.po_status,
            data.vendor_name !== undefined ? data.vendor_name : ex.vendor_name,
            data.vendor_contact !== undefined ? (data.vendor_contact || '') : ex.vendor_contact,
            data.po_number !== undefined ? (data.po_number || '') : ex.po_number,
            data.po_schedule_date !== undefined ? cleanDate(data.po_schedule_date) : ex.po_schedule_date,
            data.po_actual_date !== undefined ? cleanDate(data.po_actual_date) : ex.po_actual_date,
            data.tds_planned_date !== undefined ? cleanDate(data.tds_planned_date) : ex.tds_planned_date,
            data.tds_actual_date !== undefined ? cleanDate(data.tds_actual_date) : ex.tds_actual_date,
            data.approval_planned_date !== undefined ? cleanDate(data.approval_planned_date) : ex.approval_planned_date,
            data.approval_actual_date !== undefined ? cleanDate(data.approval_actual_date) : ex.approval_actual_date,
            data.mfg_clearance_planned !== undefined ? cleanDate(data.mfg_clearance_planned) : ex.mfg_clearance_planned,
            data.mfg_clearance_actual !== undefined ? cleanDate(data.mfg_clearance_actual) : ex.mfg_clearance_actual,
            data.mfg_start_planned !== undefined ? cleanDate(data.mfg_start_planned) : ex.mfg_start_planned,
            data.mfg_start_actual !== undefined ? cleanDate(data.mfg_start_actual) : ex.mfg_start_actual,
            data.mfg_end_planned !== undefined ? cleanDate(data.mfg_end_planned) : ex.mfg_end_planned,
            data.mfg_end_actual !== undefined ? cleanDate(data.mfg_end_actual) : ex.mfg_end_actual,
            data.inspection_planned !== undefined ? cleanDate(data.inspection_planned) : ex.inspection_planned,
            data.inspection_actual !== undefined ? cleanDate(data.inspection_actual) : ex.inspection_actual,
            data.dispatch_planned !== undefined ? cleanDate(data.dispatch_planned) : ex.dispatch_planned,
            data.dispatch_actual !== undefined ? cleanDate(data.dispatch_actual) : ex.dispatch_actual,
            data.receipt_planned !== undefined ? cleanDate(data.receipt_planned) : ex.receipt_planned,
            data.receipt_actual !== undefined ? cleanDate(data.receipt_actual) : ex.receipt_actual,
            data.location !== undefined ? (data.location || '') : ex.location,
            data.contact_person !== undefined ? (data.contact_person || '') : ex.contact_person,
            data.contact_number !== undefined ? (data.contact_number || '') : ex.contact_number,
            data.contact_email !== undefined ? (data.contact_email || '') : ex.contact_email,
            data.remarks !== undefined ? (data.remarks || '') : ex.remarks,
            data.milestone_stage !== undefined ? data.milestone_stage : ex.milestone_stage,
            itemId
        ]);
        return res.rows[0];
    }

    /**
     * Delete item (Archives to Recycle Bin for 1-Click Restore)
     */
    async deleteItem(id, user = null, req = null) {
        await this.ensureTable();
        const pRes = await pool.query('SELECT * FROM project_procurement_items WHERE item_id = $1', [cleanInt(id)]);
        if (pRes.rows.length === 0) {
            const err = new Error('Procurement item not found');
            err.status = 404;
            throw err;
        }
        const item = pRes.rows[0];

        // Archive into Recycle Bin & Audit Trail
        const recycleBinService = require('./recycleBinService');
        await recycleBinService.moveToBin({
            module: 'PROCUREMENT',
            recordId: id,
            recordTitle: `Procurement: ${item.item_description} (${item.vendor_name || 'Vendor'})`,
            recordData: item,
            user,
            req
        }).catch((err) => console.error('Procurement recycle bin archive error:', err));

        await pool.query('DELETE FROM project_procurement_items WHERE item_id = $1', [cleanInt(id)]);
        return { success: true, message: 'Item moved to Recycle Bin' };
    }

    /**
     * Generate Landscape Procurement & Supply Chain Status PDF
     */
    async generatePdf(filters = {}, res) {
        const items = await this.getAllItems(filters);
        const stats = await this.getStats(filters);

        let projectLabel = items[0]?.site_name || 'GTPL LUMINA, AIROLI, MUMBAI';
        if (filters.site_id && filters.site_id !== 'ALL' && items.length === 0) {
            const sRes = await pool.query('SELECT site_name FROM sites WHERE site_id = $1', [cleanInt(filters.site_id)]);
            if (sRes.rows[0]?.site_name) projectLabel = sRes.rows[0].site_name;
        }

        const doc = new PDFDocument({ margin: 25, size: 'A4', layout: 'landscape', bufferPages: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Procurement_Tracker_${Date.now()}.pdf"`);
        doc.pipe(res);

        // Header Banner
        doc.rect(25, 25, 792, 50).fill('#0f172a');
        doc.fillColor('#38bdf8').fontSize(14).font('Helvetica-Bold').text('NKD POWER SOLUTIONS PVT LTD', 35, 33);
        doc.fillColor('#ffffff').fontSize(10).font('Helvetica').text('PROJECT PROCUREMENT & SUPPLY CHAIN MATERIAL TRACKER', 35, 50);

        doc.fillColor('#38bdf8').fontSize(9).font('Helvetica-Bold').text(`PROJECT: ${projectLabel}`, 500, 35, { align: 'right', width: 305 });
        doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 560, 50, { align: 'right', width: 245 });

        // Stats Bar
        let y = 82;
        doc.rect(25, y, 792, 28).fill('#f1f5f9');
        doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold');
        doc.text(`Total Package Items: ${stats.total_items || items.length}`, 35, y + 9);
        doc.fillColor('#059669').text(`PO Completed: ${stats.po_completed || 0}`, 185, y + 9);
        doc.fillColor('#0284c7').text(`Delivered at Site: ${stats.delivered_at_site || 0}`, 310, y + 9);
        doc.fillColor('#d97706').text(`Client Free-Issue: ${stats.client_free_issue || 0}`, 455, y + 9);
        doc.fillColor('#475569').text('Lead Procurement: Sudhir Jadaun (+91 9358555155)', 590, y + 9);

        // Table Header
        y = 116;
        const drawHeader = () => {
            doc.rect(25, y, 792, 20).fill('#1e293b');
            doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold');
            doc.text('SL', 28, y + 6, { width: 18 });
            doc.text('ITEM DESCRIPTION', 48, y + 6, { width: 155 });
            doc.text('QTY / UOM', 205, y + 6, { width: 60 });
            doc.text('VENDOR & PO NO.', 270, y + 6, { width: 130 });
            doc.text('PO DATE', 405, y + 6, { width: 60 });
            doc.text('DRAWING APP.', 470, y + 6, { width: 65 });
            doc.text('SITE RECEIPT', 540, y + 6, { width: 65 });
            doc.text('LOCATION', 610, y + 6, { width: 75 });
            doc.text('STATUS & REMARKS', 690, y + 6, { width: 120 });
            y += 20;
        };
        drawHeader();

        if (items.length === 0) {
            doc.fillColor('#64748b').fontSize(9).font('Helvetica-Oblique')
                .text('No procurement items found for the selected filter criteria.', 35, y + 14);
            y += 40;
        } else {
            items.forEach((item, idx) => {
                if (y > 520) {
                    doc.addPage();
                    y = 35;
                    drawHeader();
                }

                const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                doc.rect(25, y, 792, 22).fill(rowBg);

                doc.fillColor('#334155').fontSize(7).font('Helvetica');
                doc.text(String(item.sl_no || idx + 1), 28, y + 6, { width: 18 });
                doc.font('Helvetica-Bold').text(item.item_description, 48, y + 6, { width: 155, ellipsis: true });
                doc.font('Helvetica').text(`${item.qty} ${item.uom}`, 205, y + 6, { width: 60 });

                doc.font('Helvetica-Bold').text(item.vendor_name, 270, y + 3, { width: 130, ellipsis: true });
                doc.font('Helvetica').fontSize(6).fillColor('#64748b').text(item.po_number || 'PO Pending', 270, y + 12, { width: 130, ellipsis: true });

                doc.fillColor('#334155').fontSize(7);
                doc.text(item.po_actual_fmt || item.po_schedule_fmt || '-', 405, y + 6, { width: 60 });
                doc.text(item.approval_actual_fmt || item.approval_planned_fmt || '-', 470, y + 6, { width: 65 });

                if (item.receipt_actual_fmt) {
                    doc.fillColor('#059669').font('Helvetica-Bold').text(item.receipt_actual_fmt, 540, y + 6, { width: 65 });
                } else {
                    doc.fillColor('#64748b').font('Helvetica').text(item.receipt_planned_fmt || '-', 540, y + 6, { width: 65 });
                }

                doc.fillColor('#334155').font('Helvetica').text(item.location || '-', 610, y + 6, { width: 75, ellipsis: true });
                doc.text(item.remarks || item.milestone_stage || 'Complete', 690, y + 6, { width: 120, ellipsis: true });

                y += 22;
            });
        }

        // Signatures
        y += 20;
        if (y > 510) {
            doc.addPage();
            y = 50;
        }

        doc.rect(25, y, 792, 45).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
        doc.text('Prepared By:', 40, y + 8);
        doc.font('Helvetica').fontSize(7.5).text('Sudhir Jadaun (Procurement In-Charge)\nNKD Power Solutions Pvt Ltd', 40, y + 20);

        doc.font('Helvetica-Bold').fontSize(8).text('Site Material Acceptance:', 320, y + 8);
        doc.font('Helvetica').fontSize(7.5).text('Site Store Keeper / QA Engineer\nSite Office', 320, y + 20);

        doc.font('Helvetica-Bold').fontSize(8).text('Project Management Review:', 600, y + 8);
        doc.font('Helvetica').fontSize(7.5).text('Project Director\nNKD Power Solutions Pvt Ltd', 600, y + 20);

        doc.end();
    }
}

module.exports = new ProcurementService();
