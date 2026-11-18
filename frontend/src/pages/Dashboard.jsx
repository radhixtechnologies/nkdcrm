import React, { useState, useEffect } from 'react';
import {
    Users, UserCheck, DollarSign, Calendar,
    Building2, Plus, ArrowRight,
    CheckCircle, AlertCircle, RefreshCw,
    ShieldAlert, Receipt, AlertTriangle,
    ClipboardList, Boxes, ShieldCheck, RotateCcw, Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import EmployeeDashboard from './EmployeeDashboard';
import dashboardService from '../services/dashboardService';
import auditRecycleService from '../services/auditRecycleService';
import { extractApiError } from '../services/api';
import AreaTrendChart from '../components/charts/AreaTrendChart';
import BarChart from '../components/charts/BarChart';
import DonutChart from '../components/charts/DonutChart';
import WorkflowFlowchart from '../components/charts/WorkflowFlowchart';
import toast from 'react-hot-toast';

const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(Number(num) || 0);
};

const StatCard = ({ title, value, badge, icon, color, bg, link, linkText }) => {
    const IconComponent = icon;
    return (
    <div className="card-hover-effect rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between group">
        <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">{title}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 tracking-tight group-hover:text-primary-700 transition-colors truncate">{value}</p>
            </div>
            <div className={`rounded-xl p-2.5 ${bg} ${color} shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-2xs`}>
                {IconComponent && <IconComponent size={22} strokeWidth={2.2} />}
            </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
            <span className="font-medium text-slate-600 flex items-center gap-1 truncate">
                {badge}
            </span>
            {link && (
                <Link to={link} className="text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-0.5 group/link shrink-0">
                    {linkText || 'View'} <ArrowRight size={12} className="transition-transform group-hover/link:translate-x-1" />
                </Link>
            )}
        </div>
    </div>
    );
};

