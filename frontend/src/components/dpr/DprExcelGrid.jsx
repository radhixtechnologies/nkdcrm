import React, { useState, useRef } from 'react';
import {
    Plus, Trash2, Upload, FileSpreadsheet,
    Edit3, Check, X, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import dprService from '../../services/dprService';
import { extractApiError } from '../../services/api';

const DEFAULT_COLUMNS = [
    { key: 'col_1', title: 'S.No', width: 60 },
    { key: 'col_2', title: 'Activity / Work Description', width: 260 },
    { key: 'col_3', title: 'Location / Grid / Room', width: 150 },
    { key: 'col_4', title: 'Planned Qty', width: 100 },
    { key: 'col_5', title: 'Executed Qty', width: 100 },
    { key: 'col_6', title: 'Unit', width: 80 },
    { key: 'col_7', title: 'Status', width: 120 },
    { key: 'col_8', title: 'Responsible / Remarks', width: 180 }
];

const createEmptyRow = (columns, rowIdx = 1) => {
    const row = { id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` };
    columns.forEach((col) => {
        if (col.key === 'col_1' || col.title?.toLowerCase().includes('s.no') || col.title?.toLowerCase() === 'sr no') {
            row[col.key] = String(rowIdx);
        } else {
            row[col.key] = '';
        }
    });
    return row;
};

const DprExcelGrid = ({
    value,
    onChange,
    readOnly = false
}) => {
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [editingColKey, setEditingColKey] = useState(null);
    const [editingColTitle, setEditingColTitle] = useState('');
    const [newColTitle, setNewColTitle] = useState('');
    const [showAddColInput, setShowAddColInput] = useState(false);

    // Ensure valid grid data
    const gridData = value && typeof value === 'object' && Array.isArray(value.columns)
        ? value
        : { columns: DEFAULT_COLUMNS, rows: [createEmptyRow(DEFAULT_COLUMNS, 1)] };

    const columns = gridData.columns.length > 0 ? gridData.columns : DEFAULT_COLUMNS;
    const rows = Array.isArray(gridData.rows) ? gridData.rows : [];

    const updateGrid = (newCols, newRows) => {
        if (onChange) {
            onChange({
                columns: newCols,
                rows: newRows
            });
        }
    };

    // Cell value change
    const handleCellChange = (rowIdx, colKey, val) => {
        const nextRows = [...rows];
        nextRows[rowIdx] = {
            ...nextRows[rowIdx],
            [colKey]: val
        };
        updateGrid(columns, nextRows);
    };

    // Add Row
    const handleAddRow = () => {
        const nextRowIdx = rows.length + 1;
        const newRow = createEmptyRow(columns, nextRowIdx);
        updateGrid(columns, [...rows, newRow]);
    };

    // Delete Row
    const handleDeleteRow = (rowIdx) => {
        if (rows.length <= 1) {
            // Keep at least one empty row
            updateGrid(columns, [createEmptyRow(columns, 1)]);
            return;
        }
        const nextRows = rows.filter((_, idx) => idx !== rowIdx);
        // Re-number S.No if first column is S.No
        const firstColKey = columns[0]?.key;
        if (firstColKey && (columns[0].title?.toLowerCase().includes('s.no') || columns[0].title?.toLowerCase() === 'sr no')) {
            nextRows.forEach((r, idx) => {
                r[firstColKey] = String(idx + 1);
            });
        }
        updateGrid(columns, nextRows);
    };

    // Add Column
    const handleAddColumn = () => {
        const title = newColTitle.trim();
        if (!title) return;
        const newKey = `col_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        const newCol = {
            key: newKey,
            title,
            width: Math.max(120, Math.min(260, title.length * 12))
        };
        const nextCols = [...columns, newCol];
        const nextRows = rows.map((r) => ({ ...r, [newKey]: '' }));
        updateGrid(nextCols, nextRows);
        setNewColTitle('');
        setShowAddColInput(false);
        toast.success(`Column "${title}" added!`);
    };

    // Rename Column
    const handleSaveRenameCol = (key) => {
        const title = editingColTitle.trim();
        if (!title) {
            setEditingColKey(null);
            return;
        }
        const nextCols = columns.map((c) => (c.key === key ? { ...c, title } : c));
        updateGrid(nextCols, rows);
        setEditingColKey(null);
        setEditingColTitle('');
    };

    // Delete Column
    const handleDeleteColumn = (colKey) => {
        if (columns.length <= 1) {
            toast.error('At least one column is required in the sheet');
            return;
        }
        const colToDelete = columns.find((c) => c.key === colKey);
        if (!window.confirm(`Delete column "${colToDelete?.title || 'this column'}"?`)) return;

        const nextCols = columns.filter((c) => c.key !== colKey);
        const nextRows = rows.map((r) => {
            const copy = { ...r };
            delete copy[colKey];
            return copy;
        });
        updateGrid(nextCols, nextRows);
        toast.success('Column removed');
    };

    // Reset to Default Template
    const handleResetDefault = () => {
        if (!window.confirm('Reset sheet to default columns and rows? Current table data will be replaced.')) return;
        updateGrid(DEFAULT_COLUMNS, [
            createEmptyRow(DEFAULT_COLUMNS, 1),
            createEmptyRow(DEFAULT_COLUMNS, 2)
        ]);
        toast.success('Reset to default sheet template');
    };

    // Import from Excel file (.xlsx)
    const handleImportExcel = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);

        try {
            setImporting(true);
            const res = await dprService.importExcelGrid(formData);
            const data = res.data?.data || res.data;
            if (data && Array.isArray(data.columns) && data.columns.length > 0) {
                updateGrid(data.columns, Array.isArray(data.rows) && data.rows.length > 0 ? data.rows : [createEmptyRow(data.columns, 1)]);
                toast.success(`Successfully imported ${data.columns.length} columns and ${data.rows?.length || 0} rows from Excel!`);
            } else {
                toast.error('Could not extract valid columns from the uploaded Excel sheet');
            }
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to import Excel sheet'));
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-3">
            {/* Toolbar */}
            {!readOnly && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Add Row Button */}
                        <button
                            type="button"
                            onClick={handleAddRow}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
                        >
                            <Plus size={14} /> Add Row
                        </button>

                        {/* Add Column Button / Input */}
                        {showAddColInput ? (
                            <div className="inline-flex items-center gap-1 bg-white p-1 rounded-lg border border-primary-400 shadow-2xs">
                                <input
                                    type="text"
                                    value={newColTitle}
                                    onChange={(e) => setNewColTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddColumn();
                                        } else if (e.key === 'Escape') {
                                            setShowAddColInput(false);
                                        }
                                    }}
                                    placeholder="Column Name (e.g. Unit, Qty, Remarks)"
                                    className="text-xs px-2 py-1 outline-none text-slate-800 w-44 font-medium"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={handleAddColumn}
                                    className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                    title="Add"
                                >
                                    <Check size={13} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddColInput(false)}
                                    className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300"
                                    title="Cancel"
                                >
                                    <X size={13} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowAddColInput(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                            >
                                <Plus size={14} /> Add Column
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Import Excel Button */}
                        <label
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer ${
                                importing ? 'opacity-50 pointer-events-none' : ''
                            }`}
                        >
                            <Upload size={14} />
                            {importing ? 'Importing...' : 'Import from Excel (.xlsx)'}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleImportExcel}
                                className="hidden"
                                disabled={importing}
                            />
                        </label>

                        {/* Reset / Default Template */}
                        <button
                            type="button"
                            onClick={handleResetDefault}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 text-xs font-semibold"
                            title="Reset to default columns"
                        >
                            <RefreshCw size={13} /> Default Grid
                        </button>
                    </div>
                </div>
            )}

            {/* Interactive Grid Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="overflow-x-auto max-h-[480px]">
                    <table className="w-full text-xs text-left border-collapse">
                        {/* Column Headers */}
                        <thead className="bg-slate-900 text-white sticky top-0 z-10 select-none">
                            <tr>
                                <th className="px-2 py-2.5 text-center font-bold text-slate-400 w-10 border-r border-slate-800">
                                    #
                                </th>
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        style={{ minWidth: `${col.width || 120}px` }}
                                        className="px-3 py-2.5 font-bold tracking-wide border-r border-slate-800 group relative"
                                    >
                                        {editingColKey === col.key && !readOnly ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="text"
                                                    value={editingColTitle}
                                                    onChange={(e) => setEditingColTitle(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveRenameCol(col.key);
                                                        if (e.key === 'Escape') setEditingColKey(null);
                                                    }}
                                                    className="text-xs px-1.5 py-0.5 rounded bg-white text-slate-900 font-bold w-full outline-none"
                                                    autoFocus
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveRenameCol(col.key)}
                                                    className="p-1 rounded bg-emerald-600 hover:bg-emerald-700"
                                                >
                                                    <Check size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingColKey(null)}
                                                    className="p-1 rounded bg-slate-700 hover:bg-slate-600"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between gap-1.5">
                                                <span
                                                    className="truncate cursor-pointer hover:text-primary-300"
                                                    title={!readOnly ? 'Click to rename column' : col.title}
                                                    onClick={() => {
                                                        if (readOnly) return;
                                                        setEditingColKey(col.key);
                                                        setEditingColTitle(col.title);
                                                    }}
                                                >
                                                    {col.title}
                                                </span>
                                                {!readOnly && (
                                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingColKey(col.key);
                                                                setEditingColTitle(col.title);
                                                            }}
                                                            className="p-0.5 text-slate-400 hover:text-white"
                                                            title="Rename Column"
                                                        >
                                                            <Edit3 size={11} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteColumn(col.key)}
                                                            className="p-0.5 text-slate-400 hover:text-rose-400"
                                                            title="Delete Column"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </th>
                                ))}
                                {!readOnly && (
                                    <th className="px-2 py-2.5 text-center font-bold text-slate-400 w-12">
                                        Action
                                    </th>
                                )}
                            </tr>
                        </thead>

                        {/* Rows */}
                        <tbody className="divide-y divide-slate-200">
                            {rows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={columns.length + (readOnly ? 1 : 2)}
                                        className="py-10 text-center text-slate-400 italic"
                                    >
                                        No rows in sheet. Click "+ Add Row" or "Import from Excel" above.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row, rIdx) => (
                                    <tr
                                        key={row.id || rIdx}
                                        className={`hover:bg-slate-50 transition-colors ${
                                            rIdx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                                        }`}
                                    >
                                        {/* Row Index */}
                                        <td className="px-2 py-1.5 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200 bg-slate-50/80">
                                            {rIdx + 1}
                                        </td>

                                        {/* Dynamic Cells */}
                                        {columns.map((col) => (
                                            <td key={col.key} className="px-2 py-1 border-r border-slate-200">
                                                {readOnly ? (
                                                    <div className="py-1 text-slate-800 font-medium whitespace-pre-wrap">
                                                        {row[col.key] || '—'}
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={row[col.key] ?? ''}
                                                        onChange={(e) => handleCellChange(rIdx, col.key, e.target.value)}
                                                        placeholder="—"
                                                        className="w-full text-xs font-medium text-slate-800 px-2 py-1 bg-transparent hover:bg-white focus:bg-white rounded border border-transparent hover:border-slate-300 focus:border-primary-500 outline-none transition-colors"
                                                    />
                                                )}
                                            </td>
                                        ))}

                                        {/* Row Action (Delete) */}
                                        {!readOnly && (
                                            <td className="px-2 py-1 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteRow(rIdx)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                                    title="Delete Row"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Status Bar */}
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                        <FileSpreadsheet size={14} className="text-emerald-600" />
                        Custom Excel Sheet: <strong>{columns.length} columns</strong> × <strong>{rows.length} rows</strong>
                    </span>
                    <span className="text-[11px] text-slate-400">
                        {readOnly
                            ? 'Auto-embedded in PDF & Excel downloads'
                            : 'Click "+ Add Column" or "+ Add Row" to customize structure'}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default DprExcelGrid;
