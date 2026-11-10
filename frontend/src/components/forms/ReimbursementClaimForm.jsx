import { useState, useEffect, useCallback } from 'react';
import { X, Upload, User } from 'lucide-react';
import benefitService from '../../services/benefitService';
import employeeService from '../../services/employeeService';
import { extractApiError } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import ModalPortal from '../common/ModalPortal';

const getIstToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

const ReimbursementClaimForm = ({ onClose, onSuccess, employeeId = null }) => {
    const { user, hasPermission } = useAuth();
    const canSelectAnyEmployee = hasPermission('BENEFITS', 'can_approve') || hasPermission('BENEFITS', 'can_update');
    const [employees, setEmployees] = useState([]);
    const [benefitTypes, setBenefitTypes] = useState([]);
    const [loading, setLoading] = useState(false);

    const istToday = getIstToday();

    const [formData, setFormData] = useState({
        employee_id: employeeId || user?.employeeId || '',
        benefit_type_id: '',
        amount: '',
        claim_date: istToday,
        description: ''
    });

    const fetchData = useCallback(async () => {
        try {
            const promises = [benefitService.getTypes()];
            if (canSelectAnyEmployee || (!employeeId && !user?.employeeId && hasPermission('EMPLOYEES', 'can_view'))) {
                promises.push(employeeService.getEmployees().catch(() => ({ data: { data: [] } })));
            }

            const [typeRes, empRes] = await Promise.all(promises);
            const allTypes = typeRes.data?.data || [];
            const claimableTypes = allTypes.filter(t => t.category === 'REIMBURSEMENT' || t.category === 'PERK');
            setBenefitTypes(claimableTypes.length > 0 ? claimableTypes : allTypes);

            if (empRes) {
                const empList = empRes.data?.data || [];
                setEmployees(empList);

                setFormData(prev => {
                    if (prev.employee_id) return prev;
                    if (user?.employeeId && empList.some(e => e.employee_id === user.employeeId)) {
                        return { ...prev, employee_id: user.employeeId };
                    }
                    if (empList.length === 1) {
                        return { ...prev, employee_id: empList[0].employee_id };
                    }
                    return prev;
                });
            }
        } catch (error) {
            console.error('Failed to load required data:', error);
            toast.error(extractApiError(error, 'Failed to load required data'));
        }
    }, [canSelectAnyEmployee, employeeId, user?.employeeId, hasPermission]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.employee_id) {
            toast.error('Please select an employee');
            return;
        }

        if (!formData.benefit_type_id || !formData.amount || !formData.description) {
            toast.error('Please fill required fields');
            return;
        }

        setLoading(true);
        try {
            await benefitService.applyClaim({
                ...formData,
                employee_id: parseInt(formData.employee_id, 10),
                amount: parseFloat(formData.amount)
            });
            toast.success('Claim submitted successfully');
            onSuccess && onSuccess();
            onClose();
        } catch (error) {
            console.error('Claim error:', error);
            toast.error(extractApiError(error, 'Failed to submit claim'));
        } finally {
            setLoading(false);
        }
    };

    const showEmployeeDropdown = canSelectAnyEmployee || (!employeeId && !user?.employeeId && employees.length > 0);

    return (
        <ModalPortal>
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                        <h3 className="font-semibold text-slate-800 text-lg">Submit Reimbursement Claim</h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                        {/* Employee Selector */}
                        {showEmployeeDropdown ? (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Employee <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    value={formData.employee_id}
                                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                                    className="w-full min-w-0 rounded-lg border border-slate-300 text-sm py-2 px-3 bg-white"
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map(emp => (
                                        <option key={emp.employee_id} value={emp.employee_id}>
                                            {emp.first_name} {emp.last_name} ({emp.employee_code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center gap-2 text-sm text-slate-700">
                                <User size={16} className="text-slate-400 shrink-0" />
                                <span className="truncate">
                                    Submitting claim for {user?.fullName || 'your profile'} {user?.employeeCode ? `(${user.employeeCode})` : ''}
                                </span>
                            </div>
                        )}

                        {/* Benefit Type */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Benefit Category <span className="text-red-500">*</span>
                            </label>
                            <select
                                required
                                value={formData.benefit_type_id}
                                onChange={(e) => setFormData({ ...formData, benefit_type_id: e.target.value })}
                                className="w-full min-w-0 rounded-lg border border-slate-300 text-sm py-2 px-3 bg-white"
                            >
                                <option value="">Select Category</option>
                                {benefitTypes.map(type => (
                                    <option key={type.benefit_type_id} value={type.benefit_type_id}>
                                        {type.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Amount & Date */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="min-w-0">
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Amount (₹) <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-slate-500">₹</span>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        step="any"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        className="w-full min-w-0 pl-7 rounded-lg border border-slate-300 text-sm py-2 px-3"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="min-w-0">
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Expense Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    max={istToday}
                                    value={formData.claim_date}
                                    onChange={(e) => setFormData({ ...formData, claim_date: e.target.value })}
                                    className="w-full min-w-0 rounded-lg border border-slate-300 text-sm py-2 px-3"
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Description <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                required
                                rows="3"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full min-w-0 rounded-lg border border-slate-300 text-sm py-2 px-3"
                                placeholder="Details of expense..."
                            ></textarea>
                        </div>

                        {/* Receipt Upload Note */}
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex gap-3 text-xs sm:text-sm text-blue-800">
                            <Upload size={16} className="mt-0.5 shrink-0" />
                            <p>Currently receipt upload is disabled. Please submit physical receipts to HR if required.</p>
                        </div>

                        <div className="pt-4 flex flex-wrap gap-3 justify-end border-t border-slate-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                            >
                                {loading ? 'Submitting...' : 'Submit Claim'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </ModalPortal>
    );
};

export default ReimbursementClaimForm;
