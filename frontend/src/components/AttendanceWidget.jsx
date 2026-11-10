import { useState, useEffect, useCallback } from 'react';
import api, { extractApiError } from '../services/api';
import { Clock, Play, Square, History, MapPin, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const API_ENDPOINT = '/attendance/tracker';

const getIstDateStr = (date = new Date()) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);

const getIstDateOffsetStr = (daysAgo = 0) =>
    getIstDateStr(new Date(Date.now() - daysAgo * 86400000));

const getIstTimeStr = (date = new Date()) =>
    new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).format(date).replace(/^24:/, '00:');

const getIstTodayHeading = () =>
    new Date().toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

const normalizeHms = (timeVal) => {
    if (!timeVal) return null;
    const str = String(timeVal).trim();
    const parts = str.split(':');
    if (parts.length < 2) return null;
    const h = String(parseInt(parts[0], 10) || 0).padStart(2, '0');
    const m = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
    const s = String(parseInt(parts[2], 10) || 0).padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const toIstEpochMs = (dateStr, timeStr) => {
    const hms = normalizeHms(timeStr);
    if (!dateStr || !hms) return null;
    const ms = new Date(`${dateStr}T${hms}+05:30`).getTime();
    return Number.isNaN(ms) ? null : ms;
};

const formatDateShort = (log) => {
    if (log.date_formatted) return log.date_formatted;
    const raw = log.date ? String(log.date).split('T')[0] : '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!m) return raw || '-';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const idx = parseInt(m[2], 10) - 1;
    return `${m[3]} ${months[idx] || m[2]}`;
};

const AttendanceWidget = () => {
    const [status, setStatus] = useState('LOADING'); // LOADING, CHECKED_IN, CHECKED_OUT
    const [sessionStartMs, setSessionStartMs] = useState(null);
    const [logs, setLogs] = useState([]);
    const [timer, setTimer] = useState('00:00:00');
    const [loadingAction, setLoadingAction] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const getCoordinates = () => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    resolve({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        location_accuracy: pos.coords.accuracy
                    });
                },
                (err) => {
                    console.warn('GPS location unavailable or declined:', err.message);
                    resolve(null);
                },
                { enableHighAccuracy: true, timeout: 6000 }
            );
        });
    };

    const fetchHistory = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setRefreshing(true);
        setErrorMsg('');
        try {
            const res = await api.get(`${API_ENDPOINT}/history`);
            const history = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setLogs(history);

            const today = getIstDateStr();
            const yesterday = getIstDateOffsetStr(1);

            const openPunch = history.find((log) => {
                const lDate = log.date ? String(log.date).split('T')[0] : '';
                const hasOut = log.check_out !== null && log.check_out !== undefined && log.check_out !== '';
                return Boolean(log.check_in) && !hasOut && (lDate === today || lDate === yesterday);
            });

            if (openPunch) {
                const lDate = String(openPunch.date).split('T')[0];
                const startMs = toIstEpochMs(lDate, openPunch.check_in);
                setStatus('CHECKED_IN');
                setSessionStartMs(startMs);
            } else {
                setStatus('CHECKED_OUT');
                setSessionStartMs(null);
            }
        } catch (err) {
            console.error('Error fetching tracker history:', err);
            const msg = extractApiError(err, 'Unable to load attendance history');
            setErrorMsg(msg);
            setStatus('CHECKED_OUT');
        } finally {
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory({ silent: true });
    }, [fetchHistory]);

    useEffect(() => {
        const updateTimer = () => {
            if (status === 'CHECKED_IN' && sessionStartMs) {
                const diffSeconds = Math.max(0, Math.floor((Date.now() - sessionStartMs) / 1000));
                const h = Math.floor(diffSeconds / 3600);
                const m = Math.floor((diffSeconds % 3600) / 60);
                const s = diffSeconds % 60;
                setTimer(
                    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                );
            } else {
                setTimer('00:00:00');
            }
        };

        updateTimer();
        if (status !== 'CHECKED_IN' || !sessionStartMs) return undefined;
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [status, sessionStartMs]);

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

    const handleCheckIn = async () => {
        setLoadingAction(true);
        try {
            const coords = await getCoordinates();
            const res = await api.post(`${API_ENDPOINT}/check-in`, coords || {});
            const timeStr = res.data?.check_in || res.data?.data?.check_in || res.data?.in_time || getIstTimeStr();
            const dateStr = res.data?.date || res.data?.data?.date || getIstDateStr();
            const startMs = toIstEpochMs(dateStr, timeStr) || Date.now();

            setStatus('CHECKED_IN');
            setSessionStartMs(startMs);

            if (coords) {
                toast.success('Checked In (IST) with GPS location!');
            } else {
                toast.success('Checked In (IST) successfully!');
            }
            await fetchHistory({ silent: true });
        } catch (err) {
            console.error('Check-in error:', err);
            toast.error(extractApiError(err, err.response?.data?.msg || 'Check-in failed'));
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
            setSessionStartMs(null);

            if (coords) {
                toast.success('Checked Out (IST) with GPS location!');
            } else {
                toast.success('Checked Out (IST) successfully!');
            }
            await fetchHistory({ silent: true });
        } catch (err) {
            toast.error(extractApiError(err, err.response?.data?.msg || 'Check-out failed'));
        } finally {
            setLoadingAction(false);
        }
    };

    const formatSeconds = (sec) => {
        if (!sec && sec !== 0) return '-';
        const safeSec = Math.max(0, Number(sec) || 0);
        const h = Math.floor(safeSec / 3600);
        const m = Math.floor((safeSec % 3600) / 60);
        const s = Math.round(safeSec % 60);
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
        if (inTime && !outTime) {
            return 'Active';
        }
        return '-';
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 max-w-lg mx-auto">
            <div className="text-center mb-5">
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
                    <Clock className="text-primary-600" size={20} />
                    Attendance Tracker (IST)
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">{getIstTodayHeading()}</p>
            </div>

            {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span className="flex-1">{errorMsg}</span>
                    <button
                        type="button"
                        onClick={() => fetchHistory()}
                        className="font-bold underline shrink-0"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Timer Display */}
            <div className="bg-slate-50 rounded-xl p-5 mb-5 text-center border border-slate-100">
                <div className="text-3xl sm:text-4xl font-mono font-bold text-slate-800 tracking-wider">
                    {timer}
                </div>
                <div className="text-[11px] text-slate-500 mt-2 font-semibold uppercase tracking-widest flex items-center justify-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${status === 'CHECKED_IN' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    {status === 'CHECKED_IN' ? 'Active Session Running (IST)' : 'Ready to Check In'}
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 gap-3 mb-6">
                {status === 'CHECKED_IN' ? (
                    <button
                        type="button"
                        onClick={handleCheckOut}
                        disabled={loadingAction}
                        className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-50"
                    >
                        {loadingAction ? 'Recording Check Out...' : (
                            <>
                                <Square size={18} fill="currentColor" /> Stop / Check Out
                            </>
                        )}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleCheckIn}
                        disabled={loadingAction || status === 'LOADING'}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-50"
                    >
                        {loadingAction ? 'Recording Check In...' : (
                            <>
                                <Play size={18} fill="currentColor" /> Start / Check In
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Full Check-in History */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-600 flex items-center gap-1.5">
                        <History size={15} className="text-primary-600" /> Check-In History
                        <span className="ml-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary-50 text-primary-700 border border-primary-200">
                            {logs.length} Sessions
                        </span>
                    </h3>
                    <button
                        type="button"
                        onClick={() => fetchHistory()}
                        disabled={refreshing}
                        className="text-xs font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
                    >
                        <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                                <th className="px-2.5 sm:px-3 py-2 text-[11px] whitespace-nowrap">Date</th>
                                <th className="px-2.5 sm:px-3 py-2 text-[11px] whitespace-nowrap">In (IST)</th>
                                <th className="px-2.5 sm:px-3 py-2 text-[11px] whitespace-nowrap">Out (IST)</th>
                                <th className="px-2.5 sm:px-3 py-2 text-right text-[11px] whitespace-nowrap">Dur</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-3 py-6 text-center text-slate-400 text-xs">
                                        No punch history found. Tap Start / Check In above to begin.
                                    </td>
                                </tr>
                            ) : logs.map((log, i) => (
                                <tr key={log.punch_id ? `p-${log.punch_id}` : `a-${log.attendance_id || i}`} className="hover:bg-slate-50">
                                    <td className="px-2.5 sm:px-3 py-2 text-slate-700 whitespace-nowrap">
                                        <div className="flex items-center gap-1">
                                            <span className="font-medium text-xs">
                                                {formatDateShort(log)}
                                            </span>
                                            {log.latitude && (
                                                <a
                                                    href={`https://maps.google.com/?q=${log.latitude},${log.longitude}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title={`GPS Location: ${log.latitude}, ${log.longitude}`}
                                                    className="text-emerald-600 hover:text-emerald-700 inline-flex items-center"
                                                >
                                                    <MapPin size={12} />
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-2.5 sm:px-3 py-2 text-slate-800 font-mono text-xs font-semibold whitespace-nowrap">
                                        {formatTimeDisplay(log.check_in_fmt || log.check_in)}
                                    </td>
                                    <td className="px-2.5 sm:px-3 py-2 text-slate-600 font-mono text-xs whitespace-nowrap">
                                        {log.check_out_fmt || log.check_out
                                            ? formatTimeDisplay(log.check_out_fmt || log.check_out)
                                            : <span className="text-amber-600 font-sans font-semibold text-[11px]">Active</span>}
                                    </td>
                                    <td className="px-2.5 sm:px-3 py-2 text-right font-medium text-slate-600 text-xs whitespace-nowrap">
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
