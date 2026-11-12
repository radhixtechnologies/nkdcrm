import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    FileSpreadsheet, ExternalLink, RefreshCw, Save, UploadCloud,
    Download, Plus, Trash2, Edit3, Check, X, Maximize2, Minimize2,
    Sparkles, Info, Link2, CheckCircle2, AlertCircle, HelpCircle,
    ChevronDown, Eye, Filter, ArrowUpRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import dprService from '../../services/dprService';
import { extractApiError } from '../../services/api';

const DEFAULT_COLUMNS = [
    { key: 'item_no', label: 'Item / Cable Drum #', type: 'text', width: '130px' },
    { key: 'description', label: 'Scope of Work / Description', type: 'text', width: '260px' },
    { key: 'location', label: 'Location / Grid / Trench', type: 'text', width: '150px' },
    { key: 'unit', label: 'Unit', type: 'text', width: '90px' },
    { key: 'boq_qty', label: 'BOQ Target', type: 'number', width: '110px' },
    { key: 'today_qty', label: 'Today Executed', type: 'number', width: '120px' },
    { key: 'cum_qty', label: 'Cumulative Done', type: 'number', width: '130px' },
    { key: 'status', label: 'Testing / Status', type: 'status', width: '130px' },
    { key: 'team', label: 'Contractor / Vendor Team', type: 'text', width: '170px' },
    { key: 'remarks', label: 'Site Engineer Remarks', type: 'text', width: '200px' }
];

const DEFAULT_ROWS = [
    { id: '1', item_no: 'DRUM-HT-01', description: '33kV 3C x 400 sqmm XLPE Armoured Cable Laying', location: 'Trench Bay-A to Bay-B', unit: 'Mtr', boq_qty: '1500', today_qty: '120', cum_qty: '640', status: 'In Progress', team: 'NKD Team Alpha', remarks: 'Depth 1.2m checked with sand cushioning' },
    { id: '2', item_no: 'DRUM-HT-02', description: 'Straight Through Cable Jointing & Heat Shrink Kit', location: 'Joint Bay JB-04', unit: 'Nos', boq_qty: '8', today_qty: '2', cum_qty: '5', status: 'Testing Pending', team: 'Specialized Jointers', remarks: 'Hi-Pot test scheduled tomorrow' },
    { id: '3', item_no: 'EARTH-01', description: 'Chemical Earthing Electrode (Copper Bonded 3m)', location: 'Control Room Pit 1-4', unit: 'Sets', boq_qty: '24', today_qty: '4', cum_qty: '18', status: 'Completed', team: 'NKD Earthing Gang', remarks: 'Resistance measured 0.85 Ohm (Passed)' },
    { id: '4', item_no: 'TRENCH-W4', description: 'Trench Excavation, Dressing & Dewatering', location: 'Switchyard North Perimeter', unit: 'Mtr', boq_qty: '450', today_qty: '35', cum_qty: '310', status: 'In Progress', team: 'Civil Subcontractor', remarks: 'Pump deployed for rain water removal' },
    { id: '5', item_no: 'TR-SETUP', description: '33/11kV Power Transformer Foundation & Placement', location: 'Yard Bay-01', unit: 'Set', boq_qty: '2', today_qty: '0', cum_qty: '1', status: 'Completed', team: 'Heavy Rigging Team', remarks: 'Placed on plinth, oil filtration pending' }
];

const STATUS_OPTIONS = ['Completed', 'In Progress', 'Testing Pending', 'Material Shortage', 'Blocked / Delay'];

const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'Completed':
            return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        case 'In Progress':
            return 'bg-sky-100 text-sky-800 border-sky-300';
        case 'Testing Pending':
            return 'bg-amber-100 text-amber-800 border-amber-300';
        case 'Material Shortage':
            return 'bg-orange-100 text-orange-800 border-orange-300';
        case 'Blocked / Delay':
            return 'bg-rose-100 text-rose-800 border-rose-300';
        default:
            return 'bg-slate-100 text-slate-700 border-slate-200';
    }
};

