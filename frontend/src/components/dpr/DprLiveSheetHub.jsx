import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    FileSpreadsheet, ExternalLink, RefreshCw, Save, UploadCloud,
    Download, Plus, Trash2, Edit3, Check, X, Maximize2, Minimize2,
    Sparkles, Info, Link2, CheckCircle2, AlertCircle, HelpCircle,
    ChevronDown, Eye, Filter, ArrowUpRight, Copy, Calculator, Table,
    Columns, Layers, CheckSquare, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import dprService from '../../services/dprService';
import { extractApiError } from '../../services/api';

// Excel column letter generator (0 -> A, 1 -> B, 25 -> Z, 26 -> AA)
const getExcelColumnLetter = (colIdx) => {
    let letter = '';
    let temp = colIdx;
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
};

// Preset Industry Templates
const INDUSTRY_TEMPLATES = {
    electrical: {
        name: '⚡ 33kV/11kV Substation & Cable Laying',
        columns: [
            { key: 'item_no', label: 'Item / Drum #', type: 'text', width: '130px' },
            { key: 'description', label: 'Scope of Work / Description', type: 'text', width: '260px' },
            { key: 'location', label: 'Location / Grid / Bay', type: 'text', width: '150px' },
            { key: 'unit', label: 'Unit', type: 'text', width: '90px' },
            { key: 'boq_qty', label: 'BOQ Target', type: 'number', width: '110px' },
            { key: 'today_qty', label: 'Today Executed', type: 'number', width: '120px' },
            { key: 'cum_qty', label: 'Cumulative Done', type: 'number', width: '130px' },
            { key: 'status', label: 'Testing / Status', type: 'status', width: '130px' },
            { key: 'team', label: 'Contractor / Vendor Team', type: 'text', width: '170px' },
            { key: 'remarks', label: 'Site Engineer Remarks', type: 'text', width: '200px' }
        ],
        rows: [
            { id: '1', item_no: 'DRUM-HT-01', description: '33kV 3C x 400 sqmm XLPE Armoured Cable Laying', location: 'Trench Bay-A to Bay-B', unit: 'Mtr', boq_qty: '1500', today_qty: '120', cum_qty: '640', status: 'In Progress', team: 'NKD Team Alpha', remarks: 'Depth 1.2m checked with sand cushioning' },
            { id: '2', item_no: 'DRUM-HT-02', description: 'Straight Through Cable Jointing & Heat Shrink Kit', location: 'Joint Bay JB-04', unit: 'Nos', boq_qty: '8', today_qty: '2', cum_qty: '5', status: 'Testing Pending', team: 'Specialized Jointers', remarks: 'Hi-Pot test scheduled tomorrow' },
            { id: '3', item_no: 'EARTH-01', description: 'Chemical Earthing Electrode (Copper Bonded 3m)', location: 'Control Room Pit 1-4', unit: 'Sets', boq_qty: '24', today_qty: '4', cum_qty: '18', status: 'Completed', team: 'NKD Earthing Gang', remarks: 'Resistance measured 0.85 Ohm (Passed)' },
            { id: '4', item_no: 'TRENCH-W4', description: 'Trench Excavation, Dressing & Dewatering', location: 'Switchyard North Perimeter', unit: 'Mtr', boq_qty: '450', today_qty: '35', cum_qty: '310', status: 'In Progress', team: 'Civil Subcontractor', remarks: 'Pump deployed for rain water removal' },
            { id: '5', item_no: 'TR-SETUP', description: '33/11kV Power Transformer Foundation & Placement', location: 'Yard Bay-01', unit: 'Set', boq_qty: '2', today_qty: '0', cum_qty: '1', status: 'Completed', team: 'Heavy Rigging Team', remarks: 'Placed on plinth, oil filtration pending' }
        ]
    },
    trench: {
        name: '🏗️ Civil Trench & Dewatering Works',
        columns: [
            { key: 'trench_id', label: 'Trench Section #', type: 'text', width: '130px' },
            { key: 'description', label: 'Civil Activity / Scope', type: 'text', width: '250px' },
            { key: 'chainage', label: 'Chainage / RD (Mtr)', type: 'text', width: '140px' },
            { key: 'unit', label: 'Unit', type: 'text', width: '80px' },
            { key: 'planned_len', label: 'Target Scope', type: 'number', width: '110px' },
            { key: 'today_len', label: 'Today Progress', type: 'number', width: '120px' },
            { key: 'cum_len', label: 'Total Executed', type: 'number', width: '120px' },
            { key: 'pumps_active', label: 'Pumps Used', type: 'number', width: '100px' },
            { key: 'status', label: 'Excavation Status', type: 'status', width: '130px' },
            { key: 'remarks', label: 'Joint Verification Remarks', type: 'text', width: '210px' }
        ],
        rows: [
            { id: '1', trench_id: 'TR-NORTH-01', description: '11kV Cable Trench Opening & Mud Clearance', chainage: 'RD 00 to 150m', unit: 'Mtr', planned_len: '150', today_len: '25', cum_len: '120', pumps_active: '2', status: 'In Progress', remarks: '2 Submersible Motor Pumps running' },
            { id: '2', trench_id: 'TR-NORTH-02', description: 'Sand Bedding & Brick Cushioning', chainage: 'RD 150 to 300m', unit: 'Mtr', planned_len: '150', today_len: '30', cum_len: '80', pumps_active: '1', status: 'In Progress', remarks: 'First layer 100mm sand placed' },
            { id: '3', trench_id: 'TR-DRAIN-01', description: 'RCC Trench Sump Dewatering & Pumping', chainage: 'Pump Pit B-3', unit: 'Hours', planned_len: '48', today_len: '8', cum_len: '32', pumps_active: '3', status: 'Completed', remarks: 'Water cleared for cable pull' }
        ]
    },
    solar: {
        name: '☀️ Solar PV Array & Inverter Erection',
        columns: [
            { key: 'table_no', label: 'Table / String #', type: 'text', width: '130px' },
            { key: 'description', label: 'Solar Installation Task', type: 'text', width: '250px' },
            { key: 'block', label: 'Inverter Block / Grid', type: 'text', width: '140px' },
            { key: 'unit', label: 'Unit', type: 'text', width: '80px' },
            { key: 'target_qty', label: 'BOQ Target', type: 'number', width: '110px' },
            { key: 'today_qty', label: 'Today Executed', type: 'number', width: '120px' },
            { key: 'cum_qty', label: 'Total Done', type: 'number', width: '120px' },
            { key: 'status', label: 'Erection Status', type: 'status', width: '130px' },
            { key: 'test_report', label: 'Megger / Voc Check', type: 'text', width: '150px' },
            { key: 'remarks', label: 'QA / Client Remarks', type: 'text', width: '200px' }
        ],
        rows: [
            { id: '1', table_no: 'STR-BLK1-01', description: '540Wp Mono Perc Solar Module Mounting', block: 'Block 01 (Central)', unit: 'Modules', target_qty: '2400', today_qty: '160', cum_qty: '1420', status: 'In Progress', test_report: 'Torque 35Nm checked', remarks: 'Row 1 to 4 completed today' },
            { id: '2', table_no: 'DC-CBL-04', description: '4 sqmm Solar DC Copper Cable Stringing', block: 'Block 01 String Box', unit: 'Mtr', target_qty: '6500', today_qty: '450', cum_qty: '3800', status: 'In Progress', test_report: 'Voc 920V measured', remarks: 'UV ties tied at 0.5m spacing' },
            { id: '3', table_no: 'INV-ST-01', description: '250kW String Inverter Mounting & Earthing', block: 'PCU Inverter Room', unit: 'Units', target_qty: '8', today_qty: '2', cum_qty: '6', status: 'Testing Pending', test_report: 'Hi-Pot test pending', remarks: 'Mounted on skid frame' }
        ]
    },
    blank: {
        name: '📄 Blank Standard 8-Column Grid',
        columns: [
            { key: 'sno', label: 'S.No', type: 'text', width: '60px' },
            { key: 'item', label: 'Item / Activity Name', type: 'text', width: '260px' },
            { key: 'location', label: 'Location / Grid', type: 'text', width: '160px' },
            { key: 'unit', label: 'Unit', type: 'text', width: '90px' },
            { key: 'target', label: 'Target Qty', type: 'number', width: '110px' },
            { key: 'executed', label: 'Executed Qty', type: 'number', width: '120px' },
            { key: 'status', label: 'Status', type: 'status', width: '130px' },
            { key: 'remarks', label: 'Engineer Remarks', type: 'text', width: '220px' }
        ],
        rows: [
            { id: '1', sno: '1', item: '', location: '', unit: 'Mtr', target: '0', executed: '0', status: 'In Progress', remarks: '' },
            { id: '2', sno: '2', item: '', location: '', unit: 'Nos', target: '0', executed: '0', status: 'In Progress', remarks: '' }
        ]
    }
};

