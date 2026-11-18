import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    FileSpreadsheet, Download, Save, Upload, Plus, Trash2, Eye,
    CheckCircle2, Clock, Calendar, Building2, RefreshCw, Sparkles,
    Image as ImageIcon, X, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import dprService from '../../services/dprService';
import { getFileUrl, extractApiError } from '../../services/api';

const DEFAULT_TRADES = [
    { trade: 'EHS Officer', required: 1, available: 1 },
    { trade: 'Electrician', required: 2, available: 0 },
    { trade: 'Engineer', required: 1, available: 0 },
    { trade: 'Fitter', required: 1, available: 0 },
    { trade: 'Welder', required: 1, available: 0 },
    { trade: 'Helper', required: 7, available: 7 },
    { trade: 'supervisor', required: 1, available: 0 },
    { trade: 'Testing engineer', required: 1, available: 0 },
    { trade: 'Cable jointer', required: 2, available: 0 },
    { trade: 'Scaffolding erection team', required: 4, available: 0 },
    { trade: 'Site Manager', required: 1, available: 1 }
];

const createInitialActivities = (count = 13) => {
    const list = [];
    for (let i = 1; i <= count; i++) {
        if (i === 1) {
            list.push({
                id: i,
                description: 'Roxtec material unloading and shifting work, [Engaged Manpower: 07].',
                status: 'complete',
                dependencies: 'NKD',
                photo_ref: ''
            });
        } else {
            list.push({ id: i, description: '', status: '', dependencies: '', photo_ref: '' });
        }
    }
    return list;
};

const createInitialNextDay = (count = 13) => {
    const list = [];
    for (let i = 1; i <= count; i++) {
        if (i === 1) {
            list.push({
                id: i,
                description: '11 kV trench core cutting (cellar room) and 11KV cable pulling in cellar.'
            });
        } else {
            list.push({ id: i, description: '' });
        }
    }
    return list;
};

const createInitialStoppers = (count = 10) => {
    const list = [];
    for (let i = 1; i <= count; i++) {
        list.push({ id: i, concern_area: '', intimation_date: '' });
    }
    return list;
};

