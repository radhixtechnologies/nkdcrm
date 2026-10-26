import { useState, useEffect } from 'react';
import { X, Gift } from 'lucide-react';
import perkService from '../../services/perkService';
import employeeService from '../../services/employeeService';
import toast from 'react-hot-toast';

const AssignPerkForm = ({ onClose, onSuccess }) => {
    const [employees, setEmployees] = useState([]);
    const [perkTypes, setPerkTypes] = useState([]);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        employee_id: '',
        perk_type_id: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        remarks: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [empRes, typeRes] = await Promise.all([
                employeeService.getEmployees(),
                perkService.getTypes()
            ]);
            setEmployees(empRes.data.data || []);
            setPerkTypes(typeRes.data.data || []);
        } catch (error) {
            console.error('Failed to load data:', error);
            toast.error('Failed to load required data');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.employee_id || !formData.perk_type_id || !formData.start_date) {
            toast.error('Please fill required fields');
            return;
        }

        setLoading(true);
        try {
            await perkService.assignPerk(formData);
            toast.success('Perk assigned successfully');
            onSuccess && onSuccess();
            onClose();
        } catch (error) {
            console.error('Assignment error:', error);
            toast.error(error.response?.data?.message || 'Failed to assign perk');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                        <Gift size={20} className="text-primary-600" />
                        Assign Perk
                    </h3>
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

                    {/* Perk Type */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Perk Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            required
                            value={formData.perk_type_id}
                            onChange={(e) => setFormData({ ...formData, perk_type_id: e.target.value })}
                            className="w-full rounded-lg border-slate-300 text-sm py-2 px-3"
                        >
                            <option value="">Select Type</option>
                            {perkTypes.map(type => (
                                <option key={type.perk_type_id} value={type.perk_type_id}>
                                    {type.name} {type.is_monetary ? '(Monetary)' : ''}
                                </option>
                            ))}
                        </select>
                        {formData.perk_type_id && (
                            <p className="text-xs text-slate-500 mt-1">
                                {perkTypes.find(t => t.perk_type_id.toString() === formData.perk_type_id.toString())?.description}
                            </p>
                        )}
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
                                End Date (Optional)
                            </label>
                            <input
                                type="date"
                                value={formData.end_date}
                                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                className="w-full rounded-lg border-slate-300 text-sm py-2 px-3"
                            />
                        </div>
                    </div>

                    {/* Remarks */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Remarks / Details
                        </label>
                        <textarea
                            rows="2"
                            value={formData.remarks}
                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                            className="w-full rounded-lg border-slate-300 text-sm py-2 px-3"
                            placeholder="e.g. Serial Number, Location, etc."
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
                            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 flex items-center gap-2"
                        >
                            <Gift size={16} />
                            {loading ? 'Assigning...' : 'Assign Perk'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AssignPerkForm;