const DEFAULT_COLUMNS = INDUSTRY_TEMPLATES.electrical.columns;
const DEFAULT_ROWS = INDUSTRY_TEMPLATES.electrical.rows;

const STATUS_OPTIONS = ['Completed', 'In Progress', 'Testing Pending', 'Material Shortage', 'Blocked / Delay'];

const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'Completed':
            return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
        case 'In Progress':
            return 'bg-sky-50 text-sky-800 border-sky-300 font-bold';
        case 'Testing Pending':
            return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
        case 'Material Shortage':
            return 'bg-orange-50 text-orange-800 border-orange-300 font-bold';
        case 'Blocked / Delay':
            return 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
        default:
            return 'bg-slate-50 text-slate-700 border-slate-200';
    }
};

const DprLiveSheetHub = ({ sites = [], selectedSiteId = 'ALL', onSiteChange }) => {
    // Mode: 'excel' (In-App Interactive Spreadsheet) or 'google' (Google Sheets Embed)
    const [sheetMode, setSheetMode] = useState('excel');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lastSavedTime, setLastSavedTime] = useState(null);
    const [isDirty, setIsDirty] = useState(false);

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
    const [newColType, setNewColType] = useState('text');
    const [showAddCol, setShowAddCol] = useState(false);
    const [renamingKey, setRenamingKey] = useState(null);
    const [renameText, setRenameText] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [selectedTemplateKey, setSelectedTemplateKey] = useState('electrical');

    // Focused cell coordinates for Excel border highlight
    const [focusedCell, setFocusedCell] = useState(null); // { rowId, colKey }

    // Load Site Sheet Config from Backend
    const loadSiteSheetData = useCallback(async (siteId) => {
        if (!siteId) return;
        setLoading(true);
        try {
            const res = await dprService.getSiteSheet(siteId);
            const siteData = res?.data?.data || res?.data || res;
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
                setLastSavedTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
                setIsDirty(false);
            }
        } catch (err) {
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
            setLastSavedTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
            setIsDirty(false);
            toast.success(`Excel Sheet saved to cloud for ${currentSite?.site_name || 'Site'}!`);
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to save sheet to site'));
        } finally {
            setSaving(false);
        }
    };

    // Cell Edit Handlers
    const handleCellChange = (rowId, colKey, val) => {
        setIsDirty(true);
        setRows((prev) =>
            prev.map((r) => (r.id === rowId ? { ...r, [colKey]: val } : r))
        );
    };

    const handleAddRow = () => {
        setIsDirty(true);
        const newRow = { id: `row_${Date.now()}` };
        columns.forEach((col, idx) => {
            if (col.key === 'sno' || col.label?.toLowerCase().includes('s.no')) {
                newRow[col.key] = String(rows.length + 1);
            } else if (col.type === 'number') {
                newRow[col.key] = '0';
            } else if (col.type === 'status') {
                newRow[col.key] = 'In Progress';
            } else {
                newRow[col.key] = '';
            }
        });
        setRows((prev) => [...prev, newRow]);
        toast.success(`Row #${rows.length + 1} added`);
    };

    const handleDuplicateRow = (rowId) => {
        setIsDirty(true);
        const targetRow = rows.find((r) => r.id === rowId);
        if (!targetRow) return;
        const newRow = { ...targetRow, id: `row_${Date.now()}` };
        const idx = rows.findIndex((r) => r.id === rowId);
        const newRows = [...rows];
        newRows.splice(idx + 1, 0, newRow);
        setRows(newRows);
        toast.success('Row duplicated');
    };

    const handleDeleteRow = (rowId) => {
        if (rows.length <= 1) {
            toast.error('Sheet must contain at least 1 row');
            return;
        }
        setIsDirty(true);
        setRows((prev) => prev.filter((r) => r.id !== rowId));
        toast.success('Row deleted');
    };

    const handleAddColumn = () => {
        const trimmed = newColLabel.trim();
        if (!trimmed) return;
        setIsDirty(true);
        const newKey = `col_${Date.now()}`;
        const newCol = {
            key: newKey,
            label: trimmed,
            type: newColType,
            width: '140px'
        };
        setColumns((prev) => [...prev, newCol]);
        setRows((prev) =>
            prev.map((r) => ({
                ...r,
                [newKey]: newColType === 'number' ? '0' : newColType === 'status' ? 'In Progress' : ''
            }))
        );
        setNewColLabel('');
        setShowAddCol(false);
        toast.success(`Column "${trimmed}" added!`);
    };

    const handleDeleteColumn = (colKey) => {
        if (columns.length <= 1) {
            toast.error('Sheet must contain at least 1 column');
            return;
        }
        const colToDelete = columns.find((c) => c.key === colKey);
        if (!window.confirm(`Delete column "${colToDelete?.label || 'this column'}"?`)) return;
        setIsDirty(true);
        setColumns((prev) => prev.filter((c) => c.key !== colKey));
        setRows((prev) =>
            prev.map((r) => {
                const next = { ...r };
                delete next[colKey];
                return next;
            })
        );
        toast.success('Column removed');
    };

    const handleRenameColumn = (colKey) => {
        const trimmed = renameText.trim();
        if (!trimmed) {
            setRenamingKey(null);
            return;
        }
        setIsDirty(true);
        setColumns((prev) =>
            prev.map((c) => (c.key === colKey ? { ...c, label: trimmed } : c))
        );
        setRenamingKey(null);
        setRenameText('');
        toast.success('Column title updated');
    };

    // Load Industry Template
    const handleApplyTemplate = (templateKey) => {
        const tpl = INDUSTRY_TEMPLATES[templateKey];
        if (!tpl) return;
        if (isDirty && !window.confirm(`Load "${tpl.name}"? Current unsaved table changes will be replaced.`)) {
            return;
        }
        setColumns(tpl.columns);
        setRows(tpl.rows);
        setSelectedTemplateKey(templateKey);
        setIsDirty(true);
        toast.success(`Loaded template: ${tpl.name}`);
    };

    // Import Excel file (.xlsx, .xls, .csv)
    const handleExcelImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        const toastId = toast.loading('Parsing Excel workbook...');
        try {
            const res = await dprService.importExcelGrid(formData);
            const grid = res?.data?.data || res?.data || res;
            if (grid && Array.isArray(grid.columns) && grid.columns.length > 0) {
                const mappedCols = grid.columns.map((c) => ({
                    key: c.key,
                    label: c.title || c.label || c.key,
                    type: (c.title?.toLowerCase().includes('qty') || c.title?.toLowerCase().includes('amount') || c.title?.toLowerCase().includes('nos')) ? 'number' : 'text',
                    width: `${c.width || 140}px`
                }));
                setColumns(mappedCols);
                setRows(Array.isArray(grid.rows) ? grid.rows : []);
                setIsDirty(true);
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
        toast.success('CSV spreadsheet exported successfully!');
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

    // Computed Filtered Rows
    const filteredRows = useMemo(() => {
        return rows.filter((r) => {
            if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
            if (!searchTerm.trim()) return true;
            const q = searchTerm.toLowerCase();
            return columns.some((c) => String(r[c.key] || '').toLowerCase().includes(q));
        });
    }, [rows, columns, statusFilter, searchTerm]);

    // Computed Stats & Column Totals
    const stats = useMemo(() => {
        const total = rows.length;
        const completed = rows.filter((r) => r.status === 'Completed').length;
        const inProgress = rows.filter((r) => r.status === 'In Progress').length;
        
        // Find target, today, and cumulative column keys dynamically
        const boqCol = columns.find((c) => c.key === 'boq_qty' || c.key === 'target_qty' || c.key === 'planned_len' || c.key === 'target');
        const todayCol = columns.find((c) => c.key === 'today_qty' || c.key === 'today_len' || c.key === 'executed');
        const cumCol = columns.find((c) => c.key === 'cum_qty' || c.key === 'cum_len');

        const totalBoqQty = boqCol ? rows.reduce((s, r) => s + (parseFloat(r[boqCol.key]) || 0), 0) : 0;
        const totalTodayQty = todayCol ? rows.reduce((s, r) => s + (parseFloat(r[todayCol.key]) || 0), 0) : 0;
        const totalCumQty = cumCol ? rows.reduce((s, r) => s + (parseFloat(r[cumCol.key]) || 0), 0) : (totalTodayQty);

        const completionRate = totalBoqQty > 0
            ? Math.min(100, Math.round((totalCumQty / totalBoqQty) * 100))
            : (total > 0 ? Math.round((completed / total) * 100) : 0);

        const pendingBalance = Math.max(0, totalBoqQty - totalCumQty);

        return {
            total,
            completed,
            inProgress,
            totalBoqQty,
            totalTodayQty,
            totalCumQty,
            pendingBalance,
            completionRate
        };
    }, [rows, columns]);

    return (
        <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-xl p-3 sm:p-5 overflow-auto flex flex-col justify-between' : ''}`}>
            {/* Top Hub Header Card - Microsoft Excel Aesthetic */}
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 rounded-2xl p-4 sm:p-5 text-white shadow-xl border border-emerald-800/40 relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-96 bg-radial from-emerald-500/10 to-transparent pointer-events-none" />

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-[11px] border border-emerald-500/30">
                                <FileSpreadsheet size={13} className="text-emerald-400" />
                                EXCEL WORKBOOK ENGINE • LIVE SITE SPREADSHEET
                            </span>
                            {isDirty ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                                    <Clock size={11} /> Unsaved Changes
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                    <CheckCircle2 size={11} /> Cloud Synced {lastSavedTime ? `at ${lastSavedTime}` : ''}
                                </span>
                            )}
                        </div>

                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                            <span>Interactive DPR Spreadsheet & Execution Tracker</span>
                        </h2>
                        <p className="text-xs text-slate-300 mt-1">
                            Current Project Site: <b className="text-white">{currentSite?.site_name || 'All Sites'}</b>
                            {currentSite?.site_code && <span className="text-emerald-300 font-mono ml-1">({currentSite.site_code})</span>}
                            {' '}• Location: <span className="text-slate-300">{currentSite?.city || 'India'}, {currentSite?.state || ''}</span>
                        </p>
                    </div>

                    {/* Mode Selector & Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Site Switcher */}
                        {sites.length > 0 && (
                            <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 text-xs text-white">
                                <span className="text-slate-400 font-medium hidden sm:inline">Site:</span>
                                <select
                                    value={currentSiteId}
                                    onChange={(e) => onSiteChange?.(e.target.value)}
                                    className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs max-w-[140px] truncate"
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
                        <div className="bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 flex items-center">
                            <button
                                type="button"
                                onClick={() => setSheetMode('excel')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    sheetMode === 'excel'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                <FileSpreadsheet size={13} />
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
                                <Link2 size={13} />
                                Google Sheet Live
                            </button>
                        </div>

                        {/* Save to Cloud Button */}
                        <button
                            type="button"
                            onClick={handleSaveSheet}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            <Save size={15} />
                            {saving ? 'Saving...' : 'Save to Site'}
                        </button>

                        {/* Fullscreen Toggle */}
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-white/10"
                            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen Spreadsheet'}
                        >
                            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                    </div>
                </div>

                {/* Formula Calculation Summary Bar */}
                {sheetMode === 'excel' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4 pt-4 border-t border-white/10 text-xs">
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Total Activities</span>
                            <span className="text-base sm:text-lg font-black text-white">{stats.total} items</span>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                            <span className="text-[10px] text-emerald-400 font-semibold block uppercase">Target BOQ (Total)</span>
                            <span className="text-base sm:text-lg font-black text-emerald-300">{stats.totalBoqQty > 0 ? stats.totalBoqQty.toLocaleString() : '—'}</span>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                            <span className="text-[10px] text-amber-400 font-semibold block uppercase">Today's Executed</span>
                            <span className="text-base sm:text-lg font-black text-amber-300">{stats.totalTodayQty.toLocaleString()}</span>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                            <span className="text-[10px] text-sky-400 font-semibold block uppercase">Cumulative Finished</span>
                            <span className="text-base sm:text-lg font-black text-sky-200">{stats.totalCumQty.toLocaleString()}</span>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                            <span className="text-[10px] text-rose-300 font-semibold block uppercase">Pending Balance</span>
                            <span className="text-base sm:text-lg font-black text-rose-200">{stats.pendingBalance > 0 ? stats.pendingBalance.toLocaleString() : '0'}</span>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-300 font-semibold block uppercase">Progress</span>
                                <span className="text-xs font-black text-emerald-400">{stats.completionRate}%</span>
                            </div>
                            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden mt-1.5">
                                <div
                                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, stats.completionRate)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ======================================================== */}
            {/* MODE 1: IN-APP INTERACTIVE EXCEL SPREADSHEET             */}
            {/* ======================================================== */}
            {sheetMode === 'excel' && (
                <div className="bg-white rounded-2xl border border-slate-300 shadow-lg overflow-hidden flex flex-col">
                    {/* Excel Ribbon Toolbar */}
                    <div className="p-3 bg-slate-100 border-b border-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Insert Row */}
                            <button
                                type="button"
                                onClick={handleAddRow}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                                title="Add a new row at the bottom"
                            >
                                <Plus size={14} /> Add Row
                            </button>

                            {/* Add Column */}
                            {showAddCol ? (
                                <div className="inline-flex items-center gap-1 bg-white border border-slate-400 rounded-lg px-2 py-1 shadow-xs animate-in fade-in">
                                    <input
                                        type="text"
                                        placeholder="Column Name..."
                                        value={newColLabel}
                                        onChange={(e) => setNewColLabel(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                                        className="text-xs border-none outline-none w-32 px-1 text-slate-900 font-medium"
                                        autoFocus
                                    />
                                    <select
                                        value={newColType}
                                        onChange={(e) => setNewColType(e.target.value)}
                                        className="text-[11px] border border-slate-200 rounded px-1 py-0.5 bg-slate-50 text-slate-700"
                                    >
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="status">Status</option>
                                    </select>
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
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                                >
                                    <Columns size={14} /> Add Column
                                </button>
                            )}

                            {/* Template Selector Dropdown */}
                            <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-2xs">
                                <Layers size={13} className="text-emerald-700 shrink-0" />
                                <select
                                    value={selectedTemplateKey}
                                    onChange={(e) => handleApplyTemplate(e.target.value)}
                                    className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
                                    title="Load standard scope template"
                                >
                                    {Object.entries(INDUSTRY_TEMPLATES).map(([key, tpl]) => (
                                        <option key={key} value={key}>{tpl.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Import Excel */}
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold transition-all shadow-2xs cursor-pointer">
                                <UploadCloud size={14} className="text-emerald-700" />
                                <span>Import .xlsx</span>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleExcelImport}
                                    className="hidden"
                                />
                            </label>

                            {/* Export CSV / Spreadsheet */}
                            <button
                                type="button"
                                onClick={handleExportCSV}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold transition-all shadow-2xs cursor-pointer"
                                title="Download current sheet as CSV / Excel"
                            >
                                <Download size={14} className="text-emerald-700" />
                                <span>Export Sheet</span>
                            </button>
                        </div>

                        {/* Search & Status Filters */}
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Search cell text..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 w-36 sm:w-44 text-slate-900"
                            />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none cursor-pointer text-slate-800 font-bold"
                            >
                                <option value="ALL">All Statuses</option>
                                {STATUS_OPTIONS.map((st) => (
                                    <option key={st} value={st}>{st}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* True Excel Grid Table */}
                    <div className="overflow-x-auto max-h-[640px] scrollbar-thin bg-slate-200">
                        <table className="w-full text-xs text-left border-collapse bg-white">
                            {/* Row 1: Excel Column Letters Header (A, B, C, D...) */}
                            <thead>
                                <tr className="bg-slate-200 border-b border-slate-300 text-slate-600 select-none">
                                    <th className="w-12 text-center py-1 font-mono font-bold text-[10px] bg-slate-300 border-r border-slate-300">
                                        fx
                                    </th>
                                    {columns.map((col, colIdx) => (
                                        <th
                                            key={`letter_${col.key}`}
                                            className="px-3 py-1 text-center font-mono font-bold text-[11px] border-r border-slate-300 text-slate-600"
                                        >
                                            {getExcelColumnLetter(colIdx)}
                                        </th>
                                    ))}
                                    <th className="w-16 text-center py-1 font-mono font-bold text-[10px] text-slate-500">
                                        Act
                                    </th>
                                </tr>

                                {/* Row 2: Actual Column Titles */}
                                <tr className="bg-emerald-900 text-white font-bold sticky top-0 z-10 shadow-sm border-b border-emerald-950">
                                    <th className="px-2 py-2.5 w-12 text-center border-r border-emerald-800 font-mono text-[11px] bg-emerald-950">
                                        #
                                    </th>
                                    {columns.map((col) => (
                                        <th
                                            key={col.key}
                                            style={{ minWidth: col.width || '140px' }}
                                            className="px-3 py-2.5 border-r border-emerald-800 text-emerald-50 text-xs font-bold uppercase tracking-wider relative group"
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
                                                        className="text-emerald-300 hover:text-white"
                                                    >
                                                        <Check size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setRenamingKey(null)}
                                                        className="text-slate-300 hover:text-white"
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
                                                            className="text-emerald-200 hover:text-white p-0.5"
                                                            title="Rename column"
                                                        >
                                                            <Edit3 size={11} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteColumn(col.key)}
                                                            className="text-rose-300 hover:text-rose-100 p-0.5"
                                                            title="Delete column"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </th>
                                    ))}
                                    <th className="px-2 py-2.5 w-16 text-center text-emerald-200 font-bold text-xs bg-emerald-950">
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            {/* Table Body - Excel Cells */}
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={columns.length + 2} className="px-4 py-12 text-center text-slate-400 bg-white">
                                            No rows matching filter. Click <b>"+ Add Row"</b> or <b>"Import .xlsx"</b> to add activities.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((r, rIdx) => (
                                        <tr
                                            key={r.id || rIdx}
                                            className="hover:bg-emerald-50/30 transition-colors group"
                                        >
                                            {/* Row Number (Excel Left Index) */}
                                            <td className="px-2 py-1.5 text-center font-mono font-bold text-slate-500 bg-slate-100 border-r border-slate-300 text-[11px] select-none">
                                                {rIdx + 1}
                                            </td>

                                            {/* Dynamic Excel Cells */}
                                            {columns.map((col) => {
                                                const val = r[col.key] ?? '';
                                                const isFocused = focusedCell?.rowId === r.id && focusedCell?.colKey === col.key;
                                                return (
                                                    <td
                                                        key={col.key}
                                                        className={`p-0 border-r border-b border-slate-200 transition-all ${
                                                            isFocused ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/20' : ''
                                                        }`}
                                                    >
                                                        {col.type === 'status' ? (
                                                            <div className="p-1">
                                                                <select
                                                                    value={val || 'In Progress'}
                                                                    onFocus={() => setFocusedCell({ rowId: r.id, colKey: col.key })}
                                                                    onChange={(e) => handleCellChange(r.id, col.key, e.target.value)}
                                                                    className={`w-full px-2 py-1 rounded text-[11px] font-bold border outline-none cursor-pointer ${getStatusBadgeClass(val)}`}
                                                                >
                                                                    {STATUS_OPTIONS.map((st) => (
                                                                        <option key={st} value={st}>{st}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        ) : (
                                                            <input
                                                                type={col.type === 'number' ? 'number' : 'text'}
                                                                value={val}
                                                                onFocus={() => setFocusedCell({ rowId: r.id, colKey: col.key })}
                                                                onChange={(e) => handleCellChange(r.id, col.key, e.target.value)}
                                                                placeholder={`-`}
                                                                className={`w-full h-full px-2 py-1.5 text-xs outline-none bg-transparent ${
                                                                    col.type === 'number' ? 'font-mono text-right font-semibold text-slate-900' : 'text-slate-800'
                                                                }`}
                                                            />
                                                        )}
                                                    </td>
                                                );
                                            })}

                                            {/* Row Actions: Duplicate & Delete */}
                                            <td className="px-2 py-1 text-center bg-slate-50 border-b border-slate-200">
                                                <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDuplicateRow(r.id)}
                                                        className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                                                        title="Duplicate Row"
                                                    >
                                                        <Copy size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteRow(r.id)}
                                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                                        title="Delete Row"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}

                                {/* Excel Bottom Summary Totals Row */}
                                {rows.length > 0 && (
                                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800">
                                        <td className="px-2 py-2 text-center font-mono text-[10px] text-slate-500 bg-slate-200 border-r border-slate-300">
                                            ∑
                                        </td>
                                        {columns.map((col, idx) => {
                                            if (idx === 0) {
                                                return (
                                                    <td key={`sum_${col.key}`} className="px-3 py-2 font-bold text-xs text-slate-700 border-r border-slate-300 uppercase tracking-wider">
                                                        Total Summary
                                                    </td>
                                                );
                                            }
                                            if (col.type === 'number') {
                                                const sumVal = rows.reduce((s, r) => s + (parseFloat(r[col.key]) || 0), 0);
                                                return (
                                                    <td key={`sum_${col.key}`} className="px-2 py-2 text-right font-mono font-extrabold text-xs text-emerald-800 border-r border-slate-300">
                                                        {sumVal > 0 ? sumVal.toLocaleString() : '0'}
                                                    </td>
                                                );
                                            }
                                            return (
                                                <td key={`sum_${col.key}`} className="px-2 py-2 text-center text-slate-400 border-r border-slate-300 text-[11px]">
                                                    —
                                                </td>
                                            );
                                        })}
                                        <td className="px-2 py-2 text-center bg-slate-200 text-[10px] text-slate-500">
                                            {rows.length} rows
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Bottom Status Bar - Like Excel Status Line */}
                    <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 font-medium select-none">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                                <CheckCircle2 size={13} className="text-emerald-600" />
                                Ready
                            </span>
                            <span className="text-slate-300">|</span>
                            <span>Visible: <b>{filteredRows.length}</b> of <b>{rows.length}</b> rows</span>
                            <span className="text-slate-300">|</span>
                            <span>Columns: <b>{columns.length}</b> fields</span>
                        </div>

                        <div className="flex items-center gap-4 text-[11px]">
                            <span>Sum Target: <b>{stats.totalBoqQty.toLocaleString()}</b></span>
                            <span>Sum Today: <b>{stats.totalTodayQty.toLocaleString()}</b></span>
                            <span>Sum Completed: <b>{stats.totalCumQty.toLocaleString()}</b></span>
                            <button
                                type="button"
                                onClick={handleSaveSheet}
                                className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer transition-colors"
                            >
                                Save Changes
                            </button>
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
                                    <Link2 className="text-emerald-600" size={17} />
                                    Connect Official Google Sheet for {currentSite?.site_name || 'This Site'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Paste your Google Sheets link below. Site engineers & clients can view and edit in real-time.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowGoogleGuide(!showGoogleGuide)}
                                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 cursor-pointer"
                            >
                                <HelpCircle size={14} />
                                {showGoogleGuide ? 'Hide Instructions' : 'How to Share Google Sheet?'}
                            </button>
                        </div>

                        {/* Guide Banner */}
                        {showGoogleGuide && (
                            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1.5 animate-in fade-in">
                                <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                                    <Info size={14} className="text-emerald-700 shrink-0" />
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
                                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-emerald-600 font-mono text-slate-800"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleSaveSheet}
                                disabled={saving || !googleSheetInput.trim()}
                                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
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
                                        className="text-xs text-emerald-300 hover:text-white font-bold inline-flex items-center gap-1"
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
