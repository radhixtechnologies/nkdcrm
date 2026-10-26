import { useState, useEffect, useCallback } from 'react';
import { Calendar, Search, Filter, Clock, CheckCircle } from 'lucide-react';
import attendanceService from '../../services/attendanceService';
import toast from 'react-hot-toast';

const DailyAttendance = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await attendanceService.getDailyLogs(startDate, endDate);
            setLogs(res.data.data || []);
        } catch (err) {
            console.error(err);
            toast.error("Failed to fetch logs");
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'P': return 'bg-green-100 text-green-700';
            case 'A': return 'bg-red-100 text-red-700';
            case 'L': return 'bg-yellow-100 text-yellow-700';
            case 'WO': return 'bg-slate-100 text-slate-700';
            case 'H': return 'bg-orange-100 text-orange-700';
            default: return 'bg-slate-100 text-slate-500';
        }
    };

    // Helper to format duration object or string
    const formatDuration = (log) => {
        // 1. Total seconds from backend
        if (log.total_seconds !== undefined && log.total_seconds !== null) {
            const sec = Number(log.total_seconds);
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = sec % 60;
            return `${h}h ${m}m ${s}s`;
        }

        // 2. Postgres interval object { hours: 8, minutes: 30 ... }
        if (log.work_duration && typeof log.work_duration === 'object') {
            const h = log.work_duration.hours || 0;
            const m = log.work_duration.minutes || 0;
            const s = log.work_duration.seconds || 0;
            return `${h}h ${m}m ${s}s`;
        }

        // 3. String interval "00:02:36"
        if (typeof log.work_duration === 'string') {
            const parts = log.work_duration.split(':').map(Number);
            const h = parts[0] || 0;
            const m = parts[1] || 0;
            const s = Math.round(parts[2] || 0);
            return `${h}h ${m}m ${s}s`;
        }

        // 4. Calculate directly from check_in and check_out
        const inTime = log.check_in_fmt || log.check_in;
        const outTime = log.check_out_fmt || log.check_out;
        if (inTime && outTime) {
            const [h1, m1, s1] = String(inTime).split(':').map(Number);
            const [h2, m2, s2] = String(outTime).split(':').map(Number);
            let diff = (h2 * 3600 + m2 * 60 + (s2 || 0)) - (h1 * 3600 + m1 * 60 + (s1 || 0));
            if (diff < 0) diff += 24 * 3600;
            const h = Math.floor(diff / 3600);
            const m = Math.floor((diff % 3600) / 60);
            const s = Math.round(diff % 60);
            return `${h}h ${m}m ${s}s`;
        }

        // 5. In Progress if punched in but not checked out
        if (inTime && !outTime && log.status === 'P') {
            return 'In Progress';
        }

        return '-';
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex gap-4 w-full md:w-auto">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">From Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="block w-full mt-1 border border-slate-300 rounded-md shadow-sm px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">To Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="block w-full mt-1 border border-slate-300 rounded-md shadow-sm px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>
                </div>

                <button
                    onClick={fetchLogs}
                    className="w-full md:w-auto bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                    <Search size={16} /> Filter Logs
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Date</th>
                                <th className="px-6 py-4 font-semibold">Employee</th>
                                <th className="px-6 py-4 text-center font-semibold">In Time</th>
                                <th className="px-6 py-4 text-center font-semibold">Out Time</th>
                                <th className="px-6 py-4 text-center font-semibold">Duration</th>
                                <th className="px-6 py-4 text-center font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold">Source</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="7" className="p-8 text-center text-slate-500">Loading logs...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan="7" className="p-12 text-center text-slate-400">No attendance logs found for this period.</td></tr>
                            ) : logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        {new Date(log.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{log.first_name} {log.last_name}</div>
                                        <div className="text-xs text-slate-500">{log.employee_code}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center text-slate-600 font-mono">
                                        {log.check_in_fmt || log.check_in || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center text-slate-600 font-mono">
                                        {log.check_out_fmt || log.check_out || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center font-mono font-medium text-slate-700">
                                        {formatDuration(log) !== '-' ? (
                                            <span className={`px-2.5 py-1 rounded text-xs font-semibold ${formatDuration(log) === 'In Progress' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>
                                                {formatDuration(log)}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(log.status)}`}>
                                            {log.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 text-xs uppercase font-semibold">
                                        {log.source}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DailyAttendance;
