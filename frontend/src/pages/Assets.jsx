import React, { useState, useEffect, useCallback } from 'react';
import {
    Shield, HardHat, Laptop, Shirt, Smartphone,
    Plus, Search, RotateCcw, UserCheck, Trash2, Edit3, X, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import assetService from '../services/assetService';
import employeeService from '../services/employeeService';
import siteService from '../services/siteService';
import { useAuth } from '../context/AuthContext';
import { extractApiError } from '../services/api';
import ModalPortal from '../components/common/ModalPortal';

const getIstToday = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

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

const CATEGORIES = [
    { value: 'ALL', label: 'All Categories' },
    { value: 'UNIFORM', label: 'Uniforms & Apparel' },
    { value: 'HELMET_PPE', label: 'Safety Helmets & PPE' },
    { value: 'LAPTOP_IT', label: 'Laptops & IT Gear' },
    { value: 'MOBILE', label: 'Smartphones & Radios' },
    { value: 'SECURITY_GEAR', label: 'Security Equipment & Batons' },
    { value: 'OTHER', label: 'Other Facilities Asset' }
];

const CONDITIONS = [
    { value: 'ALL', label: 'All Conditions' },
    { value: 'NEW', label: 'Brand New' },
    { value: 'GOOD', label: 'Good Working Condition' },
    { value: 'NEEDS_REPAIR', label: 'Needs Repair' },
    { value: 'DAMAGED', label: 'Damaged / Discarded' }
];

const Assets = () => {
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('ASSETS', 'can_create');
    const canUpdate = hasPermission('ASSETS', 'can_update');
    const canDelete = hasPermission('ASSETS', 'can_delete');
    const canViewEmployees = hasPermission('EMPLOYEES', 'can_view');
    const canViewSites = hasPermission('SITES', 'can_view') || hasPermission('ASSETS', 'can_view');

    const [activeTab, setActiveTab] = useState('inventory');
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState([]);
    const [allocations, setAllocations] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [sites, setSites] = useState([]);
    const [stats, setStats] = useState({
        total_units: 0,
        allocated_units: 0,
        available_stock: 0,
        damaged_count: 0,
        total_inventory_value: 0
    });

    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [conditionFilter, setConditionFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [showAssetModal, setShowAssetModal] = useState(false);
    const [editingAsset, setEditingAsset] = useState(null);
    const [showAllocateModal, setShowAllocateModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedAllocation, setSelectedAllocation] = useState(null);

    const [assetForm, setAssetForm] = useState({
        asset_name: '',
        category: 'UNIFORM',
        brand_model: '',
        serial_number: '',
        quantity_total: 10,
        cost: 0,
        condition: 'NEW',
        site_id: '',
        notes: ''
    });

    const [allocateForm, setAllocateForm] = useState(() => ({
        asset_id: '',
        employee_id: '',
        site_id: '',
        quantity: 1,
        issued_date: getIstToday(),
        return_due_date: '',
        condition_on_issue: 'GOOD',
        remarks: ''
    }));

    const [returnForm, setReturnForm] = useState(() => ({
        returned_date: getIstToday(),
        condition_on_return: 'GOOD',
        remarks: ''
    }));

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const empPromise = canViewEmployees
                ? (employeeService.getEmployees ? employeeService.getEmployees() : employeeService.getAllEmployees()).catch(() => ({ data: { data: [] } }))
                : Promise.resolve({ data: { data: [] } });
            const sitePromise = canViewSites
                ? siteService.getAllSites().catch(() => ({ data: { data: [] } }))
                : Promise.resolve({ data: { data: [] } });

            const [aRes, alRes, sRes, eRes, siteRes] = await Promise.all([
                assetService.getAssets({
                    category: categoryFilter,
                    condition: conditionFilter
                }),
                assetService.getAllocations(),
                assetService.getAssetStats(),
                empPromise,
                sitePromise
            ]);

            setAssets(aRes.data?.data || aRes.data || []);
            setAllocations(alRes.data?.data || alRes.data || []);
            setStats(sRes.data?.data || sRes.data || {});
            setEmployees(eRes.data?.data || eRes.data || []);
            setSites(siteRes.data?.data || siteRes.data || []);
        } catch (err) {
            console.error('Failed to load asset data:', err);
            toast.error(extractApiError(err, 'Failed to load asset data'));
        } finally {
            setLoading(false);
        }
    }, [categoryFilter, conditionFilter, canViewEmployees, canViewSites]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreateOrUpdateAsset = async (e) => {
        e.preventDefault();
        try {
            if (editingAsset) {
                await assetService.updateAsset(editingAsset.asset_id, assetForm);
                toast.success('Asset updated');
            } else {
                await assetService.createAsset(assetForm);
                toast.success('Asset created');
            }
            setShowAssetModal(false);
            setEditingAsset(null);
            fetchData();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to save asset'));
        }
    };

    const handleDeleteAsset = async (id, name) => {
        if (!window.confirm(`Delete asset "${name}"?`)) return;
        try {
            await assetService.deleteAsset(id);
            toast.success('Asset deleted');
            fetchData();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to delete asset'));
        }
    };

    const handleAllocate = async (e) => {
        e.preventDefault();
        try {
            await assetService.allocateAsset(allocateForm);
            toast.success('Asset allocated to employee');
            setShowAllocateModal(false);
            fetchData();
        } catch (err) {
            toast.error(extractApiError(err, 'Allocation failed'));
        }
    };

    const handleReturn = async (e) => {
        e.preventDefault();
        if (!selectedAllocation) return;
        try {
            await assetService.returnAsset(selectedAllocation.allocation_id, returnForm);
            toast.success('Asset marked as returned to inventory');
            setShowReturnModal(false);
            setSelectedAllocation(null);
            fetchData();
        } catch (err) {
            toast.error(extractApiError(err, 'Return failed'));
        }
    };

    const openEditAsset = (a) => {
        setEditingAsset(a);
        setAssetForm({
            asset_name: a.asset_name || '',
            category: a.category || 'UNIFORM',
            brand_model: a.brand_model || '',
            serial_number: a.serial_number || '',
            quantity_total: a.quantity_total || 1,
            cost: a.cost || 0,
            condition: a.condition || 'GOOD',
            site_id: a.site_id || '',
            notes: a.notes || ''
        });
        setShowAssetModal(true);
    };

    const openAllocateModal = (assetId = '') => {
        setAllocateForm({
            asset_id: assetId || (assets.find(a => a.in_stock > 0)?.asset_id || assets[0]?.asset_id || ''),
            employee_id: employees[0]?.employee_id || '',
            site_id: sites[0]?.site_id || '',
            quantity: 1,
            issued_date: getIstToday(),
            return_due_date: '',
            condition_on_issue: 'GOOD',
            remarks: ''
        });
        setShowAllocateModal(true);
    };

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'UNIFORM': return <Shirt size={16} className="text-blue-500 shrink-0" />;
            case 'HELMET_PPE': return <HardHat size={16} className="text-amber-500 shrink-0" />;
            case 'LAPTOP_IT': return <Laptop size={16} className="text-indigo-500 shrink-0" />;
            case 'MOBILE': return <Smartphone size={16} className="text-emerald-500 shrink-0" />;
            default: return <Shield size={16} className="text-slate-500 shrink-0" />;
        }
    };

    const filteredAssets = assets.filter(a => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
            a.asset_name?.toLowerCase().includes(q) ||
            a.asset_code?.toLowerCase().includes(q) ||
            a.brand_model?.toLowerCase().includes(q) ||
            a.serial_number?.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Shield className="text-primary-600 shrink-0" />
                        Asset Management
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Track Uniforms, Safety Helmets (PPE), Laptops & Security Gear allocation and return
                    </p>
                </div>
                {canCreate && (
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={() => openAllocateModal()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors shadow-2xs"
                        >
                            <UserCheck size={16} />
                            Allocate to Employee
                        </button>
                        <button
                            onClick={() => {
                                setEditingAsset(null);
                                setAssetForm({
                                    asset_name: '',
                                    category: 'UNIFORM',
                                    brand_model: '',
                                    serial_number: '',
                                    quantity_total: 10,
                                    cost: 0,
                                    condition: 'NEW',
                                    site_id: '',
                                    notes: ''
                                });
                                setShowAssetModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors shadow-2xs"
                        >
                            <Plus size={16} />
                            Add Asset
                        </button>
                    </div>
                )}
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="card-hover-effect bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Units</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1.5">{stats.total_units || 0}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Purchased items</div>
                </div>

                <div className="card-hover-effect bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Allocated</div>
                    <div className="text-2xl font-bold text-indigo-700 mt-1.5">{stats.allocated_units || 0}</div>
                    <div className="text-[11px] text-indigo-600 mt-0.5">In use by staff</div>
                </div>

                <div className="card-hover-effect bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">In Stock</div>
                    <div className="text-2xl font-bold text-emerald-700 mt-1.5">{stats.available_stock || 0}</div>
                    <div className="text-[11px] text-emerald-600 mt-0.5">Ready for issuance</div>
                </div>

                <div className="card-hover-effect bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Damaged / Repair</div>
                    <div className="text-2xl font-bold text-rose-700 mt-1.5">{stats.damaged_count || 0}</div>
                    <div className="text-[11px] text-rose-600 mt-0.5">Reconciliation needed</div>
                </div>

                <div className="card-hover-effect bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs col-span-2 md:col-span-1">
                    <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Inventory Value</div>
                    <div className="text-xl font-bold text-amber-700 mt-1.5 truncate">
                        ₹{parseFloat(stats.total_inventory_value || 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Total asset capital</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 overflow-x-auto no-scrollbar">
                <nav className="flex space-x-8 min-w-max">
                    <button
                        onClick={() => setActiveTab('inventory')}
                        className={`pb-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap shrink-0 transition-colors ${
                            activeTab === 'inventory'
                                ? 'border-primary-600 text-primary-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                    >
                        Assets Inventory ({assets.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('allocations')}
                        className={`pb-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap shrink-0 transition-colors ${
                            activeTab === 'allocations'
                                ? 'border-primary-600 text-primary-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                    >
                        Employee Allocations & Returns ({allocations.length})
                    </button>
                </nav>
            </div>

            {/* TAB 1: Inventory */}
            {activeTab === 'inventory' && (
                <div className="space-y-4">
                    {/* Search & Filters */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search asset name, code, brand..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 w-full text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="flex-1 sm:flex-none px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            >
                                {CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>

                            <select
                                value={conditionFilter}
                                onChange={(e) => setConditionFilter(e.target.value)}
                                className="flex-1 sm:flex-none px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            >
                                {CONDITIONS.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Desktop Inventory Table */}
                    <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                                    <tr>
                                        <th className="py-3 px-4">Asset Details</th>
                                        <th className="py-3 px-4">Category</th>
                                        <th className="py-3 px-4">Brand / Serial No.</th>
                                        <th className="py-3 px-4 text-center">Total Stock</th>
                                        <th className="py-3 px-4 text-center">Allocated</th>
                                        <th className="py-3 px-4 text-center">In-Stock</th>
                                        <th className="py-3 px-4">Unit Cost</th>
                                        <th className="py-3 px-4">Condition</th>
                                        {(canCreate || canUpdate || canDelete) && <th className="py-3 px-4 text-right">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr><td colSpan="9" className="text-center py-8 text-slate-400">Loading assets...</td></tr>
                                    ) : filteredAssets.length === 0 ? (
                                        <tr><td colSpan="9" className="text-center py-10 text-slate-400">No assets found.</td></tr>
                                    ) : (
                                        filteredAssets.map((a) => (
                                            <tr key={a.asset_id} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                                                        {getCategoryIcon(a.category)}
                                                        {a.asset_name}
                                                    </div>
                                                    <div className="text-xs text-slate-400 font-mono mt-0.5">{a.asset_code}</div>
                                                    {a.site_name && <div className="text-[11px] text-slate-500 mt-0.5">Site: {a.site_name}</div>}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium">{a.category}</span>
                                                </td>
                                                <td className="py-3 px-4 text-xs">
                                                    <div className="font-medium text-slate-800">{a.brand_model || '—'}</div>
                                                    {a.serial_number && <div className="text-slate-400 font-mono">S/N: {a.serial_number}</div>}
                                                </td>
                                                <td className="py-3 px-4 text-center font-semibold text-slate-800">{a.quantity_total}</td>
                                                <td className="py-3 px-4 text-center font-semibold text-indigo-600">{a.quantity_allocated}</td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                        a.in_stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                                    }`}>
                                                        {a.in_stock}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-semibold text-slate-900 text-xs">
                                                    ₹{parseFloat(a.cost || 0).toLocaleString('en-IN')}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                                        a.condition === 'NEW' ? 'bg-emerald-100 text-emerald-800' :
                                                        a.condition === 'GOOD' ? 'bg-blue-100 text-blue-800' :
                                                        a.condition === 'NEEDS_REPAIR' ? 'bg-amber-100 text-amber-800' :
                                                        'bg-rose-100 text-rose-800'
                                                    }`}>
                                                        {a.condition}
                                                    </span>
                                                </td>
                                                {(canCreate || canUpdate || canDelete) && (
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {canCreate && (
                                                                <button
                                                                    onClick={() => openAllocateModal(a.asset_id)}
                                                                    disabled={a.in_stock <= 0}
                                                                    title={a.in_stock > 0 ? 'Allocate to Staff' : 'Out of Stock'}
                                                                    className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent"
                                                                >
                                                                    <UserCheck size={15} />
                                                                </button>
                                                            )}
                                                            {canUpdate && (
                                                                <button
                                                                    onClick={() => openEditAsset(a)}
                                                                    title="Edit"
                                                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md"
                                                                >
                                                                    <Edit3 size={15} />
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDeleteAsset(a.asset_id, a.asset_name)}
                                                                    title="Delete"
                                                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-md"
                                                                >
                                                                    <Trash2 size={15} />
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

                    {/* Mobile Inventory Cards */}
                    <div className="block md:hidden space-y-3">
                        {loading ? (
                            <div className="text-center py-8 text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">Loading assets...</div>
                        ) : filteredAssets.length === 0 ? (
                            <div className="text-center py-8 text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">No assets found.</div>
                        ) : (
                            filteredAssets.map((a) => (
                                <div key={a.asset_id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2.5 text-xs">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                                                {getCategoryIcon(a.category)}
                                                {a.asset_name}
                                            </div>
                                            <div className="text-[11px] font-mono text-slate-400">{a.asset_code} • {a.category}</div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                            a.condition === 'NEW' ? 'bg-emerald-100 text-emerald-800' :
                                            a.condition === 'GOOD' ? 'bg-blue-100 text-blue-800' :
                                            a.condition === 'NEEDS_REPAIR' ? 'bg-amber-100 text-amber-800' :
                                            'bg-rose-100 text-rose-800'
                                        }`}>
                                            {a.condition}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl text-center">
                                        <div>
                                            <div className="text-[10px] text-slate-400">Total</div>
                                            <div className="font-bold text-slate-800">{a.quantity_total}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400">Allocated</div>
                                            <div className="font-bold text-indigo-600">{a.quantity_allocated}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400">In Stock</div>
                                            <div className={`font-bold ${a.in_stock > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{a.in_stock}</div>
                                        </div>
                                    </div>
                                    {(canCreate || canUpdate || canDelete) && (
                                        <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                                            {canCreate && (
                                                <button
                                                    onClick={() => openAllocateModal(a.asset_id)}
                                                    disabled={a.in_stock <= 0}
                                                    className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold disabled:opacity-40"
                                                >
                                                    Issue
                                                </button>
                                            )}
                                            {canUpdate && (
                                                <button onClick={() => openEditAsset(a)} className="px-2.5 py-1 rounded-lg border border-slate-200 text-indigo-600 font-semibold">
                                                    Edit
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button onClick={() => handleDeleteAsset(a.asset_id, a.asset_name)} className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 font-semibold">
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: Allocations & Returns */}
            {activeTab === 'allocations' && (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                                    <tr>
                                        <th className="py-3 px-4">Asset Issued</th>
                                        <th className="py-3 px-4">Employee</th>
                                        <th className="py-3 px-4">Site Location</th>
                                        <th className="py-3 px-4 text-center">Qty</th>
                                        <th className="py-3 px-4">Issue Date</th>
                                        <th className="py-3 px-4">Due / Return Date</th>
                                        <th className="py-3 px-4">Status</th>
                                        {canUpdate && <th className="py-3 px-4 text-right">Action</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {allocations.length === 0 ? (
                                        <tr><td colSpan="8" className="text-center py-8 text-slate-400">No asset allocations yet.</td></tr>
                                    ) : (
                                        allocations.map((al) => (
                                            <tr key={al.allocation_id} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                                        {getCategoryIcon(al.category)}
                                                        {al.asset_name}
                                                    </div>
                                                    <div className="text-xs text-slate-400 font-mono">{al.asset_code}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-slate-900">{al.employee_name}</div>
                                                    <div className="text-xs text-slate-400">{al.employee_code} • {al.designation}</div>
                                                </td>
                                                <td className="py-3 px-4 text-xs font-medium text-slate-700">{al.site_name || 'Main Office'}</td>
                                                <td className="py-3 px-4 text-center font-bold text-slate-800">{al.quantity}</td>
                                                <td className="py-3 px-4 text-xs text-slate-600">{formatIstDate(al.issued_date)}</td>
                                                <td className="py-3 px-4 text-xs">
                                                    {al.status === 'RETURNED' ? (
                                                        <span className="text-emerald-700 font-medium">Returned {formatIstDate(al.returned_date)}</span>
                                                    ) : al.return_due_date ? (
                                                        <span className="text-slate-700">Due: {formatIstDate(al.return_due_date)}</span>
                                                    ) : (
                                                        <span className="text-slate-400">Ongoing</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                        al.status === 'ISSUED'
                                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    }`}>
                                                        {al.status}
                                                    </span>
                                                </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="inline-flex items-center gap-1.5 justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => assetService.downloadHandoverForm(al.allocation_id, `${al.employee_name || 'Staff'}_${al.asset_name}`)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-colors"
                                                                title="Download IT Asset Handover Form PDF"
                                                            >
                                                                <FileText size={12} /> Handover Form
                                                            </button>
                                                            {canUpdate && al.status === 'ISSUED' && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedAllocation(al);
                                                                        setReturnForm({
                                                                            returned_date: getIstToday(),
                                                                            condition_on_return: 'GOOD',
                                                                            remarks: ''
                                                                        });
                                                                        setShowReturnModal(true);
                                                                    }}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-md transition-colors"
                                                                >
                                                                    <RotateCcw size={12} /> Return
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Allocations Cards */}
                    <div className="block md:hidden space-y-3">
                        {allocations.length === 0 ? (
                            <div className="text-center py-8 text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                                No asset allocations yet.
                            </div>
                        ) : (
                            allocations.map((al) => (
                                <div key={al.allocation_id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2 text-xs">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                                {getCategoryIcon(al.category)} {al.asset_name} (×{al.quantity})
                                            </div>
                                            <div className="text-slate-600 mt-0.5">{al.employee_name} ({al.employee_code})</div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                            al.status === 'ISSUED' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                                        }`}>
                                            {al.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between p-2 bg-slate-50 rounded-lg text-[11px]">
                                        <span>Issued: {formatIstDate(al.issued_date)}</span>
                                        <span>{al.status === 'RETURNED' ? `Returned: ${formatIstDate(al.returned_date)}` : (al.site_name || 'Main Office')}</span>
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-2 pt-1 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => assetService.downloadHandoverForm(al.allocation_id, `${al.employee_name || 'Staff'}_${al.asset_name}`)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 text-indigo-700 font-semibold rounded-lg text-xs"
                                            title="Download IT Asset Handover Form PDF"
                                        >
                                            <FileText size={12} /> Handover Form
                                        </button>
                                        {canUpdate && al.status === 'ISSUED' && (
                                            <button
                                                onClick={() => {
                                                    setSelectedAllocation(al);
                                                    setReturnForm({ returned_date: getIstToday(), condition_on_return: 'GOOD', remarks: '' });
                                                    setShowReturnModal(true);
                                                }}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 font-semibold rounded-lg text-xs"
                                            >
                                                <RotateCcw size={12} /> Return Asset
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}

            {/* MODAL 1: Add/Edit Asset */}
            {showAssetModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
                            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
                                <h2 className="text-lg font-bold text-slate-900">
                                    {editingAsset ? 'Edit Asset' : 'Add New Inventory Asset'}
                                </h2>
                                <button onClick={() => setShowAssetModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateOrUpdateAsset} className="space-y-4 p-6 overflow-y-auto">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Asset Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={assetForm.asset_name}
                                        onChange={(e) => setAssetForm({ ...assetForm, asset_name: e.target.value })}
                                        placeholder="e.g. Security Guard Uniform (Set of 2)"
                                        className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Category *</label>
                                        <select
                                            value={assetForm.category}
                                            onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        >
                                            {CATEGORIES.filter(c => c.value !== 'ALL').map(c => (
                                                <option key={c.value} value={c.value}>{c.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Condition</label>
                                        <select
                                            value={assetForm.condition}
                                            onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value })}
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        >
                                            <option value="NEW">Brand New</option>
                                            <option value="GOOD">Good Condition</option>
                                            <option value="NEEDS_REPAIR">Needs Repair</option>
                                            <option value="DAMAGED">Damaged</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Brand / Model</label>
                                        <input
                                            type="text"
                                            value={assetForm.brand_model}
                                            onChange={(e) => setAssetForm({ ...assetForm, brand_model: e.target.value })}
                                            placeholder="Karam / Dell / Woodland"
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Serial / Batch No.</label>
                                        <input
                                            type="text"
                                            value={assetForm.serial_number}
                                            onChange={(e) => setAssetForm({ ...assetForm, serial_number: e.target.value })}
                                            placeholder="Optional SN"
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Total Quantity *</label>
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            value={assetForm.quantity_total}
                                            onChange={(e) => setAssetForm({ ...assetForm, quantity_total: e.target.value })}
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Cost Per Unit (₹)</label>
                                        <input
                                            type="number"
                                            value={assetForm.cost}
                                            onChange={(e) => setAssetForm({ ...assetForm, cost: e.target.value })}
                                            placeholder="1200"
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Deployment Site (Optional)</label>
                                    <select
                                        value={assetForm.site_id}
                                        onChange={(e) => setAssetForm({ ...assetForm, site_id: e.target.value })}
                                        className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                    >
                                        <option value="">Central Warehouse / Unassigned</option>
                                        {sites.map(s => (
                                            <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowAssetModal(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                                        Cancel
                                    </button>
                                    <button type="submit" className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors shadow-2xs">
                                        {editingAsset ? 'Save Changes' : 'Save Asset'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* MODAL 2: Allocate Asset */}
            {showAllocateModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
                            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
                                <h2 className="text-lg font-bold text-slate-900">Issue / Allocate Asset</h2>
                                <button onClick={() => setShowAllocateModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleAllocate} className="space-y-4 p-6 overflow-y-auto">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Select Asset *</label>
                                    <select
                                        required
                                        value={allocateForm.asset_id}
                                        onChange={(e) => setAllocateForm({ ...allocateForm, asset_id: e.target.value })}
                                        className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                    >
                                        <option value="">Choose item...</option>
                                        {assets.filter(a => a.in_stock > 0).map(a => (
                                            <option key={a.asset_id} value={a.asset_id}>
                                                {a.asset_name} ({a.in_stock} available in stock)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Select Employee *</label>
                                        <select
                                            required
                                            value={allocateForm.employee_id}
                                            onChange={(e) => setAllocateForm({ ...allocateForm, employee_id: e.target.value })}
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        >
                                            <option value="">Choose employee...</option>
                                            {employees.map(e => (
                                                <option key={e.employee_id} value={e.employee_id}>
                                                    {e.full_name} ({e.employee_code})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Deployment Site</label>
                                        <select
                                            value={allocateForm.site_id}
                                            onChange={(e) => setAllocateForm({ ...allocateForm, site_id: e.target.value })}
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        >
                                            <option value="">Main Office / General</option>
                                            {sites.map(s => (
                                                <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Quantity *</label>
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            value={allocateForm.quantity}
                                            onChange={(e) => setAllocateForm({ ...allocateForm, quantity: e.target.value })}
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Condition on Issue</label>
                                        <select
                                            value={allocateForm.condition_on_issue}
                                            onChange={(e) => setAllocateForm({ ...allocateForm, condition_on_issue: e.target.value })}
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        >
                                            <option value="NEW">New</option>
                                            <option value="GOOD">Good</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Issue Date *</label>
                                        <input
                                            type="date"
                                            required
                                            value={allocateForm.issued_date}
                                            onChange={(e) => setAllocateForm({ ...allocateForm, issued_date: e.target.value })}
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Return Due Date</label>
                                        <input
                                            type="date"
                                            value={allocateForm.return_due_date}
                                            onChange={(e) => setAllocateForm({ ...allocateForm, return_due_date: e.target.value })}
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Remarks</label>
                                    <input
                                        type="text"
                                        value={allocateForm.remarks}
                                        onChange={(e) => setAllocateForm({ ...allocateForm, remarks: e.target.value })}
                                        placeholder="e.g. Issued for Site Guard duty"
                                        className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                    />
                                </div>

                                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowAllocateModal(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                                        Cancel
                                    </button>
                                    <button type="submit" className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors shadow-2xs">
                                        Issue Asset
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* MODAL 3: Return Asset */}
            {showReturnModal && selectedAllocation && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
                            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
                                <h2 className="text-lg font-bold text-slate-900">Return Asset to Stock</h2>
                                <button onClick={() => setShowReturnModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleReturn} className="space-y-4 p-6 overflow-y-auto">
                                <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                                    <div><span className="font-semibold text-slate-700">Item:</span> {selectedAllocation.asset_name}</div>
                                    <div><span className="font-semibold text-slate-700">Returning Staff:</span> {selectedAllocation.employee_name} ({selectedAllocation.employee_code})</div>
                                    <div><span className="font-semibold text-slate-700">Quantity:</span> {selectedAllocation.quantity}</div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Return Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={returnForm.returned_date}
                                        onChange={(e) => setReturnForm({ ...returnForm, returned_date: e.target.value })}
                                        className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Condition on Return *</label>
                                    <select
                                        value={returnForm.condition_on_return}
                                        onChange={(e) => setReturnForm({ ...returnForm, condition_on_return: e.target.value })}
                                        className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                    >
                                        <option value="GOOD">Good Working Condition</option>
                                        <option value="NEEDS_REPAIR">Needs Repair / Laundering</option>
                                        <option value="DAMAGED">Damaged / Torn</option>
                                        <option value="LOST">Lost / Missing</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Reconciliation Remarks</label>
                                    <input
                                        type="text"
                                        value={returnForm.remarks}
                                        onChange={(e) => setReturnForm({ ...returnForm, remarks: e.target.value })}
                                        placeholder="Notes on return"
                                        className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                    />
                                </div>

                                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowReturnModal(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                                        Cancel
                                    </button>
                                    <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-2xs">
                                        Confirm Return
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

export default Assets;
