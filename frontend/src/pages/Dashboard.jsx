import React, { useState, useEffect } from 'react';
import {
    Users, UserCheck, DollarSign, Calendar,
    Building2, TrendingUp, Clock, Plus,
    FileSpreadsheet, CreditCard, ArrowRight,
    CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import EmployeeDashboard from './EmployeeDashboard';
import dashboardService from '../services/dashboardService';
import AreaTrendChart from '../components/charts/AreaTrendChart';
import BarChart from '../components/charts/BarChart';
import DonutChart from '../components/charts/DonutChart';
import WorkflowFlowchart from '../components/charts/WorkflowFlowchart';
import toast from 'react-hot-toast';

const StatCard = ({ title, value, badge, icon: Icon, color, bg, link, linkText }) => (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
        <div className="flex items-start justify-between">
            <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
            </div>
            <div className={`rounded-xl p-2.5 ${bg} ${color} shrink-0`}>
                <Icon size={22} strokeWidth={2.2} />
            </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600 flex items-center gap-1">
                {badge}
            </span>
            {link && (
                <Link to={link} className="text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-0.5">
                    {linkText || 'View'} <ArrowRight size={12} />
                </Link>
            )}
        </div>
    </div>
);

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [charts, setCharts] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsRes, chartsRes] = await Promise.all([
                dashboardService.getStats(),
                dashboardService.getCharts(),
            ]);
            setStats(statsRes.data?.data || null);
            setCharts(chartsRes.data?.data || null);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            toast.error('Failed to load live dashboard stats');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const formatCurrency = (num) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(num || 0);
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            {/* Header with Quick Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">NKD CRM Executive Overview</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Real-time workforce attendance, operations & financial insights</p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={loadData}
                        title="Refresh Data"
                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>

                    <Link
                        to="/employees"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
                    >
                        <Plus size={15} /> Add Employee
                    </Link>

                    <Link
                        to="/payroll"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-xs font-semibold text-white shadow-xs transition-colors"
                    >
                        <DollarSign size={15} /> Run Payroll
                    </Link>
                </div>
            </div>

            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard
                    title="Active Employees"
                    value={loading ? '...' : (stats?.totalEmployees ?? 0)}
                    badge={`${stats?.totalSites ?? 0} Active Sites`}
                    icon={Users}
                    color="text-blue-600"
                    bg="bg-blue-50"
                    link="/employees"
                    linkText="Directory"
                />

                <StatCard
                    title="Present Today"
                    value={loading ? '...' : (stats?.presentToday ?? 0)}
                    badge={`${stats?.attendanceRate ?? 0}% Turnout Rate`}
                    icon={UserCheck}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                    link="/attendance"
                    linkText="Daily Logs"
                />

                <StatCard
                    title="Pending Approvals"
                    value={loading ? '...' : ((stats?.pendingLeaves ?? 0) + (stats?.pendingClaims ?? 0))}
                    badge={`${stats?.pendingLeaves ?? 0} Leaves, ${stats?.pendingClaims ?? 0} Claims`}
                    icon={Calendar}
                    color="text-amber-600"
                    bg="bg-amber-50"
                    link="/leaves"
                    linkText="Review"
                />

                <StatCard
                    title="Monthly Payroll"
                    value={loading ? '...' : formatCurrency(stats?.latestPayroll?.amount)}
                    badge={stats?.latestPayroll ? `Month ${stats.latestPayroll.month}/${stats.latestPayroll.year}` : 'Latest Batch'}
                    icon={DollarSign}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                    link="/payroll"
                    linkText="Manage"
                />
            </div>

            {/* Interactive Graph Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Attendance Trend Chart */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Weekly Attendance Turnout</h3>
                            <p className="text-xs text-slate-500">Live employee check-in trend for the past 7 days</p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
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
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Workforce Distribution</h3>
                            <p className="text-xs text-slate-500">Departmental deployment across operations</p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
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
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Site & Branch Staffing</h3>
                            <p className="text-xs text-slate-500">Employee count assigned to branches & client facilities</p>
                        </div>
                        <Link to="/sites" className="text-xs font-semibold text-primary-600 hover:underline">
                            View Sites
                        </Link>
                    </div>

                    <BarChart
                        data={charts?.siteDistribution || []}
                        labelKey="label"
                        valueKey="value"
                        barColor="#0ea5e9"
                    />
                </div>

                {/* 4. Live Attendance Stream / Activity */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Live Punch Feed</h3>
                            <p className="text-xs text-slate-500">Latest recorded check-ins and attendance updates</p>
                        </div>
                        <Link to="/attendance" className="text-xs font-semibold text-primary-600 hover:underline">
                            Full Register
                        </Link>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {(!charts?.recentActivity || charts.recentActivity.length === 0) ? (
                            <div className="py-12 text-center text-xs text-slate-400">
                                No check-in records logged yet today.
                            </div>
                        ) : (
                            charts.recentActivity.map((act) => (
                                <div key={act.attendance_id} className="py-3 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                                            {act.first_name?.[0] || 'E'}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800">{act.first_name} {act.last_name}</p>
                                            <p className="text-[11px] text-slate-400 font-mono">{act.employee_code}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-slate-600">
                                            {act.time ? `${act.time} hrs` : new Date(act.date).toLocaleDateString()}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            act.status === 'P' ? 'bg-emerald-100 text-emerald-700' :
                                            act.status === 'HD' ? 'bg-amber-100 text-amber-700' :
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

            {/* System Master Workflow Flowchart (Requested by User) */}
            <div>
                <WorkflowFlowchart defaultWorkflow="lifecycle" allowSwitch={true} />
            </div>
        </div>
    );
};

const Dashboard = () => {
    const { user } = useAuth();

    if (user?.roleCode === 'EMPLOYEE') {
        return <EmployeeDashboard />;
    }

    return <AdminDashboard />;
};

export default Dashboard;
