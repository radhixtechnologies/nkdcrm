import React, { useState, useEffect, useCallback } from 'react';
import {
    Truck, Plus, Download, Search, Building2,
    CheckCircle2, Clock, FileSpreadsheet, Edit2, Trash2, X, RefreshCw,
    Layers, ShieldCheck, Check, MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';
import procurementService from '../services/procurementService';
import siteService from '../services/siteService';
import { useAuth } from '../context/AuthContext';
import { extractApiError } from '../services/api';
import ModalPortal from '../components/common/ModalPortal';

const getIstToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

const createEmptyForm = (slNo = 1, siteId = '') => ({
    site_id: siteId,
    sl_no: slNo,
    item_description: '',
    uom: 'Meter',
    qty: 100,
    po_status: 'Pending',
    vendor_name: '',
    po_number: '',
    po_actual_date: '',
    tds_actual_date: '',
    approval_actual_date: '',
    receipt_actual: '',
    location: '',
    contact_person: '',
    contact_number: '',
    contact_email: '',
    remarks: '',
    milestone_stage: 'PO_ISSUED'
});

const ProcurementTracker = () => {
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('PROCUREMENT', 'can_create');
    const canUpdate = hasPermission('PROCUREMENT', 'can_update');
    const canDelete = hasPermission('PROCUREMENT', 'can_delete');
    const canExport = hasPermission('PROCUREMENT', 'can_export') || canCreate || canUpdate;

    const [items, setItems] = useState([]);
    const [stats, setStats] = useState({});
    const [sites, setSites] = useState([]);
    const [selectedSiteId, setSelectedSiteId] = useState('ALL');
    const [loading, setLoading] = useState(true);

    // Filters
    const [selectedStage, setSelectedStage] = useState('ALL');
    const [selectedStatus, setSelectedStatus] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(createEmptyForm());

    useEffect(() => {
        siteService.getAllSites()
            .then((res) => setSites(res.data?.data || res.data || []))
            .catch(() => setSites([]));
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const siteParam = selectedSiteId !== 'ALL' ? selectedSiteId : undefined;
            const params = {};
            if (siteParam) params.site_id = siteParam;
            if (selectedStage !== 'ALL') params.stage = selectedStage;
            if (selectedStatus !== 'ALL') params.po_status = selectedStatus;
            if (searchTerm.trim()) params.search = searchTerm.trim();

            const [itemsRes, statsRes] = await Promise.all([
                procurementService.getAllItems(params),
                procurementService.getStats(siteParam ? { site_id: siteParam } : {})
            ]);

            setItems(itemsRes.data?.data || []);
            setStats(statsRes.data?.data || {});
        } catch (err) {
            console.error('Failed to load procurement items:', err);
            toast.error(extractApiError(err, 'Failed to load procurement items'));
        } finally {
            setLoading(false);
        }
    }, [selectedSiteId, selectedStage, selectedStatus, searchTerm]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenCreateModal = () => {
        if (!canCreate) return;
        setEditingItem(null);
        const defaultSite = selectedSiteId !== 'ALL'
            ? String(selectedSiteId)
            : (sites[0]?.site_id ? String(sites[0].site_id) : '');
        setFormData(createEmptyForm(items.length + 1, defaultSite));
        setShowModal(true);
    };

    const handleOpenEditModal = (item) => {
        if (!canUpdate) return;
        setEditingItem(item);
        setFormData({
            site_id: item.site_id ? String(item.site_id) : '',
            sl_no: item.sl_no ?? 1,
            item_description: item.item_description || '',
            uom: item.uom || 'Meter',
            qty: item.qty ?? 1,
            po_status: item.po_status || 'Pending',
            vendor_name: item.vendor_name || '',
            po_number: item.po_number || '',
            po_actual_date: item.po_actual_date ? String(item.po_actual_date).slice(0, 10) : '',
            tds_actual_date: item.tds_actual_date ? String(item.tds_actual_date).slice(0, 10) : '',
            approval_actual_date: item.approval_actual_date ? String(item.approval_actual_date).slice(0, 10) : '',
            receipt_actual: item.receipt_actual ? String(item.receipt_actual).slice(0, 10) : '',
            location: item.location || '',
            contact_person: item.contact_person || '',
            contact_number: item.contact_number || '',
            contact_email: item.contact_email || '',
            remarks: item.remarks || '',
            milestone_stage: item.milestone_stage || 'PO_ISSUED'
        });
        setShowModal(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...formData,
                site_id: formData.site_id ? parseInt(formData.site_id, 10) : null
            };
            if (editingItem) {
                await procurementService.updateItem(editingItem.item_id, payload);
                toast.success('Procurement item updated successfully');
            } else {
                await procurementService.createItem(payload);
                toast.success('New procurement item added successfully');
            }
            setShowModal(false);
            loadData();
        } catch (err) {
            console.error('Failed to save procurement item:', err);
            toast.error(extractApiError(err, 'Failed to save item'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!canDelete) return;
        if (!window.confirm('Are you sure you want to delete this procurement item?')) return;
        try {
            await procurementService.deleteItem(id);
            toast.success('Item removed');
            loadData();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to delete item'));
        }
    };

    const handleExportPdf = () => {
        if (!canExport) return;
        const params = {};
        if (selectedSiteId !== 'ALL') params.site_id = selectedSiteId;
        if (selectedStage !== 'ALL') params.stage = selectedStage;
        if (selectedStatus !== 'ALL') params.po_status = selectedStatus;
        if (searchTerm.trim()) params.search = searchTerm.trim();
        const url = procurementService.getExportPdfUrl(params);
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleExportCsv = () => {
        if (!canExport) return;
        if (items.length === 0) {
            toast.error('No items to export');
            return;
        }

        const headers = ['Sl No', 'Project Site', 'Item Description', 'Qty', 'UOM', 'PO Status', 'Vendor', 'PO Number', 'PO Date', 'Drawing Approval', 'Site Receipt', 'Location', 'Remarks'];
        const csvRows = [headers.join(',')];

        items.forEach((it) => {
            const row = [
                it.sl_no,
                `"${(it.site_name || '').replace(/"/g, '""')}"`,
                `"${(it.item_description || '').replace(/"/g, '""')}"`,
                it.qty,
                it.uom,
                it.po_status,
                `"${(it.vendor_name || '').replace(/"/g, '""')}"`,
                `"${(it.po_number || '').replace(/"/g, '""')}"`,
                `"${it.po_actual_fmt || it.po_schedule_fmt || ''}"`,
                `"${it.approval_actual_fmt || it.approval_planned_fmt || ''}"`,
                `"${it.receipt_actual_fmt || it.receipt_planned_fmt || ''}"`,
                `"${(it.location || '').replace(/"/g, '""')}"`,
                `"${(it.remarks || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Procurement_Tracker_${getIstToday()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('CSV downloaded successfully');
    };

    const activeSite = sites.find((s) => String(s.site_id) === String(selectedSiteId));
    const totalCount = stats.total_items ?? items.length;
    const deliveredPct = totalCount > 0 ? Math.round(((stats.delivered_at_site || 0) / totalCount) * 100) : 0;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20 sm:pb-16 pt-1 sm:pt-2">
            {/* Header Box */}
            <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-primary-950 rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-primary-500/10 to-transparent pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="px-2.5 py-0.5 rounded-full bg-primary-500/20 border border-primary-400/40 text-primary-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <Truck size={13} className="text-primary-400" /> Supply Chain & Material Milestone Tracker
                            </span>
                            <span className="text-slate-400 text-xs">•</span>
                            <span className="text-slate-300 text-xs font-medium">
                                {activeSite ? `${activeSite.site_name}${activeSite.site_code ? ` (${activeSite.site_code})` : ''}` : 'All Project Sites'}
                            </span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
                            Project Procurement Tracker
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
                            10-Stage Procurement Pipeline tracking PO Placement, TDS/Drawing Submission, Client Approval, Factory Inspection, and Site Delivery.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        {canExport && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleExportPdf}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-all btn-press shadow-xs backdrop-blur-xs"
                                    title="Download Landscape Procurement Tracking Sheet PDF"
                                >
                                    <Download size={15} />
                                    <span>Client Landscape PDF</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportCsv}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white border border-emerald-400/30 text-xs font-bold transition-all btn-press shadow-xs"
                                    title="Export CSV"
                                >
                                    <FileSpreadsheet size={15} />
                                    <span>Export CSV</span>
                                </button>
                            </>
                        )}
                        {canCreate && (
                            <button
                                type="button"
                                onClick={handleOpenCreateModal}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold transition-all btn-press shadow-md shadow-primary-500/20"
                            >
                                <Plus size={16} />
                                <span>Add Material Item</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs card-hover-effect">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Layers size={13} className="text-slate-400" /> Package Items
                    </p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{totalCount}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Tracked materials</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs card-hover-effect">
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 size={13} className="text-emerald-500" /> PO Completed
                    </p>
                    <p className="text-2xl font-black text-emerald-700 mt-1">{stats.po_completed || 0}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Orders confirmed</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs card-hover-effect">
                    <p className="text-[11px] font-bold text-sky-600 uppercase tracking-wider flex items-center gap-1">
                        <Truck size={13} className="text-sky-500" /> Delivered at Site
                    </p>
                    <p className="text-2xl font-black text-sky-700 mt-1">{stats.delivered_at_site || 0}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{deliveredPct}% site handover</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs card-hover-effect">
                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                        <Clock size={13} className="text-amber-500" /> In Manufacturing
                    </p>
                    <p className="text-2xl font-black text-amber-700 mt-1">{stats.in_manufacturing || 0}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Active factory orders</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs card-hover-effect col-span-2 sm:col-span-1">
                    <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck size={13} className="text-indigo-500" /> Client Free-Issue
                    </p>
                    <p className="text-2xl font-black text-indigo-700 mt-1">{stats.client_free_issue || 0}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Client-supplied scope</p>
                </div>
            </div>

            {/* Stage Selector Pills */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 shrink-0">
                    Filter Stage:
                </span>
                <button
                    type="button"
                    onClick={() => setSelectedStage('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 btn-press ${
                        selectedStage === 'ALL'
                            ? 'bg-primary-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                >
                    All Items ({totalCount})
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedStage('DELIVERED_AT_SITE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 btn-press ${
                        selectedStage === 'DELIVERED_AT_SITE'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                >
                    Delivered at Site ({stats.delivered_at_site || 0})
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedStage('MANUFACTURING')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 btn-press ${
                        selectedStage === 'MANUFACTURING'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                >
                    In Manufacturing ({stats.in_manufacturing || 0})
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedStage('PO_ISSUED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 btn-press ${
                        selectedStage === 'PO_ISSUED'
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                >
                    PO Issued ({stats.po_pending || 0})
                </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search item, vendor, PO number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:bg-white"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {sites.length > 0 && (
                        <div className="flex items-center gap-1.5">
                            <Building2 size={14} className="text-slate-400" />
                            <select
                                value={selectedSiteId}
                                onChange={(e) => setSelectedSiteId(e.target.value)}
                                className="text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            >
                                <option value="ALL">All Sites ({sites.length})</option>
                                {sites.map((s) => (
                                    <option key={s.site_id} value={s.site_id}>
                                        {s.site_name} {s.site_code ? `(${s.site_code})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    >
                        <option value="ALL">All PO Statuses</option>
                        <option value="Complete">Complete</option>
                        <option value="Pending">Pending</option>
                    </select>

                    <button
                        type="button"
                        onClick={loadData}
                        disabled={loading}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors btn-press"
                        title="Reload"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Mobile View: High Polish Responsive Cards */}
            <div className="block sm:hidden space-y-3">
                {loading ? (
                    <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-primary-500 border-t-transparent mb-2" />
                        <p className="text-xs">Loading procurement pipeline...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                        <Truck size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700 text-sm">No items found</p>
                    </div>
                ) : (
                    items.map((it, idx) => (
                        <div key={it.item_id || idx} className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold font-mono">
                                        #{it.sl_no} • {it.qty} {it.uom}
                                    </span>
                                    <h4 className="font-bold text-slate-900 text-sm mt-1 leading-snug">
                                        {it.item_description}
                                    </h4>
                                    <p className="text-xs text-primary-700 font-semibold">{it.vendor_name}</p>
                                    {it.site_name && (
                                        <p className="text-[11px] text-slate-400 truncate">{it.site_name}</p>
                                    )}
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                    it.po_status === 'Complete'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                    {it.po_status}
                                </span>
                            </div>

                            {it.po_number && (
                                <div className="text-[11px] font-mono bg-slate-50 px-2 py-1 rounded text-slate-700 break-all">
                                    <strong>PO:</strong> {it.po_number}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs">
                                <div>
                                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Drawing Approval</span>
                                    <span className="font-bold text-slate-800">{it.approval_actual_fmt || it.approval_planned_fmt || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-emerald-600 font-semibold block uppercase">Site Delivery</span>
                                    <span className="font-bold text-emerald-700">{it.receipt_actual_fmt || it.receipt_planned_fmt || 'In Progress'}</span>
                                </div>
                            </div>

                            {it.remarks && (
                                <div className="text-[11px] bg-slate-100 px-2 py-1 rounded text-slate-600">
                                    {it.remarks}
                                </div>
                            )}

                            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                                <span className="text-slate-500 font-medium text-[11px] inline-flex items-center gap-1">
                                    <MapPin size={12} className="text-rose-400 shrink-0" />
                                    {it.location || it.site_name || '—'}
                                </span>
                                {(canUpdate || canDelete) && (
                                    <div className="flex items-center gap-2">
                                        {canUpdate && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEditModal(it)}
                                                className="p-1.5 text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg text-xs font-medium flex items-center gap-1"
                                            >
                                                <Edit2 size={13} /> Edit
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(it.item_id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-medium flex items-center gap-1"
                                            >
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

            {/* Desktop Table View */}
            <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/90 text-slate-600 border-b border-slate-200 text-xs uppercase tracking-wider font-bold">
                            <tr>
                                <th className="px-4 py-3.5 text-center w-12">#</th>
                                <th className="px-4 py-3.5">Item Description</th>
                                <th className="px-4 py-3.5 text-center">Qty / UOM</th>
                                <th className="px-4 py-3.5">Vendor & PO Number</th>
                                <th className="px-4 py-3.5 text-center">PO Status</th>
                                <th className="px-4 py-3.5 text-center">PO Date</th>
                                <th className="px-4 py-3.5 text-center">Drawing Approved</th>
                                <th className="px-4 py-3.5 text-center">Site Receipt</th>
                                <th className="px-4 py-3.5">Location</th>
                                <th className="px-4 py-3.5">Remarks / Scope</th>
                                {(canUpdate || canDelete) && <th className="px-4 py-3.5 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={canUpdate || canDelete ? 11 : 10} className="p-12 text-center text-slate-500">
                                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-primary-500 border-t-transparent mb-2" />
                                        <p className="text-xs">Loading procurement records...</p>
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={canUpdate || canDelete ? 11 : 10} className="p-12 text-center text-slate-400">
                                        No procurement items found for this filter.
                                    </td>
                                </tr>
                            ) : (
                                items.map((it, idx) => (
                                    <tr key={it.item_id || idx} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">
                                            {it.sl_no}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-900 text-xs">{it.item_description}</div>
                                            <div className="text-[10px] text-slate-400">{it.site_name || it.location || 'Project Material'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-slate-800 text-xs whitespace-nowrap">
                                            {it.qty} <span className="font-normal text-slate-500">{it.uom}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            <div className="font-bold text-slate-900">{it.vendor_name}</div>
                                            <div className="text-[10px] font-mono text-primary-700 truncate max-w-[150px]" title={it.po_number}>
                                                {it.po_number || '-'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                                it.po_status === 'Complete'
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                            }`}>
                                                {it.po_status === 'Complete' ? <Check size={10} /> : <Clock size={10} />}
                                                {it.po_status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-xs font-mono text-slate-600 whitespace-nowrap">
                                            {it.po_actual_fmt || it.po_schedule_fmt || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center text-xs font-mono text-slate-600 whitespace-nowrap">
                                            {it.approval_actual_fmt || it.approval_planned_fmt || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            {it.receipt_actual_fmt ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                                    <CheckCircle2 size={11} /> {it.receipt_actual_fmt}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic font-mono">
                                                    {it.receipt_planned_fmt || 'In Progress'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600">
                                            {it.location || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {it.remarks ? (
                                                <span className={`px-2 py-0.5 rounded font-medium text-[11px] ${
                                                    it.remarks.includes("CLIENT'S SIDE")
                                                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold'
                                                        : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {it.remarks}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        {(canUpdate || canDelete) && (
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {canUpdate && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEditModal(it)}
                                                            className="p-1.5 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                                                            title="Edit Item"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                    )}
                                                    {canDelete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(it.item_id)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                            title="Delete Item"
                                                        >
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

            {/* Add / Edit Modal */}
            {showModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-scale-in">
                            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
                                <h3 className="text-base font-bold flex items-center gap-2">
                                    <Truck size={18} className="text-primary-400" />
                                    {editingItem ? 'Edit Procurement Item' : 'New Project Procurement Item'}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="p-1 hover:bg-white/20 rounded-lg text-slate-300 hover:text-white transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                                {sites.length > 0 && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 block mb-1">Project / Site</label>
                                        <select
                                            value={formData.site_id}
                                            onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                        >
                                            <option value="">All / General Project</option>
                                            {sites.map((s) => (
                                                <option key={s.site_id} value={s.site_id}>
                                                    {s.site_name} {s.site_code ? `(${s.site_code})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1">Item Description *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.item_description}
                                        placeholder="e.g. 11KV 1CX1000 Sqmm AL Cable"
                                        onChange={(e) => setFormData({ ...formData, item_description: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 block mb-1">Qty *</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="any"
                                            value={formData.qty}
                                            onChange={(e) => setFormData({ ...formData, qty: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 block mb-1">UOM</label>
                                        <select
                                            value={formData.uom}
                                            onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                        >
                                            <option value="Meter">Meter</option>
                                            <option value="Nos">Nos</option>
                                            <option value="Set">Set</option>
                                            <option value="Lot">Lot</option>
                                            <option value="Kg">Kg</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 block mb-1">PO Status</label>
                                        <select
                                            value={formData.po_status}
                                            onChange={(e) => setFormData({ ...formData, po_status: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                        >
                                            <option value="Complete">Complete</option>
                                            <option value="Pending">Pending</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 block mb-1">Vendor Name *</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Vendor / Manufacturer name"
                                            value={formData.vendor_name}
                                            onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 block mb-1">PO Number</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. NKD POWER/2026-27/004"
                                            value={formData.po_number}
                                            onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 block mb-1">PO Date</label>
                                        <input
                                            type="date"
                                            value={formData.po_actual_date}
                                            onChange={(e) => setFormData({ ...formData, po_actual_date: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 block mb-1">Drawing Appr.</label>
                                        <input
                                            type="date"
                                            value={formData.approval_actual_date}
                                            onChange={(e) => setFormData({ ...formData, approval_actual_date: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 block mb-1">Site Receipt</label>
                                        <input
                                            type="date"
                                            value={formData.receipt_actual}
                                            onChange={(e) => setFormData({ ...formData, receipt_actual: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 block mb-1">Location</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Gujarat, Navi Mumbai"
                                            value={formData.location}
                                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 block mb-1">Milestone Stage</label>
                                        <select
                                            value={formData.milestone_stage}
                                            onChange={(e) => setFormData({ ...formData, milestone_stage: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                        >
                                            <option value="DELIVERED_AT_SITE">Delivered at Site</option>
                                            <option value="MANUFACTURING">In Manufacturing</option>
                                            <option value="PO_ISSUED">PO Issued / Pending</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 block mb-1">Procurement Contact</label>
                                        <input
                                            type="text"
                                            placeholder="Contact person name"
                                            value={formData.contact_person}
                                            onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 block mb-1">Contact Phone</label>
                                        <input
                                            type="text"
                                            placeholder="Phone number"
                                            value={formData.contact_number}
                                            onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-600 block mb-1">Remarks / Special Scope</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Delivered at site & inspected"
                                        value={formData.remarks}
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
                                        {saving ? 'Saving...' : (editingItem ? 'Update Item' : 'Add Item')}
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

export default ProcurementTracker;