const DprClientExcelSheet = ({ sites = [], selectedSiteId = 'ALL', onSiteChange }) => {
    const activeSiteId = selectedSiteId !== 'ALL' ? selectedSiteId : (sites[0]?.site_id || 5);
    const activeSite = sites.find((s) => String(s.site_id) === String(activeSiteId)) || sites[0] || null;

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [activeDprId, setActiveDprId] = useState(null);

    // Metadata Fields
    const [meta, setMeta] = useState({
        report_no: 'GTPL LUMINA/124',
        client_name: 'LUMINA',
        po_number: '600190',
        po_value: '48,374,200.00',
        current_billing_value: '  -   ',
        billing_progress_pct: '0',
        start_date: '2026-04-16',
        completion_date: '2026-07-24',
        report_date: '2026-10-23',
        weeks_manpower_rate: '',
        contractor_name: 'NKD POWER SOLUTIONS PVT LTD'
    });

    // 13 Rows of Activities
    const [todayActivities, setTodayActivities] = useState(createInitialActivities);
    const [nextDayActivities, setNextDayActivities] = useState(createInitialNextDay);

    // Show Stoppers (10 rows)
    const [showStoppers, setShowStoppers] = useState(createInitialStoppers);

    // Manpower (11 Trades)
    const [manpower, setManpower] = useState(DEFAULT_TRADES);

    // Photos (Slots 1 to 7)
    // index 0 -> Photo 1, index 1 -> Photo 2, ..., index 6 -> Photo 7
    const [photos, setPhotos] = useState([
        { slot: 1, label: 'Photo 1', tag: 'PHOTO : 1', url: '', caption: '' },
        { slot: 2, label: 'Photo 2', tag: 'PHOTO:2', url: '', caption: '' },
        { slot: 3, label: 'Photo 3', tag: 'PHOTO:3', url: '', caption: '' },
        { slot: 4, label: 'Photo 4', tag: 'PHOTO:4', url: '', caption: '' },
        { slot: 5, label: 'Photo 5', tag: 'PHOTO:5', url: '', caption: '' },
        { slot: 6, label: 'Photo 6', tag: 'PHOTO:6', url: '', caption: '' },
        { slot: 7, label: 'Photo 7', tag: 'PHOTO:7', url: '', caption: '' }
    ]);

    // Live auto-calculated available total
    const totalAvailable = useMemo(() => {
        return manpower.reduce((acc, curr) => acc + (parseInt(curr.available, 10) || 0), 0);
    }, [manpower]);

    // Load active site's DPR
    const loadDprData = useCallback(async (siteId) => {
        if (!siteId) return;
        setLoading(true);
        try {
            const res = await dprService.getAllDprs({ site_id: siteId });
            const list = res?.data?.data || res?.data || [];
            if (list.length > 0) {
                const latest = list[0];
                setActiveDprId(latest.dpr_id);
                setMeta({
                    report_no: latest.report_no || 'GTPL LUMINA/124',
                    client_name: latest.client_name || 'LUMINA',
                    po_number: latest.po_number || '600190',
                    po_value: latest.po_value ? Number(latest.po_value).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '48,374,200.00',
                    current_billing_value: latest.current_billing_value && Number(latest.current_billing_value) > 0 ? Number(latest.current_billing_value).toLocaleString('en-IN') : '  -   ',
                    billing_progress_pct: String(latest.billing_progress_pct ?? '0'),
                    start_date: latest.start_date ? String(latest.start_date).slice(0, 10) : '2026-04-16',
                    completion_date: latest.completion_date ? String(latest.completion_date).slice(0, 10) : '2026-07-24',
                    report_date: latest.report_date ? String(latest.report_date).slice(0, 10) : '2026-10-23',
                    weeks_manpower_rate: latest.weeks_manpower_rate || '',
                    contractor_name: latest.contractor_name || 'NKD POWER SOLUTIONS PVT LTD'
                });

                if (Array.isArray(latest.today_activities) && latest.today_activities.length > 0) {
                    const loadedActs = createInitialActivities(13);
                    latest.today_activities.forEach((act, idx) => {
                        if (idx < 13) {
                            loadedActs[idx] = {
                                id: idx + 1,
                                description: act.description || '',
                                status: act.status || '',
                                dependencies: act.dependencies || '',
                                photo_ref: act.photo_ref || ''
                            };
                        }
                    });
                    setTodayActivities(loadedActs);
                }

                if (Array.isArray(latest.next_day_activities) && latest.next_day_activities.length > 0) {
                    const loadedNext = createInitialNextDay(13);
                    latest.next_day_activities.forEach((act, idx) => {
                        if (idx < 13) {
                            loadedNext[idx] = {
                                id: idx + 1,
                                description: act.description || ''
                            };
                        }
                    });
                    setNextDayActivities(loadedNext);
                }

                if (Array.isArray(latest.manpower_data) && latest.manpower_data.length > 0) {
                    const mergedTrades = DEFAULT_TRADES.map((d) => {
                        const m = latest.manpower_data.find((x) => x.trade?.toLowerCase() === d.trade.toLowerCase());
                        return m ? { trade: d.trade, required: m.required ?? '', available: m.available ?? 0 } : d;
                    });
                    setManpower(mergedTrades);
                }

                if (Array.isArray(latest.photos) && latest.photos.length > 0) {
                    setPhotos((prev) =>
                        prev.map((slotObj, idx) => {
                            const found = latest.photos[idx];
                            return found ? { ...slotObj, url: found.url || '', caption: found.caption || '' } : slotObj;
                        })
                    );
                }
            } else {
                setActiveDprId(null);
            }
            setIsDirty(false);
        } catch (err) {
            console.warn('Failed to load DPR:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeSiteId) {
            loadDprData(activeSiteId);
        }
    }, [activeSiteId, loadDprData]);

    // Save All Data to Database
    const handleSaveToCloud = async () => {
        setSaving(true);
        try {
            const cleanPoVal = parseFloat(String(meta.po_value).replace(/,/g, '')) || 0;
            const payload = {
                site_id: parseInt(activeSiteId, 10),
                report_no: meta.report_no,
                report_date: meta.report_date,
                client_name: meta.client_name,
                contractor_name: meta.contractor_name,
                po_number: meta.po_number,
                po_value: cleanPoVal,
                current_billing_value: 0,
                billing_progress_pct: parseFloat(meta.billing_progress_pct) || 0,
                start_date: meta.start_date,
                completion_date: meta.completion_date,
                today_activities: todayActivities.filter((a) => a.description.trim() !== ''),
                next_day_activities: nextDayActivities.filter((a) => a.description.trim() !== ''),
                show_stoppers: showStoppers.filter((s) => s.concern_area.trim() !== ''),
                manpower_data: manpower,
                photos: photos.filter((p) => p.url).map((p, i) => ({ photo_ref: p.label, caption: p.caption || p.label, url: p.url }))
            };

            let savedId = activeDprId;
            if (activeDprId) {
                await dprService.updateDpr(activeDprId, payload);
            } else {
                const res = await dprService.createDpr(payload);
                savedId = res?.data?.data?.dpr_id || res?.data?.dpr_id;
                setActiveDprId(savedId);
            }

            setLastSaved(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
            setIsDirty(false);
            toast.success('✨ DPR Spreadsheet saved successfully!');
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to save DPR sheet'));
        } finally {
            setSaving(false);
        }
    };

    // Photo Upload Handler for a specific slot (1 to 7)
    const handleUploadPhotoSlot = async (slotIdx, file) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await dprService.uploadPhoto(formData);
            const data = res?.data?.data || res?.data;
            if (data?.url) {
                setPhotos((prev) =>
                    prev.map((p, idx) => (idx === slotIdx ? { ...p, url: data.url, caption: file.name } : p))
                );
                setIsDirty(true);
                toast.success(`Photo ${slotIdx + 1} uploaded!`);
            }
        } catch (err) {
            toast.error(extractApiError(err, 'Photo upload failed'));
        }
    };

    // Download PDF
    const handleDownloadPdf = () => {
        if (!activeDprId) {
            toast.error('Please click "Save DPR" first before downloading PDF.');
            return;
        }
        window.open(dprService.getPdfUrl(activeDprId), '_blank');
    };

    // Download Excel
    const handleDownloadExcel = () => {
        if (!activeDprId) {
            toast.error('Please click "Save DPR" first before downloading Excel.');
            return;
        }
        dprService.downloadExcel(activeDprId, `DPR_${meta.report_no.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
    };

    // 1-Click Load Reference Sample
    const handleLoadSample = () => {
        setMeta({
            report_no: 'GTPL LUMINA/124',
            client_name: 'LUMINA',
            po_number: '600190',
            po_value: '48,374,200.00',
            current_billing_value: '  -   ',
            billing_progress_pct: '0',
            start_date: '2026-04-16',
            completion_date: '2026-07-24',
            report_date: '2026-10-23',
            weeks_manpower_rate: '',
            contractor_name: 'NKD POWER SOLUTIONS PVT LTD'
        });
        setTodayActivities(createInitialActivities(13));
        setNextDayActivities(createInitialNextDay(13));
        setManpower(DEFAULT_TRADES);
        setIsDirty(true);
        toast.success('Loaded GTPL LUMINA Reference Sheet sample!');
    };

    return (
        <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                        <FileSpreadsheet size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                                GTPL LUMINA Official DPR Spreadsheet
                            </h3>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                                Exact Client Template
                            </span>
                            {isDirty ? (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                                    <Clock size={10} /> Unsaved
                                </span>
                            ) : lastSaved ? (
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                                    <CheckCircle2 size={10} /> Saved {lastSaved}
                                </span>
                            ) : null}
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                            Interactive spreadsheet with real-time calculations, side-by-side activity status, and 7-photo slot gallery.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleLoadSample}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Load GTPL LUMINA reference values"
                    >
                        <Sparkles size={13} className="text-amber-400" />
                        <span>Load Sample</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleSaveToCloud}
                        disabled={saving}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                        <Save size={14} />
                        <span>{saving ? 'Saving...' : 'Save DPR'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleDownloadPdf}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                        title="Download exact printable 2-page landscape PDF"
                    >
                        <Download size={14} />
                        <span>Download PDF</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleDownloadExcel}
                        className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                        title="Download Excel spreadsheet workbook (.xlsx)"
                    >
                        <FileSpreadsheet size={14} />
                        <span>Download Excel (.xlsx)</span>
                    </button>
                </div>
            </div>

            {/* SPREADSHEET CANVAS - EXACT EXCEL REPLICA */}
            <div className="bg-white rounded-2xl border-2 border-slate-800 shadow-xl overflow-x-auto p-4 sm:p-6 font-sans select-text">
                <div className="min-w-[960px] max-w-[1300px] mx-auto text-xs text-slate-900 border border-slate-900">

                    {/* 1. Main Sheet Title Banner */}
                    <div className="border-b border-slate-900 bg-slate-50/80 px-4 py-2.5 text-center font-bold text-sm tracking-tight flex items-center justify-center gap-2">
                        <span>Daily Site Progress Report - </span>
                        <input
                            type="text"
                            value={meta.report_no ? `${activeSite?.site_name || 'GTPL LUMINA'}, ${activeSite?.city || 'AIROLI , MUMBAI'}` : ''}
                            readOnly
                            className="font-bold text-slate-900 text-center bg-transparent border-0 focus:outline-none"
                        />
                        <span>- {meta.contractor_name} - Date: </span>
                        <input
                            type="date"
                            value={meta.report_date}
                            onChange={(e) => { setMeta({ ...meta, report_date: e.target.value }); setIsDirty(true); }}
                            className="font-bold text-slate-900 bg-white border border-slate-400 px-1 py-0.5 rounded text-xs focus:ring-1 focus:ring-primary-500"
                        />
                    </div>

                    {/* 2. Metadata Grid Table */}
                    <div className="grid grid-cols-12 border-b border-slate-900 divide-x divide-slate-900">
                        {/* Left Metadata Block (Cols 1-6) */}
                        <div className="col-span-6 divide-y divide-slate-900">
                            <div className="grid grid-cols-12 divide-x divide-slate-900">
                                <span className="col-span-4 font-bold px-2 py-1 bg-slate-100">Report No</span>
                                <input
                                    type="text"
                                    value={meta.report_no}
                                    onChange={(e) => { setMeta({ ...meta, report_no: e.target.value }); setIsDirty(true); }}
                                    className="col-span-8 px-2 py-1 font-bold text-primary-700 bg-transparent focus:bg-amber-50 focus:outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-12 divide-x divide-slate-900">
                                <span className="col-span-4 font-bold px-2 py-1 bg-slate-100">End Client Name:</span>
                                <input
                                    type="text"
                                    value={meta.client_name}
                                    onChange={(e) => { setMeta({ ...meta, client_name: e.target.value }); setIsDirty(true); }}
                                    className="col-span-8 px-2 py-1 bg-transparent focus:bg-amber-50 focus:outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-12 divide-x divide-slate-900">
                                <span className="col-span-4 font-bold px-2 py-1 bg-slate-100">PO No. | Date:</span>
                                <input
                                    type="text"
                                    value={meta.po_number}
                                    onChange={(e) => { setMeta({ ...meta, po_number: e.target.value }); setIsDirty(true); }}
                                    className="col-span-8 px-2 py-1 bg-transparent focus:bg-amber-50 focus:outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-12 divide-x divide-slate-900">
                                <span className="col-span-4 font-bold px-2 py-1 bg-slate-100">Start Date:</span>
                                <input
                                    type="date"
                                    value={meta.start_date}
                                    onChange={(e) => { setMeta({ ...meta, start_date: e.target.value }); setIsDirty(true); }}
                                    className="col-span-8 px-2 py-1 bg-transparent focus:bg-amber-50 focus:outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-12 divide-x divide-slate-900">
                                <span className="col-span-4 font-bold px-2 py-1 bg-slate-100">Completion Date:</span>
                                <input
                                    type="date"
                                    value={meta.completion_date}
                                    onChange={(e) => { setMeta({ ...meta, completion_date: e.target.value }); setIsDirty(true); }}
                                    className="col-span-8 px-2 py-1 bg-transparent focus:bg-amber-50 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Right Metadata Block (Cols 7-12) */}
                        <div className="col-span-6 divide-y divide-slate-900">
                            <div className="grid grid-cols-12 divide-x divide-slate-900">
                                <span className="col-span-6 font-bold px-2 py-1 bg-slate-100">PO Value in INR Cr.:</span>
                                <input
                                    type="text"
                                    value={meta.po_value}
                                    onChange={(e) => { setMeta({ ...meta, po_value: e.target.value }); setIsDirty(true); }}
                                    className="col-span-6 px-2 py-1 text-right font-bold bg-transparent focus:bg-amber-50 focus:outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-12 divide-x divide-slate-900">
                                <span className="col-span-6 font-bold px-2 py-1 bg-slate-100">Current Billing Value in INR Cr.:</span>
                                <input
                                    type="text"
                                    value={meta.current_billing_value}
                                    onChange={(e) => { setMeta({ ...meta, current_billing_value: e.target.value }); setIsDirty(true); }}
                                    className="col-span-6 px-2 py-1 text-right bg-transparent focus:bg-amber-50 focus:outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-12 divide-x divide-slate-900">
                                <span className="col-span-6 font-bold px-2 py-1 bg-slate-100">Billing Progress:</span>
                                <div className="col-span-6 px-2 py-1 flex items-center justify-end gap-1">
                                    <input
                                        type="number"
                                        value={meta.billing_progress_pct}
                                        onChange={(e) => { setMeta({ ...meta, billing_progress_pct: e.target.value }); setIsDirty(true); }}
                                        className="w-14 text-right bg-transparent focus:bg-amber-50 focus:outline-none font-bold"
                                    />
                                    <span>%</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-12 divide-x divide-slate-900">
                                <span className="col-span-6 font-bold px-2 py-1 bg-slate-100">Week's Manpower Rate:</span>
                                <input
                                    type="text"
                                    value={meta.weeks_manpower_rate}
                                    onChange={(e) => { setMeta({ ...meta, weeks_manpower_rate: e.target.value }); setIsDirty(true); }}
                                    className="col-span-6 px-2 py-1 bg-transparent focus:bg-amber-50 focus:outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-12 divide-x divide-slate-900 h-[29px] bg-slate-50/50">
                                <span className="col-span-12"></span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Section Headers (Peach & Ice Blue) */}
                    <div className="grid grid-cols-12 border-b border-slate-900 text-center font-bold text-xs uppercase tracking-wide">
                        <div className="col-span-6 bg-[#fed7aa] py-1.5 border-r border-slate-900 text-slate-900">
                            Today Activity Status
                        </div>
                        <div className="col-span-6 bg-[#dbeafe] py-1.5 text-slate-900">
                            Activity Planned for Next Day
                        </div>
                    </div>

                    {/* 4. Sub-Headers */}
                    <div className="grid grid-cols-12 border-b border-slate-900 divide-x divide-slate-900 bg-slate-100 text-[11px] font-bold text-center">
                        {/* Left Subheaders */}
                        <div className="col-span-6 grid grid-cols-12 divide-x divide-slate-900">
                            <span className="col-span-1 py-1.5">S. No.</span>
                            <span className="col-span-6 py-1.5">Planned</span>
                            <span className="col-span-2 py-1.5">Completion Status</span>
                            <span className="col-span-3 py-1.5">Dependencies (Resp / Photo)</span>
                        </div>
                        {/* Right Subheaders */}
                        <div className="col-span-6 grid grid-cols-12 divide-x divide-slate-900">
                            <span className="col-span-1 py-1.5">S. No.</span>
                            <span className="col-span-11 py-1.5">Planned in this & next week (including carry forward if any)</span>
                        </div>
                    </div>

                    {/* 5. 13 Activity Rows */}
                    <div className="divide-y divide-slate-900 border-b border-slate-900">
                        {todayActivities.map((act, idx) => {
                            const nextAct = nextDayActivities[idx] || { description: '' };
                            return (
                                <div key={act.id} className="grid grid-cols-12 divide-x divide-slate-900 text-xs hover:bg-slate-50/80 transition-colors">
                                    {/* Left Row Columns */}
                                    <div className="col-span-6 grid grid-cols-12 divide-x divide-slate-900">
                                        <span className="col-span-1 text-center py-1 font-bold text-slate-600 bg-slate-50">{idx + 1}</span>
                                        <input
                                            type="text"
                                            value={act.description}
                                            onChange={(e) => {
                                                const updated = [...todayActivities];
                                                updated[idx].description = e.target.value;
                                                setTodayActivities(updated);
                                                setIsDirty(true);
                                            }}
                                            placeholder={idx === 0 ? "e.g. Roxtec material unloading and shifting work..." : ""}
                                            className="col-span-6 px-2 py-1 bg-transparent focus:bg-amber-50 focus:outline-none"
                                        />
                                        <select
                                            value={act.status}
                                            onChange={(e) => {
                                                const updated = [...todayActivities];
                                                updated[idx].status = e.target.value;
                                                setTodayActivities(updated);
                                                setIsDirty(true);
                                            }}
                                            className="col-span-2 px-1 py-1 bg-transparent text-[11px] text-center focus:bg-amber-50 focus:outline-none"
                                        >
                                            <option value="">—</option>
                                            <option value="complete">complete</option>
                                            <option value="in_progress">in progress</option>
                                            <option value="testing">testing</option>
                                            <option value="pending">pending</option>
                                        </select>
                                        <div className="col-span-3 grid grid-cols-2 divide-x divide-slate-900">
                                            <input
                                                type="text"
                                                value={act.dependencies}
                                                onChange={(e) => {
                                                    const updated = [...todayActivities];
                                                    updated[idx].dependencies = e.target.value;
                                                    setTodayActivities(updated);
                                                    setIsDirty(true);
                                                }}
                                                placeholder="NKD"
                                                className="px-1 py-1 text-center bg-transparent focus:bg-amber-50 focus:outline-none text-[11px]"
                                            />
                                            <input
                                                type="text"
                                                value={act.photo_ref}
                                                onChange={(e) => {
                                                    const updated = [...todayActivities];
                                                    updated[idx].photo_ref = e.target.value;
                                                    setTodayActivities(updated);
                                                    setIsDirty(true);
                                                }}
                                                placeholder=""
                                                className="px-1 py-1 text-center bg-transparent focus:bg-amber-50 focus:outline-none text-[11px]"
                                            />
                                        </div>
                                    </div>

                                    {/* Right Row Columns */}
                                    <div className="col-span-6 grid grid-cols-12 divide-x divide-slate-900">
                                        <span className="col-span-1 text-center py-1 font-bold text-slate-600 bg-slate-50">{idx + 1}</span>
                                        <input
                                            type="text"
                                            value={nextAct.description}
                                            onChange={(e) => {
                                                const updated = [...nextDayActivities];
                                                updated[idx].description = e.target.value;
                                                setNextDayActivities(updated);
                                                setIsDirty(true);
                                            }}
                                            placeholder={idx === 0 ? "e.g. 11 kV trench core cutting..." : ""}
                                            className="col-span-11 px-2 py-1 bg-transparent focus:bg-amber-50 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 6. Show Stoppers Section */}
                    <div className="grid grid-cols-12 border-b border-slate-900 text-center font-bold text-xs uppercase tracking-wide">
                        <div className="col-span-6 bg-slate-50 py-1 border-r border-slate-900"></div>
                        <div className="col-span-6 bg-[#dbeafe] py-1 text-slate-900">
                            Show Stoppers (since nos. of weeks)
                        </div>
                    </div>

                    {/* Show Stoppers Sub-Headers */}
                    <div className="grid grid-cols-12 border-b border-slate-900 divide-x divide-slate-900 bg-slate-100 text-[11px] font-bold text-center">
                        <div className="col-span-6 grid grid-cols-12 divide-x divide-slate-900">
                            <span className="col-span-1 py-1">S. No.</span>
                            <span className="col-span-7 py-1">Concern Areas</span>
                            <span className="col-span-4 py-1">1st Intimation Date</span>
                        </div>
                        <div className="col-span-6 grid grid-cols-12 divide-x divide-slate-900">
                            <span className="col-span-1 py-1">S. No.</span>
                            <span className="col-span-11 py-1">Concern Areas</span>
                        </div>
                    </div>

                    {/* Show Stoppers Rows (10 rows) */}
                    <div className="divide-y divide-slate-900 border-b border-slate-900">
                        {showStoppers.map((st, idx) => (
                            <div key={st.id} className="grid grid-cols-12 divide-x divide-slate-900 text-xs hover:bg-slate-50/80 transition-colors">
                                <div className="col-span-6 grid grid-cols-12 divide-x divide-slate-900">
                                    <span className="col-span-1 text-center py-1 font-bold text-slate-600 bg-slate-50">{idx < 9 ? idx + 1 : ''}</span>
                                    <input
                                        type="text"
                                        value={st.concern_area}
                                        onChange={(e) => {
                                            const updated = [...showStoppers];
                                            updated[idx].concern_area = e.target.value;
                                            setShowStoppers(updated);
                                            setIsDirty(true);
                                        }}
                                        className="col-span-7 px-2 py-1 bg-transparent focus:bg-amber-50 focus:outline-none"
                                    />
                                    <input
                                        type="date"
                                        value={st.intimation_date}
                                        onChange={(e) => {
                                            const updated = [...showStoppers];
                                            updated[idx].intimation_date = e.target.value;
                                            setShowStoppers(updated);
                                            setIsDirty(true);
                                        }}
                                        className="col-span-4 px-2 py-1 bg-transparent focus:bg-amber-50 focus:outline-none text-[11px]"
                                    />
                                </div>
                                <div className="col-span-6 grid grid-cols-12 divide-x divide-slate-900">
                                    <span className="col-span-1 text-center py-1 font-bold text-slate-600 bg-slate-50">{idx + 1}</span>
                                    <input
                                        type="text"
                                        className="col-span-11 px-2 py-1 bg-transparent focus:bg-amber-50 focus:outline-none"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 7. Manpower Deployment Table (Left) + PHOTO 1 (Right) */}
                    <div className="grid grid-cols-12 border-b border-slate-900 divide-x divide-slate-900">
                        {/* Manpower Left (Cols 1-7) */}
                        <div className="col-span-7 divide-y divide-slate-900">
                            {/* Manpower Header */}
                            <div className="grid grid-cols-12 divide-x divide-slate-900 bg-slate-100 font-bold text-[11px]">
                                <span className="col-span-1 text-center py-1.5">S. No.</span>
                                <span className="col-span-7 px-2 py-1.5">Daily Progress for Manpower (Type & Count)</span>
                                <span className="col-span-2 text-center py-1.5">Required</span>
                                <span className="col-span-2 text-center py-1.5">Available</span>
                            </div>

                            {/* 11 Trades */}
                            {manpower.map((m, idx) => (
                                <div key={m.trade} className="grid grid-cols-12 divide-x divide-slate-900 text-xs hover:bg-slate-50/80 transition-colors">
                                    <span className="col-span-1 text-center py-1 text-slate-600 font-bold bg-slate-50">{idx + 1}</span>
                                    <span className="col-span-7 px-2 py-1 font-medium">{m.trade}</span>
                                    <input
                                        type="number"
                                        value={m.required}
                                        onChange={(e) => {
                                            const updated = [...manpower];
                                            updated[idx].required = e.target.value;
                                            setManpower(updated);
                                            setIsDirty(true);
                                        }}
                                        className="col-span-2 text-center py-1 bg-transparent focus:bg-amber-50 focus:outline-none"
                                    />
                                    <input
                                        type="number"
                                        value={m.available}
                                        onChange={(e) => {
                                            const updated = [...manpower];
                                            updated[idx].available = parseInt(e.target.value, 10) || 0;
                                            setManpower(updated);
                                            setIsDirty(true);
                                        }}
                                        className="col-span-2 text-center py-1 font-bold bg-transparent focus:bg-amber-50 focus:outline-none"
                                    />
                                </div>
                            ))}

                            {/* Total Row with Bright Yellow Available Highlight (#ffff00) */}
                            <div className="grid grid-cols-12 divide-x divide-slate-900 text-xs font-bold bg-slate-50">
                                <span className="col-span-1 py-1"></span>
                                <span className="col-span-7 px-2 py-1 text-right">Total</span>
                                <span className="col-span-2 text-center py-1"></span>
                                {/* BRIGHT YELLOW CELL MATCHING CLIENT REFERENCE */}
                                <span className="col-span-2 text-center py-1 bg-[#ffff00] text-slate-950 font-black text-sm border-2 border-slate-900">
                                    {totalAvailable}
                                </span>
                            </div>
                        </div>

                        {/* Photo 1 Right Box (Cols 8-12) */}
                        <div className="col-span-5 p-3 flex flex-col justify-between relative bg-slate-50/40">
                            <div className="flex-1 flex flex-col items-center justify-center min-h-[180px] border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white p-2">
                                {photos[0]?.url ? (
                                    <div className="relative w-full h-full flex flex-col items-center justify-center">
                                        <img
                                            src={getFileUrl(photos[0].url)}
                                            alt="Photo 1"
                                            className="max-h-[170px] w-auto object-contain rounded-lg shadow-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const u = [...photos];
                                                u[0].url = '';
                                                setPhotos(u);
                                                setIsDirty(true);
                                            }}
                                            className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700"
                                            title="Remove photo"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-primary-600 transition-colors">
                                        <span className="text-xl font-bold font-mono tracking-widest text-slate-400 mb-1">#REF!</span>
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-600">
                                            <Upload size={14} /> Upload Photo 1
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleUploadPhotoSlot(0, e.target.files?.[0])}
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Tag: PHOTO : 1 with green outline box matching screenshot */}
                            <div className="mt-2 flex items-center justify-between">
                                <span className="inline-flex items-center px-2.5 py-0.5 border border-emerald-600 text-emerald-800 bg-emerald-50 text-[11px] font-bold tracking-wide">
                                    PHOTO : 1
                                </span>
                                <input
                                    type="text"
                                    value={photos[0]?.caption || ''}
                                    onChange={(e) => {
                                        const u = [...photos];
                                        u[0].caption = e.target.value;
                                        setPhotos(u);
                                        setIsDirty(true);
                                    }}
                                    placeholder="Photo 1 Caption..."
                                    className="text-[11px] px-2 py-0.5 border border-slate-300 rounded bg-white w-48 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 8. Photo Grid (Photo 2 to Photo 7) */}
                    {/* Row 1: Photo 2 | Photo 3 | Photo 4 */}
                    <div className="grid grid-cols-3 divide-x divide-slate-900 border-b border-slate-900 bg-white">
                        {[1, 2, 3].map((idx) => {
                            const p = photos[idx];
                            return (
                                <div key={p.slot} className="p-3 flex flex-col justify-between min-h-[160px] bg-slate-50/30">
                                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white p-2">
                                        {p?.url ? (
                                            <div className="relative w-full h-full flex items-center justify-center">
                                                <img
                                                    src={getFileUrl(p.url)}
                                                    alt={p.label}
                                                    className="max-h-[120px] w-auto object-contain rounded-lg shadow-sm"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const u = [...photos];
                                                        u[idx].url = '';
                                                        setPhotos(u);
                                                        setIsDirty(true);
                                                    }}
                                                    className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-primary-600 transition-colors">
                                                <ImageIcon size={24} className="mb-1 text-slate-300" />
                                                <span className="text-xs font-bold text-slate-600">{p.label}</span>
                                                <span className="text-[10px] text-primary-600 font-semibold mt-0.5">Click to Upload</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handleUploadPhotoSlot(idx, e.target.files?.[0])}
                                                />
                                            </label>
                                        )}
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="inline-flex items-center px-2 py-0.5 border border-blue-600 text-blue-800 bg-blue-50 text-[10px] font-bold tracking-wide">
                                            {p.tag}
                                        </span>
                                        <input
                                            type="text"
                                            value={p?.caption || ''}
                                            onChange={(e) => {
                                                const u = [...photos];
                                                u[idx].caption = e.target.value;
                                                setPhotos(u);
                                                setIsDirty(true);
                                            }}
                                            placeholder="Caption..."
                                            className="text-[10px] px-1.5 py-0.5 border border-slate-300 rounded bg-white w-32 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Row 2: Photo 5 | Photo 6 | Photo 7 */}
                    <div className="grid grid-cols-3 divide-x divide-slate-900 bg-white">
                        {[4, 5, 6].map((idx) => {
                            const p = photos[idx];
                            return (
                                <div key={p.slot} className="p-3 flex flex-col justify-between min-h-[160px] bg-slate-50/30">
                                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white p-2">
                                        {p?.url ? (
                                            <div className="relative w-full h-full flex items-center justify-center">
                                                <img
                                                    src={getFileUrl(p.url)}
                                                    alt={p.label}
                                                    className="max-h-[120px] w-auto object-contain rounded-lg shadow-sm"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const u = [...photos];
                                                        u[idx].url = '';
                                                        setPhotos(u);
                                                        setIsDirty(true);
                                                    }}
                                                    className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-primary-600 transition-colors">
                                                <ImageIcon size={24} className="mb-1 text-slate-300" />
                                                <span className="text-xs font-bold text-slate-600">{p.label}</span>
                                                <span className="text-[10px] text-primary-600 font-semibold mt-0.5">Click to Upload</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handleUploadPhotoSlot(idx, e.target.files?.[0])}
                                                />
                                            </label>
                                        )}
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="inline-flex items-center px-2 py-0.5 border border-blue-600 text-blue-800 bg-blue-50 text-[10px] font-bold tracking-wide">
                                            {p.tag}
                                        </span>
                                        <input
                                            type="text"
                                            value={p?.caption || ''}
                                            onChange={(e) => {
                                                const u = [...photos];
                                                u[idx].caption = e.target.value;
                                                setPhotos(u);
                                                setIsDirty(true);
                                            }}
                                            placeholder="Caption..."
                                            className="text-[10px] px-1.5 py-0.5 border border-slate-300 rounded bg-white w-32 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default DprClientExcelSheet;
