import { useState } from 'react';
import { FileText, Download, Eye, Calendar, X, AlertCircle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const reportConfigs = [
    { key: 'pf', title: 'PF Report', desc: 'Provident Fund compliance report' },
    { key: 'esi', title: 'ESI Report', desc: 'Employee State Insurance report' },
    { key: 'pt', title: 'PT Report', desc: 'Professional Tax deduction report' },
    { key: 'bank-transfer', title: 'Bank Transfer', desc: 'Salary transfer statement for bank' },
    { key: 'attendance-summary', title: 'Attendance Summary', desc: 'Monthly attendance overview' },
    { key: 'overtime', title: 'Overtime Report', desc: 'Worked hours and OT calculation' },
    { key: 'department-cost', title: 'Department Cost', desc: 'Payroll cost by department' },
];

const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
];

const Reports = () => {
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [loadingKey, setLoadingKey] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [previewTitle, setPreviewTitle] = useState('');

    const fetchReport = async (key) => {
        const res = await api.get(`/reports/${key}?month=${selectedMonth}&year=${selectedYear}`);
        return res.data?.data || res.data;
    };

    const handlePreview = async (report) => {
        setLoadingKey(`preview-${report.key}`);
        try {
            const data = await fetchReport(report.key);
            setPreviewData(data);
            setPreviewTitle(report.title);
        } catch (error) {
            toast.error(error.response?.data?.message || `Failed to fetch ${report.title}`);
        } finally {
            setLoadingKey(null);
        }
    };

    const handleDownloadCSV = async (report) => {
        setLoadingKey(`download-${report.key}`);
        try {
            const data = await fetchReport(report.key);
            const rows = data.employees || data.departments || [];

            if (!rows.length) {
                toast.error('No records found for the selected period.');
                return;
            }

            // Generate CSV
            const headers = Object.keys(rows[0]);
            const csvRows = [
                headers.join(','),
                ...rows.map(row =>
                    headers.map(h => {
                        const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
                        return `"${val.replace(/"/g, '""')}"`;
                    }).join(',')
                )
            ];

            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${report.key}_report_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success(`${report.title} downloaded successfully!`);
        } catch (error) {
            toast.error(error.response?.data?.message || `Failed to download ${report.title}`);
        } finally {
            setLoadingKey(null);
        }
    };

    const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

    const previewRows = previewData ? (previewData.employees || previewData.departments || []) : [];
    const previewTotals = previewData ? (previewData.totals || previewData.grandTotals || null) : null;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {/* Header with Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Reports & Analytics</h1>
                    <p className="text-slate-500">Generate statutory and company compliance reports</p>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <Calendar size={18} className="text-slate-400 ml-1" />
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="rounded-lg border-0 bg-transparent py-1.5 text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer"
                    >
                        {months.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>

                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="rounded-lg border-0 bg-transparent py-1.5 text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer"
                    >
                        {years.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {reportConfigs.map((report) => (
                    <div
                        key={report.key}
                        className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-primary-200 hover:shadow-md transition-all group"
                    >
                        <div>
                            <div className="mb-4 inline-flex rounded-lg bg-primary-50 p-3 text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                                <FileText size={22} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 group-hover:text-primary-700 transition-colors">
                                {report.title}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">{report.desc}</p>
                        </div>

                        <div className="mt-6 flex items-center gap-2 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => handlePreview(report)}
                                disabled={loadingKey === `preview-${report.key}`}
                                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                                <Eye size={15} />
                                {loadingKey === `preview-${report.key}` ? 'Loading...' : 'Preview'}
                            </button>

                            <button
                                onClick={() => handleDownloadCSV(report)}
                                disabled={loadingKey === `download-${report.key}`}
                                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 py-2 text-xs font-semibold text-white hover:bg-primary-700 shadow-sm transition-colors disabled:opacity-50"
                            >
                                <Download size={15} />
                                {loadingKey === `download-${report.key}` ? 'Exporting...' : 'Export CSV'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Preview Modal */}
            {previewData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{previewTitle} Preview</h2>
                                <p className="text-xs text-slate-500">
                                    Period: {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                                </p>
                            </div>
                            <button
                                onClick={() => setPreviewData(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Totals Summary */}
                            {previewTotals && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    {Object.entries(previewTotals).map(([k, v]) => (
                                        <div key={k}>
                                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                                                {k.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-base font-bold text-slate-800">
                                                {typeof v === 'number' ? (k.includes('amount') || k.includes('gross') || k.includes('salary') || k.includes('pf') || k.includes('esi') || k.includes('pt') || k.includes('pay') ? `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : v) : v}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Records Table */}
                            {previewRows.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <AlertCircle size={36} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm font-medium">No records found for this period.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-lg border border-slate-200">
                                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                                        <thead className="bg-slate-50 font-semibold text-slate-700">
                                            <tr>
                                                {Object.keys(previewRows[0]).map(h => (
                                                    <th key={h} className="px-4 py-3 capitalize whitespace-nowrap">
                                                        {h.replace(/_/g, ' ')}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white text-slate-600">
                                            {previewRows.map((r, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    {Object.values(r).map((v, cIdx) => (
                                                        <td key={cIdx} className="px-4 py-2.5 whitespace-nowrap">
                                                            {v !== null && v !== undefined ? String(v) : '-'}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
                            <button
                                onClick={() => setPreviewData(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
