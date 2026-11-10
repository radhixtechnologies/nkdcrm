import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import AttendanceWidget from '../components/AttendanceWidget';
import leaveService from '../services/leaveService';
import payrollService from '../services/payrollService';
import {
    Calendar, DollarSign, Briefcase,
    ChevronRight, Bell, User
} from 'lucide-react';
import { Link } from 'react-router-dom';

const HOLIDAY_CALENDAR = [
    { name: 'Republic Day', date: '2026-01-26', type: 'National' },
    { name: 'Holi', date: '2026-03-04', type: 'Festival' },
    { name: 'Eid-ul-Fitr', date: '2026-03-21', type: 'Public' },
    { name: 'Good Friday', date: '2026-04-03', type: 'Public' },
    { name: 'Maharashtra / Labour Day', date: '2026-05-01', type: 'Public' },
    { name: 'Independence Day', date: '2026-08-15', type: 'National' },
    { name: 'Gandhi Jayanti', date: '2026-10-02', type: 'National' },
    { name: 'Dussehra', date: '2026-10-20', type: 'Festival' },
    { name: 'Diwali (Lakshmi Puja)', date: '2026-11-08', type: 'Festival' },
    { name: 'Guru Nanak Jayanti', date: '2026-11-24', type: 'Public' },
    { name: 'Christmas Day', date: '2026-12-25', type: 'Public' },
    { name: 'Republic Day', date: '2027-01-26', type: 'National' },
    { name: 'Holi', date: '2027-03-22', type: 'Festival' },
    { name: 'Good Friday', date: '2027-03-26', type: 'Public' },
    { name: 'Independence Day', date: '2027-08-15', type: 'National' },
];

const getIstTodayStr = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).format(new Date());