const ClientDashboard = () => {
    const { hasPermission } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await dashboardService.getStats();
            setStats(res.data?.data || null);
        } catch (error) {
            toast.error(extractApiError(error, 'Failed to load client overview'), { id: 'client-dash-err' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const invoicedTotal = Number(stats?.invoiceStats?.total_invoiced || 0);
    const receivedTotal = Number(stats?.invoiceStats?.total_received || 0);
    const collectionPct = invoicedTotal > 0 ? Math.min(100, Math.round((receivedTotal / invoicedTotal) * 100)) : 0;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Client Project Portal</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Live Daily Progress Reports, GTPL Material Tracking & Billing Summary</p>
                </div>
                <button
                    onClick={loadData}
                    title="Refresh Data"
                    className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <StatCard
                    title="Active Project Sites"
                    value={loading ? '...' : (stats?.totalSites ?? 0)}
                    badge="Monitored Locations"
                    icon={Building2}
                    color="text-blue-600"
                    bg="bg-blue-50"
                />
                <StatCard
                    title="Daily Progress Reports"
                    value={loading ? '...' : (stats?.totalDprs ?? 0)}
                    badge="Site Field Logs"
                    icon={ClipboardList}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                    link={hasPermission('DPR', 'can_view') ? '/dpr' : null}
                    linkText="Open DPR Hub"
                />
                <StatCard
                    title="GTPL Materials"
                    value={loading ? '...' : `${stats?.procurementDelivered ?? 0} / ${stats?.procurementTotal ?? 0}`}
                    badge="Delivered at Site"
                    icon={Boxes}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                    link={hasPermission('PROCUREMENT', 'can_view') ? '/procurement' : null}
                    linkText="Tracker"
                />
                <StatCard
                    title="Pending Billing"
                    value={loading ? '...' : formatCurrency(stats?.invoiceStats?.pending_amount)}
                    badge={`${formatCurrency(stats?.invoiceStats?.overdue_amount)} overdue`}
                    icon={Receipt}
                    color="text-amber-600"
                    bg="bg-amber-50"
                    link={hasPermission('INVOICES', 'can_view') ? '/invoices' : null}
                    linkText="View Invoices"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card-hover-effect rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                                <Receipt size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Billing & Settlement Status</h3>
                                <p className="text-xs text-slate-500">Corporate invoicing & payment realization</p>
                            </div>
                        </div>
                        {hasPermission('INVOICES', 'can_view') && (
                            <Link to="/invoices" className="text-xs font-semibold text-primary-600 hover:underline">
                                View Invoices
                            </Link>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Invoiced</p>
                            <p className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">{formatCurrency(invoicedTotal)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                            <p className="text-[11px] font-semibold text-emerald-700 uppercase">Total Received</p>
                            <p className="text-base sm:text-lg font-bold text-emerald-700 mt-0.5">{formatCurrency(receivedTotal)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                            <p className="text-[11px] font-semibold text-amber-700 uppercase">Pending Collection</p>
                            <p className="text-base sm:text-lg font-bold text-amber-700 mt-0.5">{formatCurrency(stats?.invoiceStats?.pending_amount)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
                            <p className="text-[11px] font-semibold text-rose-700 uppercase">Overdue</p>
                            <p className="text-base sm:text-lg font-bold text-rose-700 mt-0.5">{formatCurrency(stats?.invoiceStats?.overdue_amount)}</p>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
                            <span>Payment Settlement Rate</span>
                            <span>{collectionPct}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${collectionPct}%` }} />
                        </div>
                    </div>
                </div>

                <div className="card-hover-effect rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                    <div>
                        <h3 className="text-base font-bold text-slate-800 mb-1">Client Portal Modules</h3>
                        <p className="text-xs text-slate-500 mb-4">Quick access to project reports and material deliveries</p>

                        <div className="space-y-3">
                            {hasPermission('DPR', 'can_view') && (
                                <Link to="/dpr" className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-primary-50/70 border border-slate-200/80 transition-colors group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0"><ClipboardList size={18} /></div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">DPR Management Hub</p>
                                            <p className="text-xs text-slate-500 truncate">Daily progress, issues, measurement sheets & tools</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={16} className="text-slate-400 group-hover:text-primary-600 shrink-0" />
                                </Link>
                            )}

                            {hasPermission('PROCUREMENT', 'can_view') && (
                                <Link to="/procurement" className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-primary-50/70 border border-slate-200/80 transition-colors group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0"><Boxes size={18} /></div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">GTPL Procurement Tracker</p>
                                            <p className="text-xs text-slate-500 truncate">9-stage manufacturing, inspection & dispatch status</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={16} className="text-slate-400 group-hover:text-primary-600 shrink-0" />
                                </Link>
                            )}

                            {hasPermission('INVOICES', 'can_view') && (
                                <Link to="/invoices" className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-primary-50/70 border border-slate-200/80 transition-colors group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="p-2 rounded-lg bg-blue-100 text-blue-700 shrink-0"><Receipt size={18} /></div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">Client Invoices & Statements</p>
                                            <p className="text-xs text-slate-500 truncate">View itemized invoices & PDF statements</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={16} className="text-slate-400 group-hover:text-primary-600 shrink-0" />
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AdminDashboard = () => {
    const { hasPermission } = useAuth();
    const [stats, setStats] = useState(null);
    const [charts, setCharts] = useState(null);
    const [recentAudit, setRecentAudit] = useState([]);
    const [auditStats, setAuditStats] = useState({});
    const [binStats, setBinStats] = useState({});
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsRes, chartsRes, recentAuditRes, auditStatsRes, binStatsRes] = await Promise.all([
                dashboardService.getStats(),
                dashboardService.getCharts(),
                auditRecycleService.getRecentAudit(6).catch(() => ({ data: { data: [] } })),
                auditRecycleService.getAuditStats().catch(() => ({ data: { data: {} } })),
                auditRecycleService.getRecycleBinStats().catch(() => ({ data: { data: {} } }))
            ]);
            setStats(statsRes.data?.data || null);
            setCharts(chartsRes.data?.data || null);
            setRecentAudit(recentAuditRes.data?.data || []);
            setAuditStats(auditStatsRes.data?.data || {});
            setBinStats(binStatsRes.data?.data || {});
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            toast.error(extractApiError(error, 'Failed to load live dashboard stats'), { id: 'dashboard-load-err' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            {/* Header with Quick Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">NKD CRM Executive Overview</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Real-time workforce attendance, operations & financial insights</p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={loadData}
                        title="Refresh Data"
                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all btn-press shadow-xs hover:shadow-sm"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>

                    {hasPermission('EMPLOYEES', 'can_create') && (
                        <Link
                            to="/employees"
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-xs hover:shadow-md btn-press transition-all"
                        >
                            <Plus size={15} /> Add Employee
                        </Link>
                    )}

                    {hasPermission('PAYROLL', 'can_create') && (
                        <Link
                            to="/payroll"
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-xs font-bold text-white shadow-xs hover:shadow-md hover:shadow-primary-500/20 btn-press transition-all"
                        >
                            <DollarSign size={15} /> Run Payroll
                        </Link>
                    )}
                </div>
            </div>

            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <StatCard
                    title="Active Employees"
                    value={loading ? '...' : (stats?.totalEmployees ?? 0)}
                    badge={`${stats?.totalSites ?? 0} Active Sites`}
                    icon={Users}
                    color="text-blue-600"
                    bg="bg-blue-50"
                    link={hasPermission('EMPLOYEES', 'can_view') ? '/employees' : null}
                    linkText="Directory"
                />

                <StatCard
                    title="Present Today"
                    value={loading ? '...' : (stats?.presentToday ?? 0)}
                    badge={`${stats?.attendanceRate ?? 0}% Turnout Rate`}
                    icon={UserCheck}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                    link={hasPermission('ATTENDANCE', 'can_view') ? '/attendance' : null}
                    linkText="Daily Logs"
                />

                <StatCard
                    title="Pending Approvals"
                    value={loading ? '...' : ((stats?.pendingLeaves ?? 0) + (stats?.pendingClaims ?? 0))}
                    badge={`${stats?.pendingLeaves ?? 0} Leaves, ${stats?.pendingClaims ?? 0} Claims`}
                    icon={Calendar}
                    color="text-amber-600"
                    bg="bg-amber-50"
                    link={hasPermission('LEAVES', 'can_view') ? '/leaves' : null}
                    linkText="Review"
                />

                <StatCard
                    title="Monthly Payroll"
                    value={loading ? '...' : formatCurrency(stats?.latestPayroll?.amount)}
                    badge={stats?.latestPayroll ? `Month ${stats.latestPayroll.month}/${stats.latestPayroll.year}` : 'Latest Batch'}
                    icon={DollarSign}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                    link={hasPermission('PAYROLL', 'can_view') ? '/payroll' : null}
                    linkText="Manage"
                />
            </div>

            {/* Compliance Alerts & Invoice Status Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Statutory Compliance Alerts */}
                <div className="card-hover-effect rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 shadow-2xs shrink-0">
                                    <ShieldAlert size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-bold text-slate-800 truncate">Compliance & Statutory Alerts</h3>
                                    <p className="text-xs text-slate-500 truncate">PF, ESIC deadlines & mandatory employee KYC tracking</p>
                                </div>
                            </div>
                            {hasPermission('REPORTS', 'can_view') && (
                                <Link to="/reports" className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline shrink-0">
                                    Statutory Center
                                </Link>
                            )}
                        </div>

                        <div className="space-y-3">
                            {(!stats?.complianceAlerts?.alerts || stats.complianceAlerts.alerts.length === 0) ? (
                                <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-100 flex items-center gap-3 text-xs text-emerald-800">
                                    <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                                    <span>All statutory filing deadlines & employee records are up to date.</span>
                                </div>
                            ) : (
                                stats.complianceAlerts.alerts.map((alt, idx) => (
                                    <div
                                        key={alt.id || idx}
                                        className={`p-3.5 rounded-xl border text-xs flex items-start justify-between gap-3 transition-all duration-200 hover:translate-x-1 ${
                                            alt.type === 'CRITICAL' ? 'bg-rose-50/70 border-rose-200 text-rose-900' :
                                            alt.type === 'WARNING' ? 'bg-amber-50/70 border-amber-200 text-amber-900' :
                                            'bg-blue-50/70 border-blue-200 text-blue-900'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            {alt.type === 'CRITICAL' ? <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" /> :
                                             alt.type === 'WARNING' ? <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" /> :
                                             <ShieldAlert size={16} className="text-blue-600 shrink-0 mt-0.5" />}
                                            <div className="min-w-0">
                                                <p className="font-bold">{alt.title}</p>
                                                <p className="text-[11px] opacity-80 mt-0.5">{alt.description}</p>
                                            </div>
                                        </div>
                                        {alt.actionLink && (
                                            <Link
                                                to={alt.actionLink}
                                                className="shrink-0 text-[11px] font-bold px-2 py-1 rounded bg-white shadow-xs border border-slate-200 hover:bg-slate-50 transition-colors"
                                            >
                                                Review
                                            </Link>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Invoice Status & Billing Overview */}
                <div className="card-hover-effect rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                                    <Receipt size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-bold text-slate-800 truncate">Deployment Invoice Status</h3>
                                    <p className="text-xs text-slate-500 truncate">Corporate client billing & collection cycle</p>
                                </div>
                            </div>
                            {hasPermission('INVOICES', 'can_view') && (
                                <Link to="/invoices" className="text-xs font-semibold text-primary-600 hover:underline shrink-0">
                                    View Invoices
                                </Link>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Invoiced</p>
                                <p className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 truncate">
                                    {formatCurrency(stats?.invoiceStats?.total_invoiced)}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                                <p className="text-[11px] font-semibold text-emerald-700 uppercase">Total Received</p>
                                <p className="text-base sm:text-lg font-bold text-emerald-700 mt-0.5 truncate">
                                    {formatCurrency(stats?.invoiceStats?.total_received)}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                                <p className="text-[11px] font-semibold text-amber-700 uppercase">Pending Collection</p>
                                <p className="text-base sm:text-lg font-bold text-amber-700 mt-0.5 truncate">
                                    {formatCurrency(stats?.invoiceStats?.pending_amount)}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
                                <p className="text-[11px] font-semibold text-rose-700 uppercase">Overdue</p>
                                <p className="text-base sm:text-lg font-bold text-rose-700 mt-0.5 truncate">
                                    {formatCurrency(stats?.invoiceStats?.overdue_amount)}
                                </p>
                            </div>
                        </div>

                        {/* Collection Progress */}
                        <div>
                            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
                                <span>Collection Realization Rate</span>
                                <span>
                                    {stats?.invoiceStats?.total_invoiced > 0
                                        ? Math.round((Number(stats.invoiceStats.total_received) / Number(stats.invoiceStats.total_invoiced)) * 100)
                                        : 0}%
                                </span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                    style={{
                                        width: `${stats?.invoiceStats?.total_invoiced > 0
                                            ? Math.min(100, Math.round((Number(stats.invoiceStats.total_received) / Number(stats.invoiceStats.total_invoiced)) * 100))
                                            : 0}%`
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Interactive Graph Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Attendance Trend Chart */}
                <div className="card-hover-effect rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 mb-4">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Weekly Attendance Turnout</h3>
                            <p className="text-xs text-slate-500">Live employee check-in trend for the past 7 days</p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 shrink-0">
                            Live Trend
                        </span>
                    </div>

                    <AreaTrendChart
                        data={charts?.attendanceTrend || []}
                        color="#4f46e5"
                        labelKey="day_name"
                        valueKey="present"
                    />
                </div>

                {/* 2. Workforce by Department Donut */}
                <div className="card-hover-effect rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Workforce Distribution</h3>
                            <p className="text-xs text-slate-500">Departmental deployment across operations</p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 shrink-0">
                            Departments
                        </span>
                    </div>

                    <DonutChart
                        data={charts?.departmentBreakdown || []}
                        title="Staff"
                        subtitle="Deployed"
                    />
                </div>

                {/* 3. Site / Branch Deployment Bar Chart */}
                <div className="card-hover-effect rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
                    <div className="flex items-center justify-between gap-2 mb-4">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Site & Branch Staffing</h3>
                            <p className="text-xs text-slate-500">Employee count assigned to branches & client facilities</p>
                        </div>
                        {hasPermission('SITES', 'can_view') && (
                            <Link to="/sites" className="text-xs font-semibold text-primary-600 hover:underline shrink-0">
                                View Sites
                            </Link>
                        )}
                    </div>

                    <BarChart
                        data={charts?.siteDistribution || []}
                        labelKey="label"
                        valueKey="value"
                        barColor="#0ea5e9"
                    />
                </div>

                {/* 4. Live Attendance Stream / Activity */}
                <div className="card-hover-effect rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 mb-4">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Live Punch Feed</h3>
                            <p className="text-xs text-slate-500">Latest recorded check-ins and attendance updates</p>
                        </div>
                        {hasPermission('ATTENDANCE', 'can_view') && (
                            <Link to="/attendance" className="text-xs font-semibold text-primary-600 hover:underline shrink-0">
                                Full Register
                            </Link>
                        )}
                    </div>

                    <div className="divide-y divide-slate-100">
                        {(!charts?.recentActivity || charts.recentActivity.length === 0) ? (
                            <div className="py-12 text-center text-xs text-slate-400">
                                No check-in records logged yet today.
                            </div>
                        ) : (
                            charts.recentActivity.map((act) => (
                                <div key={act.attendance_id} className="py-3 flex items-center justify-between text-xs gap-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 shrink-0">
                                            {act.first_name?.[0] || 'E'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-800 truncate">{act.first_name} {act.last_name}</p>
                                            <p className="text-[11px] text-slate-400 font-mono truncate">{act.employee_code}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5 shrink-0">
                                        <span className="font-mono text-slate-600">
                                            {act.time ? `${act.time} hrs` : act.date}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            act.status === 'P' ? 'bg-emerald-100 text-emerald-700' :
                                            act.status === 'HD' || act.status === 'H' ? 'bg-amber-100 text-amber-700' :
                                            act.status === 'L' ? 'bg-blue-100 text-blue-700' :
                                            'bg-rose-100 text-rose-700'
                                        }`}>
                                            {act.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Live Security Audit Trail & Recycle Bin Widget */}
            <div className="card-hover-effect rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 text-white shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-white">Security & Audit Activity Stream</h3>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/40">
                                    Live Trail
                                </span>
                            </div>
                            <p className="text-xs text-slate-300">Forensic action logs ("Kisne kya kiya") & 1-Click Recycle Bin restore center</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            to="/audit-security"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs shadow-xs transition-transform active:scale-95"
                        >
                            <Activity size={14} className="text-primary-600" />
                            <span>Audit & Recycle Hub</span>
                            <ArrowRight size={13} />
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-5">
                    {/* Left: Quick Stats */}
                    <div className="space-y-3">
                        <div className="bg-white/10 rounded-xl p-3.5 border border-white/10 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] text-slate-300 font-medium uppercase">Today's Recorded Actions</p>
                                <p className="text-2xl font-black text-white mt-0.5">{auditStats.todayCount ?? 0}</p>
                            </div>
                            <Activity size={24} className="text-emerald-400 opacity-80" />
                        </div>

                        <div className="bg-white/10 rounded-xl p-3.5 border border-white/10 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] text-slate-300 font-medium uppercase">Recycle Bin Items (Protected)</p>
                                <p className="text-2xl font-black text-rose-300 mt-0.5">{binStats.activeTrashCount ?? 0}</p>
                            </div>
                            <RotateCcw size={24} className="text-rose-400 opacity-80" />
                        </div>

                        <div className="text-[11px] text-slate-400 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                            💡 <strong>Zero Data Loss Policy:</strong> When any record is deleted, it is safely stored in the Recycle Bin. Super Admin can restore it with 1 click.
                        </div>
                    </div>

                    {/* Right: Latest 5 actions stream */}
                    <div className="lg:col-span-2 bg-slate-950/60 rounded-xl p-4 border border-white/10">
                        <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-3">
                            <span>Recent Operational Actions</span>
                            <Link to="/audit-security" className="text-primary-400 hover:underline normal-case text-[11px] font-semibold">
                                View all ➔
                            </Link>
                        </div>

                        {recentAudit.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                                No recent activity logged yet.
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {recentAudit.slice(0, 5).map((log) => (
                                    <div key={log.log_id} className="flex items-center justify-between gap-3 text-xs p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${
                                                log.action === 'CREATE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                                log.action === 'UPDATE' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' :
                                                log.action === 'DELETE' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                                log.action === 'RESTORE' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                                                'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                                            }`}>
                                                {log.action}
                                            </span>
                                            <span className="font-bold text-slate-200 truncate">{log.user_name || 'System'}</span>
                                            <span className="text-slate-400 truncate">• {log.module}: {log.record_title || log.record_id}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono shrink-0">
                                            {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* System Master Workflow Flowchart */}
            <div>
                <WorkflowFlowchart defaultWorkflow="lifecycle" allowSwitch={true} />
            </div>
        </div>
    );
};

const Dashboard = () => {
    const { getRoleCode } = useAuth();
    const roleCode = getRoleCode();

    if (roleCode === 'EMPLOYEE') {
        return <EmployeeDashboard />;
    }
    if (roleCode === 'CLIENT_LOGIN') {
        return <ClientDashboard />;
    }

    return <AdminDashboard />;
};

export default Dashboard;
