import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AttendanceWidget from '../components/AttendanceWidget';
import leaveService from '../services/leaveService';
import payrollService from '../services/payrollService';
import {
    Calendar, DollarSign, Clock, Briefcase,
    ChevronRight, Bell, User
} from 'lucide-react';
import { Link } from 'react-router-dom';

const EmployeeDashboard = () => {
    const { user } = useAuth();
    const [leaveBalance, setLeaveBalance] = useState({ remaining: 0, total: 0 });
    const [latestPayslip, setLatestPayslip] = useState(null);
    const [loading, setLoading] = useState(true);

    // Mock Holidays
    const holidays = [
        { name: "Good Friday", date: "2024-03-29", type: "Public" },
        { name: "Eid-ul-Fitr", date: "2024-04-10", type: "Public" },
        { name: "Independence Day", date: "2024-08-15", type: "National" },
        { name: "Diwali", date: "2024-11-01", type: "Festival" },
    ].filter(h => new Date(h.date) > new Date()).slice(0, 3);

    useEffect(() => {
        const loadData = async () => {
            if (!user?.employeeCode) {
                setLoading(false);
                return;
            }

            try {
                // Fetch Leave Balance
                const balRes = await leaveService.getEmployeeBalances(user.employeeCode);
                const balances = balRes.data?.data || [];
                // Sum up simplified balance for card (e.g. Annual Leave or Total)
                const totalRemaining = balances.reduce((sum, b) => sum + (parseFloat(b.remaining) || 0), 0);
                const totalAllocated = balances.reduce((sum, b) => sum + (parseFloat(b.total_allocated) || 0), 0);
                setLeaveBalance({ remaining: totalRemaining, total: totalAllocated });

                // Fetch Latest Payslip
                const year = new Date().getFullYear();
                const payRes = await payrollService.getMyPayrollHistory(year);
                const payslips = payRes.data?.data || [];
                if (payslips.length > 0) {
                    // Sort descending by month
                    payslips.sort((a, b) => b.month - a.month);
                    setLatestPayslip(payslips[0]);
                }

            } catch (err) {
                console.error("Dashboard data load failed", err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user]);

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Welcome back, {user?.firstName}! 👋
                    </h1>
                    <p className="text-slate-500">Here's what's happening today.</p>
                </div>
                <div className="flex gap-3">
                    <button className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors relative">
                        <Bell size={20} />
                        <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                    </button>
                    <Link to="/profile" className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                        <User size={20} />
                    </Link>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Attendance Widget Wrapper - Keeping it distinct */}
                <div className="md:col-span-2">
                    <AttendanceWidget />
                </div>

                {/* Leave Balance Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 font-medium text-sm">Leave Balance</p>
                            <h3 className="text-3xl font-bold text-slate-800 mt-2">{leaveBalance.remaining}</h3>
                            <p className="text-xs text-slate-400 mt-1">Available Days</p>
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
                                        ₹ {parseFloat(latestPayslip.net_salary).toLocaleString('en-IN')}
                                    </h3>
                                    <p className="text-xs text-green-600 font-medium mt-1">
                                        {months[latestPayslip.month - 1]} {latestPayslip.year} • Paid
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
                    <div className="space-y-4">
                        {holidays.length === 0 ? (
                            <p className="text-slate-500 text-sm">No upcoming holidays.</p>
                        ) : (
                            holidays.map((h, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white p-2 rounded-lg border border-slate-200 text-center min-w-[50px]">
                                            <div className="text-xs text-red-500 font-bold uppercase">{new Date(h.date).toLocaleString('default', { month: 'short' })}</div>
                                            <div className="text-lg font-bold text-slate-800">{new Date(h.date).getDate()}</div>
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-900">{h.name}</div>
                                            <div className="text-xs text-slate-500">{h.type} Holiday</div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-medium text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">
                                        {Math.ceil((new Date(h.date) - new Date()) / (1000 * 60 * 60 * 24))} days left
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Quick Actions / Profile Shortcut */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-800 mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                        <Link to="/profile" className="block w-full p-3 text-left rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700 flex items-center justify-between group">
                            Update Profile
                            <ChevronRight size={16} className="text-slate-400 group-hover:text-primary-600" />
                        </Link>
                        <Link to="/leaves" className="block w-full p-3 text-left rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700 flex items-center justify-between group">
                            Request Time Off
                            <ChevronRight size={16} className="text-slate-400 group-hover:text-primary-600" />
                        </Link>
                        <Link to="/benefits" className="block w-full p-3 text-left rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700 flex items-center justify-between group">
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
