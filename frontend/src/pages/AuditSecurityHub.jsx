import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    ShieldCheck, RotateCcw, Trash2, Search, Filter, RefreshCw,
    Calendar, User, AlertTriangle, CheckCircle2, Clock, Eye,
    FileText, Layers, ShieldAlert, ArrowUpRight, Database, Download,
    Activity, Lock, Key, Server, Smartphone, Laptop
} from 'lucide-react';
import toast from 'react-hot-toast';
import auditRecycleService from '../services/auditRecycleService';
import { extractApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ACTION_COLORS = {
    CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    UPDATE: 'bg-sky-50 text-sky-700 border-sky-200',
    DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
    RESTORE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    LOGIN: 'bg-amber-50 text-amber-700 border-amber-200',
    EXPORT: 'bg-purple-50 text-purple-700 border-purple-200',
    DEFAULT: 'bg-slate-100 text-slate-700 border-slate-200'
};

const MODULE_OPTIONS = [
    { value: 'ALL', label: 'All Modules' },
    { value: 'EMPLOYEES', label: 'Employees Master' },
    { value: 'INVOICES', label: 'Client Invoices' },
    { value: 'ATTENDANCE', label: 'Attendance' },
    { value: 'LEAVES', label: 'Leaves' },
    { value: 'DPR', label: 'DPR Management' },
    { value: 'VENDORS', label: 'Vendors & PO' },
    { value: 'ASSETS', label: 'Assets & PPE' },
    { value: 'PROCUREMENT', label: 'Procurement' },
    { value: 'USERS', label: 'User Accounts' },
    { value: 'AUTH', label: 'Authentication / Logins' }
];

const ACTION_OPTIONS = [
    { value: 'ALL', label: 'All Actions' },
    { value: 'CREATE', label: 'Create' },
    { value: 'UPDATE', label: 'Update' },
    { value: 'DELETE', label: 'Delete' },
    { value: 'RESTORE', label: 'Restore' },
    { value: 'LOGIN', label: 'Login' }
];

const formatIstDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        return new Intl.DateTimeFormat('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'medium',
            timeZone: 'Asia/Kolkata'
        }).format(d);
    } catch (_) {
        return String(dateStr);
    }
};

