import React, { useState, useEffect } from 'react';
import {
    ClipboardList, AlertTriangle, Ruler, Truck, Wrench, Plus,
    Search, Filter, Download, Calendar, Building2, Users, CheckCircle2,
    Clock, ArrowRight, FileText, ChevronRight, Eye, Trash2, X,
    Phone, Mail, MapPin, Upload, ShieldCheck, Check, Droplets,
    Activity, HardHat, FileSpreadsheet, AlertCircle, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import siteOperationsService from '../services/siteOperationsService';
import dprService from '../services/dprService';
import siteService from '../services/siteService';
import TrenchDewateringRegister from '../components/dpr/TrenchDewateringRegister';

const DPRManagementHub = () => {
    const [activeTab, setActiveTab] = useState('dpr'); // 'dpr' | 'concerns' | 'measurements' | 'vendors' | 'tools'
    const [dprSubTab, setDprSubTab] = useState('reports'); // 'reports' | 'trench'
    const [sites, setSites] = useState([]);
    const [selectedSiteId, setSelectedSiteId] = useState('ALL');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    // Module 1: DPR State
    const [dprs, setDprs] = useState([]);
    const [selectedDprForView, setSelectedDprForView] = useState(null);
    const [showDprModal, setShowDprModal] = useState(false);
    const [dprForm, setDprForm] = useState({
        site_id: '',
        report_no: '',
        report_date: new Date().toISOString().split('T')[0],
        client_name: '',
        po_number: '',
        po_value: '',
        billing_progress_pct: 0,
        start_date: '',
        completion_date: '',
        today_activities: [
            { id: 1, description: '', status: 'complete', dependencies: 'NKD', photo_ref: '' }
        ],
        next_day_activities: [
            { id: 1, description: '', dependencies: '' }
        ],
        show_stoppers: [],
        manpower_data: [
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
        ]
    });

    // Module 2: Concerns State
    const [concerns, setConcerns] = useState([]);
    const [concernSearch, setConcernSearch] = useState('');
    const [concernStatusFilter, setConcernStatusFilter] = useState('ALL');
    const [showConcernModal, setShowConcernModal] = useState(false);
    const [concernForm, setConcernForm] = useState({
        site_id: '',
        concern_title: '',
        concern_area: '',
        category: 'CLIENT_CLEARANCE',
        severity: 'CRITICAL_SHOWSTOPPER',
        first_intimation_date: new Date().toISOString().split('T')[0],
        duration_weeks: 1,
        responsible_party: 'CLIENT',
        impact_summary: '',
        target_resolution_date: '',
        status: 'OPEN',
        resolution_remarks: ''
    });

    // Module 3: Measurements State
    const [measurements, setMeasurements] = useState([]);
    const [measurementSearch, setMeasurementSearch] = useState('');
    const [showMeasurementModal, setShowMeasurementModal] = useState(false);
    const [measurementForm, setMeasurementForm] = useState({
        site_id: '',
        item_no: '',
        description: '',
        location_ref: '',
        nos: 1,
        length: 0,
        breadth: 0,
        depth: 0,
        unit: 'MTR',
        measurement_date: new Date().toISOString().split('T')[0],
        measured_by: 'Site Engineer',
        verified_by: 'Client In-Charge',
        remarks: '',
        status: 'SUBMITTED'
    });

    // Module 4: Vendors State
    const [vendors, setVendors] = useState([]);
    const [vendorSearch, setVendorSearch] = useState('');

    // Module 5: Tools & Tackles State
    const [tools, setTools] = useState([]);
    const [toolSearch, setToolSearch] = useState('');
    const [toolStatusFilter, setToolStatusFilter] = useState('ALL');
    const [showToolModal, setShowToolModal] = useState(false);
    const [toolForm, setToolForm] = useState({
        site_id: '',
        tool_name: '',
        category: 'TESTING_EQUIPMENT',
        quantity: 1,
        serial_no: '',
        make_model: '',
        tpi_agency: '',
        certificate_no: '',
        calibration_date: '',
        valid_till: '',
        remarks: ''
    });
    const [certificateFile, setCertificateFile] = useState(null);
    const [uploadingCert, setUploadingCert] = useState(false);

    useEffect(() => {
        loadSitesAndStats();
    }, [selectedSiteId]);

    useEffect(() => {
        if (activeTab === 'dpr') loadDprs();
        else if (activeTab === 'concerns') loadConcerns();
        else if (activeTab === 'measurements') loadMeasurements();
        else if (activeTab === 'vendors') loadVendors();
        else if (activeTab === 'tools') loadTools();
    }, [activeTab, selectedSiteId, concernStatusFilter, toolStatusFilter]);

    const loadSitesAndStats = async () => {
        try {
            const [sitesRes, statsRes] = await Promise.all([
                siteService.getAllSites(),
                siteOperationsService.getStats(selectedSiteId)
            ]);
            setSites(sitesRes.data?.data || sitesRes.data || []);
            setStats(statsRes.data?.data || statsRes.data || null);
        } catch (err) {
            console.error('Failed to load initial site stats:', err);
        }
    };

    const loadDprs = async () => {
        setLoading(true);
        try {
            const res = await dprService.getAllDprs({ site_id: selectedSiteId });
            const list = res.data?.data || res.data || [];
            setDprs(list);
            if (list.length > 0 && !selectedDprForView) {
                setSelectedDprForView(list[0]);
            }
        } catch (err) {
            toast.error('Failed to load DPR records');
        } finally {
            setLoading(false);
        }
    };

    const loadConcerns = async () => {
        setLoading(true);
        try {
            const res = await siteOperationsService.getConcerns({
                site_id: selectedSiteId,
                status: concernStatusFilter,
                search: concernSearch
            });
            setConcerns(res.data?.data || res.data || []);
        } catch (err) {
            toast.error('Failed to load concerns');
        } finally {
            setLoading(false);
        }
    };

    const loadMeasurements = async () => {
        setLoading(true);
        try {
            const res = await siteOperationsService.getMeasurements({
                site_id: selectedSiteId,
                search: measurementSearch
            });
            setMeasurements(res.data?.data || res.data || []);
        } catch (err) {
            toast.error('Failed to load measurement records');
        } finally {
            setLoading(false);
        }
    };

    const loadVendors = async () => {
        setLoading(true);
        try {
            const res = await siteOperationsService.getVendors({
                site_id: selectedSiteId,
                search: vendorSearch
            });
            setVendors(res.data?.data || res.data || []);
        } catch (err) {
            toast.error('Failed to load vendor mapping');
        } finally {
            setLoading(false);
        }
    };

    const loadTools = async () => {
        setLoading(true);
        try {
            const res = await siteOperationsService.getTools({
                site_id: selectedSiteId,
                status: toolStatusFilter,
                search: toolSearch
            });
            setTools(res.data?.data || res.data || []);
        } catch (err) {
            toast.error('Failed to load tools & tackles');
        } finally {
            setLoading(false);
        }
    };

    // DPR Actions
    const handleSaveDpr = async (e) => {
        e.preventDefault();
        if (!dprForm.site_id || !dprForm.report_no) {
            toast.error('Site and Report No are required');
            return;
        }
        try {
            await dprService.createDpr(dprForm);
            toast.success('DPR Created Successfully!');
            setShowDprModal(false);
            loadDprs();
            loadSitesAndStats();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save DPR');
        }
    };

    // Concern Actions
    const handleSaveConcern = async (e) => {
        e.preventDefault();
        if (!concernForm.site_id || !concernForm.concern_title) {
            toast.error('Site and Concern Title are required');
            return;
        }
        try {
            await siteOperationsService.createConcern(concernForm);
            toast.success('Site Concern Reported!');
            setShowConcernModal(false);
            loadConcerns();
            loadSitesAndStats();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to report concern');
        }
    };

    const handleUpdateConcernStatus = async (concernId, newStatus) => {
        try {
            await siteOperationsService.updateConcern(concernId, { status: newStatus });
            toast.success(`Concern updated to ${newStatus}`);
            loadConcerns();
            loadSitesAndStats();
        } catch (err) {
            toast.error('Failed to update status');
        }
    };

    // Measurement Actions
    const handleSaveMeasurement = async (e) => {
        e.preventDefault();
        if (!measurementForm.site_id || !measurementForm.description) {
            toast.error('Site and Description are required');
            return;
        }
        try {
            await siteOperationsService.createMeasurement(measurementForm);
            toast.success('Measurement Record Added!');
            setShowMeasurementModal(false);
            loadMeasurements();
            loadSitesAndStats();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save measurement');
        }
    };

    const exportMeasurementsCSV = () => {
        if (measurements.length === 0) {
            toast.error('No measurements to export');
            return;
        }
        const headers = ['Item No', 'Description', 'Location', 'Nos', 'Length', 'Breadth', 'Depth', 'Total Qty', 'Unit', 'Date', 'Status', 'Measured By', 'Verified By'];
        const rows = measurements.map(m => [
            `"${m.item_no || ''}"`,
            `"${(m.description || '').replace(/"/g, '""')}"`,
            `"${(m.location_ref || '').replace(/"/g, '""')}"`,
            m.nos,
            m.length,
            m.breadth,
            m.depth,
            m.quantity,
            m.unit,
            m.measurement_date_display || m.measurement_date_fmt,
            m.status,
            `"${m.measured_by || ''}"`,
            `"${m.verified_by || ''}"`
        ]);
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Measurement_Sheet_${selectedSiteId}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Measurement Sheet exported as CSV!');
    };

    // Tools Actions
    const handleSaveTool = async (e) => {
        e.preventDefault();
        if (!toolForm.tool_name || !toolForm.valid_till) {
            toast.error('Tool Name and Validity Expiry Date are required');
            return;
        }
        try {
            let certificateUrl = null;
            if (certificateFile) {
                setUploadingCert(true);
                const formData = new FormData();
                formData.append('file', certificateFile);
                const uploadRes = await siteOperationsService.uploadCertificate(formData);
                certificateUrl = uploadRes.data?.url;
            }

            await siteOperationsService.createTool({
                ...toolForm,
                certificate_url: certificateUrl
            });
            toast.success('Tool & Tackle Registered Successfully!');
            setShowToolModal(false);
            setCertificateFile(null);
            loadTools();
            loadSitesAndStats();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save tool');
        } finally {
            setUploadingCert(false);
        }
    };

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-300">
            {/* Header & Site Selector */}
            <div className="bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-primary-500/20 to-transparent pointer-events-none" />
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/20 text-primary-300 text-xs font-semibold mb-2 border border-primary-500/30">
                            <Activity size={14} />
                            Site Execution & Operations Management
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                            DPR Management Hub
                        </h1>
                        <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                            Multi-site Daily Progress Reports, Showstoppers, M-Book Measurements, Vendor Mapping, and TPI Calibration Registers.
                        </p>
                    </div>

                    {/* Site Switcher Dropdown */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/15 flex items-center gap-2 text-white">
                            <Building2 size={18} className="text-primary-300 shrink-0 ml-1" />
                            <select
                                value={selectedSiteId}
                                onChange={(e) => setSelectedSiteId(e.target.value)}
                                className="bg-transparent text-white text-sm font-semibold focus:outline-none cursor-pointer pr-4"
                            >
                                <option value="ALL" className="text-slate-900">All Sites & Projects</option>
                                {sites.map(s => (
                                    <option key={s.site_id} value={s.site_id} className="text-slate-900">
                                        {s.site_name} ({s.site_code})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {activeTab === 'dpr' && (
                            <button
                                onClick={() => {
                                    const s = sites.find(x => String(x.site_id) === String(selectedSiteId)) || sites[0];
                                    setDprForm(prev => ({
                                        ...prev,
                                        site_id: s?.site_id || '',
                                        client_name: s?.principal_employer_name || 'LUMINA',
                                        report_no: s?.site_code ? `${s.site_code}/${String(dprs.length + 1).padStart(3, '0')}` : 'GTPL LUMINA/125'
                                    }));
                                    setShowDprModal(true);
                                }}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
                            >
                                <Plus size={18} />
                                New DPR (With Backdate)
                            </button>
                        )}
                        {activeTab === 'concerns' && (
                            <button
                                onClick={() => {
                                    setConcernForm(prev => ({ ...prev, site_id: selectedSiteId !== 'ALL' ? selectedSiteId : (sites[0]?.site_id || '') }));
                                    setShowConcernModal(true);
                                }}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
                            >
                                <Plus size={18} />
                                Report Site Concern
                            </button>
                        )}
                        {activeTab === 'measurements' && (
                            <div className="flex gap-2">
                                <button
                                    onClick={exportMeasurementsCSV}
                                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20 transition-all cursor-pointer"
                                    title="Export M-Book as CSV"
                                >
                                    <Download size={16} />
                                    CSV
                                </button>
                                <button
                                    onClick={() => {
                                        setMeasurementForm(prev => ({ ...prev, site_id: selectedSiteId !== 'ALL' ? selectedSiteId : (sites[0]?.site_id || '') }));
                                        setShowMeasurementModal(true);
                                    }}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
                                >
                                    <Plus size={18} />
                                    Add Measurement
                                </button>
                            </div>
                        )}
                        {activeTab === 'tools' && (
                            <button
                                onClick={() => {
                                    setToolForm(prev => ({ ...prev, site_id: selectedSiteId !== 'ALL' ? selectedSiteId : (sites[0]?.site_id || '') }));
                                    setShowToolModal(true);
                                }}
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
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <span className="text-[11px] text-slate-300 font-medium">Daily Reports Logged</span>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-xl sm:text-2xl font-black">{stats?.dprs?.total_dprs || dprs.length}</span>
                            <ClipboardList size={18} className="text-sky-400" />
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <span className="text-[11px] text-slate-300 font-medium">Open Showstoppers</span>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-xl sm:text-2xl font-black text-rose-300">{stats?.concerns?.open_concerns || 0}</span>
                            <AlertTriangle size={18} className="text-rose-400" />
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <span className="text-[11px] text-slate-300 font-medium">Measured Work (Qty)</span>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-xl sm:text-2xl font-black text-emerald-300">{parseFloat(stats?.measurements?.total_measured_qty || 0).toLocaleString()}</span>
                            <Ruler size={18} className="text-emerald-400" />
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <span className="text-[11px] text-slate-300 font-medium">Mapped Suppliers</span>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-xl sm:text-2xl font-black">{stats?.vendors?.total_vendors || vendors.length}</span>
                            <Truck size={18} className="text-amber-400" />
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-3 border border-white/10 col-span-2 sm:col-span-1">
                        <span className="text-[11px] text-slate-300 font-medium">Tools & TPI Valid</span>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-xl sm:text-2xl font-black text-indigo-300">
                                {stats?.tools?.valid_tools || 0} <span className="text-xs text-slate-400 font-normal">/ {stats?.tools?.total_tools || 0}</span>
                            </span>
                            <Wrench size={18} className="text-indigo-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* 5 Primary Modules Tab Navigation */}
            <div className="flex border-b border-slate-200 bg-white rounded-xl shadow-xs px-2 sm:px-4 overflow-x-auto scrollbar-thin">
                <button
                    onClick={() => setActiveTab('dpr')}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all shrink-0 ${
                        activeTab === 'dpr'
                            ? 'border-primary-600 text-primary-600 bg-primary-50/40'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <ClipboardList size={18} />
                    1. DPR Module (Daily Progress)
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">{dprs.length}</span>
                </button>

                <button
                    onClick={() => setActiveTab('concerns')}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all shrink-0 ${
                        activeTab === 'concerns'
                            ? 'border-rose-600 text-rose-600 bg-rose-50/40'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <AlertTriangle size={18} />
                    2. Concern & Issue Reporting
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">{concerns.filter(c => c.status !== 'RESOLVED').length}</span>
                </button>

                <button
                    onClick={() => setActiveTab('measurements')}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all shrink-0 ${
                        activeTab === 'measurements'
                            ? 'border-emerald-600 text-emerald-600 bg-emerald-50/40'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Ruler size={18} />
                    3. Measurement Sheet (M-Book)
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">{measurements.length}</span>
                </button>

                <button
                    onClick={() => setActiveTab('vendors')}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all shrink-0 ${
                        activeTab === 'vendors'
                            ? 'border-amber-600 text-amber-600 bg-amber-50/40'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Truck size={18} />
                    4. Vendor Mapping & Scope
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">{vendors.length}</span>
                </button>

                <button
                    onClick={() => setActiveTab('tools')}
                    className={`flex items-center gap-2 px-4 py-3.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all shrink-0 ${
                        activeTab === 'tools'
                            ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Wrench size={18} />
                    5. Inventory & Tools (TPI / Calibration)
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold">{tools.length}</span>
                </button>
            </div>

            {/* TAB 1: DPR MODULE */}
            {activeTab === 'dpr' && (
                <div className="space-y-6">
                    {/* Sub-tab pills */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setDprSubTab('reports')}
                            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                                dprSubTab === 'reports'
                                    ? 'bg-primary-600 text-white shadow-sm'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            Daily Site Progress Reports (Lumina Format)
                        </button>
                        <button
                            onClick={() => setDprSubTab('trench')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                                dprSubTab === 'trench'
                                    ? 'bg-primary-600 text-white shadow-sm'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <Droplets size={16} />
                            11kV Trench Dewatering Register (96 Records)
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
                                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                        {dprs.length === 0 ? (
                                            <p className="text-slate-400 text-xs py-8 text-center">No DPR records found.</p>
                                        ) : (
                                            dprs.map(item => (
                                                <div
                                                    key={item.dpr_id}
                                                    onClick={() => setSelectedDprForView(item)}
                                                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                                                        selectedDprForView?.dpr_id === item.dpr_id
                                                            ? 'border-primary-500 bg-primary-50/50 shadow-xs ring-1 ring-primary-500/20'
                                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-sm text-slate-900">{item.report_no}</span>
                                                        <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                                                            {item.report_date_display || item.report_date_fmt}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1 truncate">{item.site_name || item.client_name}</p>
                                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                                                        <span>Billing: {item.billing_progress_pct || 0}%</span>
                                                        <span className="text-emerald-600 font-medium">Manpower: {item.manpower_total || 9}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Preview */}
                            <div className="lg:col-span-2">
                                {selectedDprForView ? (
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h2 className="text-xl font-bold text-slate-900">{selectedDprForView.report_no}</h2>
                                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                                        {selectedDprForView.report_date_display || selectedDprForView.report_date_fmt}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    End Client: <strong className="text-slate-800">{selectedDprForView.client_name}</strong> | Site: <strong className="text-slate-800">{selectedDprForView.site_name || 'GTPL LUMINA, AIROLI, MUMBAI'}</strong>
                                                </p>
                                            </div>

                                            <a
                                                href={`/api/dpr/${selectedDprForView.dpr_id}/pdf`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
                                            >
                                                <Download size={14} /> Download PDF
                                            </a>
                                        </div>

                                        {/* Financial & Contract Snapshot */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                                            <div>
                                                <span className="text-[11px] text-slate-400 font-semibold uppercase">PO Value</span>
                                                <p className="text-sm font-bold text-slate-900 mt-0.5">₹ {parseFloat(selectedDprForView.po_value || 48374200).toLocaleString('en-IN')}</p>
                                            </div>
                                            <div>
                                                <span className="text-[11px] text-slate-400 font-semibold uppercase">PO No. & Date</span>
                                                <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedDprForView.po_number || '600190'}</p>
                                            </div>
                                            <div>
                                                <span className="text-[11px] text-slate-400 font-semibold uppercase">Start Date</span>
                                                <p className="text-sm font-bold text-slate-900 mt-0.5">16-Apr-2026</p>
                                            </div>
                                            <div>
                                                <span className="text-[11px] text-slate-400 font-semibold uppercase">Billing Progress</span>
                                                <p className="text-sm font-bold text-emerald-600 mt-0.5">{selectedDprForView.billing_progress_pct || 0}%</p>
                                            </div>
                                        </div>

                                        {/* Today & Next Day Activities */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="border border-slate-200 rounded-xl p-4">
                                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5 text-primary-700">
                                                    <CheckCircle2 size={16} /> Today Activity Status
                                                </h4>
                                                <div className="space-y-2">
                                                    {(selectedDprForView.today_activities || []).map((act, idx) => (
                                                        <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 text-xs text-slate-800">
                                                            <div className="flex items-center justify-between font-bold mb-1">
                                                                <span className="text-primary-700">Activity #{idx + 1}</span>
                                                                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase font-semibold">
                                                                    {act.status || 'complete'}
                                                                </span>
                                                            </div>
                                                            <p>{act.description || 'Roxtec material unloading and shifting work, [Engaged Manpower: 07].'}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="border border-slate-200 rounded-xl p-4">
                                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5 text-indigo-700">
                                                    <Clock size={16} /> Activity Planned for Next Day
                                                </h4>
                                                <div className="space-y-2">
                                                    {(selectedDprForView.next_day_activities || []).map((act, idx) => (
                                                        <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 text-xs text-slate-800">
                                                            <span className="font-bold text-indigo-700 block mb-1">Planned Task #{idx + 1}</span>
                                                            <p>{act.description || '11 kV trench core cutting (cellar room) and 11KV cable pulling in cellar.'}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Manpower Breakdown Table */}
                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between items-center">
                                                <span>Daily Manpower Deployment by Trade</span>
                                                <span className="text-emerald-700">Total Available: 9</span>
                                            </div>
                                            <div className="max-h-56 overflow-y-auto">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0">
                                                        <tr>
                                                            <th className="px-3 py-2">Trade / Role</th>
                                                            <th className="px-3 py-2 text-center">Required</th>
                                                            <th className="px-3 py-2 text-center">Available</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {[
                                                            { trade: 'Site Manager', req: 1, avail: 1 },
                                                            { trade: 'EHS Officer', req: 1, avail: 1 },
                                                            { trade: 'Helper', req: 7, avail: 7 },
                                                            { trade: 'Electrician', req: 2, avail: 0 },
                                                            { trade: 'Engineer', req: 1, avail: 0 },
                                                            { trade: 'Fitter', req: 1, avail: 0 },
                                                            { trade: 'Welder', req: 1, avail: 0 },
                                                            { trade: 'Testing Engineer', req: 1, avail: 0 },
                                                            { trade: 'Cable Jointer', req: 2, avail: 0 }
                                                        ].map((m, i) => (
                                                            <tr key={i} className="hover:bg-slate-50">
                                                                <td className="px-3 py-1.5 font-medium text-slate-800">{m.trade}</td>
                                                                <td className="px-3 py-1.5 text-center text-slate-500">{m.req}</td>
                                                                <td className={`px-3 py-1.5 text-center font-bold ${m.avail > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                                    {m.avail}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                                        Select a DPR to inspect full sheet
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <TrenchDewateringRegister selectedSiteId={selectedSiteId} sites={sites} />
                    )}
                </div>
            )}

            {/* TAB 2: CONCERNS & ISSUE REPORTING */}
            {activeTab === 'concerns' && (
                <div className="space-y-4">
                    {/* Filters Bar */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
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
                    </div>

                    {/* Concerns Cards List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {concerns.length === 0 ? (
                            <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
                                No concerns reported for this filter. Click "Report Site Concern" to log an issue.
                            </div>
                        ) : (
                            concerns.map(item => (
                                <div key={item.concern_id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                    item.severity === 'CRITICAL_SHOWSTOPPER' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {item.severity?.replace('_', ' ')}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium">Since {item.duration_weeks || 1} wk(s)</span>
                                            </div>
                                            <h3 className="font-bold text-slate-900 text-base mt-1.5 leading-snug">{item.concern_title}</h3>
                                        </div>

                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase shrink-0 ${
                                            item.status === 'OPEN' ? 'bg-rose-100 text-rose-800 animate-pulse' :
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
                                            <span className="font-semibold text-slate-800">{item.first_intimation_date ? new Date(item.first_intimation_date).toLocaleDateString('en-GB') : '-'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">Responsible Party:</span>
                                            <span className="font-bold text-primary-700">{item.responsible_party}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">Category:</span>
                                            <span className="font-medium text-slate-700">{item.category?.replace('_', ' ')}</span>
                                        </div>
                                    </div>

                                    {item.impact_summary && (
                                        <p className="text-xs text-slate-600 bg-rose-50/50 p-2.5 rounded-lg border border-rose-100">
                                            <strong>Impact:</strong> {item.impact_summary}
                                        </p>
                                    )}

                                    {/* Quick Status Toggles */}
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                                        <span className="text-slate-400">Change Status:</span>
                                        <div className="flex gap-1.5">
                                            {item.status !== 'IN_PROGRESS' && item.status !== 'RESOLVED' && (
                                                <button
                                                    onClick={() => handleUpdateConcernStatus(item.concern_id, 'IN_PROGRESS')}
                                                    className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold transition-colors"
                                                >
                                                    Mark In-Progress
                                                </button>
                                            )}
                                            {item.status !== 'RESOLVED' && (
                                                <button
                                                    onClick={() => handleUpdateConcernStatus(item.concern_id, 'RESOLVED')}
                                                    className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold transition-colors"
                                                >
                                                    Mark Resolved ✓
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

            {/* TAB 3: MEASUREMENT SHEET (M-BOOK) */}
            {activeTab === 'measurements' && (
                <div className="space-y-4">
                    {/* Measurement Header Bar */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                        <div className="relative flex-1 min-w-[260px]">
                            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by item no, work description, or location..."
                                value={measurementSearch}
                                onChange={(e) => setMeasurementSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                            />
                        </div>
                        <div className="text-xs font-semibold text-slate-500">
                            Showing <strong className="text-slate-900">{measurements.length}</strong> items
                        </div>
                    </div>

                    {/* M-Book Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="px-3.5 py-3">Item #</th>
                                        <th className="px-4 py-3 min-w-[240px]">Description of Work</th>
                                        <th className="px-3.5 py-3 min-w-[160px]">Location Reference</th>
                                        <th className="px-2.5 py-3 text-center">Nos</th>
                                        <th className="px-2.5 py-3 text-right">L (m)</th>
                                        <th className="px-2.5 py-3 text-right">B (m)</th>
                                        <th className="px-2.5 py-3 text-right">D (m)</th>
                                        <th className="px-3.5 py-3 text-right font-black text-emerald-800">Total Qty</th>
                                        <th className="px-2.5 py-3 text-center">Unit</th>
                                        <th className="px-3 py-3">Date</th>
                                        <th className="px-3 py-3 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {measurements.length === 0 ? (
                                        <tr>
                                            <td colSpan="11" className="px-4 py-12 text-center text-slate-400">
                                                No measurement records entered. Click "Add Measurement" to log physical work.
                                            </td>
                                        </tr>
                                    ) : (
                                        measurements.map(m => (
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
                                                    {parseFloat(m.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-2.5 py-3 text-center font-bold text-slate-500">{m.unit}</td>
                                                <td className="px-3 py-3 whitespace-nowrap text-slate-600">{m.measurement_date_display || m.measurement_date_fmt}</td>
                                                <td className="px-3 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                        m.status === 'CERTIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                                                    }`}>
                                                        {m.status}
                                                    </span>
                                                </td>
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
                    {/* Search Bar */}
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

                    {/* Vendors Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {vendors.map(v => (
                            <div key={v.vendor_id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                                <div>
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">{v.vendor_code}</span>
                                            <h3 className="font-bold text-slate-900 text-base mt-0.5">{v.vendor_name}</h3>
                                        </div>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">
                                            {v.category?.replace(/_/g, ' ')}
                                        </span>
                                    </div>

                                    {/* Scope of Work */}
                                    <div className="mt-3 bg-amber-50/50 p-3 rounded-lg border border-amber-200/60 text-xs">
                                        <strong className="text-amber-900 block mb-1">Scope of Supply / Services:</strong>
                                        <p className="text-slate-700 leading-relaxed">{v.scope_of_work || 'Material and Equipment Supplier for Project'}</p>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Users size={14} className="text-slate-400 shrink-0" />
                                        <span>Contact Person: <strong className="text-slate-800">{v.contact_person || 'Sudhir Jadaun'}</strong></span>
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

                                    <div className="flex items-center gap-2 text-slate-500">
                                        <MapPin size={14} className="text-rose-400 shrink-0" />
                                        <span>{v.city || 'India'}, {v.state || ''}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 5: INVENTORY & TOOLS & TACKLES (TPI) */}
            {activeTab === 'tools' && (
                <div className="space-y-4">
                    {/* Filters Bar */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
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
                    </div>

                    {/* Tools Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                                        <th className="px-3 py-3 text-center">Certificate File</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {tools.length === 0 ? (
                                        <tr>
                                            <td colSpan="10" className="px-4 py-12 text-center text-slate-400">
                                                No tools registered. Click "Register Tool / TPI" to add equipment.
                                            </td>
                                        </tr>
                                    ) : (
                                        tools.map(t => (
                                            <tr key={t.tool_id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 font-bold text-slate-900">
                                                    {t.tool_name}
                                                    {t.serial_no && <span className="block text-[10px] font-mono text-slate-400 font-normal">S/N: {t.serial_no}</span>}
                                                </td>
                                                <td className="px-3 py-3 text-slate-600 font-medium">{t.category?.replace('_', ' ')}</td>
                                                <td className="px-2 py-3 text-center font-bold text-slate-800">{t.quantity}</td>
                                                <td className="px-3 py-3 text-slate-600">{t.make_model || '-'}</td>
                                                <td className="px-3.5 py-3 font-semibold text-slate-800">{t.tpi_agency || '-'}</td>
                                                <td className="px-3 py-3 font-mono text-slate-600">{t.certificate_no || '-'}</td>
                                                <td className="px-3 py-3 text-slate-500">{t.calibration_date_display || t.calibration_date_fmt || '-'}</td>
                                                <td className="px-3.5 py-3 font-semibold">
                                                    <span className={t.computed_status === 'EXPIRED' ? 'text-red-600' : (t.computed_status === 'EXPIRING_SOON' ? 'text-amber-600' : 'text-slate-800')}>
                                                        {t.valid_till_display || t.valid_till_fmt}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                        t.computed_status === 'VALID' ? 'bg-emerald-100 text-emerald-800' :
                                                        t.computed_status === 'EXPIRING_SOON' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800 animate-pulse'
                                                    }`}>
                                                        {t.computed_status?.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    {t.certificate_url ? (
                                                        <a
                                                            href={t.certificate_url}
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
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 1: NEW DPR MODAL */}
            {showDprModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-lg text-slate-900">Prepare Daily Progress Report (DPR)</h3>
                            <button onClick={() => setShowDprModal(false)} className="text-slate-400 hover:text-slate-700">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveDpr} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Select Site / Project *</label>
                                    <select
                                        value={dprForm.site_id}
                                        onChange={(e) => {
                                            const s = sites.find(x => String(x.site_id) === String(e.target.value));
                                            setDprForm(prev => ({
                                                ...prev,
                                                site_id: e.target.value,
                                                client_name: s?.principal_employer_name || prev.client_name,
                                                report_no: s?.site_code ? `${s.site_code}/${String(dprs.length + 1).padStart(3, '0')}` : prev.report_no
                                            }));
                                        }}
                                        required
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    >
                                        <option value="">Choose Site...</option>
                                        {sites.map(s => (
                                            <option key={s.site_id} value={s.site_id}>{s.site_name} ({s.site_code})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Report Number *</label>
                                    <input
                                        type="text"
                                        value={dprForm.report_no}
                                        onChange={(e) => setDprForm(prev => ({ ...prev, report_no: e.target.value }))}
                                        required
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Report Date (Backdated Allowed) *</label>
                                    <input
                                        type="date"
                                        value={dprForm.report_date}
                                        onChange={(e) => setDprForm(prev => ({ ...prev, report_date: e.target.value }))}
                                        required
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Client Name</label>
                                    <input
                                        type="text"
                                        value={dprForm.client_name}
                                        onChange={(e) => setDprForm(prev => ({ ...prev, client_name: e.target.value }))}
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">Today's Key Progress Activity</label>
                                <textarea
                                    value={dprForm.today_activities[0]?.description || ''}
                                    onChange={(e) => setDprForm(prev => ({
                                        ...prev,
                                        today_activities: [{ ...prev.today_activities[0], description: e.target.value }]
                                    }))}
                                    rows="2"
                                    placeholder="e.g. 11kV cable pulling in cellar trench, Roxtec frame assembly..."
                                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">Planned Activity for Next Day</label>
                                <textarea
                                    value={dprForm.next_day_activities[0]?.description || ''}
                                    onChange={(e) => setDprForm(prev => ({
                                        ...prev,
                                        next_day_activities: [{ ...prev.next_day_activities[0], description: e.target.value }]
                                    }))}
                                    rows="2"
                                    placeholder="e.g. 11kV trench core cutting and termination preparation..."
                                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowDprModal(false)}
                                    className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer"
                                >
                                    Save DPR Record
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: REPORT CONCERN MODAL */}
            {showConcernModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2 text-rose-600">
                                <AlertTriangle size={20} /> Log Site Concern / Showstopper
                            </h3>
                            <button onClick={() => setShowConcernModal(false)} className="text-slate-400 hover:text-slate-700">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveConcern} className="space-y-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">Site / Project *</label>
                                <select
                                    value={concernForm.site_id}
                                    onChange={(e) => setConcernForm(prev => ({ ...prev, site_id: e.target.value }))}
                                    required
                                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                >
                                    <option value="">Select Site...</option>
                                    {sites.map(s => (
                                        <option key={s.site_id} value={s.site_id}>{s.site_name} ({s.site_code})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">Concern Title / Summary *</label>
                                <input
                                    type="text"
                                    value={concernForm.concern_title}
                                    onChange={(e) => setConcernForm(prev => ({ ...prev, concern_title: e.target.value }))}
                                    placeholder="e.g. Water ingress in 11kV trench, Core cutting approval delay"
                                    required
                                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Concern Area</label>
                                    <input
                                        type="text"
                                        value={concernForm.concern_area}
                                        onChange={(e) => setConcernForm(prev => ({ ...prev, concern_area: e.target.value }))}
                                        placeholder="e.g. Cellar Room Trench"
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Severity</label>
                                    <select
                                        value={concernForm.severity}
                                        onChange={(e) => setConcernForm(prev => ({ ...prev, severity: e.target.value }))}
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    >
                                        <option value="CRITICAL_SHOWSTOPPER">Critical Showstopper</option>
                                        <option value="MAJOR">Major Concern</option>
                                        <option value="MINOR">Minor Observation</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">1st Intimation Date *</label>
                                    <input
                                        type="date"
                                        value={concernForm.first_intimation_date}
                                        onChange={(e) => setConcernForm(prev => ({ ...prev, first_intimation_date: e.target.value }))}
                                        required
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Responsible Party</label>
                                    <select
                                        value={concernForm.responsible_party}
                                        onChange={(e) => setConcernForm(prev => ({ ...prev, responsible_party: e.target.value }))}
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-bold"
                                    >
                                        <option value="CLIENT">Client (Lumina/Contractor)</option>
                                        <option value="NKD">NKD Execution Team</option>
                                        <option value="SUBCONTRACTOR">Subcontractor</option>
                                        <option value="AUTHORITY">External Authority (MSEDCL/EHS)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">Impact Description</label>
                                <textarea
                                    value={concernForm.impact_summary}
                                    onChange={(e) => setConcernForm(prev => ({ ...prev, impact_summary: e.target.value }))}
                                    placeholder="Describe the delay caused to cabling/testing work..."
                                    rows="2"
                                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowConcernModal(false)}
                                    className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer"
                                >
                                    Log Concern
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: ADD MEASUREMENT MODAL */}
            {showMeasurementModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2 text-emerald-700">
                                <Ruler size={20} /> Add Measurement Book Entry (M-Book)
                            </h3>
                            <button onClick={() => setShowMeasurementModal(false)} className="text-slate-400 hover:text-slate-700">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveMeasurement} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Site / Project *</label>
                                    <select
                                        value={measurementForm.site_id}
                                        onChange={(e) => setMeasurementForm(prev => ({ ...prev, site_id: e.target.value }))}
                                        required
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    >
                                        <option value="">Select Site...</option>
                                        {sites.map(s => (
                                            <option key={s.site_id} value={s.site_id}>{s.site_name} ({s.site_code})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Item No. / BOQ Ref</label>
                                    <input
                                        type="text"
                                        value={measurementForm.item_no}
                                        onChange={(e) => setMeasurementForm(prev => ({ ...prev, item_no: e.target.value }))}
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
                                    onChange={(e) => setMeasurementForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="e.g. Laying & pulling of 11kV 1Cx1000 sq.mm AL Cable in trench"
                                    required
                                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-semibold"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">Location Reference</label>
                                <input
                                    type="text"
                                    value={measurementForm.location_ref}
                                    onChange={(e) => setMeasurementForm(prev => ({ ...prev, location_ref: e.target.value }))}
                                    placeholder="e.g. Cellar Room Trench Bay 1 to Bay 3"
                                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                />
                            </div>

                            {/* Dimensions Input with Auto Quantity Live Feedback */}
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Dimensions Calculation</span>
                                <div className="grid grid-cols-4 gap-2">
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Nos</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={measurementForm.nos}
                                            onChange={(e) => setMeasurementForm(prev => ({ ...prev, nos: e.target.value }))}
                                            className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Length (m)</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={measurementForm.length}
                                            onChange={(e) => setMeasurementForm(prev => ({ ...prev, length: e.target.value }))}
                                            className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Breadth (m)</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={measurementForm.breadth}
                                            onChange={(e) => setMeasurementForm(prev => ({ ...prev, breadth: e.target.value }))}
                                            className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Depth (m)</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={measurementForm.depth}
                                            onChange={(e) => setMeasurementForm(prev => ({ ...prev, depth: e.target.value }))}
                                            className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-2 border-t border-slate-200/80 text-xs font-bold">
                                    <span className="text-slate-600">Calculated Quantity:</span>
                                    <span className="text-emerald-700 font-mono text-sm">
                                        {(
                                            (parseFloat(measurementForm.nos) || 1) *
                                            (parseFloat(measurementForm.length) > 0 ? parseFloat(measurementForm.length) : 1) *
                                            (parseFloat(measurementForm.breadth) > 0 ? parseFloat(measurementForm.breadth) : 1) *
                                            (parseFloat(measurementForm.depth) > 0 ? parseFloat(measurementForm.depth) : 1)
                                        ).toFixed(3)} {measurementForm.unit}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Unit</label>
                                    <select
                                        value={measurementForm.unit}
                                        onChange={(e) => setMeasurementForm(prev => ({ ...prev, unit: e.target.value }))}
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-bold"
                                    >
                                        <option value="MTR">MTR (Running Meters)</option>
                                        <option value="SQM">SQM (Square Meters)</option>
                                        <option value="CUM">CUM (Cubic Meters)</option>
                                        <option value="NOS">NOS (Count / Units)</option>
                                        <option value="SET">SET</option>
                                        <option value="MT">MT (Metric Tonnes)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Measurement Date *</label>
                                    <input
                                        type="date"
                                        value={measurementForm.measurement_date}
                                        onChange={(e) => setMeasurementForm(prev => ({ ...prev, measurement_date: e.target.value }))}
                                        required
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowMeasurementModal(false)}
                                    className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer"
                                >
                                    Save M-Book Entry
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: REGISTER TOOL / TPI MODAL */}
            {showToolModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2 text-indigo-700">
                                <Wrench size={20} /> Register Tool, Tackle & TPI Calibration
                            </h3>
                            <button onClick={() => setShowToolModal(false)} className="text-slate-400 hover:text-slate-700">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveTool} className="space-y-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">Tool / Equipment Name *</label>
                                <input
                                    type="text"
                                    value={toolForm.tool_name}
                                    onChange={(e) => setToolForm(prev => ({ ...prev, tool_name: e.target.value }))}
                                    placeholder="e.g. 11kV Insulation Megger Tester 5kV"
                                    required
                                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-semibold"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                                    <select
                                        value={toolForm.category}
                                        onChange={(e) => setToolForm(prev => ({ ...prev, category: e.target.value }))}
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
                                        onChange={(e) => setToolForm(prev => ({ ...prev, quantity: e.target.value }))}
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Make / Model</label>
                                    <input
                                        type="text"
                                        value={toolForm.make_model}
                                        onChange={(e) => setToolForm(prev => ({ ...prev, make_model: e.target.value }))}
                                        placeholder="e.g. Megger MIT515"
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Serial Number</label>
                                    <input
                                        type="text"
                                        value={toolForm.serial_no}
                                        onChange={(e) => setToolForm(prev => ({ ...prev, serial_no: e.target.value }))}
                                        placeholder="e.g. MEG-515-9921"
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">TPI / Calibration Agency</label>
                                    <input
                                        type="text"
                                        value={toolForm.tpi_agency}
                                        onChange={(e) => setToolForm(prev => ({ ...prev, tpi_agency: e.target.value }))}
                                        placeholder="e.g. TUV SUD / Bureau Veritas"
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Certificate Number</label>
                                    <input
                                        type="text"
                                        value={toolForm.certificate_no}
                                        onChange={(e) => setToolForm(prev => ({ ...prev, certificate_no: e.target.value }))}
                                        placeholder="e.g. CAL/NTH/2026/8841"
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Calibration Date</label>
                                    <input
                                        type="date"
                                        value={toolForm.calibration_date}
                                        onChange={(e) => setToolForm(prev => ({ ...prev, calibration_date: e.target.value }))}
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Valid Till (Expiry) *</label>
                                    <input
                                        type="date"
                                        value={toolForm.valid_till}
                                        onChange={(e) => setToolForm(prev => ({ ...prev, valid_till: e.target.value }))}
                                        required
                                        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-bold text-indigo-700"
                                    />
                                </div>
                            </div>

                            {/* Certificate File Upload */}
                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">Upload Calibration / TPI Certificate (PDF/Image)</label>
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => setCertificateFile(e.target.files[0] || null)}
                                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowToolModal(false)}
                                    className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploadingCert}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer disabled:opacity-50"
                                >
                                    {uploadingCert ? 'Uploading...' : 'Save & Register Tool'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DPRManagementHub;

