import React, { useState, useEffect, useCallback } from 'react';
import {
    DollarSign, CheckCircle, FileText,
    Download, CheckSquare, Square, RefreshCw, GitBranch
} from 'lucide-react';
import toast from 'react-hot-toast';
import payrollService from '../services/payrollService';
import { useAuth } from '../context/AuthContext';
import WorkflowFlowchart from '../components/charts/WorkflowFlowchart';

const Payroll = () => {
    const { user } = useAuth();
    const isEmployee = user?.roleCode === 'EMPLOYEE' || user?.role?.roleCode === 'EMPLOYEE' || user?.role === 'EMPLOYEE';

    // Shared State
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);

    // Admin State
    const [month, setMonth] = useState(new Date().getMonth()); // 0-indexed for UI logic
    const [payrollList, setPayrollList] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);

    // Employee State
    const [myHistory, setMyHistory] = useState([]);

    // Detail Modal State (must be top level to satisfy React hook rules)
    const [viewPayroll, setViewPayroll] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showFlowchart, setShowFlowchart] = useState(false);

    // Month Names
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Fetch Data Logic
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            if (isEmployee) {
                const res = await payrollService.getMyPayrollHistory(year);
                setMyHistory(res.data.data || []);
            } else {
                const res = await payrollService.getPayrollList(month + 1, year);
                setPayrollList(res.data.data || []);
                setSelectedRows([]);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load payroll data");
        } finally {
            setLoading(false);
        }
    }, [isEmployee, month, year]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Admin Actions
    const handleGenerate = async () => {
        const toastId = toast.loading("Calculating Payroll...");
        try {
            await payrollService.generatePayroll(month + 1, year);
            toast.success("Payroll Generated Successfully", { id: toastId });
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.message || "Generation Failed", { id: toastId });
        }
    };

    const handleFinalize = async () => {
        if (selectedRows.length === 0) return toast.error("Select rows to finalize");
        if (!window.confirm(`Finalize ${selectedRows.length} employees? This cannot be undone.`)) return;

        const toastId = toast.loading("Finalizing...");
        try {
            await payrollService.finalizePayroll(selectedRows);
            toast.success("Payroll Finalized", { id: toastId });
            loadData();
        } catch (err) {
            console.error(err);
            toast.error("Finalization Failed", { id: toastId });
        }
    };

    // Selection Logic (Admin)
    const toggleSelectAll = () => {
        if (selectedRows.length === payrollList.length) {
            setSelectedRows([]);
        } else {
            setSelectedRows(payrollList.map(p => p.payroll_id));
        }
    };

    const toggleSelectRow = (id) => {
        if (selectedRows.includes(id)) {
            setSelectedRows(selectedRows.filter(r => r !== id));
        } else {
            setSelectedRows([...selectedRows, id]);
        }
    };

    const handleViewDetail = async (id) => {
        const toastId = toast.loading("Loading details...");
        try {
            const res = await payrollService.getPayrollDetail(id);
            if (res.data.success) {
                setViewPayroll(res.data.data);
                setShowDetailModal(true);
                toast.dismiss(toastId);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load details", { id: toastId });
        }
    };

    // Render Employee View
    if (isEmployee) {
        return (
            <div className="space-y-6 max-w-5xl mx-auto pb-20">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <DollarSign className="text-green-600" /> My Payslips
                        </h1>
                        <p className="text-slate-500">View and download your salary slips</p>
                    </div>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="bg-white border border-slate-200 rounded-lg p-2 text-sm font-medium shadow-sm outline-none cursor-pointer"
                    >
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                            <tr>
                                <th className="px-6 py-4">Period</th>
                                <th className="px-6 py-4 text-right">Gross Earnings</th>
                                <th className="px-6 py-4 text-right text-red-500">Deductions</th>
                                <th className="px-6 py-4 text-right font-bold text-slate-800">Net Salary</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Download</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="6" className="p-8 text-center text-slate-400">Loading...</td></tr>
                            ) : myHistory.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-slate-400">No payslips found for {year}</td></tr>
                            ) : myHistory.map((p) => (
                                <tr key={p.payroll_id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                        {months[p.month - 1]} {p.year}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-slate-600">
                                        ₹ {parseFloat(p.gross_earnings).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-red-500">
                                        - ₹ {parseFloat(p.total_deductions).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-green-700 bg-green-50/50">
                                        ₹ {parseFloat(p.net_salary).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold 
                                            ${p.payment_status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {p.payment_status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => payrollService.downloadPayslip(p.payroll_id)}
                                            className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 justify-end transition-colors"
                                        >
                                            <Download size={16} /> Payslip
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Render Admin View
    const totalPayout = payrollList.reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0);
    const totalPF = payrollList.reduce((sum, p) => sum + parseFloat(p.pf_employee || 0) + parseFloat(p.pf_employer || 0), 0);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <DollarSign className="text-green-600" /> Payroll Management
                    </h1>
                    <p className="text-slate-500">Calculate, Review, and Process Employee Salaries</p>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap gap-2.5 items-center bg-white p-2.5 rounded-2xl shadow-xs border border-slate-200/80">
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="bg-slate-50 font-semibold text-slate-700 outline-none cursor-pointer text-xs rounded-xl px-3 py-2 border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                        {months.map((m, i) => (
                            <option key={i} value={i}>{m}</option>
                        ))}
                    </select>

                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="bg-slate-50 font-semibold text-slate-700 outline-none cursor-pointer text-xs rounded-xl px-3 py-2 border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                        {[2024, 2025, 2026, 2027].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>

                    <button
                        onClick={handleGenerate}
                        className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md hover:shadow-primary-500/20 btn-press"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Generate
                    </button>

                    <button
                        onClick={() => payrollService.downloadExcel(month + 1, year)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md hover:shadow-emerald-500/20 btn-press"
                        title="Export to Excel"
                    >
                        <Download size={14} /> Export
                    </button>

                    <button
                        onClick={() => setShowFlowchart(!showFlowchart)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border shadow-xs btn-press ${showFlowchart ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                        title="Toggle Process Flowchart"
                    >
                        <GitBranch size={14} /> Flowchart
                    </button>
                </div>
            </div>

            {/* Optional Flowchart Drawer */}
            {showFlowchart && (
                <div className="animate-in fade-in duration-300">
                    <WorkflowFlowchart defaultWorkflow="payroll" allowSwitch={false} />
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card-hover-effect bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Net Payout</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">₹ {totalPayout.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Disbursed to staff bank accounts</div>
                </div>
                <div className="card-hover-effect bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Statutory PF Pool</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">₹ {totalPF.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Combined Employer + Employee</div>
                </div>
                <div className="card-hover-effect bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Batch Status</div>
                        <div className="text-lg font-bold text-slate-800 mt-1">
                            {payrollList.length === 0 ? "Not Generated" :
                                payrollList.some(p => p.payment_status === 'PENDING') ? "Draft / Pending" : "Finalized"}
                        </div>
                    </div>
                    {/* Finalize Button for Pending items */}
                    {selectedRows.length > 0 && (
                        <button
                            onClick={handleFinalize}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:shadow-lg hover:shadow-emerald-500/25 btn-press transition-all animate-scale-in"
                        >
                            Finalize ({selectedRows.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Payroll Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600">
                                        {selectedRows.length === payrollList.length && payrollList.length > 0 ?
                                            <CheckSquare size={18} /> : <Square size={18} />}
                                    </button>
                                </th>
                                <th className="px-4 py-3">Employee</th>
                                <th className="px-4 py-3 text-right">Basic + DA</th>
                                <th className="px-4 py-3 text-right">Allowances</th>
                                <th className="px-4 py-3 text-right">Gross Earned</th>
                                <th className="px-4 py-3 text-right text-red-500">Deductions (PF/ESI/PT)</th>
                                <th className="px-4 py-3 text-right font-bold text-slate-800">Net Salary</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="9" className="p-8 text-center text-slate-500">Loading payroll data...</td></tr>
                            ) : payrollList.length === 0 ? (
                                <tr><td colSpan="9" className="p-12 text-center text-slate-400">
                                    No payroll records found for {months[month]} {year}.<br />Click "Generate Payroll" to calculate.
                                </td></tr>
                            ) : payrollList.map((row) => (
                                <tr key={row.payroll_id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => toggleSelectRow(row.payroll_id)}
                                            className={`${selectedRows.includes(row.payroll_id) ? 'text-primary-600' : 'text-slate-300 hover:text-slate-500'}`}
                                        >
                                            {selectedRows.includes(row.payroll_id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-900">{row.full_name}</div>
                                        <div className="text-xs text-slate-500">{row.employee_code} • {row.designation}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                                        ₹ {parseFloat(row.basic_earned).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                                        ₹ {(parseFloat(row.hra_earned) + parseFloat(row.conveyance_earned) + parseFloat(row.special_allowance_earned)).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                                        ₹ {parseFloat(row.gross_earnings).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-red-600">
                                        - ₹ {parseFloat(row.total_deductions).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700 bg-green-50/50">
                                        ₹ {parseFloat(row.net_salary).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold 
                                            ${row.payment_status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {row.payment_status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                                        <button
                                            onClick={() => handleViewDetail(row.payroll_id)}
                                            className="text-slate-400 hover:text-primary-600 p-1 transition-colors"
                                            title="View Details"
                                        >
                                            <FileText size={18} />
                                        </button>
                                        <button
                                            onClick={() => payrollService.downloadPayslip(row.payroll_id)}
                                            className="text-slate-400 hover:text-primary-600 p-1 transition-colors"
                                            title="Download Payslip"
                                        >
                                            <Download size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* View Detail Modal */}
            {showDetailModal && viewPayroll && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Payroll Detail View</h2>
                                <p className="text-sm text-slate-500">
                                    {months[viewPayroll.month - 1]} {viewPayroll.year} • {viewPayroll.full_name} ({viewPayroll.employee_code})
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Attendance Summary Section */}
                            <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                                <h3 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                                    <CheckCircle size={16} /> Attendance Summary
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div className="bg-white p-3 rounded-lg border border-indigo-100 text-center">
                                        <div className="text-slate-500 text-xs uppercase tracking-wider">Total Days</div>
                                        <div className="text-lg font-bold text-slate-800">{viewPayroll.total_days || '-'}</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-indigo-100 text-center">
                                        <div className="text-slate-500 text-xs uppercase tracking-wider">Present</div>
                                        <div className="text-lg font-bold text-green-600">{viewPayroll.present_days || '0'}</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-indigo-100 text-center">
                                        <div className="text-slate-500 text-xs uppercase tracking-wider">Absent</div>
                                        <div className="text-lg font-bold text-red-500">{viewPayroll.absent_days || '0'}</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-indigo-100 text-center">
                                        <div className="text-slate-500 text-xs uppercase tracking-wider">Leaves</div>
                                        <div className="text-lg font-bold text-orange-500">{viewPayroll.leave_days || '0'}</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-indigo-100 text-center">
                                        <div className="text-slate-500 text-xs uppercase tracking-wider">Weekly Offs</div>
                                        <div className="text-lg font-bold text-slate-600">{viewPayroll.weekly_off_days || '0'}</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-indigo-100 text-center">
                                        <div className="text-slate-500 text-xs uppercase tracking-wider">Half Days</div>
                                        <div className="text-lg font-bold text-yellow-600">{viewPayroll.half_days || '0'}</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-indigo-100 text-center col-span-2">
                                        <div className="text-slate-500 text-xs uppercase tracking-wider">Overtime Hours</div>
                                        <div className="text-lg font-bold text-primary-600">{viewPayroll.overtime_hours || '0'} hrs</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Earnings */}
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-slate-700">Earnings</div>
                                    <div className="p-4 space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Basic Salary</span>
                                            <span className="font-mono font-medium">₹ {parseFloat(viewPayroll.basic_earned).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">HRA</span>
                                            <span className="font-mono font-medium">₹ {parseFloat(viewPayroll.hra_earned).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Conveyance</span>
                                            <span className="font-mono font-medium">₹ {parseFloat(viewPayroll.conveyance_earned).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Special Allowance</span>
                                            <span className="font-mono font-medium">₹ {parseFloat(viewPayroll.special_allowance_earned).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Other Allowance</span>
                                            <span className="font-mono font-medium">₹ {parseFloat(viewPayroll.other_allowance_earned).toLocaleString('en-IN')}</span>
                                        </div>
                                        {parseFloat(viewPayroll.overtime_amount) > 0 && (
                                            <div className="flex justify-between text-indigo-600 bg-indigo-50 -mx-4 px-4 py-1">
                                                <span>Overtime Pay</span>
                                                <span className="font-mono font-medium">₹ {parseFloat(viewPayroll.overtime_amount).toLocaleString('en-IN')}</span>
                                            </div>
                                        )}
                                        <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between font-bold text-slate-800">
                                            <span>Total Earnings</span>
                                            <span>₹ {parseFloat(viewPayroll.gross_earnings).toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Deductions */}
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="bg-red-50 px-4 py-3 border-b border-slate-200 font-bold text-red-700">Deductions</div>
                                    <div className="p-4 space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Provident Fund (PF)</span>
                                            <span className="font-mono font-medium">₹ {parseFloat(viewPayroll.pf_employee).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">ESI (Employee)</span>
                                            <span className="font-mono font-medium">₹ {parseFloat(viewPayroll.esi_employee).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Professional Tax</span>
                                            <span className="font-mono font-medium">₹ {parseFloat(viewPayroll.professional_tax).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">TDS / Income Tax</span>
                                            <span className="font-mono font-medium">₹ {parseFloat(viewPayroll.tds).toLocaleString('en-IN')}</span>
                                        </div>
                                        {parseFloat(viewPayroll.advance_deduction) > 0 && (
                                            <div className="flex justify-between text-orange-600">
                                                <span>Salary Advance</span>
                                                <span className="font-mono font-medium">₹ {parseFloat(viewPayroll.advance_deduction).toLocaleString('en-IN')}</span>
                                            </div>
                                        )}
                                        <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between font-bold text-red-600">
                                            <span>Total Deductions</span>
                                            <span>₹ {parseFloat(viewPayroll.total_deductions).toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Net Pay */}
                            <div className="bg-green-50 p-6 rounded-xl border border-green-200 text-center">
                                <div className="text-green-800 font-medium mb-1">Net Salary Payable</div>
                                <div className="text-4xl font-bold text-green-700">₹ {parseFloat(viewPayroll.net_salary).toLocaleString('en-IN')}</div>
                                <div className="text-sm text-green-600 mt-2 font-medium bg-white/50 inline-block px-3 py-1 rounded-full border border-green-100">
                                    {Number(parseFloat(viewPayroll.net_salary).toFixed(2)).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                                </div>
                            </div>

                            {/* Employer Contribution (Info Only) */}
                            <div className="text-xs text-slate-400 text-center">
                                Employer PF: ₹ {parseFloat(viewPayroll.pf_employer).toLocaleString('en-IN')} •
                                Employer ESI: ₹ {parseFloat(viewPayroll.esi_employer).toLocaleString('en-IN')}
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 bg-white z-10 rounded-b-2xl">
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => payrollService.downloadPayslip(viewPayroll.payroll_id)}
                                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition-colors"
                            >
                                <Download size={16} /> Download Payslip
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Payroll;
