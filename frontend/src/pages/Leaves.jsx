import { useState, useEffect, useCallback } from 'react';
import {
    Calendar, CheckCircle, XCircle, Clock, Plus,
    FileText, User, ChevronRight, AlertCircle, RefreshCw,
    GitBranch, Users
} from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import leaveService from '../services/leaveService';
import employeeService from '../services/employeeService';
import { useAuth } from '../context/AuthContext';
import WorkflowFlowchart from '../components/charts/WorkflowFlowchart';

// --- Sub-Component: Apply Leave Form ---
const ApplyLeaveForm = ({ employeeCode, onSuccess }) => {
    const { user } = useAuth();
    const userRole = user?.roleCode || user?.role?.roleCode || user?.role;
    const isHR = ['SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'].includes(userRole);
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [autoApprove, setAutoApprove] = useState(true);
    const [selectedEmpBalances, setSelectedEmpBalances] = useState([]);

    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const typeRes = await leaveService.getAllLeaveTypes();
                setLeaveTypes(typeRes.data?.data || typeRes.data || []);

                if (isHR || !employeeCode) {
                    const empRes = await employeeService.getEmployees();
                    setEmployees(empRes.data?.data || []);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchInitial();
    }, [isHR, employeeCode]);

    const formik = useFormik({
        initialValues: {
            employee_code: employeeCode || '',
            leave_type_id: '',
            from_date: '',
            to_date: '',
            reason: ''
        },
        enableReinitialize: true,
        validationSchema: Yup.object({
            employee_code: Yup.string().required('Employee selection required'),
            leave_type_id: Yup.string().required('Required'),
            from_date: Yup.date().required('Required'),
            to_date: Yup.date().min(Yup.ref('from_date'), 'End date must be after start date').required('Required'),
            reason: Yup.string().required('Required')
        }),
        onSubmit: async (values, { resetForm }) => {
            try {
                const start = new Date(values.from_date);
                const end = new Date(values.to_date);
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                const selectedEmp = employees.find(e => e.employee_code === values.employee_code);

                await leaveService.applyLeave({
                    ...values,
                    employee_id: selectedEmp?.employee_id,
                    total_days: diffDays,
                    auto_approve: isHR ? autoApprove : false
                });

                if (isHR && autoApprove) {
                    toast.success('Leave directly granted & approved! Attendance synced as Leave.');
                } else {
                    toast.success('Leave application submitted successfully');
                }
                resetForm();
                onSuccess && onSuccess();
            } catch (err) {
                console.error('Leave submit error:', err);
            }
        }
    });

    // Auto-fetch balances when employee is selected
    useEffect(() => {
        const targetCode = formik.values.employee_code || employeeCode;
        if (targetCode) {
            leaveService.getEmployeeBalances(targetCode)
                .then(res => setSelectedEmpBalances(res.data?.data || []))
                .catch(() => setSelectedEmpBalances([]));
        } else {
            setSelectedEmpBalances([]);
        }
    }, [formik.values.employee_code, employeeCode]);

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Plus size={18} className="text-primary-600" /> {isHR ? 'Grant / Apply Leave for Employee' : 'Apply for Leave'}
            </h3>
            <form onSubmit={formik.handleSubmit} className="space-y-4">
                {/* Employee Selector for HR/Admin */}
                {(isHR || !employeeCode) ? (
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                            Employee <span className="text-red-500">*</span>
                        </label>
                        <select
                            {...formik.getFieldProps('employee_code')}
                            className="w-full text-sm border-slate-300 rounded-lg py-2 px-3 focus:ring-primary-500 focus:border-primary-500"
                        >
                            <option value="">Select Employee</option>
                            {employees.map(emp => (
                                <option key={emp.employee_id} value={emp.employee_code}>
                                    {emp.first_name} {emp.last_name} ({emp.employee_code})
                                </option>
                            ))}
                        </select>
                        {formik.touched.employee_code && formik.errors.employee_code && (
                            <div className="text-xs text-red-500 mt-1">{formik.errors.employee_code}</div>
                        )}
                    </div>
                ) : (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                        <User size={14} className="text-primary-600" />
                        <span>Applying for Employee: <strong>{employeeCode}</strong></span>
                    </div>
                )}

                {/* Show balance cards for selected employee */}
                {selectedEmpBalances.length > 0 && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            Available Leave Balance:
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {selectedEmpBalances.map(b => (
                                <span
                                    key={b.leave_type_id}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${
                                        Number(b.remaining) > 0
                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                            : 'bg-red-50 text-red-600 border border-red-200'
                                    }`}
                                >
                                    {b.leave_code}: <strong>{b.remaining}</strong> days left
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                        Leave Type <span className="text-red-500">*</span>
                    </label>
                    <select
                        {...formik.getFieldProps('leave_type_id')}
                        className="w-full text-sm border-slate-300 rounded-lg py-2 px-3 focus:ring-primary-500 focus:border-primary-500"
                    >
                        <option value="">Select Type</option>
                        {leaveTypes.map(lt => (
                            <option key={lt.leave_type_id} value={lt.leave_type_id}>
                                {lt.leave_name} ({lt.leave_code})
                            </option>
                        ))}
                    </select>
                    {formik.touched.leave_type_id && formik.errors.leave_type_id && (
                        <div className="text-xs text-red-500 mt-1">{formik.errors.leave_type_id}</div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                            From <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            {...formik.getFieldProps('from_date')}
                            className="w-full text-sm border-slate-300 rounded-lg py-2 px-3 focus:ring-primary-500 focus:border-primary-500"
                        />
                        {formik.touched.from_date && formik.errors.from_date && (
                            <div className="text-xs text-red-500 mt-1">{formik.errors.from_date}</div>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                            To <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            {...formik.getFieldProps('to_date')}
                            className="w-full text-sm border-slate-300 rounded-lg py-2 px-3 focus:ring-primary-500 focus:border-primary-500"
                        />
                        {formik.touched.to_date && formik.errors.to_date && (
                            <div className="text-xs text-red-500 mt-1">{formik.errors.to_date}</div>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                        Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        rows="3"
                        {...formik.getFieldProps('reason')}
                        className="w-full text-sm border-slate-300 rounded-lg py-2 px-3 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Reason for leave..."
                    ></textarea>
                    {formik.touched.reason && formik.errors.reason && (
                        <div className="text-xs text-red-500 mt-1">{formik.errors.reason}</div>
                    )}
                </div>

                {/* Direct Grant / Auto-Approve Option for HR/Admin */}
                {isHR && (
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-3">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoApprove}
                                onChange={(e) => setAutoApprove(e.target.checked)}
                                className="mt-0.5 h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                            />
                            <div className="text-xs">
                                <span className="font-semibold text-emerald-950 block">Direct Grant & Auto-Approve</span>
                                <span className="text-emerald-700 block mt-0.5">
                                    Immediately mark as approved and record 'L' on daily attendance logs. (Uncheck if you want to leave it pending for approval queue).
                                </span>
                            </div>
                        </label>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={formik.isSubmitting}
                    className="w-full py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                    {formik.isSubmitting
                        ? 'Processing...'
                        : (isHR && autoApprove ? 'Grant & Approve Leave' : 'Submit Leave Request')}
                </button>
            </form>
        </div>
    );
};

// --- Sub-Component: Leave Balances for Employee ---
const LeaveBalances = ({ employeeCode }) => {
    const [balances, setBalances] = useState([]);

    const fetchBalances = useCallback(async () => {
        if (!employeeCode) return;
        try {
            const res = await leaveService.getEmployeeBalances(employeeCode);
            setBalances(res.data.data || []);
        } catch (err) {
            console.error(err);
        }
    }, [employeeCode]);

    useEffect(() => {
        fetchBalances();
    }, [fetchBalances]);

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {balances.map(b => (
                <div key={b.leave_type_id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="text-slate-500 text-xs uppercase font-semibold">{b.leave_name}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{b.remaining}</div>
                    </div>
                    <div className="mt-3 text-xs text-slate-400 flex justify-between">
                        <span>Used: {b.taken}</span>
                        <span>Total: {b.total_allocated}</span>
                    </div>
                </div>
            ))}
            {balances.length === 0 && <div className="col-span-full text-slate-500 text-sm">No leave balances found for current user.</div>}
        </div>
    );
};

// --- Main Page ---
const Leaves = () => {
    const { user } = useAuth();
    const isHR = ['SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'].includes(user?.roleCode || user?.role?.roleCode);
    const [activeTab, setActiveTab] = useState(isHR ? 'hr_dashboard' : 'my_leaves');
    const [showApplyModal, setShowApplyModal] = useState(false);

    const currentEmployeeCode = user?.employeeCode || '';
    const [hrRequestList, setHrRequestList] = useState([]);
    const [statusFilter, setStatusFilter] = useState('PENDING');
    const [myHistory, setMyHistory] = useState([]);

    const loadData = useCallback(async () => {
        if (activeTab === 'hr_dashboard') {
            try {
                const res = await leaveService.getAllRequests({ status: statusFilter });
                setHrRequestList(res.data.data || []);
            } catch (err) {
                console.error(err);
                toast.error("Failed to load requests");
            }
        } else if (currentEmployeeCode) {
            try {
                const res = await leaveService.getMyLeaveHistory(currentEmployeeCode);
                setMyHistory(res.data.data || []);
            } catch (err) {
                console.error(err);
            }
        }
    }, [activeTab, currentEmployeeCode, statusFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleApprove = async (id) => {
        try {
            await leaveService.approveLeave(id, currentEmployeeCode);
            toast.success("Leave Approved and Attendance synced");
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.message || "Approval failed");
        }
    };

    const handleReject = async (id) => {
        const reason = prompt("Enter rejection reason:");
        if (!reason) return;
        try {
            await leaveService.rejectLeave(id, currentEmployeeCode, reason);
            toast.success("Leave Rejected");
            loadData();
        } catch (err) {
            console.error(err);
            toast.error("Rejection failed");
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Leave Management</h1>
                    <p className="text-slate-500">Apply, approve, track leave balances & attendance integration</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowApplyModal(true)}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-colors text-sm"
                    >
                        <Plus size={18} /> Apply Leave
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-8 overflow-x-auto">
                    {isHR && (
                        <button
                            onClick={() => setActiveTab('hr_dashboard')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'hr_dashboard' ? 'border-primary-500 text-primary-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <FileText size={18} /> HR Approval Dashboard
                        </button>
                    )}

                    <button
                        onClick={() => setActiveTab('my_leaves')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'my_leaves' ? 'border-primary-500 text-primary-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <User size={18} /> My Leaves
                    </button>

                    <button
                        onClick={() => setActiveTab('flowchart')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'flowchart' ? 'border-primary-500 text-primary-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <GitBranch size={18} /> Approval Process Flowchart
                    </button>
                </nav>
            </div>

            {/* Content: HR Dashboard */}
            {activeTab === 'hr_dashboard' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-4">
                                <h3 className="font-semibold text-slate-800">Leave Requests</h3>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="text-sm border-slate-300 rounded-lg py-1 px-2.5 focus:ring-primary-500 focus:border-primary-500 bg-white"
                                >
                                    <option value="PENDING">Pending</option>
                                    <option value="APPROVED">Approved</option>
                                    <option value="REJECTED">Rejected</option>
                                    <option value="ALL">All Requests</option>
                                </select>
                            </div>
                            <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded text-xs font-bold">{hrRequestList.length} Requests</span>
                        </div>
                        {hrRequestList.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                <CheckCircle size={48} className="mx-auto text-green-200 mb-3" />
                                <p>No {statusFilter.toLowerCase()} requests found.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {hrRequestList.map(req => (
                                    <div key={req.request_id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold shrink-0">
                                                {req.first_name[0]}{req.last_name ? req.last_name[0] : ''}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-900">{req.first_name} {req.last_name} <span className="text-slate-400 text-xs font-mono">({req.employee_code})</span></div>
                                                <div className="text-sm text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold text-slate-700">{req.leave_name}</span>
                                                    <span>•</span>
                                                    <span>{new Date(req.from_date).toLocaleDateString()} to {new Date(req.to_date).toLocaleDateString()}</span>
                                                    <span className="bg-slate-200 px-1.5 py-0.5 rounded text-xs font-semibold">{req.total_days} Days</span>
                                                    {req.approved_by_name && <span className="text-slate-400 text-xs ml-2 italic">Approved by: {req.approved_by_name}</span>}
                                                </div>
                                                {req.reason && <div className="text-xs text-slate-500 mt-2 bg-slate-100 p-2 rounded max-w-md italic">"{req.reason}"</div>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2.5 items-center shrink-0">
                                            {req.status === 'PENDING' ? (
                                                <>
                                                    <button
                                                        onClick={() => handleReject(req.request_id)}
                                                        className="px-3.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                                                    >
                                                        Reject
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprove(req.request_id)}
                                                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
                                                    >
                                                        <CheckCircle size={14} /> Approve
                                                    </button>
                                                </>
                                            ) : (
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                                                    ${req.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                        req.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                            'bg-gray-100 text-gray-700'}`}>
                                                    {req.status}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Content: My Leaves */}
            {activeTab === 'my_leaves' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                    <LeaveBalances employeeCode={currentEmployeeCode} />

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 font-semibold text-slate-800 flex justify-between">
                            <span>Application History</span>
                            <button onClick={loadData} className="text-slate-400 hover:text-primary-600"><RefreshCw size={16} /></button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold">Type</th>
                                        <th className="px-6 py-3 font-semibold">Dates</th>
                                        <th className="px-6 py-3 font-semibold">Days</th>
                                        <th className="px-6 py-3 font-semibold">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {myHistory.length === 0 ? (
                                        <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">No personal leave records found</td></tr>
                                    ) : myHistory.map(req => (
                                        <tr key={req.request_id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium text-slate-900">{req.leave_code}</td>
                                            <td className="px-6 py-4 text-slate-500">
                                                {new Date(req.from_date).toLocaleDateString()} - {new Date(req.to_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 font-mono">{req.total_days}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold 
                                                    ${req.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                        req.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                            'bg-yellow-100 text-yellow-700'}`}>
                                                    {req.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Content: Workflow Flowchart */}
            {activeTab === 'flowchart' && (
                <div className="animate-in fade-in duration-300">
                    <WorkflowFlowchart defaultWorkflow="leave" allowSwitch={false} />
                </div>
            )}

            {/* Apply Leave Modal */}
            {showApplyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white rounded-xl shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
                        <button
                            onClick={() => setShowApplyModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <XCircle size={22} />
                        </button>

                        <div className="p-1">
                            <ApplyLeaveForm
                                employeeCode={currentEmployeeCode}
                                onSuccess={() => {
                                    setShowApplyModal(false);
                                    loadData();
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Leaves;