const DprLiveSheetHub = ({ sites = [], selectedSiteId = 'ALL', onSiteChange }) => {
    // Mode: 'excel' (In-App Interactive Spreadsheet) or 'google' (Google Sheets Embed)
    const [sheetMode, setSheetMode] = useState('excel');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Active Site
    const currentSiteId = selectedSiteId === 'ALL' ? (sites[0]?.site_id || '') : selectedSiteId;
    const currentSite = sites.find((s) => String(s.site_id) === String(currentSiteId)) || sites[0] || null;

    // Google Sheets Config
    const [googleSheetInput, setGoogleSheetInput] = useState('');
    const [savedGoogleSheetUrl, setSavedGoogleSheetUrl] = useState('');
    const [showGoogleGuide, setShowGoogleGuide] = useState(false);

    // In-App Excel Grid State
    const [columns, setColumns] = useState(DEFAULT_COLUMNS);
    const [rows, setRows] = useState(DEFAULT_ROWS);
    const [newColLabel, setNewColLabel] = useState('');
    const [showAddCol, setShowAddCol] = useState(false);
    const [renamingKey, setRenamingKey] = useState(null);
    const [renameText, setRenameText] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Load Site Sheet Config from Backend
    const loadSiteSheetData = useCallback(async (siteId) => {
        if (!siteId) return;
        setLoading(true);
        try {
            const res = await dprService.getSiteSheet(siteId);
            const siteData = res?.data || res;
            if (siteData) {
                if (siteData.google_sheet_url) {
                    setSavedGoogleSheetUrl(siteData.google_sheet_url);
                    setGoogleSheetInput(siteData.google_sheet_url);
                } else {
                    setSavedGoogleSheetUrl('');
                    setGoogleSheetInput('');
                }

                if (siteData.excel_grid && Array.isArray(siteData.excel_grid.columns) && siteData.excel_grid.columns.length > 0) {
                    setColumns(siteData.excel_grid.columns);
                    setRows(Array.isArray(siteData.excel_grid.rows) && siteData.excel_grid.rows.length > 0 ? siteData.excel_grid.rows : DEFAULT_ROWS);
                } else {
                    setColumns(DEFAULT_COLUMNS);
                    setRows(DEFAULT_ROWS);
                }
            }
        } catch (err) {
            // fallback to site template if not saved
            console.warn('Site sheet load note:', err?.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (currentSiteId) {
            loadSiteSheetData(currentSiteId);
        }
    }, [currentSiteId, loadSiteSheetData]);

    // Save In-App Excel Sheet or Google Sheet URL to Cloud
    const handleSaveSheet = async () => {
        if (!currentSiteId) {
            toast.error('Please select a site first.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                google_sheet_url: googleSheetInput ? googleSheetInput.trim() : null,
                excel_grid: { columns, rows }
            };
            await dprService.saveSiteSheet(currentSiteId, payload);
            setSavedGoogleSheetUrl(payload.google_sheet_url || '');
            toast.success(`Sheet saved successfully for ${currentSite?.site_name || 'Site'}!`);
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to save sheet to site'));
        } finally {
            setSaving(false);
        }
    };

    // Cell Edit Handlers
    const handleCellChange = (rowId, colKey, val) => {
        setRows((prev) =>
            prev.map((r) => (r.id === rowId ? { ...r, [colKey]: val } : r))
        );
    };

    const handleAddRow = () => {
        const newRow = { id: String(Date.now()) };
        columns.forEach((col) => {
            newRow[col.key] = col.type === 'number' ? '0' : col.type === 'status' ? 'In Progress' : '';
        });
        setRows((prev) => [...prev, newRow]);
        toast.success('New row added at the bottom');
    };

    const handleDeleteRow = (rowId) => {
        setRows((prev) => prev.filter((r) => r.id !== rowId));
    };

    const handleAddColumn = () => {
        const trimmed = newColLabel.trim();
        if (!trimmed) return;
        const key = `col_${Date.now()}`;
        const newCol = {
            key,
            label: trimmed,
            type: 'text',
            width: '150px'
        };
        setColumns((prev) => [...prev, newCol]);
        setRows((prev) => prev.map((r) => ({ ...r, [key]: '' })));
        setNewColLabel('');
        setShowAddCol(false);
        toast.success(`Column "${trimmed}" added!`);
    };

    const handleDeleteColumn = (colKey) => {
        if (columns.length <= 1) {
            toast.error('You must keep at least 1 column.');
            return;
        }
        setColumns((prev) => prev.filter((c) => c.key !== colKey));
        setRows((prev) =>
            prev.map((r) => {
                const copy = { ...r };
                delete copy[colKey];
                return copy;
            })
        );
    };

    const handleRenameColumn = (colKey) => {
        const trimmed = renameText.trim();
        if (!trimmed) {
            setRenamingKey(null);
            return;
        }
        setColumns((prev) =>
            prev.map((c) => (c.key === colKey ? { ...c, label: trimmed } : c))
        );
        setRenamingKey(null);
        setRenameText('');
        toast.success('Column renamed');
    };

    // Excel / CSV File Import
    const handleExcelImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);

        const toastId = toast.loading('Parsing Excel workbook...');
        try {
            const res = await dprService.importExcelGrid(formData);
            const grid = res?.data || res;
            if (grid && Array.isArray(grid.columns) && grid.columns.length > 0) {
                setColumns(grid.columns);
                setRows(Array.isArray(grid.rows) ? grid.rows : []);
                toast.success(`Imported ${grid.rows?.length || 0} rows from ${file.name}!`, { id: toastId });
            } else {
                toast.error('Could not extract table data from file', { id: toastId });
            }
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to import Excel file'), { id: toastId });
        } finally {
            e.target.value = '';
        }
    };

    // Export In-App Grid as CSV
    const handleExportCSV = () => {
        if (rows.length === 0) {
            toast.error('No rows to export.');
            return;
        }
        const headers = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
        const bodyLines = rows.map((r) =>
            columns.map((c) => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
        );
        const csvContent = [headers, ...bodyLines].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NKD_Site_Sheet_${currentSite?.site_code || 'EXPORT'}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV downloaded successfully!');
    };

    // Convert raw Google Sheet URL to embeddable URL
    const embedGoogleUrl = useMemo(() => {
        const raw = (savedGoogleSheetUrl || googleSheetInput || '').trim();
        if (!raw) return '';
        if (raw.includes('/pubhtml')) return raw;
        if (raw.includes('/pub?')) return raw;
        const match = raw.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
            return `https://docs.google.com/spreadsheets/d/${match[1]}/htmlembed?widget=true&headers=false`;
        }
        return raw;
    }, [savedGoogleSheetUrl, googleSheetInput]);

    // Computed Stats
    const filteredRows = useMemo(() => {
        return rows.filter((r) => {
            if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
            if (!searchTerm.trim()) return true;
            const q = searchTerm.toLowerCase();
            return columns.some((c) => String(r[c.key] || '').toLowerCase().includes(q));
        });
    }, [rows, columns, statusFilter, searchTerm]);

    const stats = useMemo(() => {
        const total = rows.length;
        const completed = rows.filter((r) => r.status === 'Completed').length;
        const inProgress = rows.filter((r) => r.status === 'In Progress').length;
        const totalTodayQty = rows.reduce((s, r) => s + (parseFloat(r.today_qty) || 0), 0);
        const totalCumQty = rows.reduce((s, r) => s + (parseFloat(r.cum_qty) || 0), 0);
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, inProgress, totalTodayQty, totalCumQty, completionRate };
    }, [rows]);

    return (
        <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-100 p-4 sm:p-6 overflow-auto' : ''}`}>
            {/* Top Hub Header Card */}
            <div className="bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 rounded-2xl p-5 text-white shadow-xl border border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
                                <Sparkles size={12} className="animate-spin" />
                                LIVE SPREADSHEET ENGINE
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                                Direct In-Browser Excel Grid & Google Sheets Embed
                            </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                            <FileSpreadsheet className="text-emerald-400 shrink-0" size={26} />
                            Site Progress Spreadsheet & Live Sheet Hub
                        </h2>
                        <p className="text-xs text-slate-300 mt-1">
                            Current Site: <b className="text-white">{currentSite?.site_name || 'All Sites'}</b>
                            {currentSite?.site_code && <span className="text-primary-300 font-mono ml-1">({currentSite.site_code})</span>}
                            {' '}• Employer: <span className="text-slate-300">{currentSite?.principal_employer_name || 'NKD Infrastructure'}</span>
                        </p>
                    </div>

                    {/* Mode Selector & Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        {/* Site Switcher */}
                        {sites.length > 0 && (
                            <div className="bg-white/10 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/20 flex items-center gap-2 text-xs">
                                <span className="text-slate-300 font-medium hidden sm:inline">Site:</span>
                                <select
                                    value={currentSiteId}
                                    onChange={(e) => onSiteChange?.(e.target.value)}
                                    className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
                                >
                                    {sites.map((s) => (
                                        <option key={s.site_id} value={s.site_id} className="text-slate-900">
                                            {s.site_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Mode Switch Pills */}
                        <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 flex items-center">
                            <button
                                type="button"
                                onClick={() => setSheetMode('excel')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    sheetMode === 'excel'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                <FileSpreadsheet size={14} />
                                In-App Excel Sheet
                            </button>
                            <button
                                type="button"
                                onClick={() => setSheetMode('google')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    sheetMode === 'google'
                                        ? 'bg-primary-600 text-white shadow-sm'
                                        : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                <Link2 size={14} />
                                Google Sheet Live
                            </button>
                        </div>

                        {/* Save Button */}
                        <button
                            type="button"
                            onClick={handleSaveSheet}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            <Save size={15} />
                            {saving ? 'Saving...' : 'Save to Cloud'}
                        </button>

                        {/* Fullscreen Toggle */}
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen Sheet'}
                        >
                            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                    </div>
                </div>

                {/* KPI Quick Metrics Bar */}
                {sheetMode === 'excel' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4 pt-4 border-t border-white/10 text-xs">
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Total Rows</span>
                            <span className="text-base sm:text-lg font-black text-white">{stats.total} items</span>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                            <span className="text-[10px] text-emerald-400 font-semibold block uppercase">Completed</span>
                            <span className="text-base sm:text-lg font-black text-emerald-300">{stats.completed}</span>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                            <span className="text-[10px] text-sky-400 font-semibold block uppercase">In Progress</span>
                            <span className="text-base sm:text-lg font-black text-sky-300">{stats.inProgress}</span>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                            <span className="text-[10px] text-amber-400 font-semibold block uppercase">Today Executed</span>
                            <span className="text-base sm:text-lg font-black text-amber-300">{stats.totalTodayQty.toLocaleString()}</span>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                            <span className="text-[10px] text-primary-300 font-semibold block uppercase">Cumulative Qty</span>
                            <span className="text-base sm:text-lg font-black text-primary-200">{stats.totalCumQty.toLocaleString()}</span>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Completion</span>
                            <span className="text-base sm:text-lg font-black text-emerald-400">{stats.completionRate}%</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ======================================================== */}
            {/* MODE 1: IN-APP INTERACTIVE EXCEL SPREADSHEET             */}
            {/* ======================================================== */}
            {sheetMode === 'excel' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    {/* Toolbar */}
                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Add Row */}
                            <button
                                type="button"
                                onClick={handleAddRow}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                            >
                                <Plus size={14} /> Add Row
                            </button>

                            {/* Add Column */}
                            {showAddCol ? (
                                <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-xs">
                                    <input
                                        type="text"
                                        placeholder="New Column Title..."
                                        value={newColLabel}
                                        onChange={(e) => setNewColLabel(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                                        className="text-xs border-none outline-none w-36 px-1 text-slate-800"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddColumn}
                                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                        title="Confirm"
                                    >
                                        <Check size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddCol(false)}
                                        className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                        title="Cancel"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowAddCol(true)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                                >
                                    <Plus size={14} /> Add Column
                                </button>
                            )}

                            {/* Import Excel */}
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold transition-all shadow-2xs cursor-pointer">
                                <UploadCloud size={14} className="text-primary-600" />
                                <span>Import Excel (.xlsx)</span>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleExcelImport}
                                    className="hidden"
                                />
                            </label>

                            {/* Export CSV */}
                            <button
                                type="button"
                                onClick={handleExportCSV}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold transition-all shadow-2xs cursor-pointer"
                                title="Download current sheet as CSV"
                            >
                                <Download size={14} className="text-emerald-600" /> Export CSV
                            </button>
                        </div>

                        {/* Search & Filter */}
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Search cells..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-primary-500 w-36 sm:w-48"
                            />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none cursor-pointer text-slate-700 font-semibold"
                            >
                                <option value="ALL">All Status</option>
                                {STATUS_OPTIONS.map((st) => (
                                    <option key={st} value={st}>{st}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Table Container */}
                    <div className="overflow-x-auto max-h-[620px] scrollbar-thin">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 text-white font-bold sticky top-0 z-10 shadow-xs">
                                    <th className="px-3 py-3 w-12 text-center border-r border-slate-800">#</th>
                                    {columns.map((col) => (
                                        <th
                                            key={col.key}
                                            style={{ minWidth: col.width || '140px' }}
                                            className="px-3 py-3 border-r border-slate-800 text-slate-100 text-xs font-bold uppercase tracking-wider relative group"
                                        >
                                            {renamingKey === col.key ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="text"
                                                        value={renameText}
                                                        onChange={(e) => setRenameText(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleRenameColumn(col.key)}
                                                        className="text-xs px-1.5 py-0.5 rounded bg-white text-slate-900 w-full outline-none font-normal"
                                                        autoFocus
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRenameColumn(col.key)}
                                                        className="text-emerald-400 hover:text-emerald-300"
                                                    >
                                                        <Check size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setRenamingKey(null)}
                                                        className="text-slate-400 hover:text-white"
                                                    >
                                                        <X size={13} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="truncate">{col.label}</span>
                                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setRenamingKey(col.key);
                                                                setRenameText(col.label);
                                                            }}
                                                            className="text-slate-300 hover:text-white"
                                                            title="Rename column"
                                                        >
                                                            <Edit3 size={11} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteColumn(col.key)}
                                                            className="text-rose-400 hover:text-rose-300"
                                                            title="Delete column"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </th>
                                    ))}
                                    <th className="px-2 py-3 w-10 text-center">Del</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={columns.length + 2} className="px-4 py-12 text-center text-slate-400">
                                            No rows matching filter. Click "+ Add Row" or "Import Excel" to begin.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((r, rIdx) => (
                                        <tr key={r.id || rIdx} className="hover:bg-slate-50 transition-colors group">
                                            {/* Row Number */}
                                            <td className="px-2 py-1.5 text-center font-mono font-bold text-slate-400 bg-slate-50 border-r border-slate-200 text-[11px]">
                                                {rIdx + 1}
                                            </td>

                                            {/* Dynamic Cells */}
                                            {columns.map((col) => {
                                                const val = r[col.key] ?? '';
                                                return (
                                                    <td key={col.key} className="px-1.5 py-1 border-r border-slate-200">
                                                        {col.type === 'status' ? (
                                                            <select
                                                                value={val || 'In Progress'}
                                                                onChange={(e) => handleCellChange(r.id, col.key, e.target.value)}
                                                                className={`w-full px-2 py-1 rounded-md text-[11px] font-bold border outline-none cursor-pointer ${getStatusBadgeClass(val)}`}
                                                            >
                                                                {STATUS_OPTIONS.map((st) => (
                                                                    <option key={st} value={st}>{st}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <input
                                                                type={col.type === 'number' ? 'number' : 'text'}
                                                                value={val}
                                                                onChange={(e) => handleCellChange(r.id, col.key, e.target.value)}
                                                                placeholder={`Enter ${col.label.toLowerCase()}...`}
                                                                className={`w-full px-2 py-1 rounded border-transparent hover:border-slate-300 focus:border-primary-500 focus:bg-white text-xs outline-none transition-colors ${
                                                                    col.type === 'number' ? 'font-mono text-right' : 'text-slate-800'
                                                                }`}
                                                            />
                                                        )}
                                                    </td>
                                                );
                                            })}

                                            {/* Row Delete Action */}
                                            <td className="px-1.5 py-1 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteRow(r.id)}
                                                    className="p-1 text-slate-300 hover:text-rose-600 rounded transition-colors"
                                                    title="Delete row"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Bottom Status & Quick Add Bar */}
                    <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleAddRow}
                                className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                            >
                                <Plus size={14} /> Add New Row
                            </button>
                            <span className="text-slate-300">•</span>
                            <span>Showing <b>{filteredRows.length}</b> of <b>{rows.length}</b> records</span>
                        </div>
                        <div className="flex items-center gap-2 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Auto-calculation active • Press "Save to Cloud" to sync with DPR</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* MODE 2: GOOGLE SHEETS LIVE CLOUD EMBED & SYNC            */}
            {/* ======================================================== */}
            {sheetMode === 'google' && (
                <div className="space-y-4">
                    {/* Google Sheet URL Config Panel */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                    <Link2 className="text-primary-600" size={17} />
                                    Connect Official Google Sheet for {currentSite?.site_name || 'This Site'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Paste your Google Sheets link below. Site engineers & clients can view and edit in real-time.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowGoogleGuide(!showGoogleGuide)}
                                className="text-xs font-bold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
                            >
                                <HelpCircle size={14} />
                                {showGoogleGuide ? 'Hide Instructions' : 'How to Share Google Sheet?'}
                            </button>
                        </div>

                        {/* Guide Banner */}
                        {showGoogleGuide && (
                            <div className="p-3.5 rounded-xl bg-primary-50/70 border border-primary-200 text-xs text-primary-900 space-y-1.5 animate-in fade-in">
                                <p className="font-bold flex items-center gap-1.5">
                                    <Info size={14} className="text-primary-600 shrink-0" />
                                    Google Sheet ko embed karne ke 3 aasaan steps:
                                </p>
                                <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] text-slate-700">
                                    <li>Apne Google Sheet mein upar right side <b>"Share"</b> button par click karein.</li>
                                    <li>General access mein <b>"Anyone with the link"</b> chunein aur Role <b>"Editor"</b> (ya "Viewer") rakhein.</li>
                                    <li><b>"Copy link"</b> karke neeche input box mein paste karein aur <b>"Save & Connect"</b> dabayein!</li>
                                </ol>
                            </div>
                        )}

                        {/* Input Row */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                            <div className="relative flex-1">
                                <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="url"
                                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit..."
                                    value={googleSheetInput}
                                    onChange={(e) => setGoogleSheetInput(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-primary-500 font-mono text-slate-800"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleSaveSheet}
                                disabled={saving || !googleSheetInput.trim()}
                                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                                <Save size={14} />
                                {saving ? 'Connecting...' : 'Save & Connect'}
                            </button>

                            {savedGoogleSheetUrl && (
                                <a
                                    href={savedGoogleSheetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors"
                                >
                                    <ExternalLink size={14} />
                                    Open in New Tab
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Live Embedded Google Sheet Frame */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-3 bg-slate-900 text-white flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                                <span className="font-bold">Live Google Spreadsheet View</span>
                                <span className="text-slate-400 text-[11px] hidden sm:inline">• Realtime multi-user cloud collaboration</span>
                            </div>

                            <div className="flex items-center gap-2">
                                {savedGoogleSheetUrl && (
                                    <a
                                        href={savedGoogleSheetUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary-300 hover:text-white font-bold inline-flex items-center gap-1"
                                    >
                                        <ArrowUpRight size={13} /> Open Full Google Sheets
                                    </a>
                                )}
                            </div>
                        </div>

                        {embedGoogleUrl ? (
                            <iframe
                                src={embedGoogleUrl}
                                title="Live Google Sheet"
                                className="w-full h-[680px] border-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        ) : (
                            <div className="p-16 text-center text-slate-400 space-y-3">
                                <FileSpreadsheet size={48} className="mx-auto text-slate-300" />
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700">No Google Sheet connected for this site yet</h4>
                                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                                        Paste your Google Sheets shareable link above to embed it directly inside the CRM.
                                        You can also switch to the <b>"In-App Excel Sheet"</b> mode to use the built-in spreadsheet.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSheetMode('excel')}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                                >
                                    <FileSpreadsheet size={15} /> Switch to In-App Excel Sheet
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DprLiveSheetHub;
