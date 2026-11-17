import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    MapPin, Clock, CheckCircle,
    Download, Shield, Calendar, Check, X,
    ChevronRight, Smartphone, RefreshCw, UserCheck,
    Navigation, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api, { getBackendOrigin, extractApiError } from '../services/api';
import leaveService from '../services/leaveService';
import payrollService from '../services/payrollService';

const getIstDateStr = (date = new Date()) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);

const getIstDateOffsetStr = (daysAgo = 0) =>
    getIstDateStr(new Date(Date.now() - daysAgo * 86400000));

const formatDateShort = (val) => {
    if (!val) return '—';
    const raw = String(val).split('T')[0];
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
};

const MobileApp = () => {
    const { user, hasPermission } = useAuth();
    const canApproveLeaves = hasPermission('LEAVES', 'can_approve');
    const canViewLeaves = hasPermission('LEAVES', 'can_view');
    const canViewPayroll = hasPermission('PAYROLL', 'can_view');
    const canViewAssets = hasPermission('ASSETS', 'can_view');

    const [currentTime, setCurrentTime] = useState(new Date());
    const [activePunch, setActivePunch] = useState(null);
    const [todayPunches, setTodayPunches] = useState([]);
    const [loadingPunch, setLoadingPunch] = useState(false);
    const [gpsLocation, setGpsLocation] = useState(null);
    const [gpsError, setGpsError] = useState(null);

    // Mobile Approvals
    const [pendingLeaves, setPendingLeaves] = useState([]);
    const [loadingApprovals, setLoadingApprovals] = useState(false);

    // ESS Quick Stats
    const [leaveBalance, setLeaveBalance] = useState({ remaining: 0, total: 0 });
    const [latestSalary, setLatestSalary] = useState(null);

    // PWA Install prompt
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const handleBeforeInstall = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    }, []);

    const handleInstallPWA = async () => {
        if (!deferredPrompt) {
            toast('To install: Open browser menu (⋮ or Share) and tap "Add to Home Screen"');
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            toast.success('NKD CRM Mobile App installed!');
        }
        setDeferredPrompt(null);
    };

    const detectGps = useCallback(() => {
        if (!navigator.geolocation) {
            setGpsError('Geolocation is not supported by your device');
            return;
        }
        setGpsError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGpsLocation({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                });
            },
            (err) => {
                console.warn('GPS location error:', err.message);
                setGpsError('Please enable GPS location permissions for accurate punch-in.');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }, []);

    const fetchTodayAttendance = useCallback(async () => {
        if (!hasPermission('ATTENDANCE', 'can_view')) return;
        try {
            const res = await api.get('/attendance/tracker/history');
            const history = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            const today = getIstDateStr();
            const yesterday = getIstDateOffsetStr(1);

            const openSession = history.find((l) => {
                const lDate = l.date ? String(l.date).split('T')[0] : '';
                const hasOut = l.check_out !== null && l.check_out !== undefined && l.check_out !== '';
                return Boolean(l.check_in) && !hasOut && (lDate === today || lDate === yesterday);
            });

            const punchesToday = history.filter((l) => (l.date ? String(l.date).split('T')[0] : '') === today);
            setActivePunch(openSession || null);
            setTodayPunches(punchesToday);
        } catch (err) {
            console.warn('Failed to fetch today attendance:', err);
        }
    }, [hasPermission]);

    const fetchApprovals = useCallback(async () => {
        if (!canApproveLeaves) return;
        setLoadingApprovals(true);
        try {
            const res = await leaveService.getPendingRequests();
            const list = res.data?.data || res.data || [];
            if (Array.isArray(list)) {
                setPendingLeaves(list.slice(0, 5));
            }
        } catch (err) {
            console.warn('Approvals fetch note:', err);
        } finally {
            setLoadingApprovals(false);
        }
    }, [canApproveLeaves]);

    const fetchEmployeeStats = useCallback(async () => {
        const code = user?.employeeCode || user?.employeeId;
        if (!code) return;
        try {
            if (canViewLeaves) {
                const balRes = await leaveService.getEmployeeBalances(code);
                const balances = balRes.data?.data || balRes.data || [];
                if (Array.isArray(balances)) {
                    const paidBalances = balances.filter(b => b && b.is_paid !== false && b.leave_code !== 'LWP');
                    const rem = paidBalances.reduce((sum, b) => sum + (parseFloat(b.remaining) || 0), 0);
                    const tot = paidBalances.reduce((sum, b) => sum + (parseFloat(b.total_allocated) || 0), 0);
                    setLeaveBalance({ remaining: rem, total: tot });
                }
            }

            if (canViewPayroll) {
                const payRes = await payrollService.getMyPayrollHistory(new Date().getFullYear());
                const slips = payRes.data?.data || [];
                if (Array.isArray(slips) && slips.length > 0) {
                    slips.sort((a, b) => (b.month || 0) - (a.month || 0));
                    setLatestSalary(slips[0]);
                }
            }
        } catch (error) {
            console.warn('Failed to fetch employee stats:', error);
        }
    }, [user?.employeeCode, user?.employeeId, canViewLeaves, canViewPayroll]);

    useEffect(() => {
        detectGps();
        fetchTodayAttendance();
        fetchApprovals();
        fetchEmployeeStats();
    }, [detectGps, fetchTodayAttendance, fetchApprovals, fetchEmployeeStats]);

    const handlePunch = async (punchType) => {
        setLoadingPunch(true);
        try {
            let lat = gpsLocation?.latitude;
            let lon = gpsLocation?.longitude;
            let acc = gpsLocation?.accuracy;

            if ((!lat || !lon) && navigator.geolocation) {
                await new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        (p) => {
                            lat = p.coords.latitude;
                            lon = p.coords.longitude;
                            acc = p.coords.accuracy;
                            setGpsLocation({ latitude: lat, longitude: lon, accuracy: acc });
                            resolve();
                        },
                        () => resolve(),
                        { timeout: 5000, enableHighAccuracy: true }
                    );
                });
            }

            const payload = {
                latitude: lat,
                longitude: lon,
                location_accuracy: acc
            };

            const endpoint = punchType === 'IN' ? '/attendance/tracker/check-in' : '/attendance/tracker/check-out';
            await api.post(endpoint, payload);
            toast.success(`Successfully recorded Punch ${punchType === 'IN' ? 'IN' : 'OUT'} (IST)!`);
            fetchTodayAttendance();
        } catch (err) {
            toast.error(extractApiError(err, `Punch ${punchType} failed`));
        } finally {
            setLoadingPunch(false);
        }
    };

    const handleActionApproval = async (id, status) => {
        try {
            if (status === 'APPROVED') {
                await leaveService.approveLeave(id, user?.employeeCode);
            } else {
                await leaveService.rejectLeave(id, user?.employeeCode, 'Rejected by Manager via Mobile');
            }
            toast.success(`Leave request ${status.toLowerCase()}`);
            fetchApprovals();
        } catch (err) {
            toast.error(extractApiError(err, `Failed to ${status.toLowerCase()} leave`));
        }
    };

    const isCheckedIn = Boolean(activePunch);
    const latestToday = todayPunches[0] || null;
    const displayInTime = activePunch?.check_in_fmt || activePunch?.check_in || latestToday?.check_in_fmt || latestToday?.check_in;
    const displayOutTime = !isCheckedIn ? (latestToday?.check_out_fmt || latestToday?.check_out) : null;

    const displayName = (user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.employeeCode || 'Team Member').trim();
    const displayRole = user?.designation || user?.role?.roleName || user?.roleName || user?.role?.roleCode || user?.roleCode || 'Staff Member';
    const initial = displayName.length > 0 ? displayName[0].toUpperCase() : 'N';

    const hasGpsCoords = gpsLocation && typeof gpsLocation.latitude === 'number' && !isNaN(gpsLocation.latitude) && typeof gpsLocation.longitude === 'number' && !isNaN(gpsLocation.longitude);

    const formatTime = (timeVal) => {
        if (!timeVal) return '';
        const str = typeof timeVal === 'string' ? timeVal : String(timeVal);
        const parts = str.split(':');
        if (parts.length >= 2) {
            let h = parseInt(parts[0], 10);
            const m = parts[1];
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${h}:${m} ${ampm}`;
        }
        return str;
    };

    return (
        <div className="max-w-md mx-auto space-y-4 pb-20 pt-2">
            {/* Mobile Header Greeting */}
            <div className="bg-gradient-to-r from-primary-600 via-indigo-600 to-primary-700 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-white/80 font-medium">
                            <Smartphone size={14} />
                            NKD CRM Mobile App
                        </div>
                        <h1 className="text-xl font-bold mt-1 tracking-tight truncate">
                            Namaste, {displayName}!
                        </h1>
                        <p className="text-xs text-white/90 mt-0.5 font-medium truncate">
                            {displayRole}
                        </p>
                    </div>

                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center font-bold text-lg backdrop-blur-xs border border-white/30 shrink-0">
                        {initial}
                    </div>
                </div>

                {/* Digital Clock (IST) */}
                <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between gap-2">
                    <div className="text-xs text-white/80">
                        {currentTime.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="text-lg sm:text-xl font-black font-mono tracking-wider">
                        {currentTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </div>
                </div>
            </div>

            {/* Native Android APK Direct Download Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-3.5 rounded-2xl shadow-sm flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs shrink-0">
                        <Download size={20} className="animate-bounce" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-bold leading-tight flex items-center gap-1.5 flex-wrap">
                            <span>NKD Android App</span>
                            <span className="bg-emerald-400 text-emerald-950 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">APK (4.1 MB)</span>
                        </div>
                        <div className="text-[11px] text-white/90 truncate">Install directly on Android (v2.0)</div>
                    </div>
                </div>
                <a
                    href={`${getBackendOrigin()}/api/download/apk`}
                    download="NKD-CRM.apk"
                    className="px-3 py-1.5 bg-white text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-bold shadow-xs whitespace-nowrap transition-transform active:scale-95 flex items-center gap-1 shrink-0"
                >
                    <Download size={13} />
                    Download APK
                </a>
            </div>

            {/* PWA Install App Banner */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-3.5 rounded-2xl shadow-sm flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs shrink-0">
                        <Smartphone size={20} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-bold leading-tight">Install Mobile PWA</div>
                        <div className="text-[11px] text-white/90 truncate">Add icon to phone home screen</div>
                    </div>
                </div>
                <button
                    onClick={handleInstallPWA}
                    className="px-3 py-1.5 bg-white text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-bold shadow-xs whitespace-nowrap transition-colors shrink-0"
                >
                    Install App
                </button>
            </div>

            {/* SECTION 1: LIVE GPS ATTENDANCE PUNCH */}
            {hasPermission('ATTENDANCE', 'can_create') && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-3 gap-2">
                        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            <MapPin className="text-primary-600" size={17} />
                            GPS Time Tracker (IST)
                        </h2>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                            Today: {todayPunches.length} {todayPunches.length === 1 ? 'Punch' : 'Punches'}
                        </span>
                    </div>

                    {/* GPS Location Status Pill */}
                    <div className="mb-4 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasGpsCoords ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                            {hasGpsCoords ? (
                                <span className="text-slate-700 font-mono text-[11px] truncate">
                                    GPS: {gpsLocation.latitude.toFixed(4)}, {gpsLocation.longitude.toFixed(4)} {typeof gpsLocation.accuracy === 'number' ? `(±${Math.round(gpsLocation.accuracy)}m)` : ''}
                                </span>
                            ) : (
                                <span className="text-slate-500 truncate">{gpsError || 'Detecting GPS location...'}</span>
                            )}
                        </div>

                        <button
                            onClick={detectGps}
                            className="text-primary-600 hover:text-primary-700 text-xs font-semibold shrink-0 ml-2"
                            title="Refresh GPS"
                        >
                            <RefreshCw size={13} />
                        </button>
                    </div>

                    {hasGpsCoords && (
                        <div className="mb-4 text-[11px] text-slate-500 flex items-center gap-1">
                            <Navigation size={12} className="text-primary-600" />
                            <a
                                href={`https://www.google.com/maps?q=${gpsLocation.latitude},${gpsLocation.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary-600 hover:underline flex items-center gap-0.5"
                            >
                                Open current pin on Google Maps <ExternalLink size={10} />
                            </a>
                        </div>
                    )}

                    {/* Punch-In / Punch-Out Buttons (Supports Multiple Check-Ins Per Day) */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => handlePunch('IN')}
                            disabled={loadingPunch || isCheckedIn}
                            className={`py-3.5 px-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all shadow-xs ${
                                isCheckedIn
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98'
                            }`}
                        >
                            <CheckCircle size={18} />
                            <span>{isCheckedIn ? 'Active Session' : 'Punch IN'}</span>
                            {displayInTime && (
                                <span className="text-[10px] font-mono opacity-80">{formatTime(displayInTime)}</span>
                            )}
                        </button>

                        <button
                            onClick={() => handlePunch('OUT')}
                            disabled={loadingPunch || !isCheckedIn}
                            className={`py-3.5 px-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all shadow-xs ${
                                !isCheckedIn
                                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-98'
                            }`}
                        >
                            <Clock size={18} />
                            <span>Punch OUT</span>
                            {displayOutTime && (
                                <span className="text-[10px] font-mono opacity-80">Last: {formatTime(displayOutTime)}</span>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* SECTION 2: MANAGER APPROVALS */}
            {canApproveLeaves && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                            <UserCheck size={17} className="text-amber-600" />
                            <h2 className="text-sm font-bold text-slate-800">Pending Approvals</h2>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-xs border border-amber-200">
                            {pendingLeaves.length} Pending
                        </span>
                    </div>

                    {loadingApprovals ? (
                        <div className="text-center py-4 text-xs text-slate-400">Loading requests...</div>
                    ) : pendingLeaves.length === 0 ? (
                        <div className="text-center py-4 text-xs text-slate-400">
                            No pending approvals. All team requests are cleared!
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {pendingLeaves.map((l) => (
                                <div key={l.request_id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-900 truncate">
                                                {l.first_name ? `${l.first_name} ${l.last_name || ''}`.trim() : (l.employee_name || l.employee_code)}
                                            </div>
                                            <div className="text-[11px] text-slate-500 font-medium">
                                                {l.leave_name || l.leave_code || 'Leave'} • {l.total_days || 1} day(s)
                                            </div>
                                        </div>
                                        <div className="text-[11px] font-mono text-slate-500 shrink-0">
                                            {formatDateShort(l.from_date)}
                                        </div>
                                    </div>
                                    {l.reason && (
                                        <p className="mt-1 text-[11px] text-slate-600 italic">"{l.reason}"</p>
                                    )}

                                    <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleActionApproval(l.request_id, 'REJECTED')}
                                            className="px-2.5 py-1 text-xs font-semibold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-1"
                                        >
                                            <X size={12} /> Reject
                                        </button>
                                        <button
                                            onClick={() => handleActionApproval(l.request_id, 'APPROVED')}
                                            className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 shadow-2xs"
                                        >
                                            <Check size={12} /> Approve
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* SECTION 3: EMPLOYEE QUICK STATS */}
            {user?.employeeCode && (canViewLeaves || canViewPayroll) && (
                <div className="grid grid-cols-2 gap-3">
                    {canViewLeaves && (
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Paid Leave Balance</div>
                            <div className="text-xl font-bold text-slate-900 mt-1">{leaveBalance.remaining} Days</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Out of {leaveBalance.total} allocated</div>
                        </div>
                    )}

                    {canViewPayroll && (
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Latest Net Salary</div>
                            <div className="text-xl font-bold text-emerald-700 mt-1">
                                {latestSalary ? `₹${parseFloat(latestSalary.net_salary || 0).toLocaleString('en-IN')}` : '₹—'}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                                {latestSalary ? `Month: ${latestSalary.month}/${latestSalary.year}` : 'Latest cycle'}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Quick Link Navigation Tiles */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Quick Services</h3>
                {canViewLeaves && (
                    <Link
                        to="/leaves"
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><Calendar size={15} /></div>
                            <span>Apply for Leave</span>
                        </div>
                        <ChevronRight size={14} className="text-slate-400" />
                    </Link>
                )}

                {canViewPayroll && (
                    <Link
                        to="/payroll"
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><Download size={15} /></div>
                            <span>Download Payslip PDF</span>
                        </div>
                        <ChevronRight size={14} className="text-slate-400" />
                    </Link>
                )}

                {canViewAssets && (
                    <Link
                        to="/assets"
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><Shield size={15} /></div>
                            <span>My Allocated Assets & Uniforms</span>
                        </div>
                        <ChevronRight size={14} className="text-slate-400" />
                    </Link>
                )}

                <Link
                    to="/attendance"
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><Clock size={15} /></div>
                        <span>Full Attendance & History</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400" />
                </Link>
            </div>
        </div>
    );
};

export default MobileApp;
