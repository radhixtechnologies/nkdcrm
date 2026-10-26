import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import leaveService from '../../services/leaveService';
import employeeService from '../../services/employeeService';
import toast from 'react-hot-toast';

const BalanceAdjustmentForm = ({ onClose, onSuccess }) => {
    const [employees, setEmployees] = useState([]);
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        employee_id: '',
        leave_type_id: '',
        adjustment_amount: '',
        reason: '',
        year: new Date().getFullYear(),
        admin_id: 1 // TODO: Get from auth context
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [empRes, typeRes] = await Promise.all([
                employeeService.getEmployees(),
                leaveService.getLeaveTypes()
            ]);
            setEmployees(empRes.data.data || []);
            setLeaveTypes(typeRes.data.data || []);
        } catch (error) {
            console.error('Failed to load data:', error);
            toast.error('Failed to load required data');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.employee_id || !formData.leave_type_id || !formData.adjustment_amount || !formData.reason) {
            toast.error('Please fill all required fields');
            return;
        }

        setLoading(true);
        try {
            await leaveService.adjustBalance({
                ...formData,
                adjustment_amount: parseFloat(formData.adjustment_amount)
            });
            toast.success('Leave balance adjusted successfully');
            onSuccess && onSuccess();
            onClose();
        } catch (error) {
            console.error('Adjustment error:', error);
            toast.error(error.response?.data?.message || 'Failed to adjust balance');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-semibold text-slate-800 text-lg">Adjust Leave Balance</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Employee */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Employee <span className="text-red-500">*</span>
                        </label>
                        <select
                            required
                            value={formData.employee_id}
                            onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                            className="w-full rounded-lg border-slate-300 text-sm py-2 px-3"
                        >
                            <option value="">Select Employee</option>
                            {employees.map(emp => (
                                <option key={emp.employee_id} value={emp.employee_id}>
                                    {emp.first_name} {emp.last_name} ({emp.employee_code})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Leave Type */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Leave Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            required
                            value={formData.leave_type_id}
                            onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
                            className="w-full rounded-lg border-slate-300 text-sm py-2 px-3"
                        >
                            <option value="">Select Type</option>
                            {leaveTypes.map(type => (
                                <option key={type.leave_type_id} value={type.leave_type_id}>
                                    {type.leave_name} ({type.leave_code})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Adjustment Amount (Days) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            step="0.5"
                            required
                            value={formData.adjustment_amount}
                            onChange={(e) => setFormData({ ...formData, adjustment_amount: e.target.value })}
                            placeholder="+1.0 or -1.0"
                            className="w-full rounded-lg border-slate-300 text-sm py-2 px-3"
                        />
                        <p className="text-xs text-slate-500 mt-1">Use negative values to deduct days.</p>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            required
                            rows="2"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full rounded-lg border-slate-300 text-sm py-2 px-3"
                            placeholder="Reason for adjustment..."
                        ></textarea>
                    </div>

                    <div className="pt-4 flex gap-3 justify-end border-t border-slate-100">
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
                            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                        >
                            {loading ? 'Saving...' : 'Save Adjustment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BalanceAdjustmentForm;
