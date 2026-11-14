import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Briefcase, Plus, Search,
    CheckCircle, AlertTriangle, Clock,
    Star, Trash2, Edit3, ShieldAlert,
    ShieldCheck, Calendar, Phone, Mail, MapPin, X, IndianRupee
} from 'lucide-react';
import toast from 'react-hot-toast';
import vendorService from '../services/vendorService';
import { useAuth } from '../context/AuthContext';
import { extractApiError } from '../services/api';
import ModalPortal from '../components/common/ModalPortal';

const getIstToday = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

const getIstOffsetDate = (days) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
        new Date(Date.now() + days * 86400000)
    );

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
    { value: 'MANPOWER', label: 'Manpower Supply' },
    { value: 'SECURITY', label: 'Security Guard Services' },
    { value: 'UNIFORM', label: 'Uniform & PPE Manufacturer' },
    { value: 'IT_HARDWARE', label: 'IT Hardware & Biometrics' },
    { value: 'EQUIPMENT', label: 'Safety & Facility Equipment' },
    { value: 'CLEANING_SUPPLIES', label: 'Housekeeping Supplies' },
    { value: 'OTHER', label: 'Other Contractor' }
];

const COMPLIANCE_STATUSES = [
    { value: 'ALL', label: 'All Compliance Status' },
    { value: 'COMPLIANT', label: 'Compliant' },
    { value: 'UNDER_AUDIT', label: 'Under Audit' },
    { value: 'NON_COMPLIANT', label: 'Non-Compliant' }
];

const emptyVendorForm = () => ({
    vendor_name: '',
    category: 'MANPOWER',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: 'Maharashtra',
    gstin: '',
    pan: '',
    pf_code: '',
    esic_code: '',
    compliance_status: 'COMPLIANT',
    rating: 4.5,
    bank_name: '',
    account_number: '',
    ifsc_code: ''
});

const defaultAgreementForm = (vendorId = '') => ({
    vendor_id: vendorId,
    title: '',
    start_date: getIstToday(),
    expiry_date: getIstOffsetDate(365),
    contract_value: '',
    sla_terms: '99% on-time deployment SLA. Statutory compliance reports submitted by 10th of every month.',
    status: 'ACTIVE'
});

