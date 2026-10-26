import { useState, useEffect, useCallback } from 'react';
import { X, Calendar, FileText } from 'lucide-react';
import leaveService from '../../services/leaveService';
import employeeService from '../../services/employeeService';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const LeaveRequestForm = ({ onClose, onSuccess }) => {
    const { user } = useAuth();
    const isEmployee = user?.roleCode === 'EMPLOYEE' || user?.role?.roleCode === 'EMPLOYEE' || user?.role === 'EMPLOYEE';

    const [leaveTypes, setLeaveTypes] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [balances, setBalances] = useState([]);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        employee_id: user?.employeeId || user?.employeeCode || '',
        leave_type_id: '',
        from_date: '',
        to_date: '',
        reason: ''
    });

    const fetchLeaveTypes = useCallback(async () => {
        try {
            const res = await leaveService.getLeaveTypes();
            setLeaveTypes(res.data.data || []);
        } catch (error) {
            console.error('Failed to fetch leave types:', error);
            toast.error('Failed to load leave types');
        }
    }, []);

    const fetchEmployees = useCallback(async () => {
        try {
            const res = await employeeService.getEmployees();
            const emps = res.data.data || [];
            setEmployees(emps);
            if (!formData.employee_id && emps.length > 0) {
                setFormData(prev => ({ ...prev, employee_id: emps[0].employee_id }));
            }
        } catch (error) {
            console.error('Failed to fetch employees:', error);
            toast.error('Failed to load employees');
        }
    }, [formData.employee_id]);

    const fetchBalances = useCallback(async () => {
        if (!formData.employee_id) return;
        try {
            const res = await leaveService.getBalances(formData.employee_id);
            setBalances(res.data.data || []);
        } catch (error) {
            console.error('Failed to fetch balances:', error);
        }
    }, [formData.employee_id]);

    useEffect(() => {
        fetchLeaveTypes();
        if (!isEmployee) {
            fetchEmployees();
        }
    }, [fetchLeaveTypes, fetchEmployees, isEmployee]);

    useEffect(() => {
        if (formData.employee_id) {
            fetchBalances();
        }
    }, [formData.employee_id, fetchBalances]);

    const calculateDays = () => {
        if (!formData.from_date || !formData.to_date) return 0;
        const from = new Date(formData.from_date);
        const to = new Date(formData.to_date);
        const diffTime = Math.abs(to - from);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const totalDays = calculateDays();
        if (totalDays <= 0) {
            toast.error('Invalid date range');
            return;
        }

        setLoading(true);
        try {
            await leaveService.applyLeave({
                ...formData,
                total_days: totalDays
            });
            toast.success('Leave application submitted successfully');
            onSuccess && onSuccess();
            onClose();
        } catch (error) {
            console.error('Apply leave error:', error);
            toast.error(error.response?.data?.message || 'Failed to apply for leave');
        } finally {
            setLoading(false);
        }
    };

    const selectedBalance = balances.find(b => b.leave_type_id === parseInt(formData.leave_type_id));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-semibold text-slate-800 text-lg">Apply for Leave</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Balance Info */}
                {selectedBalance && (
                    <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
                        <p className="text-sm text-blue-800">
                            <span className="font-semibold">{selectedBalance.leave_name}</span> Balance:
                            <span className="font-bold ml-2">{selectedBalance.remaining} days</span>
                            <span className="text-blue-600 ml-1">(Used: {selectedBalance.used})</span>
                        </p>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Employee Selection (Admin/HR feature) */}
                    {!isEmployee && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Select Employee
                            </label>
                            <select
                                value={formData.employee_id}
                                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm py-2.5 px-3 border"
                            >
                                {employees.map(emp => (
                                    <option key={emp.employee_id} value={emp.employee_id}>
                                        {emp.first_name} {emp.last_name} ({emp.employee_code})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Leave Type */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Leave Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            required
                            value={formData.leave_type_id}
                            onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
                            className="w-full rounded-lg border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm py-2.5 px-3 border"
                        >
                            <option value="">Select Leave Type</option>
                            {leaveTypes.map(type => (
                                <option key={type.leave_type_id} value={type.leave_type_id}>
                                    {type.leave_name} ({type.leave_code})
                                    {type.is_paid ? ' - Paid' : ' - Unpaid'}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                From Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.from_date}
                                onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm py-2.5 px-3 border"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                To Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.to_date}
                                onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                                min={formData.from_date}
                                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm py-2.5 px-3 border"
                            />
                        </div>
                    </div>

                    {/* Days Calculation */}
                    {formData.from_date && formData.to_date && (
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Total Days:</span>
                                <span className="text-lg font-bold text-slate-800">{calculateDays()} days</span>
                            </div>
                        </div>
                    )}

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            required
                            rows="3"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full rounded-lg border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm py-2.5 px-3 border"
                            placeholder="Please provide a reason for your leave..."
                        ></textarea>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex gap-3 justify-end border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Submitting...' : 'Submit Application'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LeaveRequestForm;
