import React, { useState, useEffect, useCallback } from 'react';
import {
    DollarSign, CheckCircle, FileText,
    Download, CheckSquare, Square, RefreshCw, GitBranch
} from 'lucide-react';
import toast from 'react-hot-toast';
import payrollService from '../services/payrollService';
import { extractApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import WorkflowFlowchart from '../components/charts/WorkflowFlowchart';
import ModalPortal from '../components/common/ModalPortal';

const numVal = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

const fmtINR = (v) => numVal(v).toLocaleString('en-IN');

const Payroll = () => {
    const { getRoleCode, hasPermission } = useAuth();
    const isEmployee = getRoleCode() === 'EMPLOYEE';
    const canGenerate = hasPermission('PAYROLL', 'can_create');
    const canFinalize = hasPermission('PAYROLL', 'can_approve');
    const canExport = hasPermission('PAYROLL', 'can_create') || hasPermission('PAYROLL', 'can_update') || hasPermission('PAYROLL', 'can_approve');

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
                setMyHistory(res.data?.data || []);
            } else {
                const res = await payrollService.getPayrollList(month + 1, year);
                setPayrollList(res.data?.data || []);
                setSelectedRows([]);
            }
        } catch (err) {
            console.error(err);
            toast.error(extractApiError(err, "Failed to load payroll data"));
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
            toast.error(extractApiError(err, "Generation Failed"), { id: toastId });
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
            toast.error(extractApiError(err, "Finalization Failed"), { id: toastId });
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
            if (res.data?.success) {
                setViewPayroll(res.data.data);
                setShowDetailModal(true);
                toast.dismiss(toastId);
            }
        } catch (err) {
            console.error(err);
            toast.error(extractApiError(err, "Failed to load details"), { id: toastId });
        }
    };

    // Render Employee View
    if (isEmployee) {
        return (
            <div className="space-y-6 max-w-5xl mx-auto pb-20">
                <div className="flex flex-wrap justify-between items-center gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <DollarSign className="text-green-600" /> My Payslips
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500">View and download your salary slips</p>
                    </div>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value, 10))}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium shadow-sm outline-none cursor-pointer"
                    >
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
                    ) : myHistory.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">No payslips found for {year}</div>
                    ) : (
                        <>
                            {/* Mobile Card View */}
                            <div className="block md:hidden divide-y divide-slate-100">
                                {myHistory.map((p) => (
                                    <div key={p.payroll_id} className="p-4 space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="font-bold text-slate-900 text-sm">
                                                {months[(p.month || 1) - 1]} {p.year}
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold 
                                                ${p.payment_status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {p.payment_status}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg">
                                            <div>
                                                <div className="text-[10px] text-slate-400">Gross</div>
                                                <div className="font-mono font-medium text-slate-700">₹ {fmtINR(p.gross_earnings)}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-400">Deductions</div>
                                                <div className="font-mono font-medium text-red-500">- ₹ {fmtINR(p.total_deductions)}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-400">Net Salary</div>
                                                <div className="font-mono font-bold text-green-700">₹ {fmtINR(p.net_salary)}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => payrollService.downloadPayslip(p.payroll_id)}
                                            className="w-full py-2 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                                        >
                                            <Download size={14} /> Download Payslip PDF
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
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
                                        {myHistory.map((p) => (
                                            <tr key={p.payroll_id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-900">
                                                    {months[(p.month || 1) - 1]} {p.year}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-slate-600">
                                                    ₹ {fmtINR(p.gross_earnings)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-red-500">
                                                    - ₹ {fmtINR(p.total_deductions)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-green-700 bg-green-50/50">
                                                    ₹ {fmtINR(p.net_salary)}
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
                                                        className="text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 transition-colors"
                                                    >
                                                        <Download size={16} /> Payslip
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Render Admin View
    const totalGross = payrollList.reduce((sum, p) => sum + numVal(p.gross_earnings), 0);
    const totalPayout = payrollList.reduce((sum, p) => sum + numVal(p.net_salary), 0);
    const totalPF = payrollList.reduce((sum, p) => sum + numVal(p.pf_employee) + numVal(p.pf_employer), 0);
    const totalESI = payrollList.reduce((sum, p) => sum + numVal(p.esi_employee) + numVal(p.esi_employer), 0);
    const totalAdvance = payrollList.reduce((sum, p) => sum + numVal(p.advance_deduction), 0);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <DollarSign className="text-green-600" /> Payroll Management
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500">Calculate, Review, and Process Employee Salaries</p>
                </div>

                {/* Controls */}
                <div className="w-full md:w-auto flex flex-wrap gap-2 items-center bg-white p-2.5 rounded-2xl shadow-xs border border-slate-200/80">
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                        className="bg-slate-50 font-semibold text-slate-700 outline-none cursor-pointer text-xs rounded-xl px-3 py-2 border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                        {months.map((m, i) => (
                            <option key={i} value={i}>{m}</option>
                        ))}
                    </select>

                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value, 10))}
                        className="bg-slate-50 font-semibold text-slate-700 outline-none cursor-pointer text-xs rounded-xl px-3 py-2 border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                        {[2024, 2025, 2026, 2027].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>

                    {canGenerate && (
                        <button
                            onClick={handleGenerate}
                            className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md hover:shadow-primary-500/20 btn-press"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Generate
                        </button>
                    )}

                    {canExport && (
                        <>
                            <button
                                onClick={() => payrollService.downloadExcel(month + 1, year)}
                                className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs btn-press"
                                title="Export Standard Payroll Summary"
                            >
                                <Download size={13} /> Summary
                            </button>
                            <button
                                onClick={() => payrollService.downloadClientWageSheet(month + 1, year)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md hover:shadow-indigo-500/20 btn-press"
                                title="Export Client Wage Register (Form XVII / NTPC Korba Format)"
                            >
                                <FileText size={13} /> Client Wage Sheet (Form XVII)
                            </button>
                            <button
                                onClick={() => payrollService.downloadBankNeft(month + 1, year)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md hover:shadow-emerald-500/20 btn-press"
                                title="Export Bank NEFT Disbursal Sheet"
                            >
                                <Download size={13} /> Bank NEFT
                            </button>
                        </>
                    )}

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card-hover-effect bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Gross Earnings</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">₹ {totalGross.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Earned Basic + Allowances + OT</div>
                </div>
                <div className="card-hover-effect bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Statutory Pool (PF + ESI)</div>
                    <div className="text-2xl font-bold text-indigo-700 mt-1">₹ {(totalPF + totalESI).toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">PF ₹{totalPF.toLocaleString('en-IN')} | ESI ₹{totalESI.toLocaleString('en-IN')}</div>
                </div>
                <div className="card-hover-effect bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Site Advances Deducted</div>
                    <div className="text-2xl font-bold text-amber-600 mt-1">₹ {totalAdvance.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Cash / mid-month site advances</div>
                </div>
                <div className="card-hover-effect bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Final Bank Disbursal</div>
                    <div className="text-2xl font-bold text-emerald-600 mt-1">₹ {totalPayout.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Net transferable to bank accounts</div>
                </div>
            </div>

            {/* Payroll List / Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500 text-sm">Loading payroll data...</div>
                ) : payrollList.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">
                        No payroll records found for {months[month]} {year}.
                        {canGenerate && <><br />Click &quot;Generate&quot; to calculate.</>}
                    </div>
                ) : (
                    <>
                        {/* Mobile Cards View */}
                        <div className="block md:hidden divide-y divide-slate-100">
                            {payrollList.map((row) => (
                                <div key={row.payroll_id} className="p-4 space-y-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            {canFinalize && (
                                                <button
                                                    onClick={() => toggleSelectRow(row.payroll_id)}
                                                    className={`mt-0.5 ${selectedRows.includes(row.payroll_id) ? 'text-primary-600' : 'text-slate-300'}`}
                                                >
                                                    {selectedRows.includes(row.payroll_id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                                </button>
                                            )}
                                            <div className="min-w-0">
                                                <div className="font-bold text-slate-900 text-sm truncate">{row.full_name}</div>
                                                <div className="text-xs text-slate-500 truncate">{row.employee_code} • {row.designation || 'Staff'}</div>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0
                                            ${row.payment_status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {row.payment_status}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg">
                                        <div>
                                            <div className="text-[10px] text-slate-400">Gross</div>
                                            <div className="font-mono font-medium text-slate-700">₹ {fmtINR(row.gross_earnings)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400">Statutory (PF+ESI)</div>
                                            <div className="font-mono font-medium text-red-600">- ₹ {fmtINR(numVal(row.pf_employee) + numVal(row.esi_employee) + numVal(row.professional_tax))}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400">Site Advance</div>
                                            <div className="font-mono font-medium text-amber-600">{numVal(row.advance_deduction) > 0 ? `- ₹ ${fmtINR(row.advance_deduction)}` : '₹ 0'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400">Final Payout</div>
                                            <div className="font-mono font-bold text-green-700">₹ {fmtINR(row.net_salary)}</div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleViewDetail(row.payroll_id)}
                                            className="flex-1 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 hover:bg-slate-50"
                                        >
                                            <FileText size={14} /> Details
                                        </button>
                                        <button
                                            onClick={() => payrollService.downloadPayslip(row.payroll_id)}
                                            className="flex-1 py-1.5 rounded-lg bg-primary-50 text-primary-700 text-xs font-semibold flex items-center justify-center gap-1 hover:bg-primary-100"
                                        >
                                            <Download size={14} /> Payslip
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-medium">
                                    <tr>
                                        {canFinalize && (
                                            <th className="px-4 py-3 w-10">
                                                <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600">
                                                    {selectedRows.length === payrollList.length && payrollList.length > 0 ?
                                                        <CheckSquare size={18} /> : <Square size={18} />}
                                                </button>
                                            </th>
                                        )}
                                        <th className="px-4 py-3">Employee</th>
                                        <th className="px-4 py-3 text-right">Basic + DA</th>
                                        <th className="px-4 py-3 text-right">Allowances</th>
                                        <th className="px-4 py-3 text-right">Gross Earned</th>
                                        <th className="px-4 py-3 text-right text-red-500">Statutory (PF+ESI)</th>
                                        <th className="px-4 py-3 text-right text-amber-600">Site Advance</th>
                                        <th className="px-4 py-3 text-right font-bold text-slate-800">Final Payout</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {payrollList.map((row) => (
                                        <tr key={row.payroll_id} className="hover:bg-slate-50 transition-colors">
                                            {canFinalize && (
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => toggleSelectRow(row.payroll_id)}
                                                        className={`${selectedRows.includes(row.payroll_id) ? 'text-primary-600' : 'text-slate-300 hover:text-slate-500'}`}
                                                    >
                                                        {selectedRows.includes(row.payroll_id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                                    </button>
                                                </td>
                                            )}
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-900">{row.full_name}</div>
                                                <div className="text-xs text-slate-500">{row.employee_code} • {row.designation}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-600">
                                                ₹ {fmtINR(row.basic_earned)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-600">
                                                ₹ {(numVal(row.hra_earned) + numVal(row.conveyance_earned) + numVal(row.special_allowance_earned) + numVal(row.other_allowance_earned)).toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                                                ₹ {fmtINR(row.gross_earnings)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-red-600">
                                                - ₹ {fmtINR(numVal(row.pf_employee) + numVal(row.esi_employee) + numVal(row.professional_tax))}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-amber-600">
                                                {numVal(row.advance_deduction) > 0 ? `- ₹ ${fmtINR(row.advance_deduction)}` : '₹ 0'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-green-700 bg-green-50/50">
                                                ₹ {fmtINR(row.net_salary)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold 
                                                    ${row.payment_status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {row.payment_status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
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
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* View Detail Modal */}
            {showDetailModal && viewPayroll && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
                            <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center gap-3 bg-white shrink-0">
                                <div className="min-w-0">
                                    <h2 className="text-lg sm:text-xl font-bold text-slate-800">Payroll Detail View</h2>
                                    <p className="text-xs sm:text-sm text-slate-500 truncate">
                                        {months[(viewPayroll.month || 1) - 1]} {viewPayroll.year} • {viewPayroll.full_name} ({viewPayroll.employee_code})
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 shrink-0"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
                                {/* Attendance Summary Section */}
                                <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                                    <h3 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                                        <CheckCircle size={16} /> Attendance Summary
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-sm">
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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Earnings */}
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-slate-700">Earnings</div>
                                        <div className="p-4 space-y-3 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Basic Salary</span>
                                                <span className="font-mono font-medium">₹ {fmtINR(viewPayroll.basic_earned)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">HRA</span>
                                                <span className="font-mono font-medium">₹ {fmtINR(viewPayroll.hra_earned)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Conveyance</span>
                                                <span className="font-mono font-medium">₹ {fmtINR(viewPayroll.conveyance_earned)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Special Allowance</span>
                                                <span className="font-mono font-medium">₹ {fmtINR(viewPayroll.special_allowance_earned)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Other Allowance</span>
                                                <span className="font-mono font-medium">₹ {fmtINR(viewPayroll.other_allowance_earned)}</span>
                                            </div>
                                            {numVal(viewPayroll.overtime_amount) > 0 && (
                                                <div className="flex justify-between text-indigo-600 bg-indigo-50 -mx-4 px-4 py-1">
                                                    <span>Overtime Pay</span>
                                                    <span className="font-mono font-medium">₹ {fmtINR(viewPayroll.overtime_amount)}</span>
                                                </div>
                                            )}
                                            <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between font-bold text-slate-800">
                                                <span>Total Earnings</span>
                                                <span>₹ {fmtINR(viewPayroll.gross_earnings)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Deductions */}
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="bg-red-50 px-4 py-3 border-b border-slate-200 font-bold text-red-700">Deductions</div>
                                        <div className="p-4 space-y-3 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Provident Fund (PF)</span>
                                                <span className="font-mono font-medium">₹ {fmtINR(viewPayroll.pf_employee)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">ESI (Employee)</span>
                                                <span className="font-mono font-medium">₹ {fmtINR(viewPayroll.esi_employee)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Professional Tax</span>
                                                <span className="font-mono font-medium">₹ {fmtINR(viewPayroll.professional_tax)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">TDS / Income Tax</span>
                                                <span className="font-mono font-medium">₹ {fmtINR(viewPayroll.tds)}</span>
                                            </div>
                                            {numVal(viewPayroll.advance_deduction) > 0 && (
                                                <div className="flex justify-between text-orange-600">
                                                    <span>Salary Advance</span>
                                                    <span className="font-mono font-medium">₹ {fmtINR(viewPayroll.advance_deduction)}</span>
                                                </div>
                                            )}
                                            <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between font-bold text-red-600">
                                                <span>Total Deductions</span>
                                                <span>₹ {fmtINR(viewPayroll.total_deductions)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Net Pay */}
                                <div className="bg-green-50 p-5 sm:p-6 rounded-xl border border-green-200 text-center">
                                    <div className="text-green-800 font-medium mb-1">Net Salary Payable</div>
                                    <div className="text-3xl sm:text-4xl font-bold text-green-700">₹ {fmtINR(viewPayroll.net_salary)}</div>
                                    <div className="text-xs sm:text-sm text-green-600 mt-2 font-medium bg-white/50 inline-block px-3 py-1 rounded-full border border-green-100">
                                        {numVal(viewPayroll.net_salary).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                                    </div>
                                </div>

                                {/* Employer Contribution (Info Only) */}
                                <div className="text-xs text-slate-400 text-center">
                                    Employer PF: ₹ {fmtINR(viewPayroll.pf_employer)} •
                                    Employer ESI: ₹ {fmtINR(viewPayroll.esi_employer)}
                                </div>
                            </div>

                            <div className="p-4 sm:p-6 border-t border-slate-100 flex flex-wrap justify-end gap-3 bg-white shrink-0 rounded-b-2xl">
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
                </ModalPortal>
            )}
        </div>
    );
};

export default Payroll;
