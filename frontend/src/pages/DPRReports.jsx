import React, { useState, useEffect } from 'react';
import {
    ClipboardList, Plus, Search, Filter, Download,
    Calendar, Building2, Users, AlertTriangle, CheckCircle2,
    Clock, ArrowRight, FileText, ChevronRight, Eye, Trash2,
    X, Camera, Briefcase, DollarSign, Layers, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import dprService from '../services/dprService';
import siteService from '../services/siteService';

const DPRReports = () => {
    const [dprs, setDprs] = useState([]);
    const [sites, setSites] = useState([]);
    const [selectedSiteId, setSelectedSiteId] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    // Modal state for creating new DPR
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedDprForView, setSelectedDprForView] = useState(null);

    // Form state for new DPR
    const [formData, setFormData] = useState({
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

    useEffect(() => {
        loadData();
    }, [selectedSiteId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [dprRes, sitesRes] = await Promise.all([
                dprService.getAllDprs({ site_id: selectedSiteId }),
                siteService.getAllSites()
            ]);
            const dprList = dprRes.data?.data || dprRes.data || [];
            setDprs(dprList);
            if (dprList.length > 0 && !selectedDprForView) {
                setSelectedDprForView(dprList[0]);
            }
            setSites(sitesRes.data?.data || sitesRes.data || []);
        } catch (err) {
            console.error('Failed to load DPRs:', err);
            toast.error('Failed to load DPR records');
        } finally {
            setLoading(false);
        }
    };

    const handleSiteSelectChange = (siteId) => {
        const s = sites.find(x => String(x.site_id) === String(siteId));
        setFormData(prev => ({
            ...prev,
            site_id: siteId,
            client_name: s?.principal_employer_name || s?.client_name || prev.client_name,
            report_no: s?.site_code ? `${s.site_code}/${String(dprs.length + 1).padStart(3, '0')}` : prev.report_no
        }));
    };

    const handleAddActivity = () => {
        setFormData(prev => ({
            ...prev,
            today_activities: [
                ...prev.today_activities,
                { id: prev.today_activities.length + 1, description: '', status: 'complete', dependencies: 'NKD', photo_ref: '' }
            ]
        }));
    };

    const handleAddNextDayActivity = () => {
        setFormData(prev => ({
            ...prev,
            next_day_activities: [
                ...prev.next_day_activities,
                { id: prev.next_day_activities.length + 1, description: '', dependencies: '' }
            ]
        }));
    };

    const handleAddShowstopper = () => {
        setFormData(prev => ({
            ...prev,
            show_stoppers: [
                ...prev.show_stoppers,
                { id: prev.show_stoppers.length + 1, concern_area: '', intimation_date: new Date().toISOString().split('T')[0] }
            ]
        }));
    };

    const handleManpowerChange = (index, field, value) => {
        const updated = [...formData.manpower_data];
        updated[index][field] = parseInt(value) || 0;
        setFormData(prev => ({ ...prev, manpower_data: updated }));
    };

    const handleCreateDprSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await dprService.createDpr(formData);
            toast.success(`DPR ${res.data?.data?.report_no || 'Record'} created successfully!`);
            setShowCreateModal(false);
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit DPR');
        }
    };

    const handleDeleteDpr = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this Daily Progress Report?')) return;
        try {
            await dprService.deleteDpr(id);
            toast.success('DPR deleted successfully');
            if (selectedDprForView?.dpr_id === id) {
                setSelectedDprForView(null);
            }
            loadData();
        } catch (err) {
            toast.error('Failed to delete DPR');
        }
    };

    const filteredDprs = dprs.filter(d => {
        const matchesSearch = !searchTerm ||
            d.report_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.site_name?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    // Summary calculations
    const activeDpr = selectedDprForView || dprs[0];
    const totalManpowerToday = (activeDpr?.manpower_data || []).reduce((sum, m) => sum + (parseInt(m.available) || 0), 0);
    const totalRequiredToday = (activeDpr?.manpower_data || []).reduce((sum, m) => sum + (parseInt(m.required) || 0), 0);
    const todayCompletedTasks = (activeDpr?.today_activities || []).filter(a => a.status === 'complete').length;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16 pt-1 sm:pt-2">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                            <ClipboardList size={18} />
                        </span>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            Daily Site Progress Reports (DPR)
                        </h1>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Track multi-project site execution, manpower deployment, next-day work plan & commercial progress
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-xs sm:text-sm font-bold text-white shadow-md hover:shadow-primary-500/20 transition-all active:scale-95"
                    >
                        <Plus size={16} /> New Daily Report
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                    <div className="relative w-full">
                        <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search report no, client, site name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                        <Building2 size={14} /> Filter Project:
                    </span>
                    <select
                        value={selectedSiteId}
                        onChange={(e) => setSelectedSiteId(e.target.value)}
                        className="text-xs font-semibold border border-slate-300 rounded-xl px-3 py-1.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    >
                        <option value="ALL">All Projects & Sites ({sites.length})</option>
                        {sites.map(s => (
                            <option key={s.site_id} value={s.site_id}>
                                {s.site_name} ({s.site_code || s.city || 'Site'})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            {activeDpr && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Manpower</span>
                            <span className="p-2 rounded-xl bg-blue-50 text-blue-600"><Users size={16} /></span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-slate-900">{totalManpowerToday}</span>
                            <span className="text-xs text-slate-400 font-medium">/ {totalRequiredToday} Required</span>
                        </div>
                        <p className="text-[11px] text-emerald-600 font-semibold mt-1">✓ Active on site today</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Work Status</span>
                            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={16} /></span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-emerald-700">{todayCompletedTasks}</span>
                            <span className="text-xs text-slate-400 font-medium">/ {activeDpr.today_activities?.length || 0} Tasks Done</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-1">Daily progress on schedule</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">PO Value</span>
                            <span className="p-2 rounded-xl bg-purple-50 text-purple-600"><DollarSign size={16} /></span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-xl sm:text-2xl font-black text-slate-900">
                                ₹{parseFloat(activeDpr.po_value || 0).toLocaleString('en-IN')}
                            </span>
                        </div>
                        <p className="text-[11px] text-purple-700 font-semibold mt-1">PO: {activeDpr.po_number || 'N/A'}</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Showstoppers</span>
                            <span className="p-2 rounded-xl bg-amber-50 text-amber-600"><AlertTriangle size={16} /></span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-amber-700">{activeDpr.show_stoppers?.length || 0}</span>
                            <span className="text-xs text-slate-400 font-medium">Flagged Issues</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-1">
                            {activeDpr.show_stoppers?.length > 0 ? 'Action required with client' : '✓ No site blockers'}
                        </p>
                    </div>
                </div>
            )}

            {/* Main Content Layout: Left Sidebar List + Right DPR Sheet View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: DPR List / Selector */}
                <div className="lg:col-span-4 space-y-3">
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                Project DPR History ({filteredDprs.length})
                            </h3>
                            <span className="text-[11px] text-primary-600 font-semibold">Latest first</span>
                        </div>

                        {loading ? (
                            <div className="text-center py-8 text-xs text-slate-400">Loading DPR reports...</div>
                        ) : filteredDprs.length === 0 ? (
                            <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                No DPR records found. Click "New Daily Report" to create one.
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin pr-1">
                                {filteredDprs.map(d => {
                                    const isSelected = selectedDprForView?.dpr_id === d.dpr_id;
                                    return (
                                        <div
                                            key={d.dpr_id}
                                            onClick={() => setSelectedDprForView(d)}
                                            className={`p-3.5 rounded-xl border transition-all cursor-pointer text-xs ${
                                                isSelected
                                                    ? 'bg-primary-50/80 border-primary-300 ring-2 ring-primary-100'
                                                    : 'bg-white hover:bg-slate-50 border-slate-200'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <span className="font-mono font-bold text-primary-700 text-xs">
                                                        {d.report_no}
                                                    </span>
                                                    <h4 className="font-bold text-slate-900 mt-0.5 truncate max-w-[200px]">
                                                        {d.site_name || 'Site Project'}
                                                    </h4>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                                        Client: <span className="font-semibold text-slate-700">{d.client_name || 'Client'}</span>
                                                    </p>
                                                </div>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                                                    {d.report_date ? new Date(d.report_date).toLocaleDateString('en-IN') : 'N/A'}
                                                </span>
                                            </div>

                                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                                <span>Manpower: <b className="text-slate-800">{(d.manpower_data || []).reduce((s, m) => s + (parseInt(m.available) || 0), 0)}</b> on site</span>
                                                <button
                                                    onClick={(e) => handleDeleteDpr(d.dpr_id, e)}
                                                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                                    title="Delete DPR"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Full DPR Official Sheet View */}
                <div className="lg:col-span-8">
                    {activeDpr ? (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            {/* Sheet Banner Header */}
                            <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-primary-950 text-white flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-primary-300">
                                            Daily Site Progress Report
                                        </span>
                                        <span className="text-[10px] bg-primary-500/30 text-primary-200 px-2 py-0.2 rounded-full font-mono">
                                            Official Format
                                        </span>
                                    </div>
                                    <h2 className="text-lg sm:text-xl font-bold mt-1">
                                        {activeDpr.site_name || 'Site Project'} - {activeDpr.contractor_name || 'NKD POWER SOLUTIONS PVT LTD'}
                                    </h2>
                                    <p className="text-xs text-slate-300 mt-0.5">
                                        Date: <span className="font-semibold text-white">{activeDpr.report_date ? new Date(activeDpr.report_date).toLocaleDateString('en-IN') : 'N/A'}</span>
                                        {' '}• Report No: <span className="font-mono font-bold text-primary-300">{activeDpr.report_no}</span>
                                    </p>
                                </div>

                                <a
                                    href={dprService.getPdfUrl(activeDpr.dpr_id)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold shadow-xs transition-transform active:scale-95 shrink-0"
                                >
                                    <Download size={14} /> Download Signed PDF
                                </a>
                            </div>

                            {/* Commercial & Contract Header Box */}
                            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div>
                                    <span className="text-slate-400 font-semibold block text-[11px]">End Client Name:</span>
                                    <span className="font-bold text-slate-900 text-sm">{activeDpr.client_name || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block text-[11px]">PO Number & Date:</span>
                                    <span className="font-bold text-slate-800 font-mono">{activeDpr.po_number || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block text-[11px]">PO Value in INR:</span>
                                    <span className="font-bold text-emerald-700 text-sm">
                                        ₹{parseFloat(activeDpr.po_value || 0).toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block text-[11px]">Timeline / Duration:</span>
                                    <span className="font-bold text-slate-800">
                                        {activeDpr.start_date || 'N/A'} to {activeDpr.completion_date || 'N/A'}
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 sm:p-6 space-y-6">
                                {/* SECTION 1: TODAY'S ACTIVITY STATUS */}
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                            Today Activity Status
                                        </h3>
                                        <span className="text-[11px] font-semibold text-slate-400">
                                            {activeDpr.today_activities?.length || 0} Items
                                        </span>
                                    </div>

                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                                <tr>
                                                    <th className="px-3.5 py-2.5 w-12 text-center">S.No</th>
                                                    <th className="px-3.5 py-2.5">Planned Work Activity</th>
                                                    <th className="px-3.5 py-2.5 w-28">Status</th>
                                                    <th className="px-3.5 py-2.5 w-28">Dependencies</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {(activeDpr.today_activities || []).map((act, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/60">
                                                        <td className="px-3.5 py-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                                                        <td className="px-3.5 py-2.5 font-medium text-slate-800">{act.description}</td>
                                                        <td className="px-3.5 py-2.5">
                                                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                act.status === 'complete' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                            }`}>
                                                                {act.status === 'complete' ? '✓ Complete' : 'In Progress'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3.5 py-2.5 text-slate-600 font-medium">{act.dependencies || 'NKD'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* SECTION 2: ACTIVITY PLANNED FOR NEXT DAY */}
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                                            Activity Planned for Next Day
                                        </h3>
                                    </div>

                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                                <tr>
                                                    <th className="px-3.5 py-2.5 w-12 text-center">S.No</th>
                                                    <th className="px-3.5 py-2.5">Planned Work Description</th>
                                                    <th className="px-3.5 py-2.5 w-32">Dependencies</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {(activeDpr.next_day_activities || []).map((act, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/60">
                                                        <td className="px-3.5 py-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                                                        <td className="px-3.5 py-2.5 font-medium text-slate-800">{act.description}</td>
                                                        <td className="px-3.5 py-2.5 text-slate-500">{act.dependencies || 'Clearance OK'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* SECTION 3: MANPOWER DEPLOYMENT TABLE */}
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                            Daily Progress for Manpower (Type & Count)
                                        </h3>
                                        <span className="text-xs font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-lg border border-primary-200">
                                            Total Engaged: {totalManpowerToday} / {totalRequiredToday}
                                        </span>
                                    </div>

                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 p-3.5 bg-slate-50/70">
                                            {(activeDpr.manpower_data || []).map((mp, idx) => (
                                                <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
                                                    <div className="text-[11px] text-slate-500 font-semibold truncate">{mp.trade}</div>
                                                    <div className="mt-1 flex items-baseline justify-between">
                                                        <span className="text-base font-black text-slate-900">{mp.available || 0}</span>
                                                        <span className="text-[10px] text-slate-400">Req: {mp.required || 0}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 4: SHOW STOPPERS / CONCERN AREAS */}
                                {(activeDpr.show_stoppers || []).length > 0 && (
                                    <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200">
                                        <h3 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <AlertTriangle size={15} /> Show Stoppers / Bottlenecks
                                        </h3>
                                        <div className="space-y-1.5">
                                            {activeDpr.show_stoppers.map((st, idx) => (
                                                <div key={idx} className="flex items-start justify-between text-xs text-rose-900 bg-white p-2.5 rounded-lg border border-rose-100">
                                                    <p className="font-semibold">{idx + 1}. {st.concern_area}</p>
                                                    <span className="text-[10px] text-rose-600 font-mono shrink-0 ml-2">
                                                        Intimated: {st.intimation_date || 'N/A'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                            Select a Daily Progress Report to view its full report sheet.
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL: CREATE NEW DAILY PROGRESS REPORT */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4 p-0 bg-slate-900/60 backdrop-blur-xs overflow-hidden">
                    <div className="flex flex-col bg-white w-full max-w-4xl sm:rounded-2xl rounded-none shadow-2xl h-full sm:h-[90vh] overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 sm:px-6 py-3.5 shrink-0">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">New Daily Progress Report (DPR)</h2>
                                <p className="text-xs text-slate-500">Record site daily progress, manpower and next-day planning</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleCreateDprSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                            {/* Project & Commercial Details */}
                            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">1. Project & Client Info</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="input-label">Project / Site *</label>
                                        <select
                                            required
                                            value={formData.site_id}
                                            onChange={(e) => handleSiteSelectChange(e.target.value)}
                                            className="input-field"
                                        >
                                            <option value="">Select Project Site...</option>
                                            {sites.map(s => (
                                                <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="input-label">Report Date *</label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.report_date}
                                            onChange={(e) => setFormData({ ...formData, report_date: e.target.value })}
                                            className="input-field"
                                        />
                                    </div>
                                    <div>
                                        <label className="input-label">Client Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. LUMINA"
                                            value={formData.client_name}
                                            onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                                            className="input-field"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="input-label">PO Number</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 600190"
                                            value={formData.po_number}
                                            onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                                            className="input-field"
                                        />
                                    </div>
                                    <div>
                                        <label className="input-label">PO Value (INR)</label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 48374200"
                                            value={formData.po_value}
                                            onChange={(e) => setFormData({ ...formData, po_value: e.target.value })}
                                            className="input-field"
                                        />
                                    </div>
                                    <div>
                                        <label className="input-label">Report Number (Auto / Custom)</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. GTPL LUMINA/125"
                                            value={formData.report_no}
                                            onChange={(e) => setFormData({ ...formData, report_no: e.target.value })}
                                            className="input-field font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Today Activities */}
                            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">2. Today's Activity Status</h3>
                                    <button type="button" onClick={handleAddActivity} className="text-xs font-bold text-primary-600 hover:text-primary-800">
                                        + Add Task
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {formData.today_activities.map((act, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <span className="w-5 text-center text-xs font-bold text-slate-400">{idx + 1}</span>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Roxtec material unloading and shifting work"
                                                value={act.description}
                                                onChange={(e) => {
                                                    const updated = [...formData.today_activities];
                                                    updated[idx].description = e.target.value;
                                                    setFormData({ ...formData, today_activities: updated });
                                                }}
                                                className="input-field flex-1 text-xs"
                                            />
                                            <select
                                                value={act.status}
                                                onChange={(e) => {
                                                    const updated = [...formData.today_activities];
                                                    updated[idx].status = e.target.value;
                                                    setFormData({ ...formData, today_activities: updated });
                                                }}
                                                className="input-field w-28 text-xs"
                                            >
                                                <option value="complete">Complete</option>
                                                <option value="in_progress">In Progress</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Next Day Planning */}
                            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">3. Planned for Next Day</h3>
                                    <button type="button" onClick={handleAddNextDayActivity} className="text-xs font-bold text-primary-600 hover:text-primary-800">
                                        + Add Next Day Plan
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {formData.next_day_activities.map((act, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <span className="w-5 text-center text-xs font-bold text-slate-400">{idx + 1}</span>
                                            <input
                                                type="text"
                                                placeholder="e.g. 11 kV trench core cutting and cable pulling"
                                                value={act.description}
                                                onChange={(e) => {
                                                    const updated = [...formData.next_day_activities];
                                                    updated[idx].description = e.target.value;
                                                    setFormData({ ...formData, next_day_activities: updated });
                                                }}
                                                className="input-field flex-1 text-xs"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Manpower Deployment Inputs */}
                            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">4. Manpower (Required vs Available On-Site)</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {formData.manpower_data.map((mp, idx) => (
                                        <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1.5">
                                            <span className="font-bold text-slate-800 block truncate">{mp.trade}</span>
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="Avail"
                                                    value={mp.available}
                                                    onChange={(e) => handleManpowerChange(idx, 'available', e.target.value)}
                                                    className="w-full text-xs font-bold text-center border border-slate-300 rounded px-1.5 py-1 bg-white"
                                                    title="Available Staff on site"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Showstoppers */}
                            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">5. Show Stoppers / Issues (If Any)</h3>
                                    <button type="button" onClick={handleAddShowstopper} className="text-xs font-bold text-rose-600 hover:text-rose-800">
                                        + Add Blocker
                                    </button>
                                </div>
                                {formData.show_stoppers.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No showstoppers reported for this date.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {formData.show_stoppers.map((st, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Concern area / problem..."
                                                    value={st.concern_area}
                                                    onChange={(e) => {
                                                        const updated = [...formData.show_stoppers];
                                                        updated[idx].concern_area = e.target.value;
                                                        setFormData({ ...formData, show_stoppers: updated });
                                                    }}
                                                    className="input-field flex-1 text-xs"
                                                />
                                                <input
                                                    type="date"
                                                    value={st.intimation_date}
                                                    onChange={(e) => {
                                                        const updated = [...formData.show_stoppers];
                                                        updated[idx].intimation_date = e.target.value;
                                                        setFormData({ ...formData, show_stoppers: updated });
                                                    }}
                                                    className="input-field w-32 text-xs"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="border-t border-slate-200 pt-4 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-xs font-bold text-white shadow-xs"
                                >
                                    Save & Submit DPR
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DPRReports;
