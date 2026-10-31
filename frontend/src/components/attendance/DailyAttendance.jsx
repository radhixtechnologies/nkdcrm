import React, { useState, useEffect, useCallback } from 'react';
import {
    Calendar, Search, Filter, Clock, CheckCircle,
    MapPin, User, ChevronRight, ArrowUpDown, RefreshCw,
    Download, ShieldCheck, AlertCircle
} from 'lucide-react';
import attendanceService from '../../services/attendanceService';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const getTodayStr = () => dayjs().format('YYYY-MM-DD');
const getDaysAgoStr = (days) => dayjs().subtract(days, 'day').format('YYYY-MM-DD');
const getMonthStartStr = () => dayjs().startOf('month').format('YYYY-MM-DD');

const DailyAttendance = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    // Default to last 30 days so users immediately see their full check-in history!
    const [startDate, setStartDate] = useState(getDaysAgoStr(30));
    const [endDate, setEndDate] = useState(getTodayStr());
    const [activeFilter, setActiveFilter] = useState('30d'); // 'today', '7d', 'month', '30d', 'custom'
    const [searchTerm, setSearchTerm] = useState('');

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await attendanceService.getDailyLogs(startDate, endDate);
            const data = res.data?.data || res.data || [];
            setLogs(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch attendance logs:', err);
            toast.error('Failed to fetch attendance logs');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const setQuickRange = (rangeKey) => {
        setActiveFilter(rangeKey);
        const today = getTodayStr();
        setEndDate(today);
        if (rangeKey === 'today') {
            setStartDate(today);
        } else if (rangeKey === '7d') {
            setStartDate(getDaysAgoStr(7));
        } else if (rangeKey === 'month') {
            setStartDate(getMonthStartStr());
        } else if (rangeKey === '30d') {
            setStartDate(getDaysAgoStr(30));
        }
    };

    const formatTimeDisplay = (timeStr) => {
        if (!timeStr) return '-';
        const parts = String(timeStr).split(':');
        if (parts.length >= 2) {
            let h = parseInt(parts[0], 10);
            const m = parts[1];
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${h}:${m} ${ampm}`;
        }
        return timeStr;
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'P':
                return { label: 'Present', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
            case 'A':
                return { label: 'Absent', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
            case 'L':
                return { label: 'On Leave', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
            case 'HD':
                return { label: 'Half Day', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
            case 'WO':
                return { label: 'Weekly Off', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
            case 'H':
                return { label: 'Holiday', bg: 'bg-sky-50 text-sky-700 border-sky-200' };
            default:
                return { label: status || 'P', bg: 'bg-slate-100 text-slate-600 border-slate-200' };
        }
    };

    const formatDuration = (log) => {
        if (log.total_seconds !== undefined && log.total_seconds !== null) {
            const sec = Number(log.total_seconds);
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            return `${h}h ${m}m`;
        }
        if (log.work_duration && typeof log.work_duration === 'object') {
            const h = log.work_duration.hours || 0;
            const m = log.work_duration.minutes || 0;
            return `${h}h ${m}m`;
        }
        const inTime = log.check_in_fmt || log.check_in;
        const outTime = log.check_out_fmt || log.check_out;
        if (inTime && outTime) {
            const [h1, m1] = String(inTime).split(':').map(Number);
            const [h2, m2] = String(outTime).split(':').map(Number);
            let diffMin = (h2 * 60 + m2) - (h1 * 60 + m1);
            if (diffMin < 0) diffMin += 24 * 60;
            return `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
        }
        if (inTime && !outTime && log.status === 'P') {
            return 'In Progress';
        }
        return '-';
    };

    // Filter logs by search term
    const filteredLogs = logs.filter((log) => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        const fullName = `${log.first_name || ''} ${log.last_name || ''}`.toLowerCase();
        const code = (log.employee_code || '').toLowerCase();
        const remarks = (log.remarks || '').toLowerCase();
        return fullName.includes(q) || code.includes(q) || remarks.includes(q);
    });

    // Summary counts
    const presentCount = filteredLogs.filter(l => l.status === 'P' || l.check_in).length;
    const leaveCount = filteredLogs.filter(l => l.status === 'L').length;

    return (
        <div className="space-y-5 animate-fade-in">
            {/* Quick Stats Pill Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs card-hover-effect">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Records</p>
                    <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">{filteredLogs.length}</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs card-hover-effect">
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Present / Punched</p>
                    <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-0.5">{presentCount}</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs card-hover-effect">
                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">On Leave</p>
                    <p className="text-xl sm:text-2xl font-extrabold text-amber-700 mt-0.5">{leaveCount}</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs card-hover-effect">
                    <p className="text-[11px] font-bold text-primary-600 uppercase tracking-wider">Timezone</p>
                    <p className="text-sm sm:text-base font-bold text-slate-800 mt-1 flex items-center gap-1">
                        <Clock size={15} className="text-primary-500" /> IST (UTC+5:30)
                    </p>
                </div>
            </div>

            {/* Filter Control Bar */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
                {/* Preset Pills */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 hidden sm:inline">Range:</span>
                        {[
                            { key: 'today', label: 'Today' },
                            { key: '7d', label: 'Last 7 Days' },
                            { key: 'month', label: 'This Month' },
                            { key: '30d', label: 'Last 30 Days' },
                        ].map((btn) => (
                            <button
                                key={btn.key}
                                onClick={() => setQuickRange(btn.key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 btn-press ${
                                    activeFilter === btn.key
                                        ? 'bg-primary-600 text-white shadow-xs'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-700 hover:bg-primary-50 transition-colors btn-press ml-auto"
                        title="Refresh Logs"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        <span>Refresh</span>
                    </button>
                </div>

                {/* Date Inputs & Search */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1 border-t border-slate-100">
                    <div className="sm:col-span-3">
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">From Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setActiveFilter('custom'); }}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                        />
                    </div>
                    <div className="sm:col-span-3">
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">To Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setActiveFilter('custom'); }}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                        />
                    </div>
                    <div className="sm:col-span-4">
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Search Employee</label>
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Name, EMP-Code, remarks..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
                            />
                        </div>
                    </div>
                    <div className="sm:col-span-2 flex items-end">
                        <button
                            onClick={fetchLogs}
                            disabled={loading}
                            className="w-full bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all btn-press h-[38px]"
                        >
                            <Filter size={14} /> Filter
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile View: High-Polish Cards for Smartphones */}
            <div className="block sm:hidden space-y-3">
                {loading ? (
                    <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-primary-500 border-t-transparent mb-2" />
                        <p className="text-xs">Loading attendance history...</p>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                        <Clock size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700 text-sm">No attendance logs found</p>
                        <p className="text-xs text-slate-500 mt-1">Try selecting "Last 30 Days" or adjusting your date filter above.</p>
                    </div>
                ) : (
                    filteredLogs.map((log, idx) => {
                        const badge = getStatusBadge(log.status);
                        const dur = formatDuration(log);
                        return (
                            <div key={log.attendance_id || idx} className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center shrink-0">
                                            {log.first_name?.[0] || 'E'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 text-sm leading-tight">
                                                {log.first_name} {log.last_name}
                                            </p>
                                            <p className="text-[11px] font-mono text-slate-500">{log.employee_code}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                                        {badge.label}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-center">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Date</span>
                                        <span className="text-xs font-semibold text-slate-800">
                                            {log.date_formatted || (log.date ? dayjs(log.date).format('DD MMM') : '-')}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase block">Check In</span>
                                        <span className="text-xs font-bold text-slate-900 font-mono">
                                            {formatTimeDisplay(log.check_in_fmt || log.check_in)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Check Out</span>
                                        <span className="text-xs font-bold text-slate-900 font-mono">
                                            {formatTimeDisplay(log.check_out_fmt || log.check_out)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs pt-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-slate-400 text-[11px]">Duration:</span>
                                        <span className={`font-semibold text-[11px] px-2 py-0.5 rounded-md ${
                                            dur === 'In Progress' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {dur}
                                        </span>
                                    </div>

                                    {log.source === 'GPS' || log.latitude ? (
                                        <a
                                            href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
                                        >
                                            <MapPin size={11} /> GPS Verified
                                        </a>
                                    ) : (
                                        <span className="text-[11px] text-slate-400 uppercase font-mono">{log.source || 'PORTAL'}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/90 text-slate-600 border-b border-slate-200 text-xs uppercase tracking-wider font-bold">
                            <tr>
                                <th className="px-5 py-3.5">Date</th>
                                <th className="px-5 py-3.5">Employee</th>
                                <th className="px-5 py-3.5 text-center">In Time (IST)</th>
                                <th className="px-5 py-3.5 text-center">Out Time (IST)</th>
                                <th className="px-5 py-3.5 text-center">Duration</th>
                                <th className="px-5 py-3.5 text-center">Status</th>
                                <th className="px-5 py-3.5 text-right">Source</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="p-12 text-center text-slate-500">
                                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-primary-500 border-t-transparent mb-2" />
                                        <p className="text-xs">Loading attendance records...</p>
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-12 text-center text-slate-400">
                                        No attendance logs found for this period. Try expanding the date range.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log, idx) => {
                                    const badge = getStatusBadge(log.status);
                                    const dur = formatDuration(log);
                                    return (
                                        <tr key={log.attendance_id || idx} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-5 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                                                {log.date_formatted || (log.date ? dayjs(log.date).format('DD/MM/YYYY') : '-')}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="font-bold text-slate-900 leading-tight">
                                                    {log.first_name} {log.last_name}
                                                </div>
                                                <div className="text-xs font-mono text-slate-500">{log.employee_code}</div>
                                            </td>
                                            <td className="px-5 py-3.5 text-center font-bold text-slate-900 font-mono">
                                                {formatTimeDisplay(log.check_in_fmt || log.check_in)}
                                            </td>
                                            <td className="px-5 py-3.5 text-center font-bold text-slate-900 font-mono">
                                                {formatTimeDisplay(log.check_out_fmt || log.check_out)}
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                {dur !== '-' ? (
                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                                                        dur === 'In Progress' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {dur}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badge.bg}`}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-medium text-xs">
                                                {log.source === 'GPS' || log.latitude ? (
                                                    <a
                                                        href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 transition-colors font-bold"
                                                        title={`Lat: ${log.latitude}, Lng: ${log.longitude}`}
                                                    >
                                                        <MapPin size={12} /> GPS Verified
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-500 uppercase font-mono">{log.source || 'MANUAL'}</span>
                                                )}
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
    );
};

export default DailyAttendance;