const AuditSecurityHub = () => {
    const { user } = useAuth();
    const roleCode = (user?.roleCode || user?.role?.roleCode || (typeof user?.role === 'string' ? user.role : '') || '').toUpperCase();
    const isSuperAdmin = roleCode === 'SUPER_ADMIN';

    // Active View Tab: 'audit' | 'recycle' | 'policies'
    const [activeTab, setActiveTab] = useState('audit');

    // Audit State
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditStats, setAuditStats] = useState({});
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditPage, setAuditPage] = useState(1);
    const [auditPagination, setAuditPagination] = useState({ total: 0, totalPages: 1 });
    const [selectedModule, setSelectedModule] = useState('ALL');
    const [selectedAction, setSelectedAction] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPayloadLog, setSelectedPayloadLog] = useState(null);

    // Recycle Bin State
    const [binItems, setBinItems] = useState([]);
    const [binStats, setBinStats] = useState({});
    const [binLoading, setBinLoading] = useState(false);
    const [binPage, setBinPage] = useState(1);
    const [binPagination, setBinPagination] = useState({ total: 0, totalPages: 1 });
    const [binModuleFilter, setBinModuleFilter] = useState('ALL');
    const [binSearch, setBinSearch] = useState('');
    const [actionInProgress, setActionInProgress] = useState({});

    // Load Audit Logs
    const loadAuditLogs = useCallback(async () => {
        setAuditLoading(true);
        try {
            const res = await auditRecycleService.getAuditLogs({
                page: auditPage,
                limit: 25,
                module: selectedModule,
                action: selectedAction,
                search: searchTerm
            });
            if (res.data?.success) {
                setAuditLogs(res.data.data || []);
                setAuditPagination(res.data.pagination || { total: 0, totalPages: 1 });
            }
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to load audit logs'));
        } finally {
            setAuditLoading(false);
        }
    }, [auditPage, selectedModule, selectedAction, searchTerm]);

    // Load Audit Stats
    const loadAuditStats = useCallback(async () => {
        try {
            const res = await auditRecycleService.getAuditStats();
            if (res.data?.success) {
                setAuditStats(res.data.data || {});
            }
        } catch (_) {}
    }, []);

    // Load Recycle Bin
    const loadRecycleBin = useCallback(async () => {
        setBinLoading(true);
        try {
            const res = await auditRecycleService.getRecycleBinItems({
                page: binPage,
                limit: 20,
                module: binModuleFilter,
                search: binSearch
            });
            if (res.data?.success) {
                setBinItems(res.data.data || []);
                setBinPagination(res.data.pagination || { total: 0, totalPages: 1 });
            }
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to load recycle bin'));
        } finally {
            setBinLoading(false);
        }
    }, [binPage, binModuleFilter, binSearch]);

    // Load Bin Stats
    const loadBinStats = useCallback(async () => {
        try {
            const res = await auditRecycleService.getRecycleBinStats();
            if (res.data?.success) {
                setBinStats(res.data.data || {});
            }
        } catch (_) {}
    }, []);

    useEffect(() => {
        loadAuditLogs();
        loadAuditStats();
    }, [loadAuditLogs, loadAuditStats]);

    useEffect(() => {
        if (activeTab === 'recycle') {
            loadRecycleBin();
            loadBinStats();
        }
    }, [activeTab, loadRecycleBin, loadBinStats]);

    // 1-Click Restore Action
    const handleRestoreItem = async (item) => {
        if (!window.confirm(`Restore "${item.record_title}" back to active status?`)) return;
        setActionInProgress(prev => ({ ...prev, [item.bin_id]: true }));
        try {
            const res = await auditRecycleService.restoreItem(item.bin_id);
            if (res.data?.success) {
                toast.success(res.data.message || 'Item restored successfully!');
                loadRecycleBin();
                loadBinStats();
                loadAuditLogs();
                loadAuditStats();
            }
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to restore item'));
        } finally {
            setActionInProgress(prev => ({ ...prev, [item.bin_id]: false }));
        }
    };

    // Permanent Delete Action (Super Admin Only)
    const handlePermanentDelete = async (item) => {
        if (!window.confirm(`⚠️ WARNING: Permanently delete "${item.record_title}"? This CANNOT be undone!`)) return;
        setActionInProgress(prev => ({ ...prev, [item.bin_id]: true }));
        try {
            const res = await auditRecycleService.permanentDeleteItem(item.bin_id);
            if (res.data?.success) {
                toast.success('Item permanently erased from storage.');
                loadRecycleBin();
                loadBinStats();
                loadAuditLogs();
            }
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to delete item permanently'));
        } finally {
            setActionInProgress(prev => ({ ...prev, [item.bin_id]: false }));
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Header Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
                <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 mb-3">
                            <ShieldCheck size={14} className="text-emerald-400" />
                            <span>Enterprise Security & Audit Engine Active</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                            Security Audit & Recycle Bin Hub
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                            Complete forensic activity trail ("Kisne kya kiya"), automated change logs, and 1-Click Recycle Bin restore center for accidental deletions.
                        </p>
                    </div>

                    {/* Quick Stats Badges */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15 text-center min-w-[120px]">
                            <div className="text-2xl font-black text-white">{auditStats.todayCount ?? 0}</div>
                            <div className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">Today's Actions</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15 text-center min-w-[120px]">
                            <div className="text-2xl font-black text-rose-400">{binStats.activeTrashCount ?? 0}</div>
                            <div className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">In Recycle Bin</div>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10 flex-wrap">
                    <button
                        onClick={() => setActiveTab('audit')}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'audit'
                                ? 'bg-white text-slate-900 shadow-md'
                                : 'text-slate-300 hover:bg-white/10'
                        }`}
                    >
                        <Activity size={15} />
                        <span>Live Activity Trail (Audit Logs)</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('recycle')}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'recycle'
                                ? 'bg-white text-slate-900 shadow-md'
                                : 'text-slate-300 hover:bg-white/10'
                        }`}
                    >
                        <RotateCcw size={15} />
                        <span>Recycle Bin & 1-Click Restore</span>
                        {(binStats.activeTrashCount > 0) && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-black">
                                {binStats.activeTrashCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('policies')}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'policies'
                                ? 'bg-white text-slate-900 shadow-md'
                                : 'text-slate-300 hover:bg-white/10'
                        }`}
                    >
                        <Lock size={15} />
                        <span>Governance & Security Checklist</span>
                    </button>
                </div>
            </div>

            {/* TAB 1: AUDIT TRAIL */}
            {activeTab === 'audit' && (
                <div className="space-y-4">
                    {/* Filter Bar */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by user, email, record title, or code..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <select
                                value={selectedModule}
                                onChange={(e) => { setSelectedModule(e.target.value); setAuditPage(1); }}
                                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none"
                            >
                                {MODULE_OPTIONS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>

                            <select
                                value={selectedAction}
                                onChange={(e) => { setSelectedAction(e.target.value); setAuditPage(1); }}
                                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none"
                            >
                                {ACTION_OPTIONS.map(a => (
                                    <option key={a.value} value={a.value}>{a.label}</option>
                                ))}
                            </select>

                            <button
                                onClick={() => { loadAuditLogs(); loadAuditStats(); }}
                                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                title="Refresh"
                            >
                                <RefreshCw size={15} className={auditLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {/* Audit Logs Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-600">
                                <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    <tr>
                                        <th className="py-3 px-4">User / Operator</th>
                                        <th className="py-3 px-4">Action</th>
                                        <th className="py-3 px-4">Module</th>
                                        <th className="py-3 px-4">Record / Target</th>
                                        <th className="py-3 px-4">Timestamp (IST)</th>
                                        <th className="py-3 px-4">IP / Device</th>
                                        <th className="py-3 px-4 text-right">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {auditLoading ? (
                                        <tr>
                                            <td colSpan="7" className="py-12 text-center text-slate-400">
                                                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-primary-500" />
                                                Loading audit trail...
                                            </td>
                                        </tr>
                                    ) : auditLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="py-12 text-center text-slate-400">
                                                <ShieldCheck size={32} className="mx-auto mb-2 text-slate-300" />
                                                No activity records found matching filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        auditLogs.map((log) => {
                                            const actionClass = ACTION_COLORS[log.action] || ACTION_COLORS.DEFAULT;
                                            return (
                                                <tr key={log.log_id} className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                                                {log.user_name?.[0] || 'U'}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-bold text-slate-800 truncate">{log.user_name || 'System'}</div>
                                                                <div className="text-[10px] text-slate-400 truncate">{log.user_email || log.role_code}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${actionClass}`}>
                                                            {log.action}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                                            {log.module}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="font-medium text-slate-800 truncate max-w-xs" title={log.record_title || log.record_id}>
                                                            {log.record_title || log.record_id || '-'}
                                                        </div>
                                                        {log.record_id && log.record_title && (
                                                            <div className="text-[10px] font-mono text-slate-400">ID: {log.record_id}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-600">
                                                        {formatIstDateTime(log.created_at)}
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                                                        {log.ip_address || '127.0.0.1'}
                                                    </td>
                                                    <td className="py-3 px-4 text-right whitespace-nowrap">
                                                        <button
                                                            onClick={() => setSelectedPayloadLog(log)}
                                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-600 hover:text-primary-800 hover:bg-primary-50 px-2 py-1 rounded-md transition-colors"
                                                        >
                                                            <Eye size={13} /> View JSON
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                            <div>
                                Showing {auditLogs.length} of {auditPagination.total} activities
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                                    disabled={auditPage <= 1}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-50"
                                >
                                    Previous
                                </button>
                                <span className="font-bold text-slate-700">
                                    Page {auditPage} of {auditPagination.totalPages || 1}
                                </span>
                                <button
                                    onClick={() => setAuditPage(p => Math.min(auditPagination.totalPages, p + 1))}
                                    disabled={auditPage >= auditPagination.totalPages}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold disabled:opacity-40 hover:bg-slate-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: RECYCLE BIN & 1-CLICK RESTORE */}
            {activeTab === 'recycle' && (
                <div className="space-y-4">
                    {/* Notice Banner */}
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
                        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold">Zero Data Loss Protection (Recycle Bin Active):</span>
                            <p className="mt-0.5 text-amber-800">
                                When any employee, client invoice, vendor, asset, or DPR is deleted by any staff, it is safely quarantined here. Click <strong>"Restore"</strong> to bring any record immediately back to live operations with 100% of its data intact.
                            </p>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                        <div className="relative flex-1 min-w-[260px]">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search deleted items..."
                                value={binSearch}
                                onChange={(e) => setBinSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <select
                                value={binModuleFilter}
                                onChange={(e) => { setBinModuleFilter(e.target.value); setBinPage(1); }}
                                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none"
                            >
                                <option value="ALL">All Modules</option>
                                <option value="EMPLOYEES">Employees</option>
                                <option value="INVOICES">Invoices</option>
                                <option value="VENDORS">Vendors</option>
                                <option value="ASSETS">Assets</option>
                                <option value="DPR">DPR Reports</option>
                                <option value="PROCUREMENT">Procurement</option>
                                <option value="SITES">Sites</option>
                            </select>

                            <button
                                onClick={() => { loadRecycleBin(); loadBinStats(); }}
                                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                title="Refresh"
                            >
                                <RefreshCw size={15} className={binLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {/* Recycle Bin Grid / Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {binLoading ? (
                            <div className="col-span-full py-12 text-center text-slate-400">
                                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-primary-500" />
                                Checking recycle bin...
                            </div>
                        ) : binItems.length === 0 ? (
                            <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                                <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-500" />
                                <div className="font-bold text-slate-700 text-sm">Recycle Bin is Empty</div>
                                <p className="text-xs text-slate-400 mt-0.5">No deleted items are waiting for restoration.</p>
                            </div>
                        ) : (
                            binItems.map((item) => (
                                <div key={item.bin_id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
                                                {item.module}
                                            </span>
                                            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                                                <Clock size={12} />
                                                {formatIstDateTime(item.deleted_at)}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-sm mb-1 leading-snug">
                                            {item.record_title}
                                        </h3>
                                        <div className="text-xs text-slate-500 space-y-0.5 mt-2">
                                            <div className="flex items-center gap-1.5">
                                                <User size={13} className="text-slate-400" />
                                                <span>Deleted by: <strong className="text-slate-700">{item.deleted_by_name || 'System Admin'}</strong></span>
                                            </div>
                                            {item.deleted_by_email && (
                                                <div className="text-[11px] text-slate-400 pl-5">{item.deleted_by_email}</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-between gap-2 mt-5 pt-3 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => handleRestoreItem(item)}
                                            disabled={actionInProgress[item.bin_id]}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                        >
                                            <RotateCcw size={14} className={actionInProgress[item.bin_id] ? 'animate-spin' : ''} />
                                            <span>Restore to Active</span>
                                        </button>

                                        {isSuperAdmin && (
                                            <button
                                                type="button"
                                                onClick={() => handlePermanentDelete(item)}
                                                disabled={actionInProgress[item.bin_id]}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs transition-colors cursor-pointer"
                                                title="Permanently erase from disk"
                                            >
                                                <Trash2 size={13} />
                                                <span>Wipe</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: GOVERNANCE & SECURITY POLICIES */}
            {activeTab === 'policies' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                                <Lock size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Maker-Checker & Dual Authorization</h3>
                                <p className="text-xs text-slate-500">Critical workflow approval gates</p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Ensures sensitive operations (e.g. employee salary restructuring, client invoice deletion, and high-value procurement) require Super Admin review before hard commits.
                        </p>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
                            <span>Policy Status</span>
                            <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[11px]">Enforced via RBAC</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <Server size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Automated Daily Cloud Backups</h3>
                                <p className="text-xs text-slate-500">PostgreSQL data disaster recovery</p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Daily scheduled database snapshots preserve all historical attendance, daily progress reports, statutory Form XII/XIII registers, and employee full-and-final settlements.
                        </p>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
                            <span>Backup Routine</span>
                            <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[11px]">Hostinger Daily Snapshot Active</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <Smartphone size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">GPS Geo-Fencing & Site Shift Locks</h3>
                                <p className="text-xs text-slate-500">Site presence verification</p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Field engineers and labour punch-ins enforce GPS radius checks against site latitude and longitude, preventing proxy attendance and remote punch-ins.
                        </p>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
                            <span>Mobile Security</span>
                            <span className="text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full text-[11px]">GPS Coordinate Match Active</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                <Key size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Session Security & IP Pinning</h3>
                                <p className="text-xs text-slate-500">Anti-hijack session integrity</p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            JWT credentials are signed with server-managed secrets and verified against active user records on every protected endpoint. Disabled or terminated employees are instantly cut off.
                        </p>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
                            <span>Session Integrity</span>
                            <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[11px]">JWT Bearer Guard Active</span>
                        </div>
                    </div>
                </div>
            )}

            {/* JSON Payload Modal */}
            {selectedPayloadLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 p-6 overflow-hidden">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Audit Action Details</h3>
                                <p className="text-xs text-slate-400 font-mono mt-0.5">
                                    {selectedPayloadLog.action} • {selectedPayloadLog.module} • {selectedPayloadLog.record_id}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedPayloadLog(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-auto max-h-80">
                            <pre>{JSON.stringify(selectedPayloadLog.details || {}, null, 2)}</pre>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={() => setSelectedPayloadLog(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditSecurityHub;
