import { useState, useEffect, useCallback } from 'react';
import { Plus, Clock, Edit, Trash } from 'lucide-react';
import shiftService from '../../services/shiftService';
import toast from 'react-hot-toast';

const ShiftManagement = () => {
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingShift, setEditingShift] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        shift_name: '',
        start_time: '09:00',
        end_time: '18:00',
        break_minutes: 60,
        description: '',
        is_active: true
    });

    const fetchShifts = useCallback(async () => {
        try {
            const res = await shiftService.getAllShifts();
            setShifts(res.data.data || []);
            setLoading(false);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load shifts');
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchShifts();
    }, [fetchShifts]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleEdit = (shift) => {
        setEditingShift(shift);
        setFormData({
            shift_name: shift.shift_name,
            start_time: shift.start_time?.slice(0, 5) || '09:00',
            end_time: shift.end_time?.slice(0, 5) || '18:00',
            break_minutes: shift.break_minutes || 60,
            description: shift.description || '',
            is_active: shift.is_active ?? true
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this shift?")) return;
        try {
            await shiftService.deleteShift(id);
            toast.success("Shift deleted successfully");
            fetchShifts();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || "Failed to delete shift");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                start_time: formData.start_time + ':00',
                end_time: formData.end_time + ':00'
            };

            if (editingShift) {
                await shiftService.updateShift(editingShift.shift_id, payload);
                toast.success('Shift updated successfully');
            } else {
                await shiftService.createShift(payload);
                toast.success('Shift created successfully');
            }

            setShowForm(false);
            setEditingShift(null);
            fetchShifts();

            // Reset form
            setFormData({
                shift_name: '',
                start_time: '09:00',
                end_time: '18:00',
                break_minutes: 60,
                description: '',
                is_active: true
            });
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to save shift');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Shift Configuration</h2>
                    <p className="text-sm text-slate-500">Manage work shifts and timings</p>
                </div>
                <button
                    onClick={() => {
                        setEditingShift(null);
                        setFormData({
                            shift_name: '',
                            start_time: '09:00',
                            end_time: '18:00',
                            break_minutes: 60,
                            description: '',
                            is_active: true
                        });
                        setShowForm(true);
                    }}
                    className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition-colors"
                >
                    <Plus size={16} />
                    Add Shift
                </button>
            </div>

            {/* Shifts Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Loading shifts...</div>
                ) : shifts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                        <div className="mb-4 rounded-full bg-slate-100 p-4">
                            <Clock size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900">No Shifts Found</h3>
                        <p className="mt-1 text-sm text-slate-500 max-w-sm">
                            Create shifts to define employee working hours.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-6 py-3">Shift Name</th>
                                    <th className="px-6 py-3">Start Time</th>
                                    <th className="px-6 py-3">End Time</th>
                                    <th className="px-6 py-3">Break (Min)</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {shifts.map((shift) => (
                                    <tr key={shift.shift_id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            {shift.shift_name}
                                            {shift.description && (
                                                <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{shift.description}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-slate-600">{shift.start_time?.slice(0, 5)}</td>
                                        <td className="px-6 py-4 font-mono text-slate-600">{shift.end_time?.slice(0, 5)}</td>
                                        <td className="px-6 py-4 text-slate-600">{shift.break_minutes}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${shift.is_active
                                                ? 'bg-green-50 text-green-700 ring-green-600/20'
                                                : 'bg-slate-100 text-slate-600 ring-slate-500/10'}`}>
                                                {shift.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(shift)}
                                                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="Edit Shift"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(shift.shift_id)}
                                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Delete Shift"
                                                >
                                                    <Trash size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-semibold text-slate-800">{editingShift ? 'Edit Shift' : 'Create New Shift'}</h3>
                            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Shift Name</label>
                                <input
                                    type="text"
                                    name="shift_name"
                                    required
                                    value={formData.shift_name}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm py-2 px-3 border"
                                    placeholder="e.g. General Shift"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                                    <input
                                        type="time"
                                        name="start_time"
                                        required
                                        value={formData.start_time}
                                        onChange={handleChange}
                                        className="w-full rounded-lg border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm py-2 px-3 border"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                                    <input
                                        type="time"
                                        name="end_time"
                                        required
                                        value={formData.end_time}
                                        onChange={handleChange}
                                        className="w-full rounded-lg border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm py-2 px-3 border"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Break Duration (Minutes)</label>
                                <input
                                    type="number"
                                    name="break_minutes"
                                    required
                                    min="0"
                                    value={formData.break_minutes}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm py-2 px-3 border"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    name="description"
                                    rows="2"
                                    value={formData.description}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm py-2 px-3 border"
                                    placeholder="Optional description..."
                                ></textarea>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    name="is_active"
                                    checked={formData.is_active}
                                    onChange={handleChange}
                                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                />
                                <label htmlFor="is_active" className="text-sm text-slate-700 font-medium">Active Shift</label>
                            </div>

                            <div className="pt-2 flex gap-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                                >
                                    {editingShift ? 'Update Shift' : 'Create Shift'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShiftManagement;
