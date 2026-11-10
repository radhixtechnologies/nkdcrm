import React, { useState, useEffect, useCallback } from 'react';
import {
    Receipt, Building2, Plus, Search, Filter,
    CheckCircle, AlertTriangle, Clock,
    Check, X, Phone, Mail, MapPin, Edit3, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import invoiceService from '../services/invoiceService';
import siteService from '../services/siteService';
import { useAuth } from '../context/AuthContext';
import { extractApiError } from '../services/api';
import ModalPortal from '../components/common/ModalPortal';

const getIstOffsetDate = (days) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
        new Date(Date.now() + days * 86400000)
    );

const getIstMonthYear = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'numeric'
    }).formatToParts(new Date());
    return {
        month: parseInt(parts.find(p => p.type === 'month')?.value || '1', 10),
        year: parseInt(parts.find(p => p.type === 'year')?.value || '2026', 10)
    };
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

const emptyClientForm = () => ({
    client_name: '',
    company_name: '',
    gstin: '',
    pan: '',
    contact_person: '',
    email: '',
    phone: '',
    billing_address: '',
    city: '',
    state: 'Maharashtra',
    pincode: ''
});

const defaultInvoiceForm = () => {
    const { month, year } = getIstMonthYear();
    return {
        client_id: '',
        site_id: '',
        billing_month: month,
        billing_year: year,
        subtotal: '',
        tax_rate: 18,
        tds_rate: 2,
        status: 'PENDING',
        due_date: getIstOffsetDate(15),
        notes: ''
    };
};

