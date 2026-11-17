import React, { useState, useEffect, useCallback } from 'react';
import {
    ClipboardList, AlertTriangle, Ruler, Truck, Wrench, Plus,
    Search, Download, Building2, CheckCircle2, Clock, Trash2, Edit2, X,
    Phone, Mail, MapPin, Users, Droplets, Activity, ExternalLink,
    Folder, FolderOpen, Calendar, Image as ImageIcon, FileSpreadsheet,
    ChevronRight, ChevronDown, Sparkles, UploadCloud, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import siteOperationsService from '../services/siteOperationsService';
import dprService from '../services/dprService';
import siteService from '../services/siteService';
import trenchDewateringService from '../services/trenchDewateringService';
import TrenchDewateringRegister from '../components/dpr/TrenchDewateringRegister';
import DprExcelGrid from '../components/dpr/DprExcelGrid';
import DprLiveSheetHub from '../components/dpr/DprLiveSheetHub';
import { useAuth } from '../context/AuthContext';
import { extractApiError, getFileUrl } from '../services/api';
import ModalPortal from '../components/common/ModalPortal';

const getIstToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

const formatIstDate = (d) => {
    if (!d) return '—';
    const s = String(d).trim();
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00+05:30`) : new Date(d);
    if (Number.isNaN(parsed.getTime())) return String(d);
    return parsed.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

const DEFAULT_MANPOWER = [
    { trade: 'Site Manager', required: 1, available: 1 },
    { trade: 'EHS Officer', required: 1, available: 1 },
    { trade: 'Electrician', required: 2, available: 0 },
    { trade: 'Engineer', required: 1, available: 0 },
    { trade: 'Fitter', required: 1, available: 0 },
    { trade: 'Welder', required: 1, available: 0 },
    { trade: 'Helper', required: 7, available: 7 },
    { trade: 'Supervisor', required: 1, available: 0 },
    { trade: 'Testing Engineer', required: 1, available: 0 },
    { trade: 'Cable Jointer', required: 2, available: 0 },
    { trade: 'Scaffolding Team', required: 4, available: 0 }
];

const createEmptyDprForm = () => ({
    site_id: '',
    report_no: '',
    report_date: getIstToday(),
    client_name: '',
    po_number: '',
    po_value: '',
    billing_progress_pct: 0,
    start_date: '',
    completion_date: '',
    today_activities: [{ id: 1, description: '', status: 'complete', dependencies: 'NKD', photo_ref: '' }],
    next_day_activities: [{ id: 1, description: '', dependencies: '' }],
    show_stoppers: [],
    manpower_data: DEFAULT_MANPOWER.map((m) => ({ ...m })),
    photos: [],
    excel_grid: null
});

const createEmptyConcernForm = (siteId = '') => ({
    site_id: siteId,
    concern_title: '',
    concern_area: '',
    category: 'CLIENT_CLEARANCE',
    severity: 'CRITICAL_SHOWSTOPPER',
    first_intimation_date: getIstToday(),
    duration_weeks: 1,
    responsible_party: 'CLIENT',
    impact_summary: '',
    target_resolution_date: '',
    status: 'OPEN',
    resolution_remarks: ''
});

const createEmptyMeasurementForm = (siteId = '') => ({
    site_id: siteId,
    item_no: '',
    description: '',
    location_ref: '',
    nos: 1,
    length: 0,
    breadth: 0,
    depth: 0,
    unit: 'MTR',
    measurement_date: getIstToday(),
    measured_by: 'Site Engineer',
    verified_by: 'Client In-Charge',
    remarks: '',
    status: 'SUBMITTED'
});

const createEmptyToolForm = (siteId = '') => ({
    site_id: siteId,
    tool_name: '',
    category: 'TESTING_EQUIPMENT',
    quantity: 1,
    serial_no: '',
    make_model: '',
    tpi_agency: '',
    certificate_no: '',
    calibration_date: '',
    valid_till: '',
    certificate_url: null,
    remarks: ''
});

const DPRManagementHub = () => {
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('DPR', 'can_create');
    const canUpdate = hasPermission('DPR', 'can_update');
    const canDelete = hasPermission('DPR', 'can_delete');
    const canExport = hasPermission('DPR', 'can_export') || canCreate || canUpdate;
    const canUpdateVendorScope = canUpdate || hasPermission('VENDORS', 'can_update');

    const [activeTab, setActiveTab] = useState('dpr');
    const [dprSubTab, setDprSubTab] = useState('reports');
    const [sites, setSites] = useState([]);
    const [selectedSiteId, setSelectedSiteId] = useState('ALL');
    const [stats, setStats] = useState(null);
    const [trenchCount, setTrenchCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Module 1: DPR State
    const [dprs, setDprs] = useState([]);
    const [selectedDprForView, setSelectedDprForView] = useState(null);
    const [showDprModal, setShowDprModal] = useState(false);
    const [editingDpr, setEditingDpr] = useState(null);
    const [savingDpr, setSavingDpr] = useState(false);
    const [dprForm, setDprForm] = useState(createEmptyDprForm);
    const [archiveData, setArchiveData] = useState([]);
    const [loadingArchive, setLoadingArchive] = useState(false);
    const [expandedSites, setExpandedSites] = useState({});
    const [expandedMonths, setExpandedMonths] = useState({});
    const [uploadingDprPhoto, setUploadingDprPhoto] = useState(false);
    const [showMasterDetails, setShowMasterDetails] = useState(false);

    // Module 2: Concerns State
    const [concerns, setConcerns] = useState([]);
    const [concernSearch, setConcernSearch] = useState('');
    const [concernStatusFilter, setConcernStatusFilter] = useState('ALL');
    const [showConcernModal, setShowConcernModal] = useState(false);
    const [editingConcern, setEditingConcern] = useState(null);
    const [concernForm, setConcernForm] = useState(createEmptyConcernForm);

    // Module 3: Measurements State
    const [measurements, setMeasurements] = useState([]);
    const [measurementSearch, setMeasurementSearch] = useState('');
    const [showMeasurementModal, setShowMeasurementModal] = useState(false);
    const [editingMeasurement, setEditingMeasurement] = useState(null);
    const [measurementForm, setMeasurementForm] = useState(createEmptyMeasurementForm);

    // Module 4: Vendors State
    const [vendors, setVendors] = useState([]);
    const [vendorSearch, setVendorSearch] = useState('');
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [editingVendor, setEditingVendor] = useState(null);
    const [vendorForm, setVendorForm] = useState({
        scope_of_work: '',
        site_id: '',
        contact_person: '',
        phone: '',
        email: '',
        city: '',
        state: ''
    });

    // Module 5: Tools & Tackles State
    const [tools, setTools] = useState([]);
    const [toolSearch, setToolSearch] = useState('');
    const [toolStatusFilter, setToolStatusFilter] = useState('ALL');
    const [showToolModal, setShowToolModal] = useState(false);
    const [editingTool, setEditingTool] = useState(null);
    const [toolForm, setToolForm] = useState(createEmptyToolForm);
    const [certificateFile, setCertificateFile] = useState(null);
    const [uploadingCert, setUploadingCert] = useState(false);

    const resolveDefaultSiteId = useCallback(
        () => (selectedSiteId !== 'ALL' ? String(selectedSiteId) : (sites[0]?.site_id ? String(sites[0].site_id) : '')),
        [selectedSiteId, sites]
    );

    const loadSitesAndStats = useCallback(async () => {
        try {
            const siteParam = selectedSiteId !== 'ALL' ? selectedSiteId : undefined;
            const [sitesRes, statsRes, trenchStatsRes] = await Promise.all([
                siteService.getAllSites().catch(() => ({ data: { data: [] } })),
                siteOperationsService.getStats(selectedSiteId).catch(() => ({ data: { data: null } })),
                trenchDewateringService.getStats(siteParam ? { site_id: siteParam } : {}).catch(() => ({ data: { data: {} } }))
            ]);
            setSites(sitesRes.data?.data || sitesRes.data || []);
            setStats(statsRes.data?.data || statsRes.data || null);
            setTrenchCount(trenchStatsRes.data?.data?.summary?.total_records ?? 0);
        } catch (err) {
            console.error('Failed to load initial site stats:', err);
        }
    }, [selectedSiteId]);

    const loadDprs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await dprService.getAllDprs({ site_id: selectedSiteId });
            const list = res.data?.data || res.data || [];
            setDprs(list);
            setSelectedDprForView((prev) => {
                if (prev && list.some((d) => d.dpr_id === prev.dpr_id)) {
                    return list.find((d) => d.dpr_id === prev.dpr_id) || null;
                }
                return list[0] || null;
            });
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to load DPR records'));
        } finally {
            setLoading(false);
        }
    }, [selectedSiteId]);

    const loadArchive = useCallback(async () => {
        setLoadingArchive(true);
        try {
            const res = await dprService.getSiteWiseArchive(selectedSiteId);
            const data = res.data?.data || res.data || [];
            setArchiveData(data);
            if (Array.isArray(data) && data.length > 0) {
                const initSites = {};
                const initMonths = {};
                data.forEach((s, idx) => {
                    if (idx === 0 || String(s.site_id) === String(selectedSiteId)) {
                        initSites[s.site_id] = true;
                        if (s.months && s.months[0]) {
                            initMonths[`${s.site_id}_${s.months[0].month_key}`] = true;
                        }
                    }
                });
                setExpandedSites((prev) => ({ ...initSites, ...prev }));
                setExpandedMonths((prev) => ({ ...initMonths, ...prev }));
            }
        } catch (err) {
            console.error('Failed to load site archive:', err);
        } finally {
            setLoadingArchive(false);
        }
    }, [selectedSiteId]);

    const loadConcerns = useCallback(async () => {
        setLoading(true);
        try {
            const res = await siteOperationsService.getConcerns({
                site_id: selectedSiteId,
                status: concernStatusFilter,
                search: concernSearch.trim() || undefined
            });
            setConcerns(res.data?.data || res.data || []);
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to load concerns'));
        } finally {
            setLoading(false);
        }
    }, [selectedSiteId, concernStatusFilter, concernSearch]);

    const loadMeasurements = useCallback(async () => {
        setLoading(true);
        try {
            const res = await siteOperationsService.getMeasurements({
                site_id: selectedSiteId,
                search: measurementSearch.trim() || undefined
            });
            setMeasurements(res.data?.data || res.data || []);
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to load measurement records'));
        } finally {
            setLoading(false);
        }
    }, [selectedSiteId, measurementSearch]);

    const loadVendors = useCallback(async () => {
        setLoading(true);
        try {
            const res = await siteOperationsService.getVendors({
                site_id: selectedSiteId,
                search: vendorSearch.trim() || undefined
            });
            setVendors(res.data?.data || res.data || []);
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to load vendor mapping'));
        } finally {
            setLoading(false);
        }
    }, [selectedSiteId, vendorSearch]);

    const loadTools = useCallback(async () => {
        setLoading(true);
        try {
            const res = await siteOperationsService.getTools({
                site_id: selectedSiteId,
                status: toolStatusFilter,
                search: toolSearch.trim() || undefined
            });
            setTools(res.data?.data || res.data || []);
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to load tools & tackles'));
        } finally {
            setLoading(false);
        }
    }, [selectedSiteId, toolStatusFilter, toolSearch]);

    useEffect(() => {
        loadSitesAndStats();
    }, [loadSitesAndStats]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeTab === 'dpr') {
                loadDprs();
                loadArchive();
            }
            else if (activeTab === 'concerns') loadConcerns();
            else if (activeTab === 'measurements') loadMeasurements();
            else if (activeTab === 'vendors') loadVendors();
            else if (activeTab === 'tools') loadTools();
        }, 180);
        return () => clearTimeout(timer);
    }, [activeTab, loadDprs, loadArchive, loadConcerns, loadMeasurements, loadVendors, loadTools]);

    // ===================== MODULE 1: DPR HANDLERS =====================
    const openCreateDpr = async (customSiteId = null, customDate = null) => {
        if (!canCreate) return;
        setEditingDpr(null);
        setShowMasterDetails(false);
        const targetSiteId = customSiteId || (selectedSiteId !== 'ALL' ? selectedSiteId : (sites[0]?.site_id || ''));
        const s = sites.find((x) => String(x.site_id) === String(targetSiteId)) || sites[0];
        let nextForm = createEmptyDprForm();
        if (customDate) nextForm.report_date = customDate;

        if (s) {
            nextForm.site_id = String(s.site_id);
            try {
                const tmplRes = await dprService.getSiteTemplate(s.site_id);
                const tmpl = tmplRes.data?.data || tmplRes.data;
                if (tmpl) {
                    nextForm.client_name = tmpl.client_name || s.principal_employer_name || '';
                    nextForm.po_number = tmpl.po_number || '';
                    nextForm.po_value = tmpl.po_value !== null ? tmpl.po_value : '';
                    nextForm.billing_progress_pct = tmpl.billing_progress_pct !== null ? tmpl.billing_progress_pct : 0;
                    nextForm.start_date = tmpl.start_date ? String(tmpl.start_date).slice(0, 10) : '';
                    nextForm.completion_date = tmpl.completion_date ? String(tmpl.completion_date).slice(0, 10) : '';
                    nextForm.report_no = tmpl.nextReportNo || (s.site_code ? `${s.site_code}/${String(dprs.length + 1).padStart(3, '0')}` : '');
                    if (Array.isArray(tmpl.manpower_data) && tmpl.manpower_data.length > 0) {
                        nextForm.manpower_data = tmpl.manpower_data.map((m) => ({ ...m }));
                    }
                    if (tmpl.excel_grid) {
                        nextForm.excel_grid = tmpl.excel_grid;
                    }
                    if (tmpl.isExistingDprSample) {
                        toast.success('✨ Master details auto-filled from Site DPR template!', { duration: 3500 });
                    }
                }
            } catch (_) {
                nextForm.client_name = s.principal_employer_name || '';
                nextForm.report_no = s.site_code ? `${s.site_code}/${String(dprs.length + 1).padStart(3, '0')}` : '';
            }
        }
        setDprForm(nextForm);
        setShowDprModal(true);
    };

    const handleSiteChangeInModal = async (newSiteId) => {
        const s = sites.find((x) => String(x.site_id) === String(newSiteId));
        if (!newSiteId || !s) {
            setDprForm((prev) => ({ ...prev, site_id: '' }));
            return;
        }
        try {
            const tmplRes = await dprService.getSiteTemplate(newSiteId);
            const tmpl = tmplRes.data?.data || tmplRes.data;
            if (tmpl) {
                setDprForm((prev) => ({
                    ...prev,
                    site_id: String(newSiteId),
                    client_name: tmpl.client_name || s.principal_employer_name || prev.client_name,
                    po_number: tmpl.po_number || prev.po_number,
                    po_value: tmpl.po_value !== null ? tmpl.po_value : prev.po_value,
                    billing_progress_pct: tmpl.billing_progress_pct !== null ? tmpl.billing_progress_pct : prev.billing_progress_pct,
                    start_date: tmpl.start_date ? String(tmpl.start_date).slice(0, 10) : prev.start_date,
                    completion_date: tmpl.completion_date ? String(tmpl.completion_date).slice(0, 10) : prev.completion_date,
                    report_no: !editingDpr ? (tmpl.nextReportNo || `${s.site_code || 'SITE'}/${String(dprs.length + 1).padStart(3, '0')}`) : prev.report_no,
                    manpower_data: Array.isArray(tmpl.manpower_data) && tmpl.manpower_data.length > 0
                        ? tmpl.manpower_data.map((m) => ({ ...m }))
                        : prev.manpower_data
                }));
                if (tmpl.isExistingDprSample) {
                    toast.success('✨ Master details auto-filled from Site DPR template!');
                }
            }
        } catch (_) {
            setDprForm((prev) => ({
                ...prev,
                site_id: String(newSiteId),
                client_name: s.principal_employer_name || prev.client_name,
                report_no: !editingDpr && s.site_code ? `${s.site_code}/${String(dprs.length + 1).padStart(3, '0')}` : prev.report_no
            }));
        }
    };

    const handleDprPhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            setUploadingDprPhoto(true);
            const res = await dprService.uploadPhoto(formData);
            const data = res.data?.data || res.data;
            const nextIdx = (dprForm.photos || []).length + 1;
            const newPhoto = {
                photo_ref: `Photo ${nextIdx}`,
                caption: file.name.replace(/\.[^/.]+$/, ''),
                url: data.url
            };
            setDprForm((prev) => ({
                ...prev,
                photos: [...(prev.photos || []), newPhoto]
            }));
            toast.success(`Photo ${nextIdx} uploaded successfully`);
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to upload photo'));
        } finally {
            setUploadingDprPhoto(false);
            e.target.value = '';
        }
    };

    const handleRemoveDprPhoto = (index) => {
        setDprForm((prev) => {
            const next = (prev.photos || []).filter((_, i) => i !== index);
            return {
                ...prev,
                photos: next.map((p, idx) => ({ ...p, photo_ref: `Photo ${idx + 1}` }))
            };
        });
    };

    const openEditDpr = (dpr, e) => {
        if (e) e.stopPropagation();
        if (!canUpdate || !dpr) return;
        setEditingDpr(dpr);
        setShowMasterDetails(false);
        setDprForm({
            site_id: dpr.site_id ? String(dpr.site_id) : '',
            report_no: dpr.report_no || '',
            report_date: dpr.report_date ? String(dpr.report_date).slice(0, 10) : getIstToday(),
            client_name: dpr.client_name || '',
            po_number: dpr.po_number || '',
            po_value: dpr.po_value ?? '',
            billing_progress_pct: dpr.billing_progress_pct ?? 0,
            start_date: dpr.start_date ? String(dpr.start_date).slice(0, 10) : '',
            completion_date: dpr.completion_date ? String(dpr.completion_date).slice(0, 10) : '',
            today_activities: Array.isArray(dpr.today_activities) && dpr.today_activities.length > 0
                ? dpr.today_activities.map((a, idx) => ({
                    id: a.id ?? idx + 1,
                    description: a.description || '',
                    status: a.status || 'complete',
                    dependencies: a.dependencies || 'NKD',
                    photo_ref: a.photo_ref || ''
                }))
                : [{ id: 1, description: '', status: 'complete', dependencies: 'NKD', photo_ref: '' }],
            next_day_activities: Array.isArray(dpr.next_day_activities) && dpr.next_day_activities.length > 0
                ? dpr.next_day_activities.map((a, idx) => ({
                    id: a.id ?? idx + 1,
                    description: a.description || '',
                    dependencies: a.dependencies || ''
                }))
                : [{ id: 1, description: '', dependencies: '' }],
            show_stoppers: Array.isArray(dpr.show_stoppers)
                ? dpr.show_stoppers.map((st, idx) => ({
                    id: st.id ?? idx + 1,
                    concern_area: st.concern_area || '',
                    intimation_date: st.intimation_date ? String(st.intimation_date).slice(0, 10) : getIstToday()
                }))
                : [],
            manpower_data: Array.isArray(dpr.manpower_data) && dpr.manpower_data.length > 0
                ? dpr.manpower_data.map((m) => ({ ...m }))
                : DEFAULT_MANPOWER.map((m) => ({ ...m })),
            photos: Array.isArray(dpr.photos) && dpr.photos.length > 0
                ? dpr.photos.map((p) => ({ ...p }))
                : [],
            excel_grid: dpr.excel_grid || null
        });
        setShowDprModal(true);
    };

    const handleSaveDpr = async (e) => {
        e.preventDefault();
        if (!dprForm.site_id) {
            toast.error('Please select a project site');
            return;
        }
        setSavingDpr(true);
        try {
            const payload = {
                ...dprForm,
                site_id: parseInt(dprForm.site_id, 10),
                today_activities: dprForm.today_activities.filter((a) => String(a.description || '').trim()),
                next_day_activities: dprForm.next_day_activities.filter((a) => String(a.description || '').trim()),
                show_stoppers: dprForm.show_stoppers.filter((s) => String(s.concern_area || '').trim()),
                photos: (dprForm.photos || []).filter((p) => p.url),
                excel_grid: dprForm.excel_grid || null
            };
            if (editingDpr) {
                await dprService.updateDpr(editingDpr.dpr_id, payload);
                toast.success('DPR Updated Successfully!');
            } else {
                await dprService.createDpr(payload);
                toast.success('DPR Created Successfully!');
            }
            setShowDprModal(false);
            loadDprs();
            loadArchive();
            loadSitesAndStats();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to save DPR'));
        } finally {
            setSavingDpr(false);
        }
    };

    const handleDeleteDpr = async (id, e) => {
        if (e) e.stopPropagation();
        if (!canDelete) return;
        if (!window.confirm('Are you sure you want to delete this DPR report?')) return;
        try {
            await dprService.deleteDpr(id);
            toast.success('DPR deleted');
            if (selectedDprForView?.dpr_id === id) setSelectedDprForView(null);
            loadDprs();
            loadArchive();
            loadSitesAndStats();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to delete DPR'));
        }
    };

    // ===================== MODULE 2: CONCERN HANDLERS =====================
    const openCreateConcern = () => {
        if (!canCreate) return;
        setEditingConcern(null);
        setConcernForm(createEmptyConcernForm(resolveDefaultSiteId()));
        setShowConcernModal(true);
    };

    const openEditConcern = (item) => {
        if (!canUpdate) return;
        setEditingConcern(item);
        setConcernForm({
            site_id: item.site_id ? String(item.site_id) : resolveDefaultSiteId(),
            concern_title: item.concern_title || '',
            concern_area: item.concern_area || '',
            category: item.category || 'CLIENT_CLEARANCE',
            severity: item.severity || 'CRITICAL_SHOWSTOPPER',
            first_intimation_date: item.first_intimation_date ? String(item.first_intimation_date).slice(0, 10) : getIstToday(),
            duration_weeks: item.duration_weeks ?? 1,
            responsible_party: item.responsible_party || 'CLIENT',
            impact_summary: item.impact_summary || '',
            target_resolution_date: item.target_resolution_date ? String(item.target_resolution_date).slice(0, 10) : '',
            status: item.status || 'OPEN',
            resolution_remarks: item.resolution_remarks || ''
        });
        setShowConcernModal(true);
    };

    const handleSaveConcern = async (e) => {
        e.preventDefault();
        if (!concernForm.site_id || !concernForm.concern_title.trim()) {
            toast.error('Site and Concern Title are required');
            return;
        }
        try {
            const payload = { ...concernForm, site_id: parseInt(concernForm.site_id, 10) };
            if (editingConcern) {
                await siteOperationsService.updateConcern(editingConcern.concern_id, payload);
                toast.success('Site Concern Updated!');
            } else {
                await siteOperationsService.createConcern(payload);
                toast.success('Site Concern Reported!');
            }
            setShowConcernModal(false);
            loadConcerns();
            loadSitesAndStats();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to save concern'));
        }
    };

    const handleUpdateConcernStatus = async (concernId, newStatus) => {
        if (!canUpdate) return;
        try {
            await siteOperationsService.updateConcern(concernId, { status: newStatus });
            toast.success(`Concern updated to ${newStatus}`);
            loadConcerns();
            loadSitesAndStats();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to update status'));
        }
    };

    const handleDeleteConcern = async (concernId) => {
        if (!canDelete) return;
        if (!window.confirm('Delete this site concern?')) return;
        try {
            await siteOperationsService.deleteConcern(concernId);
            toast.success('Concern deleted');
            loadConcerns();
            loadSitesAndStats();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to delete concern'));
        }
    };

    // ===================== MODULE 3: MEASUREMENT HANDLERS =====================
    const openCreateMeasurement = () => {
        if (!canCreate) return;
        setEditingMeasurement(null);
        setMeasurementForm(createEmptyMeasurementForm(resolveDefaultSiteId()));
        setShowMeasurementModal(true);
    };

    const openEditMeasurement = (m) => {
        if (!canUpdate) return;
        setEditingMeasurement(m);
        setMeasurementForm({
            site_id: m.site_id ? String(m.site_id) : resolveDefaultSiteId(),
            item_no: m.item_no || '',
            description: m.description || '',
            location_ref: m.location_ref || '',
            nos: m.nos ?? 1,
            length: m.length ?? 0,
            breadth: m.breadth ?? 0,
            depth: m.depth ?? 0,
            unit: m.unit || 'MTR',
            measurement_date: m.measurement_date ? String(m.measurement_date).slice(0, 10) : getIstToday(),
            measured_by: m.measured_by || '',
            verified_by: m.verified_by || '',
            remarks: m.remarks || '',
            status: m.status || 'SUBMITTED'
        });
        setShowMeasurementModal(true);
    };

    const handleSaveMeasurement = async (e) => {
        e.preventDefault();
        if (!measurementForm.site_id || !measurementForm.description.trim()) {
            toast.error('Site and Description are required');
            return;
        }
        try {
            const payload = { ...measurementForm, site_id: parseInt(measurementForm.site_id, 10) };
            if (editingMeasurement) {
                await siteOperationsService.updateMeasurement(editingMeasurement.measurement_id, payload);
                toast.success('Measurement Record Updated!');
            } else {
                await siteOperationsService.createMeasurement(payload);
                toast.success('Measurement Record Added!');
            }
            setShowMeasurementModal(false);
            loadMeasurements();
            loadSitesAndStats();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to save measurement'));
        }
    };

    const handleDeleteMeasurement = async (id) => {
        if (!canDelete) return;
        if (!window.confirm('Delete this M-Book measurement entry?')) return;
        try {
            await siteOperationsService.deleteMeasurement(id);
            toast.success('Measurement deleted');
            loadMeasurements();
            loadSitesAndStats();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to delete measurement'));
        }
    };

    const exportMeasurementsCSV = () => {
        if (!canExport) return;
        if (measurements.length === 0) {
            toast.error('No measurements to export');
            return;
        }
        const headers = ['Item No', 'Site', 'Description', 'Location', 'Nos', 'Length', 'Breadth', 'Depth', 'Total Qty', 'Unit', 'Date', 'Status', 'Measured By', 'Verified By'];
        const rows = measurements.map((m) => [
            `"${(m.item_no || '').replace(/"/g, '""')}"`,
            `"${(m.site_name || '').replace(/"/g, '""')}"`,
            `"${(m.description || '').replace(/"/g, '""')}"`,
            `"${(m.location_ref || '').replace(/"/g, '""')}"`,
            m.nos,
            m.length,
            m.breadth,
            m.depth,
            m.quantity,
            m.unit,
            m.measurement_date_display || formatIstDate(m.measurement_date),
            m.status,
            `"${(m.measured_by || '').replace(/"/g, '""')}"`,
            `"${(m.verified_by || '').replace(/"/g, '""')}"`
        ]);
        const blob = new Blob([[headers.join(','), ...rows.map((r) => r.join(','))].join('\n')], {
            type: 'text/csv;charset=utf-8;'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Measurement_Sheet_${selectedSiteId}_${getIstToday()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Measurement Sheet exported as CSV!');
    };

    // ===================== MODULE 4: VENDOR SCOPE HANDLERS =====================
    const openEditVendor = (v) => {
        if (!canUpdateVendorScope) return;
        setEditingVendor(v);
        setVendorForm({
            scope_of_work: v.scope_of_work || '',
            site_id: v.site_id ? String(v.site_id) : '',
            contact_person: v.contact_person || '',
            phone: v.phone || '',
            email: v.email || '',
            city: v.city || '',
            state: v.state || ''
        });
        setShowVendorModal(true);
    };

    const handleSaveVendorScope = async (e) => {
        e.preventDefault();
        if (!editingVendor) return;
        try {
            await siteOperationsService.updateVendor(editingVendor.vendor_id, {
                ...vendorForm,
                site_id: vendorForm.site_id ? parseInt(vendorForm.site_id, 10) : null
            });
            toast.success('Vendor scope & site mapping updated');
            setShowVendorModal(false);
            loadVendors();
            loadSitesAndStats();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to update vendor scope'));
        }
    };

    // ===================== MODULE 5: TOOL / TPI HANDLERS =====================
    const openCreateTool = () => {
        if (!canCreate) return;
        setEditingTool(null);
        setCertificateFile(null);
        setToolForm(createEmptyToolForm(resolveDefaultSiteId()));
        setShowToolModal(true);
    };

    const openEditTool = (t) => {
        if (!canUpdate) return;
        setEditingTool(t);
        setCertificateFile(null);
        setToolForm({
            site_id: t.site_id ? String(t.site_id) : resolveDefaultSiteId(),
            tool_name: t.tool_name || '',
            category: t.category || 'TESTING_EQUIPMENT',
            quantity: t.quantity ?? 1,
            serial_no: t.serial_no || '',
            make_model: t.make_model || '',
            tpi_agency: t.tpi_agency || '',
            certificate_no: t.certificate_no || '',
            calibration_date: t.calibration_date ? String(t.calibration_date).slice(0, 10) : '',
            valid_till: t.valid_till ? String(t.valid_till).slice(0, 10) : '',
            certificate_url: t.certificate_url || null,
            remarks: t.remarks || ''
        });
        setShowToolModal(true);
    };

    const handleSaveTool = async (e) => {
        e.preventDefault();
        if (!toolForm.tool_name.trim() || !toolForm.valid_till) {
            toast.error('Tool Name and Validity Expiry Date are required');
            return;
        }
        try {
            let certificateUrl = toolForm.certificate_url || null;
            if (certificateFile) {
                setUploadingCert(true);
                const fd = new FormData();
                fd.append('file', certificateFile);
                const uploadRes = await siteOperationsService.uploadCertificate(fd);
                certificateUrl = uploadRes.data?.url || certificateUrl;
            }

            const payload = {
                ...toolForm,
                site_id: toolForm.site_id ? parseInt(toolForm.site_id, 10) : null,
                certificate_url: certificateUrl
            };

            if (editingTool) {
                await siteOperationsService.updateTool(editingTool.tool_id, payload);
                toast.success('Tool & TPI Record Updated!');
            } else {
                await siteOperationsService.createTool(payload);
                toast.success('Tool & Tackle Registered Successfully!');
            }
            setShowToolModal(false);
            setCertificateFile(null);
            loadTools();
            loadSitesAndStats();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to save tool'));
        } finally {
            setUploadingCert(false);
        }
    };

    const handleDeleteTool = async (toolId) => {
        if (!canDelete) return;
        if (!window.confirm('Delete this tool / TPI record?')) return;
        try {
            await siteOperationsService.deleteTool(toolId);
            toast.success('Tool deleted');
            loadTools();
            loadSitesAndStats();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to delete tool'));
        }
    };

    // Computed DPR view manpower totals
    const previewManpower = Array.isArray(selectedDprForView?.manpower_data) ? selectedDprForView.manpower_data : [];
    const previewManpowerAvail = previewManpower.reduce((sum, m) => sum + (parseInt(m.available, 10) || 0), 0);
    const previewManpowerReq = previewManpower.reduce((sum, m) => sum + (parseInt(m.required, 10) || 0), 0);

    // Dimension preview calculation consistent with backend
    const calcMBookPreview = () => {
        const n = parseFloat(measurementForm.nos) || 1;
        const l = parseFloat(measurementForm.length) || 0;
        const b = parseFloat(measurementForm.breadth) || 0;
        const d = parseFloat(measurementForm.depth) || 0;
        if (l > 0 && b > 0 && d > 0) return n * l * b * d;
        if (l > 0 && b > 0) return n * l * b;
        if (l > 0) return n * l;
        return n;
    };

    return (
        <div className="space-y-6 pb-20 sm:pb-12 animate-in fade-in duration-300">
            {/* Header & Site Selector */}
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-primary-950 text-white rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden border border-slate-800/80">
                <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-radial from-primary-500/15 via-emerald-500/10 to-transparent pointer-events-none" />
                <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 relative z-10">
                    <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-bold mb-2 border border-emerald-500/30 backdrop-blur-md">
                            <Activity size={14} className="animate-pulse text-emerald-400" />
                            <span>Power, Solar & Site Operations Intelligence</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex flex-wrap items-center gap-2.5">
                            <span>DPR Management Hub</span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono">
                                <FileSpreadsheet size={13} /> Excel Engine Active
                            </span>
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                            Multi-site Daily Progress Reports, In-App Interactive Excel Spreadsheets, Showstoppers, M-Book Measurements, and Joint Calibration Registers.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        {/* Site Filter Dropdown */}
                        <div className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/90 rounded-xl px-3 py-2 flex items-center gap-2 text-white shadow-sm transition-colors">
                            <Building2 size={16} className="text-emerald-400 shrink-0" />
                            <select
                                value={selectedSiteId}
                                onChange={(e) => setSelectedSiteId(e.target.value)}
                                className="bg-transparent text-white text-xs sm:text-sm font-bold focus:outline-none cursor-pointer pr-2 max-w-[190px] sm:max-w-[240px] truncate"
                                title="Filter by Project Site"
                            >
                                <option value="ALL" className="text-slate-900">All Sites & Projects</option>
                                {sites.map((s) => (
                                    <option key={s.site_id} value={s.site_id} className="text-slate-900">
                                        {s.site_name} {s.site_code ? `(${s.site_code})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Interactive Excel Sheet Button */}
                        <button
                            type="button"
                            onClick={() => setActiveTab('live_sheet')}
                            className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95 cursor-pointer ${
                                activeTab === 'live_sheet'
                                    ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-900'
                                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40'
                            }`}
                            title="Open Fullscreen Interactive Excel Spreadsheet Editor"
                        >
                            <FileSpreadsheet size={16} className="text-emerald-100" />
                            <span>Excel Live Sheet</span>
                        </button>

                        {/* New DPR Button */}
                        {activeTab === 'dpr' && dprSubTab === 'reports' && canCreate && (
                            <button
                                type="button"
                                onClick={openCreateDpr}
                                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer"
                                title="Create new daily progress report with backdate option"
                            >
                                <Plus size={16} />
                                <span>New DPR Report</span>
                            </button>
                        )}
                        {activeTab === 'concerns' && canCreate && (
                            <button
                                type="button"
                                onClick={openCreateConcern}
                                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer"
                            >
                                <Plus size={16} />
                                <span>Report Site Concern</span>
                            </button>
                        )}
                        {activeTab === 'measurements' && (
                            <div className="flex gap-2">
                                {canExport && (
                                    <button
                                        type="button"
                                        onClick={exportMeasurementsCSV}
                                        className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20 transition-all cursor-pointer"
                                        title="Export M-Book as CSV"
                                    >
                                        <Download size={16} />
                                        CSV
                                    </button>
                                )}
                                {canCreate && (
                                    <button
                                        type="button"
                                        onClick={openCreateMeasurement}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer flex-1 sm:flex-none"
                                    >
                                        <Plus size={18} />
                                        Add Measurement
                                    </button>
                                )}
                            </div>
                        )}
                        {activeTab === 'tools' && canCreate && (
                            <button
                                type="button"
                                onClick={openCreateTool}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
                            >
                                <Plus size={18} />
                                Register Tool / TPI
                            </button>
                        )}
                    </div>
                </div>

                {/* KPI Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/10">
                    <div className="bg-white/[0.06] hover:bg-white/[0.1] rounded-2xl p-3.5 border border-white/10 backdrop-blur-md transition-all">
                        <span className="text-[11px] text-slate-300 font-semibold block uppercase tracking-wider">Daily Reports Logged</span>
                        <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xl sm:text-2xl font-black text-white">{stats?.dprs?.total_dprs ?? dprs.length}</span>
                            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                                <ClipboardList size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/[0.06] hover:bg-white/[0.1] rounded-2xl p-3.5 border border-white/10 backdrop-blur-md transition-all">
                        <span className="text-[11px] text-slate-300 font-semibold block uppercase tracking-wider">Open Showstoppers</span>
                        <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xl sm:text-2xl font-black text-rose-300">{stats?.concerns?.open_concerns || 0}</span>
                            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                                <AlertTriangle size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/[0.06] hover:bg-white/[0.1] rounded-2xl p-3.5 border border-white/10 backdrop-blur-md transition-all">
                        <span className="text-[11px] text-slate-300 font-semibold block uppercase tracking-wider">Measured Work (Qty)</span>
                        <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xl sm:text-2xl font-black text-emerald-300">{parseFloat(stats?.measurements?.total_measured_qty || 0).toLocaleString()}</span>
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                <Ruler size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/[0.06] hover:bg-white/[0.1] rounded-2xl p-3.5 border border-white/10 backdrop-blur-md transition-all">
                        <span className="text-[11px] text-slate-300 font-semibold block uppercase tracking-wider">Mapped Suppliers</span>
                        <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xl sm:text-2xl font-black text-white">{stats?.vendors?.total_vendors ?? vendors.length}</span>
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                                <Truck size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/[0.06] hover:bg-white/[0.1] rounded-2xl p-3.5 border border-white/10 backdrop-blur-md col-span-2 sm:col-span-1 transition-all">
                        <span className="text-[11px] text-slate-300 font-semibold block uppercase tracking-wider">Tools & TPI Valid</span>
                        <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xl sm:text-2xl font-black text-indigo-300">
                                {stats?.tools?.valid_tools || 0} <span className="text-xs text-slate-400 font-normal">/ {stats?.tools?.total_tools || 0}</span>
                            </span>
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                                <Wrench size={18} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 6 Primary Modules Tab Navigation */}
            <div className="flex border-b border-slate-200 bg-white rounded-2xl shadow-xs px-2 sm:px-4 overflow-x-auto scrollbar-thin">
                <button
                    type="button"
                    onClick={() => setActiveTab('dpr')}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all shrink-0 ${
                        activeTab === 'dpr' ? 'border-primary-600 text-primary-600 bg-primary-50/40' : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <ClipboardList size={18} />
                    1. DPR Reports
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                        {stats?.dprs?.total_dprs ?? dprs.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('live_sheet')}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all shrink-0 ${
                        activeTab === 'live_sheet' ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <FileSpreadsheet size={18} className="text-emerald-600" />
                    2. Live Excel & Google Sheet
                    <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold uppercase tracking-wide">
                        Live Sheet
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('concerns')}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all shrink-0 ${
                        activeTab === 'concerns' ? 'border-rose-600 text-rose-600 bg-rose-50/40' : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <AlertTriangle size={18} />
                    3. Concerns & Issues
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                        {stats?.concerns?.open_concerns ?? concerns.filter((c) => c.status !== 'RESOLVED').length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('measurements')}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all shrink-0 ${
                        activeTab === 'measurements' ? 'border-emerald-600 text-emerald-600 bg-emerald-50/40' : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Ruler size={18} />
                    4. Measurement Sheet (M-Book)
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                        {stats?.measurements?.total_entries ?? measurements.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('vendors')}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all shrink-0 ${
                        activeTab === 'vendors' ? 'border-amber-600 text-amber-600 bg-amber-50/40' : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Truck size={18} />
                    5. Vendor Mapping
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                        {stats?.vendors?.total_vendors ?? vendors.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('tools')}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all shrink-0 ${
                        activeTab === 'tools' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40' : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Wrench size={18} />
                    6. Tools & TPI
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold">
                        {stats?.tools?.total_tools ?? tools.length}
                    </span>
                </button>
            </div>

            {/* TAB 1: DPR MODULE */}
            {activeTab === 'dpr' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setDprSubTab('reports')}
                            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                                dprSubTab === 'reports' ? 'bg-primary-600 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            Daily Site Progress Reports
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('live_sheet')}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-all cursor-pointer shadow-2xs"
                            title="Switch to In-App Excel Spreadsheet Editor"
                        >
                            <FileSpreadsheet size={16} className="text-emerald-600" />
                            <span>Interactive Excel Editor</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-600 text-white font-black uppercase">Live</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setDprSubTab('archive');
                                loadArchive();
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                                dprSubTab === 'archive' ? 'bg-primary-600 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <Folder size={16} />
                            Site Folders (Backdate Archive)
                        </button>
                        <button
                            type="button"
                            onClick={() => setDprSubTab('trench')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                                dprSubTab === 'trench' ? 'bg-primary-600 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <Droplets size={16} />
                            11kV Trench Dewatering Register ({trenchCount} Records)
                        </button>
                    </div>

                    {/* Interactive Excel Editor Callout Banner */}
                    <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white p-3.5 sm:p-4 rounded-2xl border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                <FileSpreadsheet size={20} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs sm:text-sm font-bold text-white">
                                        Client Feature: Interactive Excel Spreadsheet Editor
                                    </h4>
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 uppercase tracking-wider">
                                        Live
                                    </span>
                                </div>
                                <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
                                    Manage daily activities like Microsoft Excel with inline cell editing, BOQ sums, progress meters, and .xlsx import/export.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveTab('live_sheet')}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all active:scale-95 shadow-sm shrink-0 cursor-pointer"
                        >
                            <FileSpreadsheet size={15} />
                            <span>Open Excel Editor</span>
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    {dprSubTab === 'reports' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left List */}
                            <div className="lg:col-span-1 space-y-3">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-bold text-slate-800 text-sm">Site DPR History</h3>
                                        <span className="text-xs text-slate-400 font-semibold">{dprs.length} reports</span>
                                    </div>
                                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                                        {loading ? (
                                            <p className="text-slate-400 text-xs py-8 text-center">Loading DPR reports...</p>
                                        ) : dprs.length === 0 ? (
                                            <p className="text-slate-400 text-xs py-8 text-center">No DPR records found.</p>
                                        ) : (
                                            dprs.map((item) => {
                                                const itemManpower = item.manpower_total ?? (item.manpower_data || []).reduce((s, m) => s + (parseInt(m.available, 10) || 0), 0);
                                                return (
                                                    <div
                                                        key={item.dpr_id}
                                                        onClick={() => setSelectedDprForView(item)}
                                                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                                                            selectedDprForView?.dpr_id === item.dpr_id
                                                                ? 'border-primary-500 bg-primary-50/50 shadow-xs ring-1 ring-primary-500/20'
                                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="font-bold text-sm text-slate-900 truncate">{item.report_no}</span>
                                                            <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded shrink-0">
                                                                {formatIstDate(item.report_date)}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1 truncate">{item.site_name || item.client_name}</p>
                                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                                                            <span>Billing: {item.billing_progress_pct || 0}%</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-emerald-600 font-medium">Manpower: {itemManpower}</span>
                                                                {canUpdate && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => openEditDpr(item, e)}
                                                                        className="text-slate-400 hover:text-primary-600 p-0.5"
                                                                        title="Edit DPR"
                                                                    >
                                                                        <Edit2 size={12} />
                                                                    </button>
                                                                )}
                                                                {canDelete && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleDeleteDpr(item.dpr_id, e)}
                                                                        className="text-slate-400 hover:text-rose-600 p-0.5"
                                                                        title="Delete DPR"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Preview */}
                            <div className="lg:col-span-2">
                                {selectedDprForView ? (
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-6">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h2 className="text-xl font-bold text-slate-900">{selectedDprForView.report_no}</h2>
                                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                                        {formatIstDate(selectedDprForView.report_date)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    End Client: <strong className="text-slate-800">{selectedDprForView.client_name || 'N/A'}</strong> | Site: <strong className="text-slate-800">{selectedDprForView.site_name || 'N/A'}</strong>
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                                {canUpdate && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditDpr(selectedDprForView)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold"
                                                    >
                                                        <Edit2 size={14} /> Edit
                                                    </button>
                                                )}
                                                {canExport && (
                                                    <>
                                                        <a
                                                            href={dprService.getPdfUrl(selectedDprForView.dpr_id)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
                                                        >
                                                            <Download size={14} /> Download PDF
                                                        </a>
                                                        <button
                                                            type="button"
                                                            onClick={() => dprService.downloadExcel(selectedDprForView.dpr_id, `DPR_${selectedDprForView.report_no || selectedDprForView.dpr_id}.xlsx`)}
                                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                                                        >
                                                            <FileSpreadsheet size={14} /> Download Excel (.xlsx)
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Financial & Contract Snapshot */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                                            <div>
                                                <span className="text-[11px] text-slate-400 font-semibold uppercase">PO Value</span>
                                                <p className="text-sm font-bold text-slate-900 mt-0.5">
                                                    ₹{parseFloat(selectedDprForView.po_value || 0).toLocaleString('en-IN')}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-[11px] text-slate-400 font-semibold uppercase">PO Number</span>
                                                <p className="text-sm font-bold text-slate-900 mt-0.5 font-mono truncate">
                                                    {selectedDprForView.po_number || 'N/A'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-[11px] text-slate-400 font-semibold uppercase">Start Date</span>
                                                <p className="text-sm font-bold text-slate-900 mt-0.5">
                                                    {selectedDprForView.start_date ? formatIstDate(selectedDprForView.start_date) : 'N/A'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-[11px] text-slate-400 font-semibold uppercase">Billing Progress</span>
                                                <p className="text-sm font-bold text-emerald-600 mt-0.5">{selectedDprForView.billing_progress_pct || 0}%</p>
                                            </div>
                                        </div>

                                        {/* Today & Next Day Activities */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="border border-slate-200 rounded-xl p-4">
                                                <h4 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 text-primary-700">
                                                    <CheckCircle2 size={16} /> Today Activity Status
                                                </h4>
                                                <div className="space-y-2">
                                                    {(selectedDprForView.today_activities || []).length === 0 ? (
                                                        <p className="text-xs text-slate-400 italic">No activities recorded.</p>
                                                    ) : (
                                                        (selectedDprForView.today_activities || []).map((act, idx) => (
                                                            <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 text-xs text-slate-800">
                                                                <div className="flex items-center justify-between font-bold mb-1">
                                                                    <span className="text-primary-700">Activity #{idx + 1}</span>
                                                                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase font-semibold">
                                                                        {act.status || 'complete'}
                                                                    </span>
                                                                </div>
                                                                <p>{act.description}</p>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>

                                            <div className="border border-slate-200 rounded-xl p-4">
                                                <h4 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 text-indigo-700">
                                                    <Clock size={16} /> Activity Planned for Next Day
                                                </h4>
                                                <div className="space-y-2">
                                                    {(selectedDprForView.next_day_activities || []).length === 0 ? (
                                                        <p className="text-xs text-slate-400 italic">No next-day activities planned.</p>
                                                    ) : (
                                                        (selectedDprForView.next_day_activities || []).map((act, idx) => (
                                                            <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 text-xs text-slate-800">
                                                                <span className="font-bold text-indigo-700 block mb-1">Planned Task #{idx + 1}</span>
                                                                <p>{act.description}</p>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Live Manpower Breakdown Table */}
                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between items-center">
                                                <span>Daily Manpower Deployment by Trade</span>
                                                <span className="text-emerald-700">
                                                    Total Available: {previewManpowerAvail} / {previewManpowerReq} Req
                                                </span>
                                            </div>
                                            <div className="max-h-56 overflow-y-auto overflow-x-auto">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0">
                                                        <tr>
                                                            <th className="px-3 py-2">Trade / Role</th>
                                                            <th className="px-3 py-2 text-center">Required</th>
                                                            <th className="px-3 py-2 text-center">Available</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {previewManpower.length === 0 ? (
                                                            <tr>
                                                                <td colSpan="3" className="px-3 py-4 text-center text-slate-400">No manpower rows entered.</td>
                                                            </tr>
                                                        ) : (
                                                            previewManpower.map((m, i) => (
                                                                <tr key={i} className="hover:bg-slate-50">
                                                                    <td className="px-3 py-1.5 font-medium text-slate-800">{m.trade}</td>
                                                                    <td className="px-3 py-1.5 text-center text-slate-500">{m.required ?? 0}</td>
                                                                    <td className={`px-3 py-1.5 text-center font-bold ${(m.available || 0) > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                                        {m.available ?? 0}
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        {/* Site Progress Photos & Visual Evidence */}
                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between items-center">
                                                <span className="flex items-center gap-2">
                                                    <ImageIcon size={15} className="text-primary-600" />
                                                    Site Progress Photos & Visual Evidence ({Array.isArray(selectedDprForView.photos) ? selectedDprForView.photos.length : 0})
                                                </span>
                                                <span className="text-[11px] text-slate-500">Auto-embedded in PDF & Excel</span>
                                            </div>
                                            <div className="p-4">
                                                {Array.isArray(selectedDprForView.photos) && selectedDprForView.photos.length > 0 ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {selectedDprForView.photos.map((ph, pIdx) => (
                                                            <div key={pIdx} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden p-2.5 flex flex-col gap-2">
                                                                <div className="relative aspect-video w-full bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                                                                    <img
                                                                        src={getFileUrl(ph.url)}
                                                                        alt={ph.caption || ph.photo_ref || 'Site Progress Photo'}
                                                                        className="w-full h-full object-cover"
                                                                        onError={(e) => {
                                                                            e.currentTarget.style.display = 'none';
                                                                        }}
                                                                    />
                                                                    <span className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                                        {ph.photo_ref || `Photo ${pIdx + 1}`}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs font-semibold text-slate-700 truncate" title={ph.caption}>
                                                                    {ph.caption || 'Site Progress Evidence'}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-400 py-3 text-center">
                                                        No site photos attached. Click "Edit" to upload progress photos with visual evidence.
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Custom Site Excel Sheet / Work Breakdown Table */}
                                        {selectedDprForView.excel_grid && Array.isArray(selectedDprForView.excel_grid.columns) && selectedDprForView.excel_grid.columns.length > 0 && (
                                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between items-center">
                                                    <span className="flex items-center gap-2">
                                                        <FileSpreadsheet size={15} className="text-emerald-600" />
                                                        Custom Site Work Breakdown Table ({selectedDprForView.excel_grid.columns.length} cols × {selectedDprForView.excel_grid.rows?.length || 0} rows)
                                                    </span>
                                                    <span className="text-[11px] text-slate-500">Auto-embedded in Excel & PDF downloads</span>
                                                </div>
                                                <div className="p-3">
                                                    <DprExcelGrid
                                                        value={selectedDprForView.excel_grid}
                                                        readOnly={true}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                                        Select a DPR to inspect full sheet
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : dprSubTab === 'archive' ? (
                        <div className="space-y-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap justify-between items-center gap-3">
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                                        <FolderOpen className="text-primary-600" size={20} />
                                        Site-Wise DPR Folders & Backdate Archive
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Browse past DPR records grouped by Site ➔ Year-Month. Add backdated DPRs with 1-click sample auto-fill.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={loadArchive}
                                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                                    >
                                        Refresh Folders
                                    </button>
                                </div>
                            </div>

                            {loadingArchive ? (
                                <div className="bg-white p-12 text-center text-slate-400 rounded-xl border border-slate-200">
                                    Loading site archive folders...
                                </div>
                            ) : archiveData.length === 0 ? (
                                <div className="bg-white p-12 text-center text-slate-400 rounded-xl border border-slate-200">
                                    No archive folders available. Select a site or create your first DPR.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {archiveData.map((siteItem) => {
                                        const isSiteExpanded = expandedSites[siteItem.site_id];
                                        return (
                                            <div key={siteItem.site_id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                                                {/* Site Folder Header */}
                                                <div
                                                    onClick={() => setExpandedSites((prev) => ({ ...prev, [siteItem.site_id]: !isSiteExpanded }))}
                                                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/80 border-b border-slate-100 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                                                            {isSiteExpanded ? <FolderOpen size={20} /> : <Folder size={20} />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-slate-900 text-sm sm:text-base">{siteItem.site_name}</h4>
                                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                                                                    {siteItem.site_code}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-400 mt-0.5">
                                                                {siteItem.total_dprs} DPR Reports • Latest: {formatIstDate(siteItem.latest_report_date)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {canCreate && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openCreateDpr(siteItem.site_id);
                                                                }}
                                                                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                                                            >
                                                                <Plus size={14} /> Add DPR for Site
                                                            </button>
                                                        )}
                                                        {isSiteExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                                                    </div>
                                                </div>

                                                {/* Site Month Folders */}
                                                {isSiteExpanded && (
                                                    <div className="p-4 bg-slate-50/50 space-y-3">
                                                        {(!siteItem.months || siteItem.months.length === 0) ? (
                                                            <p className="text-xs text-slate-400 py-3 text-center">No reports in this folder.</p>
                                                        ) : (
                                                            siteItem.months.map((month) => {
                                                                const mKey = `${siteItem.site_id}_${month.month_key}`;
                                                                const isMonthExpanded = expandedMonths[mKey];
                                                                return (
                                                                    <div key={mKey} className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
                                                                        <div
                                                                            onClick={() => setExpandedMonths((prev) => ({ ...prev, [mKey]: !isMonthExpanded }))}
                                                                            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                                                                        >
                                                                            <div className="flex items-center gap-2.5">
                                                                                <Calendar size={16} className="text-slate-500" />
                                                                                <span className="font-bold text-xs sm:text-sm text-slate-800">{month.month_label}</span>
                                                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                                                                                    {month.total_reports} {month.total_reports === 1 ? 'Report' : 'Reports'}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                {isMonthExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                                                                            </div>
                                                                        </div>

                                                                        {/* Report List Inside Month */}
                                                                        {isMonthExpanded && (
                                                                            <div className="divide-y divide-slate-100 border-t border-slate-100">
                                                                                {month.reports.map((rep) => (
                                                                                    <div
                                                                                        key={rep.dpr_id}
                                                                                        className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                                                                                    >
                                                                                        <div className="space-y-1">
                                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                                <span className="font-mono font-bold text-xs text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                                                                                                    {rep.report_no || `DPR #${rep.dpr_id}`}
                                                                                                </span>
                                                                                                <span className="text-xs font-semibold text-slate-700">
                                                                                                    {formatIstDate(rep.report_date)}
                                                                                                </span>
                                                                                                {rep.has_photos && (
                                                                                                    <span className="inline-flex items-center gap-1 text-[10px] bg-sky-50 text-sky-700 font-semibold px-2 py-0.5 rounded-full">
                                                                                                        <ImageIcon size={10} /> {rep.photo_count} photos
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                            <p className="text-xs text-slate-500">
                                                                                                Client: <span className="font-medium text-slate-700">{rep.client_name || 'N/A'}</span> • {rep.activities_count} activities • {rep.manpower_available} manpower
                                                                                            </p>
                                                                                        </div>

                                                                                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={async () => {
                                                                                                    const full = await dprService.getDprById(rep.dpr_id);
                                                                                                    const dprData = full.data?.data || full.data;
                                                                                                    setSelectedDprForView(dprData);
                                                                                                    setDprSubTab('reports');
                                                                                                }}
                                                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                                                                                                title="View DPR"
                                                                                            >
                                                                                                <Eye size={13} /> View
                                                                                            </button>
                                                                                            {canExport && (
                                                                                                <>
                                                                                                    <a
                                                                                                        href={dprService.getPdfUrl(rep.dpr_id)}
                                                                                                        target="_blank"
                                                                                                        rel="noreferrer"
                                                                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs"
                                                                                                        title="Download PDF"
                                                                                                    >
                                                                                                        <Download size={13} /> PDF
                                                                                                    </a>
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={() => dprService.downloadExcel(rep.dpr_id, `DPR_${rep.report_no || rep.dpr_id}.xlsx`)}
                                                                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-2xs cursor-pointer"
                                                                                                        title="Download Excel"
                                                                                                    >
                                                                                                        <FileSpreadsheet size={13} /> Excel
                                                                                                    </button>
                                                                                                </>
                                                                                            )}
                                                                                            {canUpdate && (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={async () => {
                                                                                                        const full = await dprService.getDprById(rep.dpr_id);
                                                                                                        const dprData = full.data?.data || full.data;
                                                                                                        openEditDpr(dprData);
                                                                                                    }}
                                                                                                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                                                                                                    title="Edit DPR"
                                                                                                >
                                                                                                    <Edit2 size={13} />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <TrenchDewateringRegister selectedSiteId={selectedSiteId} sites={sites} />
                    )}
                </div>
            )}

            {/* TAB 2: LIVE EXCEL & GOOGLE SHEET SPREADSHEET HUB */}
            {activeTab === 'live_sheet' && (
                <DprLiveSheetHub
                    sites={sites}
                    selectedSiteId={selectedSiteId}
                    onSiteChange={(newSiteId) => setSelectedSiteId(newSiteId)}
                />
            )}

            {/* TAB 3: CONCERNS & ISSUE REPORTING */}
            {activeTab === 'concerns' && (
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search concerns by area, title or responsible party..."
                                value={concernSearch}
                                onChange={(e) => setConcernSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-rose-500 focus:outline-none"
                            />
                        </div>
                        <select
                            value={concernStatusFilter}
                            onChange={(e) => setConcernStatusFilter(e.target.value)}
                            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-rose-500 focus:outline-none cursor-pointer"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="OPEN">Open (Active)</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="RESOLVED">Resolved</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {concerns.length === 0 ? (
                            <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
                                No concerns reported for this filter.
                            </div>
                        ) : (
                            concerns.map((item) => (
                                <div key={item.concern_id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                    item.severity === 'CRITICAL_SHOWSTOPPER' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {item.severity?.replace(/_/g, ' ')}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium">Since {item.duration_weeks || 1} wk(s)</span>
                                            </div>
                                            <h3 className="font-bold text-slate-900 text-base mt-1.5 leading-snug">{item.concern_title}</h3>
                                        </div>

                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase shrink-0 ${
                                            item.status === 'OPEN' ? 'bg-rose-100 text-rose-800' :
                                            item.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">Concern Area:</span>
                                            <span className="font-semibold text-slate-800">{item.concern_area || 'Site Wide'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">1st Intimation Date:</span>
                                            <span className="font-semibold text-slate-800">{formatIstDate(item.first_intimation_date)}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">Responsible Party:</span>
                                            <span className="font-bold text-primary-700">{item.responsible_party}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">Category:</span>
                                            <span className="font-medium text-slate-700">{item.category?.replace(/_/g, ' ')}</span>
                                        </div>
                                    </div>

                                    {item.impact_summary && (
                                        <p className="text-xs text-slate-600 bg-rose-50/50 p-2.5 rounded-lg border border-rose-100">
                                            <strong>Impact:</strong> {item.impact_summary}
                                        </p>
                                    )}

                                    {(canUpdate || canDelete) && (
                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                                            <div className="flex items-center gap-2">
                                                {canUpdate && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditConcern(item)}
                                                        className="px-2 py-1 rounded text-slate-600 hover:bg-slate-100 font-semibold flex items-center gap-1"
                                                    >
                                                        <Edit2 size={12} /> Edit
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteConcern(item.concern_id)}
                                                        className="px-2 py-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 font-semibold flex items-center gap-1"
                                                    >
                                                        <Trash2 size={12} /> Delete
                                                    </button>
                                                )}
                                            </div>
                                            {canUpdate && (
                                                <div className="flex gap-1.5">
                                                    {item.status !== 'IN_PROGRESS' && item.status !== 'RESOLVED' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateConcernStatus(item.concern_id, 'IN_PROGRESS')}
                                                            className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold transition-colors"
                                                        >
                                                            Mark In-Progress
                                                        </button>
                                                    )}
                                                    {item.status !== 'RESOLVED' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateConcernStatus(item.concern_id, 'RESOLVED')}
                                                            className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold transition-colors"
                                                        >
                                                            Mark Resolved
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: MEASUREMENT SHEET (M-BOOK) */}
            {activeTab === 'measurements' && (
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by item no, work description, or location..."
                                value={measurementSearch}
                                onChange={(e) => setMeasurementSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                            />
                        </div>
                        <div className="text-xs font-semibold text-slate-500 shrink-0">
                            Showing <strong className="text-slate-900">{measurements.length}</strong> items
                        </div>
                    </div>

                    {/* Mobile Cards (< md) */}
                    <div className="block md:hidden space-y-3">
                        {measurements.length === 0 ? (
                            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
                                No measurement records entered.
                            </div>
                        ) : (
                            measurements.map((m) => (
                                <div key={m.measurement_id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                                Item {m.item_no || '—'}
                                            </span>
                                            <h4 className="font-bold text-slate-900 text-sm mt-1">{m.description}</h4>
                                            {m.location_ref && <p className="text-xs text-slate-500 mt-0.5">{m.location_ref}</p>}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                                            m.status === 'CERTIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                                        }`}>
                                            {m.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg text-xs">
                                        <span className="text-slate-500">{m.measurement_date_display || formatIstDate(m.measurement_date)}</span>
                                        <span className="font-mono font-black text-emerald-700 text-sm">
                                            {parseFloat(m.quantity || 0).toLocaleString()} {m.unit}
                                        </span>
                                    </div>
                                    {(canUpdate || canDelete) && (
                                        <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                                            {canUpdate && (
                                                <button type="button" onClick={() => openEditMeasurement(m)} className="text-xs font-semibold text-slate-600 hover:text-primary-600 flex items-center gap-1 p-1">
                                                    <Edit2 size={13} /> Edit
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button type="button" onClick={() => handleDeleteMeasurement(m.measurement_id)} className="text-xs font-semibold text-slate-400 hover:text-rose-600 flex items-center gap-1 p-1">
                                                    <Trash2 size={13} /> Delete
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop M-Book Table (>= md) */}
                    <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="px-3.5 py-3">Item #</th>
                                        <th className="px-4 py-3 min-w-[220px]">Description of Work</th>
                                        <th className="px-3.5 py-3 min-w-[150px]">Location Reference</th>
                                        <th className="px-2.5 py-3 text-center">Nos</th>
                                        <th className="px-2.5 py-3 text-right">L (m)</th>
                                        <th className="px-2.5 py-3 text-right">B (m)</th>
                                        <th className="px-2.5 py-3 text-right">D (m)</th>
                                        <th className="px-3.5 py-3 text-right font-black text-emerald-800">Total Qty</th>
                                        <th className="px-2.5 py-3 text-center">Unit</th>
                                        <th className="px-3 py-3">Date</th>
                                        <th className="px-3 py-3 text-center">Status</th>
                                        {(canUpdate || canDelete) && <th className="px-3 py-3 text-right">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {measurements.length === 0 ? (
                                        <tr>
                                            <td colSpan={canUpdate || canDelete ? 12 : 11} className="px-4 py-12 text-center text-slate-400">
                                                No measurement records entered.
                                            </td>
                                        </tr>
                                    ) : (
                                        measurements.map((m) => (
                                            <tr key={m.measurement_id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-3.5 py-3 font-mono font-bold text-slate-900">{m.item_no || '-'}</td>
                                                <td className="px-4 py-3 font-semibold text-slate-800">
                                                    {m.description}
                                                    {m.remarks && <span className="block text-[11px] text-slate-400 font-normal mt-0.5">{m.remarks}</span>}
                                                </td>
                                                <td className="px-3.5 py-3 text-slate-600">{m.location_ref || '-'}</td>
                                                <td className="px-2.5 py-3 text-center font-mono">{m.nos || 1}</td>
                                                <td className="px-2.5 py-3 text-right font-mono text-slate-600">{m.length > 0 ? parseFloat(m.length).toFixed(2) : '-'}</td>
                                                <td className="px-2.5 py-3 text-right font-mono text-slate-600">{m.breadth > 0 ? parseFloat(m.breadth).toFixed(2) : '-'}</td>
                                                <td className="px-2.5 py-3 text-right font-mono text-slate-600">{m.depth > 0 ? parseFloat(m.depth).toFixed(2) : '-'}</td>
                                                <td className="px-3.5 py-3 text-right font-mono font-black text-emerald-700 text-sm">
                                                    {parseFloat(m.quantity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-2.5 py-3 text-center font-bold text-slate-500">{m.unit}</td>
                                                <td className="px-3 py-3 whitespace-nowrap text-slate-600">{m.measurement_date_display || formatIstDate(m.measurement_date)}</td>
                                                <td className="px-3 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                        m.status === 'CERTIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                                                    }`}>
                                                        {m.status}
                                                    </span>
                                                </td>
                                                {(canUpdate || canDelete) && (
                                                    <td className="px-3 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {canUpdate && (
                                                                <button type="button" onClick={() => openEditMeasurement(m)} className="p-1.5 text-slate-500 hover:text-primary-600 rounded-lg" title="Edit">
                                                                    <Edit2 size={14} />
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button type="button" onClick={() => handleDeleteMeasurement(m.measurement_id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg" title="Delete">
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: VENDOR MAPPING & SCOPE */}
            {activeTab === 'vendors' && (
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search vendor by name, contact person, scope of work or city..."
                                value={vendorSearch}
                                onChange={(e) => setVendorSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {vendors.length === 0 ? (
                            <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
                                No vendors mapped for the current search or site filter.
                            </div>
                        ) : (
                            vendors.map((v) => (
                                <div key={v.vendor_id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                                    <div>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">{v.vendor_code}</span>
                                                <h3 className="font-bold text-slate-900 text-base mt-0.5 truncate">{v.vendor_name}</h3>
                                            </div>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase shrink-0">
                                                {v.category?.replace(/_/g, ' ')}
                                            </span>
                                        </div>

                                        <div className="mt-3 bg-amber-50/50 p-3 rounded-lg border border-amber-200/60 text-xs">
                                            <strong className="text-amber-900 block mb-1">Scope of Supply / Services:</strong>
                                            <p className="text-slate-700 leading-relaxed">{v.scope_of_work || 'Material and Equipment Supplier for Project'}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Users size={14} className="text-slate-400 shrink-0" />
                                            <span>Contact Person: <strong className="text-slate-800">{v.contact_person || '—'}</strong></span>
                                        </div>

                                        {v.phone && (
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <Phone size={14} className="text-emerald-500 shrink-0" />
                                                <a href={`tel:${v.phone}`} className="hover:text-primary-600 font-mono font-semibold">{v.phone}</a>
                                            </div>
                                        )}

                                        {v.email && (
                                            <div className="flex items-center gap-2 text-slate-600 truncate">
                                                <Mail size={14} className="text-sky-500 shrink-0" />
                                                <a href={`mailto:${v.email}`} className="hover:text-primary-600 truncate">{v.email}</a>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-2 text-slate-500">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <MapPin size={14} className="text-rose-400 shrink-0" />
                                                <span className="truncate">{[v.city, v.state].filter(Boolean).join(', ') || '—'}</span>
                                            </div>
                                            {canUpdateVendorScope && (
                                                <button
                                                    type="button"
                                                    onClick={() => openEditVendor(v)}
                                                    className="px-2 py-1 rounded text-primary-600 hover:bg-primary-50 font-semibold flex items-center gap-1 shrink-0"
                                                >
                                                    <Edit2 size={12} /> Edit Scope
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB 5: INVENTORY & TOOLS & TACKLES (TPI) */}
            {activeTab === 'tools' && (
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search tools by name, TPI agency, certificate no..."
                                value={toolSearch}
                                onChange={(e) => setToolSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                            />
                        </div>
                        <select
                            value={toolStatusFilter}
                            onChange={(e) => setToolStatusFilter(e.target.value)}
                            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none cursor-pointer"
                        >
                            <option value="ALL">All Calibration Status</option>
                            <option value="VALID">Valid (Audited)</option>
                            <option value="EXPIRING_SOON">Expiring Soon (30 Days)</option>
                            <option value="EXPIRED">Expired (Re-test Required)</option>
                        </select>
                    </div>

                    {/* Mobile Cards (< md) */}
                    <div className="block md:hidden space-y-3">
                        {tools.length === 0 ? (
                            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
                                No tools registered.
                            </div>
                        ) : (
                            tools.map((t) => (
                                <div key={t.tool_id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-slate-900 text-sm">{t.tool_name}</h4>
                                            <p className="text-[11px] text-slate-500">{t.make_model || t.category?.replace(/_/g, ' ')} • Qty {t.quantity}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                                            t.computed_status === 'VALID' ? 'bg-emerald-100 text-emerald-800' :
                                            t.computed_status === 'EXPIRING_SOON' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                            {t.computed_status?.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg text-xs">
                                        <div>
                                            <span className="text-[10px] text-slate-400 block">TPI Agency</span>
                                            <span className="font-semibold text-slate-800">{t.tpi_agency || '—'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 block">Valid Till</span>
                                            <span className="font-bold text-slate-900">{t.valid_till_display || formatIstDate(t.valid_till)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                                        {t.certificate_url ? (
                                            <a
                                                href={getFileUrl(t.certificate_url)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-primary-600 font-semibold"
                                            >
                                                <ExternalLink size={13} /> View Certificate
                                            </a>
                                        ) : (
                                            <span className="text-slate-400 text-[11px]">No certificate</span>
                                        )}
                                        {(canUpdate || canDelete) && (
                                            <div className="flex items-center gap-2">
                                                {canUpdate && (
                                                    <button type="button" onClick={() => openEditTool(t)} className="text-slate-600 hover:text-primary-600 flex items-center gap-1 p-1 font-semibold">
                                                        <Edit2 size={13} /> Edit
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button type="button" onClick={() => handleDeleteTool(t.tool_id)} className="text-slate-400 hover:text-rose-600 flex items-center gap-1 p-1 font-semibold">
                                                        <Trash2 size={13} /> Delete
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop Tools Table (>= md) */}
                    <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3">Tool / Tackle Name</th>
                                        <th className="px-3 py-3">Category</th>
                                        <th className="px-2 py-3 text-center">Qty</th>
                                        <th className="px-3 py-3">Make / Model</th>
                                        <th className="px-3.5 py-3">TPI / Calibration Agency</th>
                                        <th className="px-3 py-3">Certificate #</th>
                                        <th className="px-3 py-3">Calibration Date</th>
                                        <th className="px-3.5 py-3">Valid Till</th>
                                        <th className="px-3 py-3 text-center">Audit Status</th>
                                        <th className="px-3 py-3 text-center">Certificate</th>
                                        {(canUpdate || canDelete) && <th className="px-3 py-3 text-right">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {tools.length === 0 ? (
                                        <tr>
                                            <td colSpan={canUpdate || canDelete ? 11 : 10} className="px-4 py-12 text-center text-slate-400">
                                                No tools registered.
                                            </td>
                                        </tr>
                                    ) : (
                                        tools.map((t) => (
                                            <tr key={t.tool_id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 font-bold text-slate-900">
                                                    {t.tool_name}
                                                    {t.serial_no && <span className="block text-[10px] font-mono text-slate-400 font-normal">S/N: {t.serial_no}</span>}
                                                </td>
                                                <td className="px-3 py-3 text-slate-600 font-medium">{t.category?.replace(/_/g, ' ')}</td>
                                                <td className="px-2 py-3 text-center font-bold text-slate-800">{t.quantity}</td>
                                                <td className="px-3 py-3 text-slate-600">{t.make_model || '-'}</td>
                                                <td className="px-3.5 py-3 font-semibold text-slate-800">{t.tpi_agency || '-'}</td>
                                                <td className="px-3 py-3 font-mono text-slate-600">{t.certificate_no || '-'}</td>
                                                <td className="px-3 py-3 text-slate-500">{t.calibration_date_display || formatIstDate(t.calibration_date)}</td>
                                                <td className="px-3.5 py-3 font-semibold">
                                                    <span className={t.computed_status === 'EXPIRED' ? 'text-red-600' : (t.computed_status === 'EXPIRING_SOON' ? 'text-amber-600' : 'text-slate-800')}>
                                                        {t.valid_till_display || formatIstDate(t.valid_till)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                        t.computed_status === 'VALID' ? 'bg-emerald-100 text-emerald-800' :
                                                        t.computed_status === 'EXPIRING_SOON' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {t.computed_status?.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    {t.certificate_url ? (
                                                        <a
                                                            href={getFileUrl(t.certificate_url)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 font-semibold"
                                                        >
                                                            <ExternalLink size={14} /> View
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-300 text-[10px]">No doc</span>
                                                    )}
                                                </td>
                                                {(canUpdate || canDelete) && (
                                                    <td className="px-3 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {canUpdate && (
                                                                <button type="button" onClick={() => openEditTool(t)} className="p-1.5 text-slate-500 hover:text-primary-600 rounded-lg" title="Edit">
                                                                    <Edit2 size={14} />
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button type="button" onClick={() => handleDeleteTool(t.tool_id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg" title="Delete">
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 1: CREATE / EDIT DPR */}
            {showDprModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                            <div className="flex justify-between items-center border-b border-slate-100 px-6 py-4 shrink-0">
                                <h3 className="font-bold text-lg text-slate-900">
                                    {editingDpr ? `Edit DPR (${editingDpr.report_no})` : 'Prepare Daily Progress Report (DPR)'}
                                </h3>
                                <button type="button" onClick={() => setShowDprModal(false)} className="text-slate-400 hover:text-slate-700">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveDpr} className="flex-1 overflow-y-auto p-6 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Select Site / Project *</label>
                                        <select
                                            value={dprForm.site_id}
                                            onChange={(e) => handleSiteChangeInModal(e.target.value)}
                                            required
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white"
                                        >
                                            <option value="">Choose Site...</option>
                                            {sites.map((s) => (
                                                <option key={s.site_id} value={s.site_id}>{s.site_name} {s.site_code ? `(${s.site_code})` : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Report Number *</label>
                                        <input
                                            type="text"
                                            value={dprForm.report_no}
                                            onChange={(e) => setDprForm((prev) => ({ ...prev, report_no: e.target.value }))}
                                            placeholder="Auto-incremented or custom ref"
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-primary-700 bg-slate-50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Report Date (Backdated Allowed) *</label>
                                        <input
                                            type="date"
                                            value={dprForm.report_date}
                                            onChange={(e) => setDprForm((prev) => ({ ...prev, report_date: e.target.value }))}
                                            required
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                        />
                                    </div>
                                </div>

                                {/* Collapsible Site Master Profile Accordion */}
                                <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                                    <div
                                        onClick={() => setShowMasterDetails((p) => !p)}
                                        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-slate-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Sparkles size={16} className="text-amber-500" />
                                            <span className="text-xs font-bold text-slate-800">
                                                Site Master Details (Auto-filled from previous DPR / Site setup)
                                            </span>
                                            {dprForm.client_name && (
                                                <span className="text-[11px] font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                                                    Client: {dprForm.client_name}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs font-semibold text-primary-600">
                                            {showMasterDetails ? 'Hide Master Details' : 'View / Edit Master Details'}
                                        </span>
                                    </div>

                                    {showMasterDetails && (
                                        <div className="p-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white">
                                            <div>
                                                <label className="text-xs font-semibold text-slate-700 block mb-1">Client Name</label>
                                                <input
                                                    type="text"
                                                    value={dprForm.client_name}
                                                    onChange={(e) => setDprForm((prev) => ({ ...prev, client_name: e.target.value }))}
                                                    placeholder="e.g. GTPL LUMINA"
                                                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-700 block mb-1">PO Number</label>
                                                <input
                                                    type="text"
                                                    value={dprForm.po_number}
                                                    onChange={(e) => setDprForm((prev) => ({ ...prev, po_number: e.target.value }))}
                                                    placeholder="e.g. GTPL/PO/2026/04"
                                                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-700 block mb-1">PO Value (INR) & Billing %</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        type="number"
                                                        placeholder="PO Value ₹"
                                                        value={dprForm.po_value}
                                                        onChange={(e) => setDprForm((prev) => ({ ...prev, po_value: e.target.value }))}
                                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                                    />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.01"
                                                        placeholder="Progress %"
                                                        value={dprForm.billing_progress_pct}
                                                        onChange={(e) => setDprForm((prev) => ({ ...prev, billing_progress_pct: e.target.value }))}
                                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-700 block mb-1">Contract Start & Completion</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        type="date"
                                                        value={dprForm.start_date}
                                                        onChange={(e) => setDprForm((prev) => ({ ...prev, start_date: e.target.value }))}
                                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                                        title="Start Date"
                                                    />
                                                    <input
                                                        type="date"
                                                        value={dprForm.completion_date}
                                                        onChange={(e) => setDprForm((prev) => ({ ...prev, completion_date: e.target.value }))}
                                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                                        title="Completion Date"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Multi-row Today Activities */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-700">Today's Work Activities (Status & Evidence Reference)</label>
                                        <button
                                            type="button"
                                            onClick={() => setDprForm((p) => ({
                                                ...p,
                                                today_activities: [...p.today_activities, { id: p.today_activities.length + 1, description: '', status: 'complete', dependencies: 'NKD', photo_ref: '' }]
                                            }))}
                                            className="text-xs font-bold text-primary-600 hover:text-primary-700 cursor-pointer"
                                        >
                                            + Add Activity
                                        </button>
                                    </div>
                                    {dprForm.today_activities.map((act, idx) => (
                                        <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                                            <input
                                                type="text"
                                                placeholder="Describe progress activity..."
                                                value={act.description}
                                                onChange={(e) => {
                                                    const next = [...dprForm.today_activities];
                                                    next[idx] = { ...next[idx], description: e.target.value };
                                                    setDprForm((p) => ({ ...p, today_activities: next }));
                                                }}
                                                className="flex-1 text-sm border border-slate-300 rounded-xl px-3 py-2 w-full"
                                            />
                                            <div className="flex gap-2 w-full sm:w-auto">
                                                <select
                                                    value={act.status}
                                                    onChange={(e) => {
                                                        const next = [...dprForm.today_activities];
                                                        next[idx] = { ...next[idx], status: e.target.value };
                                                        setDprForm((p) => ({ ...p, today_activities: next }));
                                                    }}
                                                    className="text-xs border border-slate-300 rounded-xl px-2.5 py-2 w-28 bg-white"
                                                >
                                                    <option value="complete">Complete</option>
                                                    <option value="in_progress">In Progress</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    placeholder="Photo Ref (e.g. Photo 1)"
                                                    value={act.photo_ref || ''}
                                                    onChange={(e) => {
                                                        const next = [...dprForm.today_activities];
                                                        next[idx] = { ...next[idx], photo_ref: e.target.value };
                                                        setDprForm((p) => ({ ...p, today_activities: next }));
                                                    }}
                                                    className="text-xs border border-slate-300 rounded-xl px-2 py-2 w-28 font-mono"
                                                />
                                                {dprForm.today_activities.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDprForm((p) => ({ ...p, today_activities: p.today_activities.filter((_, i) => i !== idx) }))}
                                                        className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Next Day Planning */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-700">Planned Activities for Next Day</label>
                                        <button
                                            type="button"
                                            onClick={() => setDprForm((p) => ({
                                                ...p,
                                                next_day_activities: [...p.next_day_activities, { id: p.next_day_activities.length + 1, description: '', dependencies: '' }]
                                            }))}
                                            className="text-xs font-bold text-primary-600 hover:text-primary-700 cursor-pointer"
                                        >
                                            + Add Task
                                        </button>
                                    </div>
                                    {dprForm.next_day_activities.map((act, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Next day planned task..."
                                                value={act.description}
                                                onChange={(e) => {
                                                    const next = [...dprForm.next_day_activities];
                                                    next[idx] = { ...next[idx], description: e.target.value };
                                                    setDprForm((p) => ({ ...p, next_day_activities: next }));
                                                }}
                                                className="flex-1 text-sm border border-slate-300 rounded-xl px-3 py-2"
                                            />
                                            {dprForm.next_day_activities.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setDprForm((p) => ({ ...p, next_day_activities: p.next_day_activities.filter((_, i) => i !== idx) }))}
                                                    className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Manpower Trade Grid */}
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-2">Manpower Deployment (Available On Site)</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {dprForm.manpower_data.map((mp, idx) => (
                                            <div key={idx} className="p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                                                <span className="font-semibold text-slate-700 block truncate mb-1">{mp.trade}</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={mp.available ?? 0}
                                                    onChange={(e) => {
                                                        const next = dprForm.manpower_data.map((row, i) =>
                                                            i === idx ? { ...row, available: parseInt(e.target.value, 10) || 0 } : row
                                                        );
                                                        setDprForm((p) => ({ ...p, manpower_data: next }));
                                                    }}
                                                    className="w-full text-xs font-bold text-center border border-slate-300 rounded px-2 py-1 bg-white"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Dynamic Interactive Excel Spreadsheet */}
                                <div className="space-y-3 pt-3 border-t border-slate-200">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                                <FileSpreadsheet size={16} className="text-emerald-600" />
                                                Interactive Site Spreadsheet / Excel Sheet (Dynamic Rows & Columns)
                                            </label>
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                Add custom columns, add rows, or import an Excel file (.xlsx). Automatically included in Excel & PDF downloads.
                                            </p>
                                        </div>
                                    </div>
                                    <DprExcelGrid
                                        value={dprForm.excel_grid}
                                        onChange={(newGrid) => setDprForm((p) => ({ ...p, excel_grid: newGrid }))}
                                        readOnly={false}
                                    />
                                </div>

                                {/* Site Progress Photos & Visual Evidence Upload */}
                                <div className="space-y-3 pt-2 border-t border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <ImageIcon size={15} className="text-primary-600" />
                                                Site Progress Photos & Visual Evidence ({dprForm.photos?.length || 0})
                                            </label>
                                            <span className="text-[11px] text-slate-400">Photos will be embedded in both PDF and Excel reports</span>
                                        </div>
                                        <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs cursor-pointer ${uploadingDprPhoto ? 'opacity-50 pointer-events-none' : ''}`}>
                                            <UploadCloud size={14} />
                                            {uploadingDprPhoto ? 'Uploading...' : 'Upload Site Photo'}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleDprPhotoUpload}
                                                className="hidden"
                                                disabled={uploadingDprPhoto}
                                            />
                                        </label>
                                    </div>

                                    {Array.isArray(dprForm.photos) && dprForm.photos.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {dprForm.photos.map((p, pIdx) => (
                                                <div key={pIdx} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex gap-3 items-center">
                                                    <div className="relative w-20 h-16 bg-slate-900 rounded-lg overflow-hidden shrink-0">
                                                        <img
                                                            src={getFileUrl(p.url)}
                                                            alt={p.caption || 'Site Photo'}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                        <span className="absolute bottom-1 left-1 bg-slate-900/90 text-white text-[9px] font-bold px-1 rounded">
                                                            {p.photo_ref || `Photo ${pIdx + 1}`}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 min-w-0 space-y-1">
                                                        <input
                                                            type="text"
                                                            value={p.caption || ''}
                                                            onChange={(e) => {
                                                                const next = [...dprForm.photos];
                                                                next[pIdx] = { ...next[pIdx], caption: e.target.value };
                                                                setDprForm((prev) => ({ ...prev, photos: next }));
                                                            }}
                                                            placeholder="Caption / description of photo"
                                                            className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white font-medium text-slate-800"
                                                        />
                                                        <span className="text-[10px] text-slate-400 block truncate">Tag in activity as: <strong>{p.photo_ref || `Photo ${pIdx + 1}`}</strong></span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveDprPhoto(pIdx)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg shrink-0 cursor-pointer"
                                                        title="Remove Photo"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">
                                            No photos added yet. Upload live progress photos to include them in the PDF gallery & Excel sheet.
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowDprModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={savingDpr} className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer disabled:opacity-50">
                                        {savingDpr ? 'Saving...' : (editingDpr ? 'Update DPR' : 'Save DPR Record')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* MODAL 2: CONCERN CREATE / EDIT */}
            {showConcernModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
                            <div className="flex justify-between items-center border-b border-slate-100 px-6 py-4 shrink-0">
                                <h3 className="font-bold text-lg text-rose-600 flex items-center gap-2">
                                    <AlertTriangle size={20} /> {editingConcern ? 'Edit Site Concern' : 'Log Site Concern / Showstopper'}
                                </h3>
                                <button type="button" onClick={() => setShowConcernModal(false)} className="text-slate-400 hover:text-slate-700">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveConcern} className="flex-1 overflow-y-auto p-6 space-y-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Site / Project *</label>
                                    <select
                                        value={concernForm.site_id}
                                        onChange={(e) => setConcernForm((prev) => ({ ...prev, site_id: e.target.value }))}
                                        required
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    >
                                        <option value="">Select Site...</option>
                                        {sites.map((s) => (
                                            <option key={s.site_id} value={s.site_id}>{s.site_name} {s.site_code ? `(${s.site_code})` : ''}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Concern Title / Summary *</label>
                                    <input
                                        type="text"
                                        value={concernForm.concern_title}
                                        onChange={(e) => setConcernForm((prev) => ({ ...prev, concern_title: e.target.value }))}
                                        placeholder="Describe the site blocker or concern..."
                                        required
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Concern Area</label>
                                        <input
                                            type="text"
                                            value={concernForm.concern_area}
                                            onChange={(e) => setConcernForm((prev) => ({ ...prev, concern_area: e.target.value }))}
                                            placeholder="e.g. Substation Trench"
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Severity</label>
                                        <select
                                            value={concernForm.severity}
                                            onChange={(e) => setConcernForm((prev) => ({ ...prev, severity: e.target.value }))}
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                        >
                                            <option value="CRITICAL_SHOWSTOPPER">Critical Showstopper</option>
                                            <option value="MAJOR">Major Concern</option>
                                            <option value="MINOR">Minor Observation</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">1st Intimation Date *</label>
                                        <input
                                            type="date"
                                            value={concernForm.first_intimation_date}
                                            onChange={(e) => setConcernForm((prev) => ({ ...prev, first_intimation_date: e.target.value }))}
                                            required
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Responsible Party</label>
                                        <select
                                            value={concernForm.responsible_party}
                                            onChange={(e) => setConcernForm((prev) => ({ ...prev, responsible_party: e.target.value }))}
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-bold"
                                        >
                                            <option value="CLIENT">Client / Contractor</option>
                                            <option value="NKD">NKD Execution Team</option>
                                            <option value="SUBCONTRACTOR">Subcontractor</option>
                                            <option value="AUTHORITY">External Authority (MSEDCL/EHS)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
                                        <select
                                            value={concernForm.status}
                                            onChange={(e) => setConcernForm((prev) => ({ ...prev, status: e.target.value }))}
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                        >
                                            <option value="OPEN">OPEN</option>
                                            <option value="IN_PROGRESS">IN_PROGRESS</option>
                                            <option value="RESOLVED">RESOLVED</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Target Resolution</label>
                                        <input
                                            type="date"
                                            value={concernForm.target_resolution_date}
                                            onChange={(e) => setConcernForm((prev) => ({ ...prev, target_resolution_date: e.target.value }))}
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Impact Description</label>
                                    <textarea
                                        value={concernForm.impact_summary}
                                        onChange={(e) => setConcernForm((prev) => ({ ...prev, impact_summary: e.target.value }))}
                                        placeholder="Describe the impact on execution..."
                                        rows="2"
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowConcernModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                                        Cancel
                                    </button>
                                    <button type="submit" className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer">
                                        {editingConcern ? 'Update Concern' : 'Log Concern'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* MODAL 3: MEASUREMENT CREATE / EDIT */}
            {showMeasurementModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                            <div className="flex justify-between items-center border-b border-slate-100 px-6 py-4 shrink-0">
                                <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2">
                                    <Ruler size={20} /> {editingMeasurement ? 'Edit M-Book Entry' : 'Add Measurement Book Entry (M-Book)'}
                                </h3>
                                <button type="button" onClick={() => setShowMeasurementModal(false)} className="text-slate-400 hover:text-slate-700">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveMeasurement} className="flex-1 overflow-y-auto p-6 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Site / Project *</label>
                                        <select
                                            value={measurementForm.site_id}
                                            onChange={(e) => setMeasurementForm((prev) => ({ ...prev, site_id: e.target.value }))}
                                            required
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                        >
                                            <option value="">Select Site...</option>
                                            {sites.map((s) => (
                                                <option key={s.site_id} value={s.site_id}>{s.site_name} {s.site_code ? `(${s.site_code})` : ''}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Item No. / BOQ Ref</label>
                                        <input
                                            type="text"
                                            value={measurementForm.item_no}
                                            onChange={(e) => setMeasurementForm((prev) => ({ ...prev, item_no: e.target.value }))}
                                            placeholder="e.g. 1.1, 2.3"
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Description of Work *</label>
                                    <input
                                        type="text"
                                        value={measurementForm.description}
                                        onChange={(e) => setMeasurementForm((prev) => ({ ...prev, description: e.target.value }))}
                                        placeholder="Describe measured BOQ item..."
                                        required
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-semibold"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Location Reference</label>
                                    <input
                                        type="text"
                                        value={measurementForm.location_ref}
                                        onChange={(e) => setMeasurementForm((prev) => ({ ...prev, location_ref: e.target.value }))}
                                        placeholder="Bay / Trench / Building section"
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    />
                                </div>

                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Dimensions Calculation</span>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <div>
                                            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Nos</label>
                                            <input type="number" step="any" value={measurementForm.nos} onChange={(e) => setMeasurementForm((prev) => ({ ...prev, nos: e.target.value }))} className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Length (m)</label>
                                            <input type="number" step="any" value={measurementForm.length} onChange={(e) => setMeasurementForm((prev) => ({ ...prev, length: e.target.value }))} className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Breadth (m)</label>
                                            <input type="number" step="any" value={measurementForm.breadth} onChange={(e) => setMeasurementForm((prev) => ({ ...prev, breadth: e.target.value }))} className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Depth (m)</label>
                                            <input type="number" step="any" value={measurementForm.depth} onChange={(e) => setMeasurementForm((prev) => ({ ...prev, depth: e.target.value }))} className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono" />
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center pt-2 border-t border-slate-200/80 text-xs font-bold">
                                        <span className="text-slate-600">Calculated Quantity:</span>
                                        <span className="text-emerald-700 font-mono text-sm">
                                            {calcMBookPreview().toFixed(3)} {measurementForm.unit}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Unit</label>
                                        <select
                                            value={measurementForm.unit}
                                            onChange={(e) => setMeasurementForm((prev) => ({ ...prev, unit: e.target.value }))}
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-bold"
                                        >
                                            <option value="MTR">MTR (Running Meters)</option>
                                            <option value="SQM">SQM (Square Meters)</option>
                                            <option value="CUM">CUM (Cubic Meters)</option>
                                            <option value="NOS">NOS (Units)</option>
                                            <option value="SET">SET</option>
                                            <option value="MT">MT</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Measurement Date *</label>
                                        <input
                                            type="date"
                                            value={measurementForm.measurement_date}
                                            onChange={(e) => setMeasurementForm((prev) => ({ ...prev, measurement_date: e.target.value }))}
                                            required
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
                                        <select
                                            value={measurementForm.status}
                                            onChange={(e) => setMeasurementForm((prev) => ({ ...prev, status: e.target.value }))}
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                        >
                                            <option value="SUBMITTED">SUBMITTED</option>
                                            <option value="CERTIFIED">CERTIFIED</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowMeasurementModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                                        Cancel
                                    </button>
                                    <button type="submit" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer">
                                        {editingMeasurement ? 'Update M-Book Entry' : 'Save M-Book Entry'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* MODAL 4: EDIT VENDOR SCOPE & SITE MAPPING */}
            {showVendorModal && editingVendor && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
                            <div className="flex justify-between items-center border-b border-slate-100 px-6 py-4 shrink-0">
                                <h3 className="font-bold text-lg text-slate-900">
                                    Edit Scope: {editingVendor.vendor_name}
                                </h3>
                                <button type="button" onClick={() => setShowVendorModal(false)} className="text-slate-400 hover:text-slate-700">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveVendorScope} className="flex-1 overflow-y-auto p-6 space-y-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Assigned Site (Optional)</label>
                                    <select
                                        value={vendorForm.site_id}
                                        onChange={(e) => setVendorForm((p) => ({ ...p, site_id: e.target.value }))}
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    >
                                        <option value="">All Sites / Company-Wide</option>
                                        {sites.map((s) => (
                                            <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Scope of Work / Supply</label>
                                    <textarea
                                        rows="3"
                                        value={vendorForm.scope_of_work}
                                        onChange={(e) => setVendorForm((p) => ({ ...p, scope_of_work: e.target.value }))}
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Contact Person</label>
                                        <input type="text" value={vendorForm.contact_person} onChange={(e) => setVendorForm((p) => ({ ...p, contact_person: e.target.value }))} className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Phone</label>
                                        <input type="text" value={vendorForm.phone} onChange={(e) => setVendorForm((p) => ({ ...p, phone: e.target.value }))} className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Email</label>
                                        <input type="email" value={vendorForm.email} onChange={(e) => setVendorForm((p) => ({ ...p, email: e.target.value }))} className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">City</label>
                                        <input type="text" value={vendorForm.city} onChange={(e) => setVendorForm((p) => ({ ...p, city: e.target.value }))} className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2" />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowVendorModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                        Cancel
                                    </button>
                                    <button type="submit" className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-md">
                                        Save Mapping
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* MODAL 5: REGISTER / EDIT TOOL & TPI */}
            {showToolModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
                            <div className="flex justify-between items-center border-b border-slate-100 px-6 py-4 shrink-0">
                                <h3 className="font-bold text-lg text-indigo-700 flex items-center gap-2">
                                    <Wrench size={20} /> {editingTool ? 'Edit Tool & TPI Record' : 'Register Tool, Tackle & TPI Calibration'}
                                </h3>
                                <button type="button" onClick={() => setShowToolModal(false)} className="text-slate-400 hover:text-slate-700">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveTool} className="flex-1 overflow-y-auto p-6 space-y-3">
                                {sites.length > 0 && (
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Deployed Site</label>
                                        <select
                                            value={toolForm.site_id}
                                            onChange={(e) => setToolForm((prev) => ({ ...prev, site_id: e.target.value }))}
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                        >
                                            <option value="">General Pool / Unassigned</option>
                                            {sites.map((s) => (
                                                <option key={s.site_id} value={s.site_id}>{s.site_name} {s.site_code ? `(${s.site_code})` : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Tool / Equipment Name *</label>
                                    <input
                                        type="text"
                                        value={toolForm.tool_name}
                                        onChange={(e) => setToolForm((prev) => ({ ...prev, tool_name: e.target.value }))}
                                        placeholder="e.g. Digital Insulation Resistance Tester"
                                        required
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-semibold"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                                        <select
                                            value={toolForm.category}
                                            onChange={(e) => setToolForm((prev) => ({ ...prev, category: e.target.value }))}
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                        >
                                            <option value="TESTING_EQUIPMENT">Testing Equipment (Megger/Torque)</option>
                                            <option value="DEWATERING_PUMP">Dewatering Pump (Submersible/Diesel)</option>
                                            <option value="CRIMPING_TOOL">Crimping Tool (Hydraulic)</option>
                                            <option value="LIFTING_SAFETY">Safety & Lifting Tackle</option>
                                            <option value="SCAFFOLDING">Scaffolding Mobile Tower</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Quantity</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={toolForm.quantity}
                                            onChange={(e) => setToolForm((prev) => ({ ...prev, quantity: e.target.value }))}
                                            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Make / Model</label>
                                        <input type="text" value={toolForm.make_model} onChange={(e) => setToolForm((prev) => ({ ...prev, make_model: e.target.value }))} placeholder="Manufacturer & model" className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Serial Number</label>
                                        <input type="text" value={toolForm.serial_no} onChange={(e) => setToolForm((prev) => ({ ...prev, serial_no: e.target.value }))} placeholder="Asset S/N" className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">TPI / Calibration Agency</label>
                                        <input type="text" value={toolForm.tpi_agency} onChange={(e) => setToolForm((prev) => ({ ...prev, tpi_agency: e.target.value }))} placeholder="Inspection agency" className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Certificate Number</label>
                                        <input type="text" value={toolForm.certificate_no} onChange={(e) => setToolForm((prev) => ({ ...prev, certificate_no: e.target.value }))} placeholder="Certificate ref" className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Calibration Date</label>
                                        <input type="date" value={toolForm.calibration_date} onChange={(e) => setToolForm((prev) => ({ ...prev, calibration_date: e.target.value }))} className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">Valid Till (Expiry) *</label>
                                        <input type="date" value={toolForm.valid_till} onChange={(e) => setToolForm((prev) => ({ ...prev, valid_till: e.target.value }))} required className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-bold text-indigo-700" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                                        Upload Calibration / TPI Certificate (PDF/Image)
                                        {toolForm.certificate_url && (
                                            <span className="ml-2 text-primary-600 font-normal">(Existing file attached)</span>
                                        )}
                                    </label>
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={(e) => setCertificateFile(e.target.files[0] || null)}
                                        className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowToolModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={uploadingCert} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer disabled:opacity-50">
                                        {uploadingCert ? 'Uploading...' : (editingTool ? 'Update Tool Record' : 'Save & Register Tool')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
};

export default DPRManagementHub;