const Vendors = () => {
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('VENDORS', 'can_create');
    const canUpdate = hasPermission('VENDORS', 'can_update');
    const canDelete = hasPermission('VENDORS', 'can_delete');

    const [activeTab, setActiveTab] = useState('vendors');
    const [loading, setLoading] = useState(true);
    const [vendors, setVendors] = useState([]);
    const [agreements, setAgreements] = useState([]);
    const [stats, setStats] = useState({
        total_vendors: 0,
        compliant_count: 0,
        non_compliant_count: 0,
        average_rating: 4.0,
        total_agreements: 0,
        active_agreements: 0,
        expired_agreements: 0
    });

    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [complianceFilter, setComplianceFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Modals & Edit States
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [editingVendor, setEditingVendor] = useState(null);
    const [showAgreementModal, setShowAgreementModal] = useState(false);
    const [editingAgreement, setEditingAgreement] = useState(null);

    const [vendorForm, setVendorForm] = useState(emptyVendorForm);
    const [agreementForm, setAgreementForm] = useState(() => defaultAgreementForm());

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [vRes, aRes, sRes] = await Promise.all([
                vendorService.getVendors({
                    category: categoryFilter,
                    compliance_status: complianceFilter
                }),
                vendorService.getAgreements(),
                vendorService.getVendorStats()
            ]);

            setVendors(vRes.data?.data || vRes.data || []);
            setAgreements(aRes.data?.data || aRes.data || []);
            setStats(sRes.data?.data || sRes.data || {});
        } catch (err) {
            console.error('Failed to load vendors:', err);
            toast.error(extractApiError(err, 'Failed to load vendor data'));
        } finally {
            setLoading(false);
        }
    }, [categoryFilter, complianceFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreateOrUpdateVendor = async (e) => {
        e.preventDefault();
        try {
            if (editingVendor) {
                await vendorService.updateVendor(editingVendor.vendor_id, vendorForm);
                toast.success('Vendor updated successfully');
            } else {
                await vendorService.createVendor(vendorForm);
                toast.success('Vendor added successfully');
            }
            setShowVendorModal(false);
            setEditingVendor(null);
            fetchData();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to save vendor'));
        }
    };

    const handleDeleteVendor = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete vendor "${name}"?`)) return;
        try {
            await vendorService.deleteVendor(id);
            toast.success('Vendor deleted');
            fetchData();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to delete vendor'));
        }
    };

    const handleSaveAgreement = async (e) => {
        e.preventDefault();
        try {
            if (editingAgreement) {
                await vendorService.updateAgreement(editingAgreement.agreement_id, agreementForm);
                toast.success('Vendor agreement updated');
            } else {
                await vendorService.createAgreement(agreementForm);
                toast.success('Vendor agreement created');
            }
            setShowAgreementModal(false);
            setEditingAgreement(null);
            fetchData();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to save agreement'));
        }
    };

    const handleDeleteAgreement = async (id) => {
        if (!window.confirm('Delete this vendor agreement?')) return;
        try {
            await vendorService.deleteAgreement(id);
            toast.success('Agreement deleted');
            fetchData();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to delete agreement'));
        }
    };

    const openEditVendor = (v) => {
        setEditingVendor(v);
        setVendorForm({
            vendor_name: v.vendor_name || '',
            category: v.category || 'MANPOWER',
            contact_person: v.contact_person || '',
            email: v.email || '',
            phone: v.phone || '',
            address: v.address || '',
            city: v.city || '',
            state: v.state || '',
            gstin: v.gstin || '',
            pan: v.pan || '',
            pf_code: v.pf_code || '',
            esic_code: v.esic_code || '',
            compliance_status: v.compliance_status || 'COMPLIANT',
            rating: v.rating || 4.0,
            bank_name: v.bank_name || '',
            account_number: v.account_number || '',
            ifsc_code: v.ifsc_code || ''
        });
        setShowVendorModal(true);
    };

    const openAddAgreementModal = (vendorId = '') => {
        setEditingAgreement(null);
        setAgreementForm(defaultAgreementForm(vendorId || (vendors[0]?.vendor_id || '')));
        setShowAgreementModal(true);
    };

    const openEditAgreementModal = (a) => {
        setEditingAgreement(a);
        setAgreementForm({
            vendor_id: a.vendor_id || '',
            title: a.title || '',
            start_date: a.start_date ? String(a.start_date).slice(0, 10) : getIstToday(),
            expiry_date: a.expiry_date ? String(a.expiry_date).slice(0, 10) : getIstOffsetDate(365),
            contract_value: a.contract_value ?? '',
            sla_terms: a.sla_terms || '',
            status: a.status || 'ACTIVE'
        });
        setShowAgreementModal(true);
    };

    const filteredVendors = vendors.filter(v => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
            v.vendor_name?.toLowerCase().includes(q) ||
            v.vendor_code?.toLowerCase().includes(q) ||
            v.contact_person?.toLowerCase().includes(q) ||
            v.city?.toLowerCase().includes(q) ||
            v.gstin?.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Briefcase className="text-primary-600 shrink-0" />
                        Vendor Management
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Subcontractor compliance, agreements, performance SLA and statutory registers
                    </p>
                </div>
                {canCreate && (
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <Link
                            to="/vendor-payments"
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                        >
                            <IndianRupee size={16} />
                            Vendor Payments (FY 26-27)
                        </Link>
                        <button
                            onClick={() => openAddAgreementModal()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors shadow-2xs"
                        >
                            <Calendar size={16} />
                            + New Agreement
                        </button>
                        <button
                            onClick={() => {
                                setEditingVendor(null);
                                setVendorForm(emptyVendorForm());
                                setShowVendorModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors shadow-2xs"
                        >
                            <Plus size={16} />
                            Add Vendor
                        </button>
                    </div>
                )}
            </div>

            {/* Stat Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card-hover-effect bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Vendors</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1.5">{stats.total_vendors || 0}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Approved contractors</div>
                </div>

                <div className="card-hover-effect bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle size={14} />
                        Compliant
                    </div>
                    <div className="text-2xl font-bold text-emerald-700 mt-1.5">{stats.compliant_count || 0}</div>
                    <div className="text-[11px] text-emerald-600 mt-0.5">PF & ESIC verified</div>
                </div>

                <div className="card-hover-effect bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle size={14} />
                        Non-Compliant
                    </div>
                    <div className="text-2xl font-bold text-rose-700 mt-1.5">{stats.non_compliant_count || 0}</div>
                    <div className="text-[11px] text-rose-600 mt-0.5">Audit action needed</div>
                </div>

                <div className="card-hover-effect bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                        <Star size={14} />
                        Avg Performance
                    </div>
                    <div className="text-2xl font-bold text-amber-700 mt-1.5">
                        {stats.average_rating ? `${stats.average_rating} / 5` : '4.0 / 5'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                        {stats.active_agreements || 0} Active SLAs
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 overflow-x-auto no-scrollbar">
                <nav className="flex space-x-8 min-w-max">
                    <button
                        onClick={() => setActiveTab('vendors')}
                        className={`pb-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap shrink-0 transition-colors ${
                            activeTab === 'vendors'
                                ? 'border-primary-600 text-primary-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                    >
                        Vendors Directory ({vendors.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('agreements')}
                        className={`pb-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap shrink-0 transition-colors ${
                            activeTab === 'agreements'
                                ? 'border-primary-600 text-primary-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                    >
                        Vendor Agreements & SLAs ({agreements.length})
                    </button>
                </nav>
            </div>

            {/* TAB 1: Vendors Directory */}
            {activeTab === 'vendors' && (
                <div className="space-y-4">
                    {/* Filters & Search */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by name, GSTIN, code, city..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 w-full text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
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
                                value={complianceFilter}
                                onChange={(e) => setComplianceFilter(e.target.value)}
                                className="flex-1 sm:flex-none px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            >
                                {COMPLIANCE_STATUSES.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                                    <tr>
                                        <th className="py-3 px-4">Vendor Info</th>
                                        <th className="py-3 px-4">Category</th>
                                        <th className="py-3 px-4">Contact Person</th>
                                        <th className="py-3 px-4">Statutory Identifiers</th>
                                        <th className="py-3 px-4">Compliance Status</th>
                                        <th className="py-3 px-4">Rating</th>
                                        {(canCreate || canUpdate || canDelete) && <th className="py-3 px-4 text-right">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="7" className="text-center py-8 text-slate-400">Loading vendors...</td>
                                        </tr>
                                    ) : filteredVendors.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="text-center py-10 text-slate-400">
                                                No vendors found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredVendors.map((v) => (
                                            <tr key={v.vendor_id} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-slate-900">{v.vendor_name}</div>
                                                    <div className="text-xs text-slate-400 font-mono mt-0.5">{v.vendor_code}</div>
                                                    {v.city && (
                                                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                            <MapPin size={11} /> {v.city}, {v.state}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium">
                                                        {v.category}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-slate-800">{v.contact_person || '—'}</div>
                                                    {v.phone && (
                                                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                            <Phone size={11} /> {v.phone}
                                                        </div>
                                                    )}
                                                    {v.email && (
                                                        <div className="text-xs text-slate-500 flex items-center gap-1">
                                                            <Mail size={11} /> {v.email}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-xs space-y-1">
                                                    <div><span className="text-slate-400">GST:</span> <span className="font-mono text-slate-700">{v.gstin || '—'}</span></div>
                                                    <div><span className="text-slate-400">PAN:</span> <span className="font-mono text-slate-700">{v.pan || '—'}</span></div>
                                                    <div><span className="text-slate-400">PF Code:</span> <span className="font-mono text-slate-700">{v.pf_code || '—'}</span></div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {v.compliance_status === 'COMPLIANT' && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                                                            <ShieldCheck size={12} /> Compliant
                                                        </span>
                                                    )}
                                                    {v.compliance_status === 'UNDER_AUDIT' && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                                                            <Clock size={12} /> Under Audit
                                                        </span>
                                                    )}
                                                    {v.compliance_status === 'NON_COMPLIANT' && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-semibold">
                                                            <ShieldAlert size={12} /> Non-Compliant
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-1 text-amber-500 font-semibold text-xs">
                                                        <Star size={13} fill="currentColor" />
                                                        <span>{v.rating || '4.0'}</span>
                                                    </div>
                                                </td>
                                                {(canCreate || canUpdate || canDelete) && (
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {canCreate && (
                                                                <button
                                                                    onClick={() => openAddAgreementModal(v.vendor_id)}
                                                                    title="Add Agreement"
                                                                    className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-md transition-colors"
                                                                >
                                                                    <Calendar size={15} />
                                                                </button>
                                                            )}
                                                            {canUpdate && (
                                                                <button
                                                                    onClick={() => openEditVendor(v)}
                                                                    title="Edit Vendor"
                                                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
                                                                >
                                                                    <Edit3 size={15} />
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDeleteVendor(v.vendor_id, v.vendor_name)}
                                                                    title="Delete Vendor"
                                                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
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

                    {/* Mobile Cards */}
                    <div className="block md:hidden space-y-3">
                        {loading ? (
                            <div className="text-center py-8 text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">Loading vendors...</div>
                        ) : filteredVendors.length === 0 ? (
                            <div className="text-center py-8 text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">No vendors found.</div>
                        ) : (
                            filteredVendors.map((v) => (
                                <div key={v.vendor_id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2.5 text-xs">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="font-bold text-slate-900 text-sm">{v.vendor_name}</div>
                                            <div className="text-[11px] font-mono text-slate-400">{v.vendor_code} • {v.category}</div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                            v.compliance_status === 'COMPLIANT' ? 'bg-emerald-50 text-emerald-700' :
                                            v.compliance_status === 'UNDER_AUDIT' ? 'bg-amber-50 text-amber-700' :
                                            'bg-rose-50 text-rose-700'
                                        }`}>
                                            {v.compliance_status}
                                        </span>
                                    </div>
                                    <div className="space-y-1 text-slate-600">
                                        <div className="font-medium text-slate-800">{v.contact_person || '—'}</div>
                                        {v.phone && <div className="flex items-center gap-1.5"><Phone size={11} /> {v.phone}</div>}
                                        {v.city && <div className="flex items-center gap-1.5"><MapPin size={11} /> {v.city}, {v.state}</div>}
                                    </div>
                                    <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg text-[11px]">
                                        <span className="font-mono text-slate-600">GST: {v.gstin || '—'}</span>
                                        <span className="flex items-center gap-1 text-amber-500 font-bold">
                                            <Star size={12} fill="currentColor" /> {v.rating || '4.0'}
                                        </span>
                                    </div>
                                    {(canCreate || canUpdate || canDelete) && (
                                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                                            {canCreate && (
                                                <button onClick={() => openAddAgreementModal(v.vendor_id)} className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-semibold">
                                                    + SLA
                                                </button>
                                            )}
                                            {canUpdate && (
                                                <button onClick={() => openEditVendor(v)} className="px-2.5 py-1 rounded-lg border border-slate-200 text-indigo-600 font-semibold">
                                                    Edit
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button onClick={() => handleDeleteVendor(v.vendor_id, v.vendor_name)} className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 font-semibold">
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

            {/* TAB 2: Vendor Agreements */}
            {activeTab === 'agreements' && (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                                    <tr>
                                        <th className="py-3 px-4">Agreement Code</th>
                                        <th className="py-3 px-4">Vendor</th>
                                        <th className="py-3 px-4">Title / Purpose</th>
                                        <th className="py-3 px-4">Validity Period</th>
                                        <th className="py-3 px-4">Contract Value</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4">SLA Terms</th>
                                        {(canUpdate || canDelete) && <th className="py-3 px-4 text-right">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {agreements.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="text-center py-8 text-slate-400">
                                                No agreements created yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        agreements.map((a) => (
                                            <tr key={a.agreement_id} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="py-3 px-4 font-mono font-medium text-xs text-slate-800">{a.agreement_code}</td>
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-slate-900">{a.vendor_name}</div>
                                                    <div className="text-xs text-slate-400">{a.category}</div>
                                                </td>
                                                <td className="py-3 px-4 font-medium text-slate-800">{a.title}</td>
                                                <td className="py-3 px-4 text-xs">
                                                    <div>{formatIstDate(a.start_date)} to</div>
                                                    <div className="font-semibold text-slate-700">{formatIstDate(a.expiry_date)}</div>
                                                    {a.days_to_expiry !== undefined && a.days_to_expiry !== null && (
                                                        <span className={`text-[11px] font-medium ${
                                                            a.days_to_expiry < 0 ? 'text-rose-600' : a.days_to_expiry <= 30 ? 'text-amber-600' : 'text-emerald-600'
                                                        }`}>
                                                            {a.days_to_expiry < 0 ? `Expired ${Math.abs(a.days_to_expiry)}d ago` : `${a.days_to_expiry} days remaining`}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 font-semibold text-slate-900">
                                                    ₹{parseFloat(a.contract_value || 0).toLocaleString('en-IN')}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                        a.status === 'ACTIVE'
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    }`}>
                                                        {a.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate" title={a.sla_terms}>
                                                    {a.sla_terms || 'Standard SLA'}
                                                </td>
                                                {(canUpdate || canDelete) && (
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="inline-flex items-center gap-1">
                                                            {canUpdate && (
                                                                <button
                                                                    onClick={() => openEditAgreementModal(a)}
                                                                    title="Edit Agreement"
                                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
                                                                >
                                                                    <Edit3 size={15} />
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDeleteAgreement(a.agreement_id)}
                                                                    title="Delete Agreement"
                                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
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

                    {/* Mobile Agreement Cards */}
                    <div className="block md:hidden space-y-3">
                        {agreements.length === 0 ? (
                            <div className="text-center py-8 text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                                No agreements created yet.
                            </div>
                        ) : (
                            agreements.map((a) => (
                                <div key={a.agreement_id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2 text-xs">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="font-mono text-[11px] text-slate-400">{a.agreement_code}</div>
                                            <div className="font-bold text-slate-900">{a.title}</div>
                                            <div className="text-slate-600">{a.vendor_name}</div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                            a.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                        }`}>
                                            {a.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                                        <span>{formatIstDate(a.start_date)} – {formatIstDate(a.expiry_date)}</span>
                                        <span className="font-bold text-slate-900">₹{parseFloat(a.contract_value || 0).toLocaleString('en-IN')}</span>
                                    </div>
                                    {(canUpdate || canDelete) && (
                                        <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                                            {canUpdate && (
                                                <button onClick={() => openEditAgreementModal(a)} className="px-2.5 py-1 rounded-lg border border-slate-200 text-indigo-600 font-semibold">
                                                    Edit
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button onClick={() => handleDeleteAgreement(a.agreement_id)} className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 font-semibold">
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}

            {/* MODAL 1: Add/Edit Vendor */}
            {showVendorModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
                            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
                                <h2 className="text-lg font-bold text-slate-900">
                                    {editingVendor ? 'Edit Vendor Details' : 'Register New Vendor / Subcontractor'}
                                </h2>
                                <button
                                    onClick={() => setShowVendorModal(false)}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateOrUpdateVendor} className="space-y-4 p-6 overflow-y-auto">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                                            Vendor Company Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={vendorForm.vendor_name}
                                            onChange={(e) => setVendorForm({ ...vendorForm, vendor_name: e.target.value })}
                                            placeholder="e.g. Apex Security Solutions Pvt Ltd"
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                                            Category *
                                        </label>
                                        <select
                                            value={vendorForm.category}
                                            onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })}
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20"
                                        >
                                            {CATEGORIES.filter(c => c.value !== 'ALL').map(c => (
                                                <option key={c.value} value={c.value}>{c.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Contact Person</label>
                                        <input
                                            type="text"
                                            value={vendorForm.contact_person}
                                            onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
                                            placeholder="Name"
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Phone Number</label>
                                        <input
                                            type="tel"
                                            value={vendorForm.phone}
                                            onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                                            placeholder="+91 98765 43210"
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={vendorForm.email}
                                            onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                                            placeholder="vendor@example.com"
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">City</label>
                                        <input
                                            type="text"
                                            value={vendorForm.city}
                                            onChange={(e) => setVendorForm({ ...vendorForm, city: e.target.value })}
                                            placeholder="Mumbai"
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">State</label>
                                        <input
                                            type="text"
                                            value={vendorForm.state}
                                            onChange={(e) => setVendorForm({ ...vendorForm, state: e.target.value })}
                                            placeholder="Maharashtra"
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                </div>

                                {/* Statutory Details */}
                                <div className="p-3 bg-slate-50 rounded-xl space-y-3 border border-slate-100">
                                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                        Statutory & Compliance Details
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">GSTIN</label>
                                            <input
                                                type="text"
                                                value={vendorForm.gstin}
                                                onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value.toUpperCase() })}
                                                placeholder="27AAAAA0000A1Z5"
                                                className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-200 rounded bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">PAN</label>
                                            <input
                                                type="text"
                                                value={vendorForm.pan}
                                                onChange={(e) => setVendorForm({ ...vendorForm, pan: e.target.value.toUpperCase() })}
                                                placeholder="AAAAA0000A"
                                                className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-200 rounded bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">PF Code</label>
                                            <input
                                                type="text"
                                                value={vendorForm.pf_code}
                                                onChange={(e) => setVendorForm({ ...vendorForm, pf_code: e.target.value })}
                                                placeholder="MH/BAN/0000000"
                                                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">ESIC Code</label>
                                            <input
                                                type="text"
                                                value={vendorForm.esic_code}
                                                onChange={(e) => setVendorForm({ ...vendorForm, esic_code: e.target.value })}
                                                placeholder="31000000000000000"
                                                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Compliance Status</label>
                                            <select
                                                value={vendorForm.compliance_status}
                                                onChange={(e) => setVendorForm({ ...vendorForm, compliance_status: e.target.value })}
                                                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded bg-white font-medium"
                                            >
                                                <option value="COMPLIANT">Compliant</option>
                                                <option value="UNDER_AUDIT">Under Audit</option>
                                                <option value="NON_COMPLIANT">Non-Compliant</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Performance Rating (1-5)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="1"
                                                max="5"
                                                value={vendorForm.rating}
                                                onChange={(e) => setVendorForm({ ...vendorForm, rating: e.target.value })}
                                                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Bank Details */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Bank Name</label>
                                        <input
                                            type="text"
                                            value={vendorForm.bank_name}
                                            onChange={(e) => setVendorForm({ ...vendorForm, bank_name: e.target.value })}
                                            placeholder="e.g. HDFC Bank"
                                            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Account Number</label>
                                        <input
                                            type="text"
                                            value={vendorForm.account_number}
                                            onChange={(e) => setVendorForm({ ...vendorForm, account_number: e.target.value })}
                                            placeholder="Account Number"
                                            className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">IFSC Code</label>
                                        <input
                                            type="text"
                                            value={vendorForm.ifsc_code}
                                            onChange={(e) => setVendorForm({ ...vendorForm, ifsc_code: e.target.value.toUpperCase() })}
                                            placeholder="HDFC0001234"
                                            className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowVendorModal(false)}
                                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors shadow-2xs"
                                    >
                                        {editingVendor ? 'Save Changes' : 'Register Vendor'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* MODAL 2: Add / Edit Agreement */}
            {showAgreementModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
                            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
                                <h2 className="text-lg font-bold text-slate-900">
                                    {editingAgreement ? `Edit Agreement (${editingAgreement.agreement_code})` : 'New Vendor Agreement / SLA'}
                                </h2>
                                <button
                                    onClick={() => setShowAgreementModal(false)}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveAgreement} className="space-y-4 p-6 overflow-y-auto">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Select Vendor *</label>
                                    <select
                                        required
                                        value={agreementForm.vendor_id}
                                        onChange={(e) => setAgreementForm({ ...agreementForm, vendor_id: e.target.value })}
                                        className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                    >
                                        <option value="">Select Vendor...</option>
                                        {vendors.map(v => (
                                            <option key={v.vendor_id} value={v.vendor_id}>
                                                {v.vendor_name} ({v.vendor_code})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Agreement Title *</label>
                                    <input
                                        type="text"
                                        required
                                        value={agreementForm.title}
                                        onChange={(e) => setAgreementForm({ ...agreementForm, title: e.target.value })}
                                        placeholder="e.g. Annual Manpower Supply Agreement 2026-27"
                                        className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Start Date *</label>
                                        <input
                                            type="date"
                                            required
                                            value={agreementForm.start_date}
                                            onChange={(e) => setAgreementForm({ ...agreementForm, start_date: e.target.value })}
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Expiry Date *</label>
                                        <input
                                            type="date"
                                            required
                                            value={agreementForm.expiry_date}
                                            onChange={(e) => setAgreementForm({ ...agreementForm, expiry_date: e.target.value })}
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Contract Value (₹)</label>
                                        <input
                                            type="number"
                                            value={agreementForm.contract_value}
                                            onChange={(e) => setAgreementForm({ ...agreementForm, contract_value: e.target.value })}
                                            placeholder="500000"
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Agreement Status</label>
                                        <select
                                            value={agreementForm.status}
                                            onChange={(e) => setAgreementForm({ ...agreementForm, status: e.target.value })}
                                            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg"
                                        >
                                            <option value="ACTIVE">ACTIVE</option>
                                            <option value="EXPIRED">EXPIRED</option>
                                            <option value="TERMINATED">TERMINATED</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">SLA Terms & Penalties</label>
                                    <textarea
                                        rows="3"
                                        value={agreementForm.sla_terms}
                                        onChange={(e) => setAgreementForm({ ...agreementForm, sla_terms: e.target.value })}
                                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg"
                                    />
                                </div>

                                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowAgreementModal(false)}
                                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors shadow-2xs"
                                    >
                                        {editingAgreement ? 'Save Changes' : 'Save Agreement'}
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

export default Vendors;