const Invoices = () => {
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('INVOICES', 'can_create');
    const canUpdate = hasPermission('INVOICES', 'can_update');
    const canDelete = hasPermission('INVOICES', 'can_delete');

    const [activeTab, setActiveTab] = useState('invoices');
    const [loading, setLoading] = useState(true);
    const [invoices, setInvoices] = useState([]);
    const [clients, setClients] = useState([]);
    const [sites, setSites] = useState([]);
    const [stats, setStats] = useState({
        total_invoiced: 0,
        total_received: 0,
        pending_amount: 0,
        overdue_amount: 0,
        paid_count: 0,
        pending_count: 0,
        overdue_count: 0
    });

    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Modals & editing states
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [showClientModal, setShowClientModal] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMode, setPaymentMode] = useState('NEFT/RTGS');

    const [clientForm, setClientForm] = useState(emptyClientForm);
    const [invoiceForm, setInvoiceForm] = useState(defaultInvoiceForm);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [invRes, cliRes, siteRes, statRes] = await Promise.all([
                invoiceService.getInvoices(),
                invoiceService.getClients().catch(() => ({ data: { data: [] } })),
                (siteService.getAllSites ? siteService.getAllSites() : siteService.getSites()).catch(() => ({ data: { data: [] } })),
                invoiceService.getInvoiceStats()
            ]);
            setInvoices(invRes.data?.data || []);
            setClients(cliRes.data?.data || []);
            setSites(siteRes.data?.data || []);
            setStats(statRes.data?.data || {});
        } catch (err) {
            console.error('Error fetching invoices/clients:', err);
            toast.error(extractApiError(err, 'Failed to load invoicing data'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const openAddClientModal = () => {
        setEditingClient(null);
        setClientForm(emptyClientForm());
        setShowClientModal(true);
    };

    const openEditClientModal = (cli) => {
        setEditingClient(cli);
        setClientForm({
            client_name: cli.client_name || '',
            company_name: cli.company_name || '',
            gstin: cli.gstin || '',
            pan: cli.pan || '',
            contact_person: cli.contact_person || '',
            email: cli.email || '',
            phone: cli.phone || '',
            billing_address: cli.billing_address || '',
            city: cli.city || '',
            state: cli.state || 'Maharashtra',
            pincode: cli.pincode || ''
        });
        setShowClientModal(true);
    };

    const handleSaveClient = async (e) => {
        e.preventDefault();
        try {
            if (editingClient) {
                await invoiceService.updateClient(editingClient.client_id, clientForm);
                toast.success('Client updated successfully!');
            } else {
                await invoiceService.createClient(clientForm);
                toast.success('Client registered successfully in Client Master!');
            }
            setShowClientModal(false);
            setEditingClient(null);
            setClientForm(emptyClientForm());
            loadData();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to save client'));
        }
    };

    const openCreateInvoiceModal = () => {
        setEditingInvoice(null);
        setInvoiceForm(defaultInvoiceForm());
        setShowInvoiceModal(true);
    };

    const openEditInvoiceModal = (inv) => {
        const sub = parseFloat(inv.subtotal) || 0;
        const taxAmt = parseFloat(inv.tax_amount) || 0;
        const computedRate = sub > 0 ? Math.round((taxAmt / sub) * 100) : 18;
        setEditingInvoice(inv);
        setInvoiceForm({
            client_id: inv.client_id || '',
            site_id: inv.site_id || '',
            billing_month: inv.billing_month || getIstMonthYear().month,
            billing_year: inv.billing_year || getIstMonthYear().year,
            subtotal: inv.subtotal ?? '',
            tax_rate: computedRate,
            tds_rate: parseFloat(inv.tds_rate ?? 0),
            status: inv.status || 'PENDING',
            due_date: inv.due_date ? String(inv.due_date).slice(0, 10) : getIstOffsetDate(15),
            notes: inv.notes || ''
        });
        setShowInvoiceModal(true);
    };

    const handleSaveInvoice = async (e) => {
        e.preventDefault();
        try {
            if (editingInvoice) {
                await invoiceService.updateInvoice(editingInvoice.invoice_id, invoiceForm);
                toast.success(`Invoice ${editingInvoice.invoice_number} updated!`);
            } else {
                await invoiceService.createInvoice(invoiceForm);
                toast.success('Invoice generated successfully!');
            }
            setShowInvoiceModal(false);
            setEditingInvoice(null);
            setInvoiceForm(defaultInvoiceForm());
            loadData();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to save invoice'));
        }
    };

    const handleDeleteInvoice = async (inv) => {
        if (!window.confirm(`Delete invoice ${inv.invoice_number}?`)) return;
        try {
            await invoiceService.deleteInvoice(inv.invoice_id);
            toast.success(`Invoice ${inv.invoice_number} deleted`);
            loadData();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to delete invoice'));
        }
    };

    const handleMarkPaid = async (e) => {
        e.preventDefault();
        if (!selectedInvoice) return;
        try {
            await invoiceService.updateInvoiceStatus(selectedInvoice.invoice_id, 'PAID', paymentMode);
            toast.success(`Invoice ${selectedInvoice.invoice_number} marked as PAID via ${paymentMode}`);
            setShowPaymentModal(false);
            setSelectedInvoice(null);
            loadData();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to update invoice payment status'));
        }
    };

    const formatINR = (val) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(Number(val) || 0);
    };

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = (inv.invoice_number && inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (inv.client_name && inv.client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (inv.site_name && inv.site_name.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const previewSubtotal = Number(invoiceForm.subtotal) || 0;
    const previewTaxRate = Number(invoiceForm.tax_rate) || 0;
    const previewTdsRate = Number(invoiceForm.tds_rate) || 0;
    const previewGst = (previewSubtotal * previewTaxRate) / 100;
    const previewGross = previewSubtotal + previewGst;
    const previewTds = (previewSubtotal * previewTdsRate) / 100;
    const previewNet = Math.max(0, previewGross - previewTds);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Client Master & Invoices</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Manage corporate clients, deployment billing, GST invoices and collections</p>
                </div>

                {canCreate && (
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={openAddClientModal}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
                        >
                            <Building2 size={15} /> Add Client
                        </button>
                        <button
                            onClick={openCreateInvoiceModal}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-xs font-semibold text-white shadow-xs transition-colors"
                        >
                            <Plus size={15} /> Generate Invoice
                        </button>
                    </div>
                )}
            </div>

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card-hover-effect rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Billed</p>
                            <p className="mt-1 text-2xl font-bold text-slate-900 group-hover:text-primary-700 transition-colors">{formatINR(stats.total_invoiced)}</p>
                        </div>
                        <div className="rounded-xl p-2.5 bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                            <Receipt size={22} />
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{invoices.length} invoices generated</p>
                </div>

                <div className="card-hover-effect rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Received</p>
                            <p className="mt-1 text-2xl font-bold text-emerald-600 group-hover:text-emerald-700 transition-colors">{formatINR(stats.total_received)}</p>
                        </div>
                        <div className="rounded-xl p-2.5 bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                            <CheckCircle size={22} />
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{stats.paid_count || 0} invoices paid</p>
                </div>

                <div className="card-hover-effect rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Collections</p>
                            <p className="mt-1 text-2xl font-bold text-amber-600 group-hover:text-amber-700 transition-colors">{formatINR(stats.pending_amount)}</p>
                        </div>
                        <div className="rounded-xl p-2.5 bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
                            <Clock size={22} />
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{stats.pending_count || 0} invoices awaiting payment</p>
                </div>

                <div className="card-hover-effect rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overdue Amount</p>
                            <p className="mt-1 text-2xl font-bold text-rose-600 group-hover:text-rose-700 transition-colors">{formatINR(stats.overdue_amount)}</p>
                        </div>
                        <div className="rounded-xl p-2.5 bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
                            <AlertTriangle size={22} />
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{stats.overdue_count || 0} overdue invoices</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('invoices')}
                    className={`pb-3 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === 'invoices' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <Receipt size={16} /> Invoices & Billing ({invoices.length})
                </button>
                <button
                    onClick={() => setActiveTab('clients')}
                    className={`pb-3 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === 'clients' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <Building2 size={16} /> Client Master ({clients.length})
                </button>
            </div>

            {/* TAB 1: INVOICES LIST */}
            {activeTab === 'invoices' && (
                <div className="space-y-4">
                    {/* Filter bar */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-white p-4 rounded-xl border border-slate-200">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search invoice #, client, site..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Filter size={15} className="text-slate-500 shrink-0" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full sm:w-auto text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="PENDING">Pending</option>
                                <option value="PAID">Paid</option>
                                <option value="OVERDUE">Overdue</option>
                            </select>
                        </div>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-600">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3">Invoice Number</th>
                                        <th className="px-4 py-3">Client & Site</th>
                                        <th className="px-4 py-3">Period</th>
                                        <th className="px-4 py-3">Subtotal</th>
                                        <th className="px-4 py-3">GST</th>
                                        <th className="px-4 py-3">Total Gross</th>
                                        <th className="px-4 py-3">TDS (194C)</th>
                                        <th className="px-4 py-3">Net Receivable</th>
                                        <th className="px-4 py-3">Due Date</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr><td colSpan="11" className="py-8 text-center text-slate-400">Loading invoices...</td></tr>
                                    ) : filteredInvoices.length === 0 ? (
                                        <tr>
                                            <td colSpan="11" className="py-8 text-center text-slate-400">
                                                No invoices found. {canCreate ? 'Click "Generate Invoice" to create one.' : ''}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredInvoices.map((inv) => {
                                            const netVal = inv.net_receivable ?? (Number(inv.total_amount) - (Number(inv.tds_amount) || 0));
                                            return (
                                                <tr key={inv.invoice_id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-4 py-3 font-mono font-bold text-slate-800">{inv.invoice_number}</td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-bold text-slate-900">{inv.client_name || 'Client Unassigned'}</p>
                                                        <p className="text-[11px] text-slate-400">{inv.site_name || 'All Sites'}</p>
                                                    </td>
                                                    <td className="px-4 py-3">{inv.billing_month}/{inv.billing_year}</td>
                                                    <td className="px-4 py-3">{formatINR(inv.subtotal)}</td>
                                                    <td className="px-4 py-3 text-slate-500">{formatINR(inv.tax_amount)}</td>
                                                    <td className="px-4 py-3 font-semibold text-slate-700">{formatINR(inv.total_amount)}</td>
                                                    <td className="px-4 py-3 text-rose-600 font-medium">
                                                        {Number(inv.tds_amount) > 0 ? `-${formatINR(inv.tds_amount)} (${inv.tds_rate}%)` : '₹0'}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-slate-900">{formatINR(netVal)}</td>
                                                    <td className="px-4 py-3">{formatIstDate(inv.due_date)}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                                                            inv.status === 'OVERDUE' ? 'bg-rose-100 text-rose-700' :
                                                            'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {inv.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="inline-flex items-center gap-1.5">
                                                            {inv.status !== 'PAID' ? (
                                                                canUpdate && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedInvoice(inv);
                                                                            setShowPaymentModal(true);
                                                                        }}
                                                                        className="px-2 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700 text-[11px] inline-flex items-center gap-1"
                                                                    >
                                                                        <Check size={12} /> Paid
                                                                    </button>
                                                                )
                                                            ) : (
                                                                <span className="text-[11px] text-emerald-600 font-semibold px-1.5">
                                                                    {inv.payment_mode || 'Paid'}
                                                                </span>
                                                            )}
                                                            {canUpdate && (
                                                                <button
                                                                    onClick={() => openEditInvoiceModal(inv)}
                                                                    title="Edit Invoice"
                                                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md"
                                                                >
                                                                    <Edit3 size={14} />
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDeleteInvoice(inv)}
                                                                    title="Delete Invoice"
                                                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-md"
                                                                >
                                                                    <Trash2 size={14} />
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

                    {/* Mobile Cards */}
                    <div className="block md:hidden space-y-3">
                        {loading ? (
                            <div className="py-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">Loading invoices...</div>
                        ) : filteredInvoices.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                                No invoices found.
                            </div>
                        ) : (
                            filteredInvoices.map((inv) => {
                                const netVal = inv.net_receivable ?? (Number(inv.total_amount) - (Number(inv.tds_amount) || 0));
                                return (
                                    <div key={inv.invoice_id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2.5 text-xs">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="font-mono font-bold text-slate-900">{inv.invoice_number}</div>
                                                <div className="font-semibold text-slate-800 mt-0.5">{inv.client_name || 'Client Unassigned'}</div>
                                                <div className="text-[11px] text-slate-400">{inv.site_name || 'All Sites'} • {inv.billing_month}/{inv.billing_year}</div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                                inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                                                inv.status === 'OVERDUE' ? 'bg-rose-100 text-rose-700' :
                                                'bg-amber-100 text-amber-700'
                                            }`}>
                                                {inv.status}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl">
                                            <div>
                                                <div className="text-[10px] text-slate-400">Gross (incl. GST)</div>
                                                <div className="font-semibold text-slate-700">{formatINR(inv.total_amount)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-slate-400">Net Receivable</div>
                                                <div className="font-bold text-primary-700">{formatINR(netVal)}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-400">TDS Deduction</div>
                                                <div className="text-rose-600 font-medium">
                                                    {Number(inv.tds_amount) > 0 ? `-${formatINR(inv.tds_amount)} (${inv.tds_rate}%)` : '₹0'}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-slate-400">Due Date</div>
                                                <div className="font-medium text-slate-700">{formatIstDate(inv.due_date)}</div>
                                            </div>
                                        </div>

                                        {(canUpdate || canDelete) && (
                                            <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-100">
                                                {inv.status !== 'PAID' && canUpdate && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedInvoice(inv);
                                                            setShowPaymentModal(true);
                                                        }}
                                                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold inline-flex items-center gap-1"
                                                    >
                                                        <Check size={12} /> Mark Paid
                                                    </button>
                                                )}
                                                {canUpdate && (
                                                    <button
                                                        onClick={() => openEditInvoiceModal(inv)}
                                                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold inline-flex items-center gap-1"
                                                    >
                                                        <Edit3 size={12} /> Edit
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDeleteInvoice(inv)}
                                                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 font-semibold inline-flex items-center gap-1"
                                                    >
                                                        <Trash2 size={12} /> Delete
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: CLIENT MASTER */}
            {activeTab === 'clients' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {loading ? (
                            <div className="col-span-full text-center py-12 text-slate-400 text-sm">Loading clients...</div>
                        ) : clients.length === 0 ? (
                            <div className="col-span-full text-center py-12 text-slate-400 text-sm bg-white rounded-xl border border-dashed border-slate-200">
                                No clients registered in Client Master yet.
                            </div>
                        ) : (
                            clients.map((cli) => (
                                <div key={cli.client_id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h3 className="font-bold text-slate-900 text-sm">{cli.client_name}</h3>
                                                <p className="text-xs text-slate-500">{cli.company_name}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                                    {cli.client_code}
                                                </span>
                                                {canUpdate && (
                                                    <button
                                                        onClick={() => openEditClientModal(cli)}
                                                        title="Edit Client"
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                    >
                                                        <Edit3 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-3 space-y-1 text-xs text-slate-600">
                                            {cli.contact_person && (
                                                <p className="font-medium text-slate-800">Contact: {cli.contact_person}</p>
                                            )}
                                            {cli.email && (
                                                <div className="flex items-center gap-2">
                                                    <Mail size={13} className="text-slate-400 shrink-0" />
                                                    <span className="truncate">{cli.email}</span>
                                                </div>
                                            )}
                                            {cli.phone && (
                                                <div className="flex items-center gap-2">
                                                    <Phone size={13} className="text-slate-400 shrink-0" />
                                                    <span>{cli.phone}</span>
                                                </div>
                                            )}
                                            {(cli.city || cli.billing_address) && (
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={13} className="text-slate-400 shrink-0" />
                                                    <span className="truncate">
                                                        {[cli.billing_address, cli.city, cli.state, cli.pincode].filter(Boolean).join(', ')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                                            <div>
                                                <span className="text-[11px] text-slate-400 font-mono">GSTIN: {cli.gstin || 'Unregistered'}</span>
                                            </div>
                                            <span className="font-semibold text-primary-600">
                                                {cli.site_count || 0} Sites Linked
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* MODAL 1: Add / Edit Client */}
            {showClientModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
                        <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                            <div className="p-5 border-b border-slate-200 flex justify-between items-center shrink-0">
                                <h3 className="font-bold text-slate-900">
                                    {editingClient ? 'Edit Client (Client Master)' : 'Add New Client (Client Master)'}
                                </h3>
                                <button onClick={() => setShowClientModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                            </div>
                            <form onSubmit={handleSaveClient} className="p-5 space-y-4 overflow-y-auto">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Client / Brand Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Tata Consultancy Services, HDFC Bank"
                                        value={clientForm.client_name}
                                        onChange={(e) => setClientForm({ ...clientForm, client_name: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Company Name</label>
                                        <input
                                            type="text"
                                            placeholder="Pvt Ltd / Corp name"
                                            value={clientForm.company_name}
                                            onChange={(e) => setClientForm({ ...clientForm, company_name: e.target.value })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
                                        <input
                                            type="text"
                                            placeholder="Representative Name"
                                            value={clientForm.contact_person}
                                            onChange={(e) => setClientForm({ ...clientForm, contact_person: e.target.value })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN</label>
                                        <input
                                            type="text"
                                            placeholder="15-digit GSTIN"
                                            value={clientForm.gstin}
                                            onChange={(e) => setClientForm({ ...clientForm, gstin: e.target.value.toUpperCase() })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono uppercase"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">PAN Number</label>
                                        <input
                                            type="text"
                                            placeholder="10-digit PAN"
                                            value={clientForm.pan}
                                            onChange={(e) => setClientForm({ ...clientForm, pan: e.target.value.toUpperCase() })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono uppercase"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            placeholder="billing@client.com"
                                            value={clientForm.email}
                                            onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                                        <input
                                            type="tel"
                                            placeholder="Phone number"
                                            value={clientForm.phone}
                                            onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Address</label>
                                    <input
                                        type="text"
                                        placeholder="Street / Business Park / Floor"
                                        value={clientForm.billing_address}
                                        onChange={(e) => setClientForm({ ...clientForm, billing_address: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                                        <input
                                            type="text"
                                            placeholder="Mumbai"
                                            value={clientForm.city}
                                            onChange={(e) => setClientForm({ ...clientForm, city: e.target.value })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                                        <input
                                            type="text"
                                            placeholder="Maharashtra"
                                            value={clientForm.state}
                                            onChange={(e) => setClientForm({ ...clientForm, state: e.target.value })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Pincode</label>
                                        <input
                                            type="text"
                                            placeholder="400001"
                                            value={clientForm.pincode}
                                            onChange={(e) => setClientForm({ ...clientForm, pincode: e.target.value })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowClientModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
                                    <button type="submit" className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700">
                                        {editingClient ? 'Save Changes' : 'Save Client'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* MODAL 2: Generate / Edit Invoice */}
            {showInvoiceModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
                        <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                            <div className="p-5 border-b border-slate-200 flex justify-between items-center shrink-0">
                                <h3 className="font-bold text-slate-900">
                                    {editingInvoice ? `Edit Invoice (${editingInvoice.invoice_number})` : 'Generate Deployment Invoice'}
                                </h3>
                                <button onClick={() => setShowInvoiceModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                            </div>
                            <form onSubmit={handleSaveInvoice} className="p-5 space-y-4 overflow-y-auto">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Client *</label>
                                        <select
                                            required
                                            value={invoiceForm.client_id}
                                            onChange={(e) => setInvoiceForm({ ...invoiceForm, client_id: e.target.value })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        >
                                            <option value="">Select Client</option>
                                            {clients.map(c => (
                                                <option key={c.client_id} value={c.client_id}>{c.client_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Site / Deployment</label>
                                        <select
                                            value={invoiceForm.site_id}
                                            onChange={(e) => setInvoiceForm({ ...invoiceForm, site_id: e.target.value })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        >
                                            <option value="">All Client Sites</option>
                                            {sites.map(s => (
                                                <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Month</label>
                                        <select
                                            value={invoiceForm.billing_month}
                                            onChange={(e) => setInvoiceForm({ ...invoiceForm, billing_month: parseInt(e.target.value, 10) })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        >
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                <option key={m} value={m}>Month {m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Year</label>
                                        <input
                                            type="number"
                                            value={invoiceForm.billing_year}
                                            onChange={(e) => setInvoiceForm({ ...invoiceForm, billing_year: parseInt(e.target.value, 10) || getIstMonthYear().year })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Subtotal (₹) *</label>
                                        <input
                                            type="number"
                                            required
                                            placeholder="e.g. 150000"
                                            value={invoiceForm.subtotal}
                                            onChange={(e) => setInvoiceForm({ ...invoiceForm, subtotal: e.target.value })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">GST Rate (%)</label>
                                        <select
                                            value={invoiceForm.tax_rate}
                                            onChange={(e) => setInvoiceForm({ ...invoiceForm, tax_rate: parseFloat(e.target.value) || 0 })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        >
                                            <option value="0">0% (Exempt)</option>
                                            <option value="5">5% GST</option>
                                            <option value="12">12% GST</option>
                                            <option value="18">18% GST</option>
                                            <option value="28">28% GST</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Client TDS Rate</label>
                                        <select
                                            value={invoiceForm.tds_rate}
                                            onChange={(e) => setInvoiceForm({ ...invoiceForm, tds_rate: parseFloat(e.target.value) || 0 })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        >
                                            <option value="0">0% (No TDS)</option>
                                            <option value="1">1% - Sec 194C (Indiv)</option>
                                            <option value="2">2% - Sec 194C (Corp)</option>
                                            <option value="10">10% - Sec 194J (Prof)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Due Date</label>
                                        <input
                                            type="date"
                                            value={invoiceForm.due_date}
                                            onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                    {editingInvoice ? (
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Status</label>
                                            <select
                                                value={invoiceForm.status}
                                                onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value })}
                                                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                            >
                                                <option value="PENDING">PENDING</option>
                                                <option value="OVERDUE">OVERDUE</option>
                                                <option value="PAID">PAID</option>
                                            </select>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / PO Ref</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. PO-8492"
                                                value={invoiceForm.notes}
                                                onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                                                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                            />
                                        </div>
                                    )}
                                </div>

                                {editingInvoice && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / PO Ref</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. PO-8492"
                                            value={invoiceForm.notes}
                                            onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                )}

                                {invoiceForm.subtotal !== '' && (
                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                                        <div className="flex justify-between text-slate-600">
                                            <span>Subtotal (Base Value):</span>
                                            <span>{formatINR(previewSubtotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-600">
                                            <span>GST ({previewTaxRate}%):</span>
                                            <span>+{formatINR(previewGst)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-600">
                                            <span>Total Invoice Gross:</span>
                                            <span>{formatINR(previewGross)}</span>
                                        </div>
                                        {previewTdsRate > 0 && (
                                            <div className="flex justify-between text-rose-600 font-medium">
                                                <span>Less: Client TDS ({previewTdsRate}%):</span>
                                                <span>-{formatINR(previewTds)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1 text-sm">
                                            <span>Net Receivable:</span>
                                            <span className="text-primary-700">{formatINR(previewNet)}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowInvoiceModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
                                    <button type="submit" className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700">
                                        {editingInvoice ? 'Save Changes' : 'Generate Invoice'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* MODAL 3: Mark Paid */}
            {showPaymentModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
                        <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                            <div className="p-5 border-b border-slate-200 flex justify-between items-center shrink-0">
                                <h3 className="font-bold text-slate-900">Record Payment Received</h3>
                                <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                            </div>
                            <form onSubmit={handleMarkPaid} className="p-5 space-y-4 overflow-y-auto">
                                <p className="text-xs text-slate-600">
                                    Record collection of <span className="font-bold text-slate-900">{formatINR(selectedInvoice?.total_amount)}</span> for invoice <span className="font-mono font-bold text-primary-600">{selectedInvoice?.invoice_number}</span>.
                                </p>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                                    <select
                                        value={paymentMode}
                                        onChange={(e) => setPaymentMode(e.target.value)}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    >
                                        <option value="NEFT/RTGS">NEFT / RTGS Bank Transfer</option>
                                        <option value="UPI">UPI / QR Payment</option>
                                        <option value="CHEQUE">Cheque / Demand Draft</option>
                                        <option value="CASH">Cash</option>
                                    </select>
                                </div>

                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
                                    <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">Confirm Payment</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
};

export default Invoices;
