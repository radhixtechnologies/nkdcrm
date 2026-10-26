import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import benefitService from '../../services/benefitService';
import employeeService from '../../services/employeeService';
import toast from 'react-hot-toast';

const AssignBenefitForm = ({ onClose, onSuccess }) => {
    const [employees, setEmployees] = useState([]);
    const [benefitTypes, setBenefitTypes] = useState([]);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        employee_id: '',
        benefit_type_id: '',
        policy_number: '',
        details: '',
        start_date: '',
        end_date: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [empRes, typeRes] = await Promise.all([
                employeeService.getEmployees(),
                benefitService.getTypes()
            ]);
            setEmployees(empRes.data.data || []);
            setBenefitTypes(typeRes.data.data || []);
        } catch (error) {
            console.error('Failed to load data:', error);
            toast.error('Failed to load required data');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.employee_id || !formData.benefit_type_id || !formData.start_date) {
            toast.error('Please fill required fields');
            return;
        }

        setLoading(true);
        try {
            await benefitService.assignBenefit(formData);
            toast.success('Benefit assigned successfully');
            onSuccess && onSuccess();
            onClose();
        } catch (error) {
            console.error('Assignment error:', error);
            toast.error(error.response?.data?.message || 'Failed to assign benefit');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-semibold text-slate-800 text-lg">Assign Employee Benefit</h3>
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

                    {/* Benefit Type */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Benefit Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            required
                            value={formData.benefit_type_id}
                            onChange={(e) => setFormData({ ...formData, benefit_type_id: e.target.value })}
                            className="w-full rounded-lg border-slate-300 text-sm py-2 px-3"
                        >
                            <option value="">Select Type</option>
                            {benefitTypes.map(type => (
                                <option key={type.benefit_type_id} value={type.benefit_type_id}>
                                    {type.name} ({type.category})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Policy Number */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Policy Number / ID (Optional)
                        </label>
                        <input
                            type="text"
                            value={formData.policy_number}
                            onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                            className="w-full rounded-lg border-slate-300 text-sm py-2 px-3"
                            placeholder="e.g. INS-123456789"
                        />
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Start Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                className="w-full rounded-lg border-slate-300 text-sm py-2 px-3"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                End Date
                            </label>
                            <input
                                type="date"
                                value={formData.end_date}
                                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                className="w-full rounded-lg border-slate-300 text-sm py-2 px-3"
                            />
                        </div>
                    </div>

                    {/* Details */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Additional Details
                        </label>
                        <textarea
                            rows="2"
                            value={formData.details}
                            onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                            className="w-full rounded-lg border-slate-300 text-sm py-2 px-3"
                            placeholder="Coverage limits, specific terms, etc."
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
                            {loading ? 'Assigning...' : 'Assign Benefit'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AssignBenefitForm;
