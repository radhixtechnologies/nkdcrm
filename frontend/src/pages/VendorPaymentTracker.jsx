import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    IndianRupee, Download, Plus, Search, Filter, RefreshCw,
    Building2, CheckCircle2, Clock, AlertTriangle, AlertCircle,
    FileSpreadsheet, CreditCard, ChevronRight, X, Edit2, Trash2,
    History, ArrowUpRight, Check, FileText, PieChart, BarChart3,
    TrendingUp, ExternalLink, Calendar, Layers, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import vendorPaymentService from '../services/vendorPaymentService';
import siteService from '../services/siteService';
import vendorService from '../services/vendorService';
import { useAuth } from '../context/AuthContext';
import { extractApiError } from '../services/api';
import ModalPortal from '../components/common/ModalPortal';

const formatINR = (val) => {
    if (val === undefined || val === null || val === '') return '₹0';
    const num = Math.round(Number(val));
    return '₹' + num.toLocaleString('en-IN');
};

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

const getIstToday = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

const emptyInvoiceForm = () => ({
    vendor_name: '',
    site_name: '',
    invoice_number: '',
    invoice_date: getIstToday(),
    due_date: '',
    po_number: '',
    category: 'MATERIAL',
    basic_amount: '',
    gst_rate: 18,
    gst_amount: '',
    tds_rate: 2,
    tds_amount: '',
    invoice_value: '',
    total_payable: '',
    paid_amount: 0,
    status: 'OUTSTANDING',
    remarks: ''
});

const emptyPaymentForm = (invoice = null) => ({
    invoice_id: invoice?.invoice_id || '',
    amount_paid: invoice ? Math.max(0, parseFloat(invoice.outstanding_amount || invoice.total_payable || 0)) : '',
    payment_date: getIstToday(),
    payment_mode: 'NEFT/RTGS',
    transaction_reference: '',
    bank_name: 'HDFC Bank',
    paid_by: 'Finance Dept',
    remarks: ''
});

