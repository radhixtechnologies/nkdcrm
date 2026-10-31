import { useState, useEffect } from 'react';
import api from '../services/api';
import dayjs from 'dayjs';
import { Clock, Play, Square, History, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

// API Base URL (Relative path handling in api.js or use full path)
// api.js usually has baseURL configured. Assuming it points to /api
// So we use /attendance/tracker endpoint
const API_ENDPOINT = '/attendance/tracker';

const AttendanceWidget = () => {
    const [status, setStatus] = useState('LOADING'); // LOADING, CHECKED_IN, CHECKED_OUT
    const [checkInTime, setCheckInTime] = useState(null);
    const [logs, setLogs] = useState([]);
    const [timer, setTimer] = useState('00:00:00');
    const [loadingAction, setLoadingAction] = useState(false);
    const [gpsCoords, setGpsCoords] = useState(null);

    const getCoordinates = () => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const coords = {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        location_accuracy: pos.coords.accuracy
                    };
                    setGpsCoords(coords);
                    resolve(coords);
                },
                (err) => {
                    console.warn('GPS location unavailable or declined:', err.message);
                    resolve(null);
                },
                { enableHighAccuracy: true, timeout: 6000 }
            );
        });
    };

    // Initial Fetch
    useEffect(() => {
        fetchHistory();
    }, []);

    // Timer Logic
    useEffect(() => {
        let interval;
        if (status === 'CHECKED_IN' && checkInTime) {
            interval = setInterval(() => {
                const now = dayjs();
                const start = dayjs(checkInTime);
                const diffSeconds = now.diff(start, 'second');

                const h = Math.floor(diffSeconds / 3600);
                const m = Math.floor((diffSeconds % 3600) / 60);
                const s = diffSeconds % 60;

                setTimer(
                    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                );
            }, 1000);
        } else {
            setTimer('00:00:00');
        }
        return () => clearInterval(interval);
    }, [status, checkInTime]);

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

    const fetchHistory = async () => {
        try {
            const res = await api.get(`${API_ENDPOINT}/history`);
            const history = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setLogs(history);

            // Determine current status based on today's record
            const today = dayjs().format('YYYY-MM-DD');
            const todayLog = history.find(log => {
                const lDate = log.date ? (typeof log.date === 'string' ? log.date.split('T')[0] : dayjs(log.date).format('YYYY-MM-DD')) : '';
                return lDate === today;
            });

            console.log('Today Log:', todayLog);

            if (todayLog) {
                // If checked in but not checked out
                const hasCheckOut = todayLog.check_out !== null &&
                    todayLog.check_out !== undefined &&
                    todayLog.check_out !== '';

                if (todayLog.check_in && !hasCheckOut) {
                    console.log('Setting status to CHECKED_IN');
                    setStatus('CHECKED_IN');
                    const [h, m, s] = String(todayLog.check_in).split(':');
                    const fullDate = dayjs().hour(parseInt(h) || 0).minute(parseInt(m) || 0).second(parseInt(s) || 0);
                    setCheckInTime(fullDate);
                } else if (hasCheckOut) {
                    console.log('Setting status to CHECKED_OUT (has check_out)');
                    setStatus('CHECKED_OUT');
                    setCheckInTime(null);
                } else {
                    console.log('Setting status to CHECKED_OUT (no check_in)');
                    setStatus('CHECKED_OUT');
                }
            } else {
                console.log('No log for today, setting status to CHECKED_OUT');
                setStatus('CHECKED_OUT'); // Ready to check in
            }
        } catch (err) {
            console.error('Error fetching history:', err);
            setStatus('CHECKED_OUT'); // Fallback on error
        }
    };

    const handleCheckIn = async () => {
        setLoadingAction(true);
        try {
            const coords = await getCoordinates();
            const res = await api.post(`${API_ENDPOINT}/check-in`, coords || {});
            console.log('Check-in response:', res.data);
            setStatus('CHECKED_IN');
            const timeStr = res.data.check_in || res.data.in_time; // HH:MM:SS
            const today = dayjs().format('YYYY-MM-DD');
            const [h, m, s] = timeStr.split(':');
            setCheckInTime(dayjs(today).hour(h).minute(m).second(s));

            if (coords) {
                toast.success('📍 Checked In with GPS Location!');
            } else {
                toast.success('Checked In Successfully!');
            }
            fetchHistory(); // Refresh logs
        } catch (err) {
            console.error('Check-in error:', err);
            toast.error(err.response?.data?.msg || 'Check-in failed');
        } finally {
            setLoadingAction(false);
        }
    };

    const handleCheckOut = async () => {
        setLoadingAction(true);
        try {
            const coords = await getCoordinates();
            await api.post(`${API_ENDPOINT}/check-out`, coords || {});
            setStatus('CHECKED_OUT');
            setCheckInTime(null);
            if (coords) {
                toast.success('📍 Checked Out with GPS Location!');
            } else {
                toast.success('Checked Out Successfully!');
            }
            fetchHistory();
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Check-out failed');
        } finally {
            setLoadingAction(false);
        }
    };

    const formatSeconds = (sec) => {
        if (!sec && sec !== 0) return '-';
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.round(sec % 60);
        return `${h}h ${m}m ${s}s`;
    };

    const formatDuration = (log) => {
        if (log.total_seconds !== undefined && log.total_seconds !== null) return formatSeconds(log.total_seconds);
        if (log.work_duration && typeof log.work_duration === 'object') {
            const h = log.work_duration.hours || 0;
            const m = log.work_duration.minutes || 0;
            const s = log.work_duration.seconds || 0;
            return `${h}h ${m}m ${s}s`;
        }
        const inTime = log.check_in_fmt || log.check_in;
        const outTime = log.check_out_fmt || log.check_out;
        if (inTime && outTime) {
            const [h1, m1, s1] = String(inTime).split(':').map(Number);
            const [h2, m2, s2] = String(outTime).split(':').map(Number);
            let diff = (h2 * 3600 + m2 * 60 + (s2 || 0)) - (h1 * 3600 + m1 * 60 + (s1 || 0));
            if (diff < 0) diff += 24 * 3600;
            return formatSeconds(diff);
        }
        return '-';
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-md mx-auto">
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
                    <Clock className="text-primary-600" />
                    Attendance Tracker
                </h2>
                <p className="text-sm text-slate-500 mt-1">{dayjs().format('dddd, D MMMM YYYY')}</p>
            </div>

            {/* Timer Display */}
            <div className="bg-slate-50 rounded-lg p-6 mb-6 text-center border border-slate-100">
                <div className="text-4xl font-mono font-bold text-slate-700 tracking-wider">
                    {timer}
                </div>
                <div className="text-xs text-slate-400 mt-2 font-medium uppercase tracking-widest">
                    {status === 'CHECKED_IN' ? 'Current Session' : 'Ready to Start'}
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 gap-4 mb-8">
                {status === 'CHECKED_IN' ? (
                    <button
                        onClick={handleCheckOut}
                        disabled={loadingAction}
                        className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg font-semibold transition-all shadow-sm disabled:opacity-50"
                    >
                        {loadingAction ? 'Processing...' : (
                            <>
                                <Square size={20} fill="currentColor" /> Stop / Check Out
                            </>
                        )}
                    </button>
                ) : (
                    <button
                        onClick={handleCheckIn}
                        disabled={loadingAction || status === 'LOADING'}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-3 px-4 rounded-lg font-semibold transition-all shadow-sm disabled:opacity-50"
                    >
                        {loadingAction ? 'Processing...' : (
                            <>
                                <Play size={20} fill="currentColor" /> Start / Check In
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* History */}
            <div>
                <h3 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
                    <History size={16} /> Recent History
                </h3>
                <div className="border border-slate-100 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-2 text-xs">Date</th>
                                <th className="px-3 py-2 text-xs">In</th>
                                <th className="px-3 py-2 text-xs">Out</th>
                                <th className="px-3 py-2 text-right text-xs">Dur</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-3 py-6 text-center text-slate-400 text-xs">
                                        No recent logs found. Punch in to record your attendance.
                                    </td>
                                </tr>
                            ) : logs.slice(0, 15).map((log, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 text-slate-700">
                                        <div className="flex items-center gap-1">
                                            <span className="font-medium text-xs">
                                                {log.date_formatted || (log.date ? dayjs(log.date).format('DD MMM') : '-')}
                                            </span>
                                            {log.latitude && (
                                                <a
                                                    href={`https://maps.google.com/?q=${log.latitude},${log.longitude}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title={`GPS Location: ${log.latitude}, ${log.longitude}`}
                                                    className="text-emerald-600 hover:text-emerald-700 inline-flex items-center ml-0.5"
                                                >
                                                    <MapPin size={12} />
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-slate-700 font-mono text-xs font-semibold">
                                        {formatTimeDisplay(log.check_in_fmt || log.check_in)}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600 font-mono text-xs">
                                        {formatTimeDisplay(log.check_out_fmt || log.check_out)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium text-slate-600 text-xs">
                                        {formatDuration(log)}
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

export default AttendanceWidget;
