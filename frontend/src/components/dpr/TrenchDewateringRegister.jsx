import React, { useState, useEffect, useCallback } from 'react';
import {
    Droplets, Plus, Download, Search, Filter,
    Calendar, Users, Wrench, Shield, CheckCircle2,
    RefreshCw, FileSpreadsheet, FileText, ArrowUpDown,
    Edit2, Trash2, X, AlertCircle, Building2, ChevronRight, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import trenchDewateringService from '../../services/trenchDewateringService';

const TrenchDewateringRegister = () => {
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState({ summary: {}, monthlyBreakdown: [] });
    const [loading, setLoading] = useState(true);

    // Filters
    const [selectedMonth, setSelectedMonth] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingLog, setEditingLog] = useState(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        log_date: new Date().toISOString().split('T')[0],
        work_description: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.',
        skilled_manpower: 1,
        unskilled_manpower: 2,
        pumps_count: 2,
        motor_pumps: 2,
        diesel_pumps: 0,
        remarks: '2 MOTOR',
        status: 'VERIFIED'
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (selectedMonth !== 'ALL') params.month = selectedMonth;
            if (searchTerm) params.search = searchTerm;
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const [logsRes, statsRes] = await Promise.all([
                trenchDewateringService.getLogs(params),
                trenchDewateringService.getStats({ month: selectedMonth !== 'ALL' ? selectedMonth : undefined })
            ]);

            setLogs(logsRes.data?.data || []);
            setStats(statsRes.data?.data || { summary: {}, monthlyBreakdown: [] });
        } catch (err) {
            console.error('Failed to load trench dewatering logs:', err);
            toast.error('Failed to load dewatering records');
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, searchTerm, startDate, endDate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenCreateModal = () => {
        setEditingLog(null);
        setFormData({
            log_date: new Date().toISOString().split('T')[0],
            work_description: '11 KV CABLE TRENCH OPENING DEWATERING AND  CLEANING WORK.',
            skilled_manpower: 1,
            unskilled_manpower: 2,
            pumps_count: 2,
            motor_pumps: 2,
            diesel_pumps: 0,
            remarks: '2 MOTOR',
            status: 'VERIFIED'
        });
        setShowModal(true);
    };

    const handleOpenEditModal = (log) => {
        setEditingLog(log);
        setFormData({
            log_date: log.log_date,
            work_description: log.work_description,
            skilled_manpower: log.skilled_manpower,
            unskilled_manpower: log.unskilled_manpower,
            pumps_count: log.pumps_count,
            motor_pumps: log.motor_pumps,
            diesel_pumps: log.diesel_pumps,
            remarks: log.remarks || '',
            status: log.status || 'VERIFIED'
        });
        setShowModal(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingLog) {
                await trenchDewateringService.updateLog(editingLog.log_id, formData);
                toast.success('Dewatering log updated successfully');
            } else {
                await trenchDewateringService.createLog(formData);
                toast.success('New dewatering log recorded successfully');
            }
            setShowModal(false);
            loadData();
        } catch (err) {
            console.error('Failed to save log:', err);
            toast.error('Failed to save log entry');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this dewatering entry?')) return;
        try {
            await trenchDewateringService.deleteLog(id);
            toast.success('Entry deleted');
            loadData();
        } catch (err) {
            toast.error('Failed to delete entry');
        }
    };

    const handleExportPdf = () => {
        const params = {};
        if (selectedMonth !== 'ALL') params.month = selectedMonth;
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        const url = trenchDewateringService.getExportPdfUrl(params);
        window.open(url, '_blank');
    };

    const handleExportCsv = () => {
        if (logs.length === 0) {
            toast.error('No records to export');
            return;
        }

        const headers = ['Sr No', 'Date', 'Description of Work', 'Skilled Manpower', 'Unskilled Manpower', 'Total Manpower', 'Dewatering Pumps', 'Motor Pumps', 'Diesel Pumps', 'Equipment Remarks', 'Status'];
        const csvRows = [headers.join(',')];

        logs.forEach((l, idx) => {
            const row = [
                idx + 1,
                `"${l.log_date_display || l.log_date}"`,
                `"${(l.work_description || '').replace(/"/g, '""')}"`,
                l.skilled_manpower,
                l.unskilled_manpower,
                l.total_manpower,
                l.pumps_count,
                l.motor_pumps,
                l.diesel_pumps,
                `"${(l.remarks || '').replace(/"/g, '""')}"`,
                l.status
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `11KV_Trench_Dewatering_${selectedMonth !== 'ALL' ? 'Month_' + selectedMonth : 'Full'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('CSV downloaded successfully');
    };

    const s = stats.summary || {};

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Box */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-primary-950 rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-primary-500/10 to-transparent pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="px-2.5 py-0.5 rounded-full bg-primary-500/20 border border-primary-400/40 text-primary-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <Droplets size={13} className="text-primary-400" /> Site Operations & Dewatering
                            </span>
                            <span className="text-slate-400 text-xs">•</span>
                            <span className="text-slate-300 text-xs font-medium">GTPL LUMINA Data Center (Airoli)</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
                            CLEANING & DEWATERING WORK OF 11KV TRENCH
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
                            Daily certified log of skilled & unskilled manpower, submersible electric motor pumps, and diesel dewatering engines for High-Voltage 11kV cable trenches.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={handleExportPdf}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-all btn-press shadow-xs backdrop-blur-xs"
                            title="Download Signed Client Verification Measurement PDF"
                        >
                            <Download size={15} />
                            <span>Client PDF Sheet</span>
                        </button>
                        <button
                            onClick={handleExportCsv}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white border border-emerald-400/30 text-xs font-bold transition-all btn-press shadow-xs"
                            title="Export CSV for Billing"
                        >
                            <FileSpreadsheet size={15} />
                            <span>Export CSV</span>
                        </button>
                        <button
                            onClick={handleOpenCreateModal}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold transition-all btn-press shadow-md shadow-primary-500/20"
                        >
                            <Plus size={16} />
                            <span>Add Daily Log</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs card-hover-effect">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Calendar size={13} className="text-slate-400" /> Active Operating Days
                    </p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{s.total_records || logs.length}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">21 May 2026 – 15 Oct 2026</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs card-hover-effect">
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                        <Wrench size={13} className="text-emerald-500" /> Skilled Manpower
                    </p>
                    <p className="text-2xl font-black text-emerald-700 mt-1">{s.total_skilled || 0}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Pump operators / techs</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs card-hover-effect">
                    <p className="text-[11px] font-bold text-sky-600 uppercase tracking-wider flex items-center gap-1">
                        <Users size={13} className="text-sky-500" /> Unskilled Manpower
                    </p>
                    <p className="text-2xl font-black text-sky-700 mt-1">{s.total_unskilled || 0}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Trench cleaning helpers</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs card-hover-effect">
                    <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                        <Users size={13} className="text-indigo-500" /> Total Manpower
                    </p>
                    <p className="text-2xl font-black text-indigo-700 mt-1">{s.total_manpower || 0}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Combined mandays</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs card-hover-effect col-span-2 sm:col-span-1">
                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                        <Droplets size={13} className="text-amber-500" /> Total Pumps Run
                    </p>
                    <p className="text-2xl font-black text-amber-700 mt-1">{s.total_pumps || 0}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                        {s.total_motor_pumps || 0} Motor • {s.total_diesel_pumps || 0} Diesel
                    </p>
                </div>
            </div>

            {/* Month Filter Selector Pills */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 shrink-0">
                    Filter Month:
                </span>
                <button
                    onClick={() => setSelectedMonth('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 btn-press ${
                        selectedMonth === 'ALL'
                            ? 'bg-primary-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                >
                    All Months ({stats.summary?.total_records || 96})
                </button>

                {(stats.monthlyBreakdown || []).map((m) => (
                    <button
                        key={m.month_num}
                        onClick={() => setSelectedMonth(String(m.month_num))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 btn-press ${
                            String(selectedMonth) === String(m.month_num)
                                ? 'bg-primary-600 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                    >
                        {m.month_label} ({m.days_count} days • {m.pumps} pumps)
                    </button>
                ))}
            </div>

            {/* Secondary Search & Filter Bar */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search work description, remarks, motor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:bg-white"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors btn-press"
                        title="Reload Data"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <span className="text-xs font-semibold text-slate-500">
                        Showing <strong className="text-slate-800">{logs.length}</strong> daily logs
                    </span>
                </div>
            </div>

            {/* Mobile View: High Polish Responsive Cards */}
            <div className="block sm:hidden space-y-3">
                {loading ? (
                    <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-primary-500 border-t-transparent mb-2" />
                        <p className="text-xs">Loading dewatering records...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                        <Droplets size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700 text-sm">No dewatering logs found</p>
                    </div>
                ) : (
                    logs.map((log, idx) => (
                        <div key={log.log_id || idx} className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 text-xs font-bold font-mono">
                                        #{idx + 1} • {log.log_date_display || log.log_date}
                                    </span>
                                    <h4 className="font-bold text-slate-900 text-xs mt-1">
                                        11 KV CABLE TRENCH DEWATERING
                                    </h4>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    VERIFIED
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                                <div>
                                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Skilled</span>
                                    <span className="text-sm font-black text-slate-900">{log.skilled_manpower}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-sky-700 uppercase block">Unskilled</span>
                                    <span className="text-sm font-black text-slate-900">{log.unskilled_manpower}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-amber-700 uppercase block">Pumps</span>
                                    <span className="text-sm font-black text-amber-800">{log.pumps_count}</span>
                                </div>
                            </div>

                            {log.remarks && (
                                <div className="text-[11px] bg-slate-100/80 px-2.5 py-1.5 rounded-lg text-slate-700 font-medium">
                                    <strong>Equipment:</strong> {log.remarks}
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                                <button
                                    onClick={() => handleOpenEditModal(log)}
                                    className="p-1.5 text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg text-xs font-medium flex items-center gap-1"
                                >
                                    <Edit2 size={13} /> Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(log.log_id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-medium flex items-center gap-1"
                                >
                                    <Trash2 size={13} /> Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/90 text-slate-600 border-b border-slate-200 text-xs uppercase tracking-wider font-bold">
                            <tr>
                                <th className="px-4 py-3.5 text-center w-12">#</th>
                                <th className="px-4 py-3.5">Date</th>
                                <th className="px-4 py-3.5">Description of Work</th>
                                <th className="px-4 py-3.5 text-center">Skilled Manpower</th>
                                <th className="px-4 py-3.5 text-center">Unskilled Manpower</th>
                                <th className="px-4 py-3.5 text-center">Total Manpower</th>
                                <th className="px-4 py-3.5 text-center">Dewatering Pump</th>
                                <th className="px-4 py-3.5">Equipment / Remarks</th>
                                <th className="px-4 py-3.5 text-center">Status</th>
                                <th className="px-4 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="p-12 text-center text-slate-500">
                                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-primary-500 border-t-transparent mb-2" />
                                        <p className="text-xs">Loading dewatering records...</p>
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="p-12 text-center text-slate-400">
                                        No dewatering records found for the selected filter.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log, index) => (
                                    <tr key={log.log_id || index} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">
                                            {index + 1}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900 font-mono text-xs">
                                            {log.log_date_display || log.log_date}
                                        </td>
                                        <td className="px-4 py-3 text-slate-700 font-medium text-xs max-w-xs truncate" title={log.work_description}>
                                            {log.work_description}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                {log.skilled_manpower}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-bold text-xs bg-sky-50 text-sky-700 border border-sky-200">
                                                {log.unskilled_manpower}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-slate-800 font-mono text-xs">
                                            {log.total_manpower}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full font-bold text-xs bg-amber-50 text-amber-800 border border-amber-200">
                                                {log.pumps_count} Pump{log.pumps_count > 1 ? 's' : ''}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {log.remarks ? (
                                                <span className={`px-2 py-0.5 rounded font-semibold ${
                                                    log.remarks.includes('DIESEL') ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {log.remarks}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 italic">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                <CheckCircle2 size={10} /> VERIFIED
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleOpenEditModal(log)}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                                                    title="Edit Log"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(log.log_id)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                    title="Delete Log"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-scale-in">
                        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
                            <h3 className="text-base font-bold flex items-center gap-2">
                                <Droplets size={18} className="text-primary-400" />
                                {editingLog ? 'Edit Dewatering Log' : 'Add Daily Trench Dewatering Log'}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1 hover:bg-white/20 rounded-lg text-slate-300 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1">Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.log_date}
                                        onChange={(e) => setFormData({ ...formData, log_date: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1">Total Dewatering Pumps</label>
                                    <input
                                        type="number"
                                        min="0"
                                        required
                                        value={formData.pumps_count}
                                        onChange={(e) => setFormData({ ...formData, pumps_count: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1">Skilled Manpower</label>
                                    <input
                                        type="number"
                                        min="0"
                                        required
                                        value={formData.skilled_manpower}
                                        onChange={(e) => setFormData({ ...formData, skilled_manpower: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1">Unskilled Manpower</label>
                                    <input
                                        type="number"
                                        min="0"
                                        required
                                        value={formData.unskilled_manpower}
                                        onChange={(e) => setFormData({ ...formData, unskilled_manpower: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Work Description</label>
                                <textarea
                                    required
                                    rows="2"
                                    value={formData.work_description}
                                    onChange={(e) => setFormData({ ...formData, work_description: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Equipment / Remarks (e.g. 1 MOTOR, 2 DIESEL PUMP)</label>
                                <input
                                    type="text"
                                    value={formData.remarks}
                                    placeholder="e.g. 2 MOTOR, 1 DIESEL PUMP"
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-xs transition-all btn-press disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : (editingLog ? 'Update Entry' : 'Save Daily Entry')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrenchDewateringRegister;