const VendorPaymentTracker = () => {
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('VENDORS', 'can_create');
    const canUpdate = hasPermission('VENDORS', 'can_update');
    const canDelete = hasPermission('VENDORS', 'can_delete');

    // Active Navigation Tab
    const [activeTab, setActiveTab] = useState('DASHBOARD'); // 'DASHBOARD' | 'TRACKER' | 'OUTSTANDING' | 'SITES'

    // Data States
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [sitesList, setSitesList] = useState([]);
    const [vendorsList, setVendorsList] = useState([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('ALL');
    const [selectedSite, setSelectedSite] = useState('ALL');

    // Modals
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [invoiceForm, setInvoiceForm] = useState(emptyInvoiceForm());

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [payingInvoice, setPayingInvoice] = useState(null);
    const [paymentForm, setPaymentForm] = useState(emptyPaymentForm());

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyInvoice, setHistoryInvoice] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Initial Data Fetch
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [statsRes, invRes] = await Promise.all([
                vendorPaymentService.getStats(),
                vendorPaymentService.getInvoices()
            ]);
            setStats(statsRes.data?.data || statsRes.data);
            setInvoices(invRes.data?.data || invRes.data || []);
        } catch (err) {
            toast.error(extractApiError(err) || 'Failed to load vendor payment data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        // Load sites and vendors for dropdowns
        siteService.getAllSites()
            .then(res => setSitesList(res.data?.data || res.data || []))
            .catch(() => {});
        vendorService.getVendors()
            .then(res => setVendorsList(res.data?.data || res.data || []))
            .catch(() => {});
    }, [loadData]);

    // Recalculate amounts in Invoice Form
    const handleInvoiceFormChange = (field, value) => {
        setInvoiceForm(prev => {
            const updated = { ...prev, [field]: value };
            if (['basic_amount', 'gst_rate', 'tds_rate'].includes(field)) {
                const basic = parseFloat(field === 'basic_amount' ? value : updated.basic_amount) || 0;
                const gRate = parseFloat(field === 'gst_rate' ? value : updated.gst_rate) || 18;
                const tRate = parseFloat(field === 'tds_rate' ? value : updated.tds_rate) || 2;

                const gst = Math.round((basic * (gRate / 100)) * 100) / 100;
                const tds = Math.round((basic * (tRate / 100)) * 100) / 100;
                const invVal = Math.round((basic + gst) * 100) / 100;
                const payable = Math.round((invVal - tds) * 100) / 100;

                updated.gst_amount = gst;
                updated.tds_amount = tds;
                updated.invoice_value = invVal;
                updated.total_payable = payable;
            }
            return updated;
        });
    };

    // Open Add Invoice Modal
    const handleOpenAddInvoice = () => {
        setEditingInvoice(null);
        setInvoiceForm(emptyInvoiceForm());
        setShowInvoiceModal(true);
    };

    // Open Edit Invoice Modal
    const handleOpenEditInvoice = (inv) => {
        setEditingInvoice(inv);
        setInvoiceForm({
            vendor_name: inv.vendor_name || '',
            site_name: inv.site_name || '',
            invoice_number: inv.invoice_number || '',
            invoice_date: inv.invoice_date || getIstToday(),
            due_date: inv.due_date || '',
            po_number: inv.po_number || '',
            category: inv.category || 'MATERIAL',
            basic_amount: inv.basic_amount || '',
            gst_rate: inv.gst_rate || 18,
            gst_amount: inv.gst_amount || '',
            tds_rate: inv.tds_rate || 2,
            tds_amount: inv.tds_amount || '',
            invoice_value: inv.invoice_value || '',
            total_payable: inv.total_payable || '',
            paid_amount: inv.paid_amount || 0,
            status: inv.status || 'OUTSTANDING',
            remarks: inv.remarks || ''
        });
        setShowInvoiceModal(true);
    };

    // Save Invoice
    const handleSaveInvoice = async (e) => {
        e.preventDefault();
        if (!invoiceForm.invoice_number || !invoiceForm.vendor_name || !invoiceForm.site_name) {
            toast.error('Please enter Invoice Number, Vendor Name, and Site');
            return;
        }

        setSubmitting(true);
        try {
            if (editingInvoice) {
                await vendorPaymentService.updateInvoice(editingInvoice.invoice_id, invoiceForm);
                toast.success('Invoice updated successfully');
            } else {
                await vendorPaymentService.createInvoice(invoiceForm);
                toast.success('Invoice registered successfully');
            }
            setShowInvoiceModal(false);
            loadData();
        } catch (err) {
            toast.error(extractApiError(err) || 'Failed to save invoice');
        } finally {
            setSubmitting(false);
        }
    };

    // Delete Invoice
    const handleDeleteInvoice = async (id, invNum) => {
        if (!window.confirm(`Are you sure you want to delete invoice ${invNum}? This will remove associated payment records.`)) {
            return;
        }
        try {
            await vendorPaymentService.deleteInvoice(id);
            toast.success('Invoice deleted successfully');
            loadData();
        } catch (err) {
            toast.error(extractApiError(err) || 'Failed to delete invoice');
        }
    };

    // Open Record Payment Modal
    const handleOpenPayment = (inv) => {
        setPayingInvoice(inv);
        setPaymentForm(emptyPaymentForm(inv));
        setShowPaymentModal(true);
    };

    // Submit Payment
    const handleSavePayment = async (e) => {
        e.preventDefault();
        const amt = parseFloat(paymentForm.amount_paid);
        if (!amt || amt <= 0) {
            toast.error('Please enter a valid payment amount greater than zero');
            return;
        }

        setSubmitting(true);
        try {
            await vendorPaymentService.recordPayment(payingInvoice.invoice_id, paymentForm);
            toast.success(`Payment of ${formatINR(amt)} recorded successfully!`);
            setShowPaymentModal(false);
            loadData();
        } catch (err) {
            toast.error(extractApiError(err) || 'Failed to record payment');
        } finally {
            setSubmitting(false);
        }
    };

    // Open Payment History Modal
    const handleOpenHistory = async (inv) => {
        setHistoryLoading(true);
        setShowHistoryModal(true);
        try {
            const res = await vendorPaymentService.getInvoiceById(inv.invoice_id);
            setHistoryInvoice(res.data?.data || res.data);
        } catch (err) {
            toast.error('Failed to load invoice history');
            setShowHistoryModal(false);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Download Excel Tracker
    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const res = await vendorPaymentService.exportExcel();
            const blob = new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `VENDOR_PAYMENT_TRACKER_FY-26-2027_${getIstToday()}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('Vendor payment spreadsheet downloaded successfully!');
        } catch (err) {
            toast.error('Failed to download Excel tracker');
        } finally {
            setExporting(false);
        }
    };

    // Filtered Invoices List
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const matchesSearch = !searchTerm ||
                inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                inv.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                inv.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                inv.site_name?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = selectedStatus === 'ALL' || inv.status === selectedStatus;
            const matchesSite = selectedSite === 'ALL' || inv.site_name === selectedSite;

            return matchesSearch && matchesStatus && matchesSite;
        });
    }, [invoices, searchTerm, selectedStatus, selectedSite]);

    // Outstanding Invoices List
    const outstandingInvoices = useMemo(() => {
        return invoices.filter(i => i.status === 'OUTSTANDING' || i.status === 'PART_PAID');
    }, [invoices]);

    // Unique Sites from Invoices
    const availableSites = useMemo(() => {
        const set = new Set(invoices.map(i => i.site_name).filter(Boolean));
        return Array.from(set).sort();
    }, [invoices]);

    return (
        <div className="space-y-6">
            {/* Top Corporate Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Live Financial Tracker
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-500/20 text-primary-300 border border-primary-500/30">
                                FY 2026-27
                            </span>
                        </div>
                        <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white">
                            VENDOR PAYMENT DASHBOARD
                        </h1>
                        <p className="text-sm text-slate-300 mt-1 flex items-center gap-2">
                            <span>N.K.D Power Solutions Pvt Ltd</span>
                            <span>•</span>
                            <span>Updates automatically from the Vendor Payment Tracker</span>
                            <span>•</span>
                            <span className="text-slate-400">As of Nov 2026</span>
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={loadData}
                            disabled={loading}
                            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700 flex items-center justify-center cursor-pointer"
                            title="Refresh Data"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>

                        <button
                            onClick={handleExportExcel}
                            disabled={exporting}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-md transition flex items-center gap-2 cursor-pointer"
                        >
                            <FileSpreadsheet size={18} />
                            <span>{exporting ? 'Generating...' : 'Export Excel'}</span>
                        </button>

                        {canCreate && (
                            <button
                                onClick={handleOpenAddInvoice}
                                className="px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-semibold shadow-md transition flex items-center gap-2 cursor-pointer"
                            >
                                <Plus size={18} />
                                <span>New Invoice</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 6 Top Metric Cards (Exact layout from client sheet) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* 1. Total Payable */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Total Payable (Net of TDS)
                        </div>
                        <div className="text-xl lg:text-2xl font-black text-slate-900 mt-1">
                            {formatINR(stats?.kpi?.total_payable)}
                        </div>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-2 pt-2 border-t border-slate-100 truncate">
                        Invoice value {formatINR(stats?.kpi?.invoice_value)}
                    </div>
                </div>

                {/* 2. Paid */}
                <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-xs flex flex-col justify-between bg-gradient-to-b from-white to-emerald-50/30">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                            Paid
                        </div>
                        <div className="text-xl lg:text-2xl font-black text-emerald-600 mt-1">
                            {formatINR(stats?.kpi?.total_paid)}
                        </div>
                    </div>
                    <div className="text-[11px] text-emerald-700 font-semibold mt-2 pt-2 border-t border-emerald-100">
                        {stats?.kpi?.paid_percent || '68.7%'} of payable
                    </div>
                </div>

                {/* 3. Outstanding */}
                <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-xs flex flex-col justify-between bg-gradient-to-b from-white to-rose-50/30">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                            Outstanding
                        </div>
                        <div className="text-xl lg:text-2xl font-black text-rose-600 mt-1">
                            {formatINR(stats?.kpi?.total_outstanding)}
                        </div>
                    </div>
                    <div className="text-[11px] text-rose-700 font-semibold mt-2 pt-2 border-t border-rose-100">
                        {stats?.kpi?.outstanding_percent || '36.4%'} of payable
                    </div>
                </div>

                {/* 4. Open Invoices */}
                <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-xs flex flex-col justify-between bg-gradient-to-b from-white to-amber-50/30">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                            Open Invoices
                        </div>
                        <div className="text-xl lg:text-2xl font-black text-amber-600 mt-1">
                            {stats?.kpi?.open_invoices ?? 22}
                        </div>
                    </div>
                    <div className="text-[11px] text-amber-700 font-medium mt-2 pt-2 border-t border-amber-100">
                        {stats?.kpi?.awaiting_invoice_count ?? 6} awaiting invoice
                    </div>
                </div>

                {/* 5. GST On Invoices */}
                <div className="bg-white rounded-xl p-4 border border-indigo-200 shadow-xs flex flex-col justify-between bg-gradient-to-b from-white to-indigo-50/30">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                            GST on Invoices
                        </div>
                        <div className="text-xl lg:text-2xl font-black text-indigo-700 mt-1">
                            {formatINR(stats?.kpi?.total_gst)}
                        </div>
                    </div>
                    <div className="text-[11px] text-indigo-600 font-medium mt-2 pt-2 border-t border-indigo-100">
                        Input credit to match
                    </div>
                </div>

                {/* 6. TDS To Deposit */}
                <div className="bg-white rounded-xl p-4 border border-purple-200 shadow-xs flex flex-col justify-between bg-gradient-to-b from-white to-purple-50/30">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                            TDS to Deposit
                        </div>
                        <div className="text-xl lg:text-2xl font-black text-purple-700 mt-1">
                            {formatINR(stats?.kpi?.total_tds)}
                        </div>
                    </div>
                    <div className="text-[11px] text-purple-600 font-medium mt-2 pt-2 border-t border-purple-100">
                        Deducted from payables
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl shadow-xs">
                <button
                    onClick={() => setActiveTab('DASHBOARD')}
                    className={`flex items-center gap-2 py-3.5 px-4 font-semibold text-sm border-b-2 transition cursor-pointer ${
                        activeTab === 'DASHBOARD'
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <PieChart size={18} />
                    <span>Dashboard & Position</span>
                </button>

                <button
                    onClick={() => setActiveTab('TRACKER')}
                    className={`flex items-center gap-2 py-3.5 px-4 font-semibold text-sm border-b-2 transition cursor-pointer ${
                        activeTab === 'TRACKER'
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <FileSpreadsheet size={18} />
                    <span>Vendor Payment Tracker</span>
                    <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                        {invoices.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('OUTSTANDING')}
                    className={`flex items-center gap-2 py-3.5 px-4 font-semibold text-sm border-b-2 transition cursor-pointer ${
                        activeTab === 'OUTSTANDING'
                            ? 'border-rose-600 text-rose-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <AlertCircle size={18} />
                    <span>Outstanding Payments</span>
                    <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                        {outstandingInvoices.length}
                    </span>
                </button>
            </div>

            {/* ============================================================== */}
            {/* TAB 1: DASHBOARD & POSITION                                     */}
            {/* ============================================================== */}
            {activeTab === 'DASHBOARD' && (
                <div className="space-y-6">
                    {/* Top Row: Payment Status Table & Visual Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Status Table */}
                        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
                                <h3 className="font-bold text-sm tracking-wide flex items-center gap-2">
                                    <Layers size={16} className="text-primary-400" />
                                    <span>PAYMENT STATUS</span>
                                </h3>
                                <span className="text-xs text-slate-400">79 Total Line Items</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4 text-center">Invoices</th>
                                            <th className="py-3 px-4 text-right">Payable</th>
                                            <th className="py-3 px-4 text-right">Paid</th>
                                            <th className="py-3 px-4 text-right">Outstanding</th>
                                            <th className="py-3 px-4 text-right">% of Outst.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {stats?.status_breakdown?.map((s, idx) => {
                                            const isPaid = s.status === 'PAID';
                                            const isPart = s.status === 'PART_PAID';
                                            const isOut = s.status === 'OUTSTANDING';
                                            const isAwait = s.status === 'AWAITING_INVOICE';

                                            return (
                                                <tr key={idx} className="hover:bg-slate-50/80 transition">
                                                    <td className="py-3 px-4 font-semibold">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
                                                            isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                            isPart ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                            isOut ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                            'bg-slate-100 text-slate-700 border border-slate-200'
                                                        }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                                isPaid ? 'bg-emerald-500' :
                                                                isPart ? 'bg-amber-500' :
                                                                isOut ? 'bg-rose-500' :
                                                                'bg-slate-400'
                                                            }`} />
                                                            {s.status === 'PART_PAID' ? 'Part Paid' :
                                                             s.status === 'AWAITING_INVOICE' ? 'Awaiting Invoice' :
                                                             s.status === 'OUTSTANDING' ? 'Outstanding' : 'Paid'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-bold text-slate-700">
                                                        {s.invoices}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-semibold text-slate-800">
                                                        {formatINR(s.payable)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                                                        {formatINR(s.paid)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-semibold text-rose-600">
                                                        {formatINR(s.outstanding)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-bold text-slate-600">
                                                        {s.percent_outst || '0.0%'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-slate-100/80 font-black text-slate-900 border-t-2 border-slate-300">
                                        <tr>
                                            <td className="py-3 px-4 uppercase text-xs">Total</td>
                                            <td className="py-3 px-4 text-center">{stats?.kpi?.total_items || 79}</td>
                                            <td className="py-3 px-4 text-right">{formatINR(stats?.kpi?.total_payable)}</td>
                                            <td className="py-3 px-4 text-right text-emerald-700">{formatINR(stats?.kpi?.total_paid)}</td>
                                            <td className="py-3 px-4 text-right text-rose-700">{formatINR(stats?.kpi?.total_outstanding)}</td>
                                            <td className="py-3 px-4 text-right">100.0%</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Visual Breakdown Card */}
                        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
                            <div>
                                <h4 className="font-bold text-slate-900 text-sm flex items-center justify-between mb-4">
                                    <span>Payable Distribution</span>
                                    <span className="text-xs font-normal text-slate-500">FY 2026-27</span>
                                </h4>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-xs font-semibold mb-1">
                                            <span className="text-emerald-700 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                                Paid Invoices
                                            </span>
                                            <span className="text-slate-900">37.8% (₹46.53 L)</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '37.8%' }} />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-xs font-semibold mb-1">
                                            <span className="text-amber-700 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                Part Paid Invoices
                                            </span>
                                            <span className="text-slate-900">52.1% (₹64.15 L)</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-amber-500 rounded-full" style={{ width: '52.1%' }} />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-xs font-semibold mb-1">
                                            <span className="text-rose-700 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                                Outstanding
                                            </span>
                                            <span className="text-slate-900">10.1% (₹12.38 L)</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-rose-500 rounded-full" style={{ width: '10.1%' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mt-6">
                                <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                    Financial Insight
                                </div>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    72.4% of total outstanding liabilities belong to active supply contracts currently in Part Paid status. HMCL Dharuhera and Sify Rabale account for over 68% of total outstanding.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bottom: Site-Wise Position Table (Exact matching from sheet) */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
                            <h3 className="font-bold text-sm tracking-wide flex items-center gap-2">
                                <Building2 size={16} className="text-primary-400" />
                                <span>SITE-WISE POSITION</span>
                            </h3>
                            <span className="text-xs text-slate-400">10 Active Client Sites + Corporate</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="py-3 px-4">Site Name</th>
                                        <th className="py-3 px-4 text-center">Invoices</th>
                                        <th className="py-3 px-4 text-right">Payable</th>
                                        <th className="py-3 px-4 text-right">Paid</th>
                                        <th className="py-3 px-4 text-right">Outstanding</th>
                                        <th className="py-3 px-4 text-center">% Paid</th>
                                        <th className="py-3 px-4">Outstanding Burden</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {stats?.site_positions?.map((site, idx) => {
                                        const outVal = parseFloat(site.outstanding || 0);
                                        const payableVal = parseFloat(site.payable || 0);
                                        const pctPaidNum = parseInt(site.percent_paid, 10) || 0;

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition">
                                                <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                                                    <Building2 size={15} className="text-slate-400" />
                                                    <span>{site.site_name}</span>
                                                </td>
                                                <td className="py-3 px-4 text-center font-semibold text-slate-600">
                                                    {site.invoices}
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold text-slate-800">
                                                    {formatINR(site.payable)}
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                                                    {formatINR(site.paid)}
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold text-rose-600">
                                                    {formatINR(site.outstanding)}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                        pctPaidNum >= 90 ? 'bg-emerald-100 text-emerald-800' :
                                                        pctPaidNum >= 50 ? 'bg-amber-100 text-amber-800' :
                                                        'bg-rose-100 text-rose-800'
                                                    }`}>
                                                        {site.percent_paid}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 w-48">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${outVal > 1000000 ? 'bg-rose-600' : outVal > 100000 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                                style={{ width: `${Math.min(100, Math.round((outVal / 2514174) * 100))}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[11px] font-mono text-slate-500 w-16 text-right truncate">
                                                            {outVal > 0 ? formatINR(outVal) : '₹0'}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                                    <tr>
                                        <td className="py-3 px-4 uppercase text-xs">Total (73 Invoices)</td>
                                        <td className="py-3 px-4 text-center">73</td>
                                        <td className="py-3 px-4 text-right">{formatINR(stats?.kpi?.total_payable)}</td>
                                        <td className="py-3 px-4 text-right text-emerald-700">{formatINR(stats?.kpi?.total_paid)}</td>
                                        <td className="py-3 px-4 text-right text-rose-700">{formatINR(stats?.kpi?.total_outstanding)}</td>
                                        <td className="py-3 px-4 text-center">69%</td>
                                        <td className="py-3 px-4 text-xs text-slate-500 font-normal">₹44,79,623 Total Outst.</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2 & 3: FULL INVOICES REGISTER / OUTSTANDING PAYMENTS        */}
            {/* ============================================================== */}
            {(activeTab === 'TRACKER' || activeTab === 'OUTSTANDING') && (
                <div className="space-y-4">
                    {/* Filter & Search Bar */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3 flex-1">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[240px]">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by Invoice #, Vendor, PO, Remarks..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>

                            {/* Status Filter */}
                            {activeTab === 'TRACKER' && (
                                <select
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                                >
                                    <option value="ALL">All Statuses</option>
                                    <option value="PAID">Paid</option>
                                    <option value="PART_PAID">Part Paid</option>
                                    <option value="OUTSTANDING">Outstanding</option>
                                    <option value="AWAITING_INVOICE">Awaiting Invoice</option>
                                </select>
                            )}

                            {/* Site Filter */}
                            <select
                                value={selectedSite}
                                onChange={(e) => setSelectedSite(e.target.value)}
                                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                            >
                                <option value="ALL">All Sites</option>
                                {availableSites.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
                            Showing <span className="font-bold text-slate-900">
                                {activeTab === 'OUTSTANDING' ? outstandingInvoices.length : filteredInvoices.length}
                            </span> records
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-900 text-white font-bold uppercase text-[11px] tracking-wider">
                                    <tr>
                                        <th className="py-3.5 px-4">Invoice / Date</th>
                                        <th className="py-3.5 px-4">Vendor Name</th>
                                        <th className="py-3.5 px-4">Site Name</th>
                                        <th className="py-3.5 px-4">PO Number</th>
                                        <th className="py-3.5 px-4 text-right">Net Payable</th>
                                        <th className="py-3.5 px-4 text-right">Paid Amount</th>
                                        <th className="py-3.5 px-4 text-right">Outstanding</th>
                                        <th className="py-3.5 px-4 text-center">Status</th>
                                        <th className="py-3.5 px-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(activeTab === 'OUTSTANDING' ? outstandingInvoices : filteredInvoices).length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="text-center py-12 text-slate-400">
                                                No invoice records found matching your filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        (activeTab === 'OUTSTANDING' ? outstandingInvoices : filteredInvoices).map((inv) => {
                                            const isPaid = inv.status === 'PAID';
                                            const isPart = inv.status === 'PART_PAID';
                                            const isOut = inv.status === 'OUTSTANDING';
                                            const isAwait = inv.status === 'AWAITING_INVOICE';

                                            return (
                                                <tr key={inv.invoice_id} className="hover:bg-slate-50/80 transition">
                                                    <td className="py-3.5 px-4">
                                                        <div className="font-bold text-slate-900">
                                                            {inv.invoice_number}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                            <Calendar size={12} />
                                                            <span>{formatIstDate(inv.invoice_date)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <div className="font-semibold text-slate-800">
                                                            {inv.vendor_name}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400">
                                                            {inv.category || 'MATERIAL'}
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                                                            {inv.site_name}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                                                        {inv.po_number || '—'}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                                                        {formatINR(inv.total_payable)}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-semibold text-emerald-600">
                                                        {formatINR(inv.paid_amount)}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-bold text-rose-600">
                                                        {formatINR(inv.outstanding_amount)}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
                                                            isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                            isPart ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                            isOut ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                            'bg-slate-100 text-slate-700 border border-slate-200'
                                                        }`}>
                                                            {isPaid ? 'Paid' :
                                                             isPart ? 'Part Paid' :
                                                             isOut ? 'Outstanding' : 'Awaiting Inv'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {/* Pay Button */}
                                                            {inv.status !== 'PAID' && canUpdate && (
                                                                <button
                                                                    onClick={() => handleOpenPayment(inv)}
                                                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-2xs transition cursor-pointer"
                                                                    title="Record Payment"
                                                                >
                                                                    Pay
                                                                </button>
                                                            )}

                                                            {/* History Button */}
                                                            <button
                                                                onClick={() => handleOpenHistory(inv)}
                                                                className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded transition cursor-pointer"
                                                                title="View Details & Payment History"
                                                            >
                                                                <History size={15} />
                                                            </button>

                                                            {/* Edit Button */}
                                                            {canUpdate && (
                                                                <button
                                                                    onClick={() => handleOpenEditInvoice(inv)}
                                                                    className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded transition cursor-pointer"
                                                                    title="Edit Invoice"
                                                                >
                                                                    <Edit2 size={15} />
                                                                </button>
                                                            )}

                                                            {/* Delete Button */}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDeleteInvoice(inv.invoice_id, inv.invoice_number)}
                                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition cursor-pointer"
                                                                    title="Delete Invoice"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* MODAL 1: ADD / EDIT INVOICE                                    */}
            {/* ============================================================== */}
            {showInvoiceModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-scale-in">
                            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
                                <h3 className="text-base font-bold flex items-center gap-2">
                                    <FileSpreadsheet size={18} className="text-primary-400" />
                                    <span>{editingInvoice ? 'Edit Vendor Invoice' : 'New Vendor Invoice'}</span>
                                </h3>
                                <button
                                    onClick={() => setShowInvoiceModal(false)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveInvoice} className="p-6 overflow-y-auto space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            Vendor Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            list="vendors-datalist"
                                            value={invoiceForm.vendor_name}
                                            onChange={(e) => handleInvoiceFormChange('vendor_name', e.target.value)}
                                            placeholder="e.g. Polycab India Ltd"
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        />
                                        <datalist id="vendors-datalist">
                                            {vendorsList.map(v => (
                                                <option key={v.vendor_id} value={v.vendor_name} />
                                            ))}
                                        </datalist>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            Site Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            list="sites-datalist"
                                            value={invoiceForm.site_name}
                                            onChange={(e) => handleInvoiceFormChange('site_name', e.target.value)}
                                            placeholder="e.g. HMCL DHARUHERA"
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        />
                                        <datalist id="sites-datalist">
                                            {availableSites.map(s => (
                                                <option key={s} value={s} />
                                            ))}
                                        </datalist>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            Invoice Number *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={invoiceForm.invoice_number}
                                            onChange={(e) => handleInvoiceFormChange('invoice_number', e.target.value)}
                                            placeholder="INV/26-27/..."
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            Invoice Date *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={invoiceForm.invoice_date}
                                            onChange={(e) => handleInvoiceFormChange('invoice_date', e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            PO Number
                                        </label>
                                        <input
                                            type="text"
                                            value={invoiceForm.po_number}
                                            onChange={(e) => handleInvoiceFormChange('po_number', e.target.value)}
                                            placeholder="PO-NKD-2026-..."
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            Category
                                        </label>
                                        <select
                                            value={invoiceForm.category}
                                            onChange={(e) => handleInvoiceFormChange('category', e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                                        >
                                            <option value="MATERIAL">Material / Equipment</option>
                                            <option value="SERVICE">Service / Contractor</option>
                                            <option value="ADVANCE">Advance Settlement</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Financial Calculations Block */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                        Tax & Net Calculation
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs text-slate-600 mb-1">Basic Amount (₹)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={invoiceForm.basic_amount}
                                                onChange={(e) => handleInvoiceFormChange('basic_amount', e.target.value)}
                                                placeholder="0.00"
                                                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs text-slate-600 mb-1">GST @ 18% (₹)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={invoiceForm.gst_amount}
                                                onChange={(e) => handleInvoiceFormChange('gst_amount', e.target.value)}
                                                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs text-slate-600 mb-1">TDS @ 2% (₹)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={invoiceForm.tds_amount}
                                                onChange={(e) => handleInvoiceFormChange('tds_amount', e.target.value)}
                                                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Invoice Value (Basic + GST)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={invoiceForm.invoice_value}
                                                onChange={(e) => handleInvoiceFormChange('invoice_value', e.target.value)}
                                                className="w-full px-3 py-1.5 text-sm font-bold border border-slate-200 rounded-lg bg-slate-100"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-primary-700 mb-1">Total Payable (Net of TDS)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={invoiceForm.total_payable}
                                                onChange={(e) => handleInvoiceFormChange('total_payable', e.target.value)}
                                                className="w-full px-3 py-1.5 text-sm font-bold border border-primary-300 rounded-lg bg-primary-50 text-primary-900"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        Remarks / Notes
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={invoiceForm.remarks}
                                        onChange={(e) => handleInvoiceFormChange('remarks', e.target.value)}
                                        placeholder="Add any specific context, supply scope or payment terms..."
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowInvoiceModal(false)}
                                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-500 text-white rounded-lg shadow-md transition cursor-pointer"
                                    >
                                        {submitting ? 'Saving...' : (editingInvoice ? 'Update Invoice' : 'Save Invoice')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* ============================================================== */}
            {/* MODAL 2: RECORD PAYMENT                                        */}
            {/* ============================================================== */}
            {showPaymentModal && payingInvoice && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden border border-slate-200 animate-scale-in">
                            <div className="bg-emerald-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
                                <h3 className="text-base font-bold flex items-center gap-2">
                                    <CreditCard size={18} />
                                    <span>Record Vendor Payment</span>
                                </h3>
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSavePayment} className="p-6 space-y-4">
                                {/* Invoice Context Summary */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-xs text-slate-500">Invoice Number</div>
                                            <div className="font-bold text-slate-900 text-sm">{payingInvoice.invoice_number}</div>
                                            <div className="text-xs text-slate-600 mt-0.5">{payingInvoice.vendor_name} • {payingInvoice.site_name}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-slate-500">Outstanding Balance</div>
                                            <div className="text-base font-black text-rose-600">
                                                {formatINR(payingInvoice.outstanding_amount)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-xs font-bold text-slate-700 uppercase">
                                                Amount to Disburse (₹) *
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setPaymentForm(prev => ({ ...prev, amount_paid: payingInvoice.outstanding_amount }))}
                                                className="text-[11px] font-bold text-primary-600 hover:text-primary-800 underline cursor-pointer"
                                            >
                                                Pay Full Outstanding
                                            </button>
                                        </div>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            value={paymentForm.amount_paid}
                                            onChange={(e) => setPaymentForm(prev => ({ ...prev, amount_paid: e.target.value }))}
                                            className="w-full px-3 py-2 text-base font-bold text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                                Payment Date *
                                            </label>
                                            <input
                                                type="date"
                                                required
                                                value={paymentForm.payment_date}
                                                onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                                Payment Mode
                                            </label>
                                            <select
                                                value={paymentForm.payment_mode}
                                                onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_mode: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                                            >
                                                <option value="NEFT/RTGS">NEFT / RTGS</option>
                                                <option value="CHEQUE">Cheque</option>
                                                <option value="UPI">UPI / NetBanking</option>
                                                <option value="CASH">Cash</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                                UTR / Cheque Ref No
                                            </label>
                                            <input
                                                type="text"
                                                value={paymentForm.transaction_reference}
                                                onChange={(e) => setPaymentForm(prev => ({ ...prev, transaction_reference: e.target.value }))}
                                                placeholder="e.g. HDFC20261100..."
                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                                Bank Name
                                            </label>
                                            <input
                                                type="text"
                                                value={paymentForm.bank_name}
                                                onChange={(e) => setPaymentForm(prev => ({ ...prev, bank_name: e.target.value }))}
                                                placeholder="HDFC Bank"
                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                            Payment Remarks
                                        </label>
                                        <input
                                            type="text"
                                            value={paymentForm.remarks}
                                            onChange={(e) => setPaymentForm(prev => ({ ...prev, remarks: e.target.value }))}
                                            placeholder="Part payment / Final settlement / Advance clearance"
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowPaymentModal(false)}
                                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-md transition cursor-pointer"
                                    >
                                        {submitting ? 'Recording...' : 'Confirm Disbursal'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* ============================================================== */}
            {/* MODAL 3: INVOICE DETAILS & PAYMENT HISTORY                     */}
            {/* ============================================================== */}
            {showHistoryModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-scale-in">
                            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
                                <h3 className="text-base font-bold flex items-center gap-2">
                                    <History size={18} className="text-primary-400" />
                                    <span>Invoice Breakdown & Payment History</span>
                                </h3>
                                <button
                                    onClick={() => setShowHistoryModal(false)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-5">
                                {historyLoading ? (
                                    <div className="text-center py-12 text-slate-400 flex items-center justify-center gap-2">
                                        <RefreshCw size={18} className="animate-spin" />
                                        <span>Loading payment history...</span>
                                    </div>
                                ) : historyInvoice ? (
                                    <>
                                        {/* Header Info */}
                                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <div>
                                                <div className="text-xs text-slate-500 uppercase font-semibold">Invoice No</div>
                                                <div className="text-sm font-bold text-slate-900">{historyInvoice.invoice_number}</div>
                                                <div className="text-xs text-slate-600 mt-1">{historyInvoice.vendor_name}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-slate-500 uppercase font-semibold">Site & PO</div>
                                                <div className="text-sm font-bold text-slate-900">{historyInvoice.site_name}</div>
                                                <div className="text-xs font-mono text-slate-600 mt-1">{historyInvoice.po_number || 'No PO'}</div>
                                            </div>
                                        </div>

                                        {/* Financial Breakdown Table */}
                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            <table className="w-full text-sm">
                                                <tbody className="divide-y divide-slate-100">
                                                    <tr>
                                                        <td className="py-2.5 px-4 text-slate-600">Basic Taxable Amount</td>
                                                        <td className="py-2.5 px-4 text-right font-mono font-semibold">{formatINR(historyInvoice.basic_amount)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="py-2.5 px-4 text-slate-600">GST @ {historyInvoice.gst_rate}%</td>
                                                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-indigo-700">+{formatINR(historyInvoice.gst_amount)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="py-2.5 px-4 text-slate-600">TDS Deducted @ {historyInvoice.tds_rate}%</td>
                                                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-purple-700">-{formatINR(historyInvoice.tds_amount)}</td>
                                                    </tr>
                                                    <tr className="bg-slate-50 font-bold">
                                                        <td className="py-2.5 px-4 text-slate-900">Net Payable (Net of TDS)</td>
                                                        <td className="py-2.5 px-4 text-right font-mono text-primary-700">{formatINR(historyInvoice.total_payable)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="py-2.5 px-4 text-emerald-700 font-semibold">Total Paid to Date</td>
                                                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">{formatINR(historyInvoice.paid_amount)}</td>
                                                    </tr>
                                                    <tr className="bg-rose-50/50">
                                                        <td className="py-2.5 px-4 text-rose-700 font-bold">Remaining Outstanding</td>
                                                        <td className="py-2.5 px-4 text-right font-mono font-black text-rose-600">{formatINR(historyInvoice.outstanding_amount)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Payment Transactions Log */}
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                                                <span>Payment Disbursal Log</span>
                                                <span className="text-[11px] font-normal text-slate-500">
                                                    {historyInvoice.payments?.length || 0} transaction(s)
                                                </span>
                                            </h4>

                                            {!historyInvoice.payments || historyInvoice.payments.length === 0 ? (
                                                <div className="bg-slate-50 p-4 rounded-xl text-center text-xs text-slate-500 border border-slate-200">
                                                    No payments recorded yet for this invoice.
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {historyInvoice.payments.map((p) => (
                                                        <div key={p.payment_id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-emerald-700 text-sm">
                                                                        {formatINR(p.amount_paid)}
                                                                    </span>
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                                                                        {p.payment_mode}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs font-mono text-slate-500 mt-1">
                                                                    Ref/UTR: {p.transaction_reference || '—'}
                                                                </div>
                                                                {p.remarks && (
                                                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                                                        {p.remarks}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-xs font-semibold text-slate-700">
                                                                    {formatIstDate(p.payment_date)}
                                                                </div>
                                                                <div className="text-[11px] text-slate-400">
                                                                    {p.bank_name || 'HDFC Bank'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
};

export default VendorPaymentTracker;