const EmployeeDashboard = () => {
    const { user } = useAuth();
    const [leaveBalance, setLeaveBalance] = useState({ remaining: 0, total: 0 });
    const [latestPayslip, setLatestPayslip] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notifOpen, setNotifOpen] = useState(false);
    const notifRef = useRef(null);

    const todayStr = getIstTodayStr();
    const todayMidnight = new Date(`${todayStr}T00:00:00+05:30`);
    const holidays = HOLIDAY_CALENDAR
        .filter(h => h.date >= todayStr)
        .slice(0, 4);

    useEffect(() => {
        const handleOutside = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    useEffect(() => {
        const loadData = async () => {
            if (!user?.employeeCode) {
                setLoading(false);
                return;
            }

            try {
                const [balRes, payRes] = await Promise.all([
                    leaveService.getEmployeeBalances(user.employeeCode).catch(() => ({ data: { data: [] } })),
                    payrollService.getMyPayrollHistory(new Date().getFullYear()).catch(() => ({ data: { data: [] } }))
                ]);

                const balances = balRes.data?.data || balRes.data || [];
                if (Array.isArray(balances)) {
                    const paidBalances = balances.filter(b => b && b.is_paid !== false && b.leave_code !== 'LWP');
                    const totalRemaining = paidBalances.reduce((sum, b) => sum + (parseFloat(b.remaining) || 0), 0);
                    const totalAllocated = paidBalances.reduce((sum, b) => sum + (parseFloat(b.total_allocated) || 0), 0);
                    setLeaveBalance({
                        remaining: Math.round(totalRemaining * 10) / 10,
                        total: Math.round(totalAllocated * 10) / 10
                    });
                }

                const payslips = payRes.data?.data || payRes.data || [];
                if (Array.isArray(payslips) && payslips.length > 0) {
                    const sorted = [...payslips].sort((a, b) => {
                        const yDiff = (Number(b.year) || 0) - (Number(a.year) || 0);
                        return yDiff !== 0 ? yDiff : (Number(b.month) || 0) - (Number(a.month) || 0);
                    });
                    setLatestPayslip(sorted[0]);
                }
            } catch (err) {
                console.error('Dashboard data load failed', err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user]);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                        Welcome back, {user?.firstName || 'Team Member'}!
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500">Here&apos;s your attendance, leave balance, and salary overview.</p>
                </div>
                <div className="flex gap-2.5 self-end sm:self-auto">
                    <div className="relative" ref={notifRef}>
                        <button
                            type="button"
                            onClick={() => setNotifOpen(!notifOpen)}
                            className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors relative"
                            aria-label="Notifications"
                        >
                            <Bell size={20} />
                            {holidays.length > 0 && (
                                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                            )}
                        </button>
                        {notifOpen && (
                            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 z-40 text-xs space-y-2.5">
                                <p className="font-bold text-slate-800 border-b border-slate-100 pb-2">Quick Summary</p>
                                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900">
                                    <span className="font-semibold">Paid Leave Balance:</span> {leaveBalance.remaining} / {leaveBalance.total} days remaining
                                </div>
                                {latestPayslip && (
                                    <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-900">
                                        <span className="font-semibold">Latest Payslip:</span> {months[(latestPayslip.month || 1) - 1]} {latestPayslip.year} (₹{(Number(latestPayslip.net_salary) || 0).toLocaleString('en-IN')})
                                    </div>
                                )}
                                {holidays[0] && (
                                    <div className="p-2.5 rounded-xl bg-blue-50 text-blue-900">
                                        <span className="font-semibold">Next Holiday:</span> {holidays[0].name} ({holidays[0].date})
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <Link to="/profile" className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors" aria-label="My Profile">
                        <User size={20} />
                    </Link>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="md:col-span-2">
                    <AttendanceWidget />
                </div>

                {/* Leave Balance Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 font-medium text-sm">Leave Balance</p>
                            <h3 className="text-3xl font-bold text-slate-800 mt-2">{leaveBalance.remaining}</h3>
                            <p className="text-xs text-slate-400 mt-1">Available Paid Days</p>
                        </div>
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                            <Briefcase size={24} />
                        </div>
                    </div>
                    <Link to="/leaves" className="mt-4 text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 group">
                        Apply Leave <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>

                {/* Payslip Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 font-medium text-sm">Latest Salary</p>
                            {latestPayslip ? (
                                <>
                                    <h3 className="text-2xl font-bold text-slate-800 mt-2">
                                        ₹ {(Number(latestPayslip.net_salary) || 0).toLocaleString('en-IN')}
                                    </h3>
                                    <p className="text-xs text-green-600 font-medium mt-1">
                                        {months[(Number(latestPayslip.month) || 1) - 1]} {latestPayslip.year} • {latestPayslip.payment_status || 'Processed'}
                                    </p>
                                </>
                            ) : (
                                <h3 className="text-xl font-bold text-slate-400 mt-2">No Data</h3>
                            )}
                        </div>
                        <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                            <DollarSign size={24} />
                        </div>
                    </div>
                    <Link to="/payroll" className="mt-4 text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 group">
                        View Payslips <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>

            {/* Bottom Section: Holidays & Quick Links */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upcoming Holidays */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Calendar size={18} className="text-primary-600" /> Upcoming Holidays
                    </h3>
                    <div className="space-y-3">
                        {holidays.length === 0 ? (
                            <p className="text-slate-500 text-sm">No upcoming holidays scheduled.</p>
                        ) : (
                            holidays.map((h, i) => {
                                const hDate = new Date(`${h.date}T00:00:00+05:30`);
                                const daysLeft = Math.max(0, Math.round((hDate - todayMidnight) / (1000 * 60 * 60 * 24)));
                                return (
                                    <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                            <div className="bg-white p-2 rounded-lg border border-slate-200 text-center min-w-[50px] shrink-0">
                                                <div className="text-xs text-red-500 font-bold uppercase">
                                                    {hDate.toLocaleString('en-US', { month: 'short', timeZone: 'Asia/Kolkata' })}
                                                </div>
                                                <div className="text-lg font-bold text-slate-800">
                                                    {h.date.slice(8, 10)}
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-medium text-slate-900 truncate">{h.name}</div>
                                                <div className="text-xs text-slate-500">{h.type} Holiday</div>
                                            </div>
                                        </div>
                                        <div className="text-xs font-medium text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200 shrink-0">
                                            {daysLeft === 0 ? 'Today' : `${daysLeft} days left`}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-800 mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                        <Link to="/profile" className="w-full p-3 text-left rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700 flex items-center justify-between group">
                            Update Profile
                            <ChevronRight size={16} className="text-slate-400 group-hover:text-primary-600" />
                        </Link>
                        <Link to="/leaves" className="w-full p-3 text-left rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700 flex items-center justify-between group">
                            Request Time Off
                            <ChevronRight size={16} className="text-slate-400 group-hover:text-primary-600" />
                        </Link>
                        <Link to="/benefits" className="w-full p-3 text-left rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700 flex items-center justify-between group">
                            My Benefits
                            <ChevronRight size={16} className="text-slate-400 group-hover:text-primary-600" />
                        </Link>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Support</h4>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">HR</div>
                            <div>
                                <div className="text-sm font-medium text-slate-900">Contact HR</div>
                                <div className="text-xs text-slate-500">hr@nkdcrm.com</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeDashboard;
