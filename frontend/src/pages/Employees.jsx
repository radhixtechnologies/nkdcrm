import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, User, Edit, Trash, Eye, UploadCloud, FileText } from 'lucide-react';
import EmployeeForm from '../components/forms/EmployeeForm';
import api from '../services/api';
import employeeService from '../services/employeeService';
import toast from 'react-hot-toast';

const Employees = () => {
    const navigate = useNavigate();
    const [showForm, setShowForm] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [importing, setImporting] = useState(false);
    const importInputRef = useRef(null);

    const fetchEmployees = useCallback(async () => {
        try {
            const response = await api.get('/employees');
            setEmployees(response.data.data || []);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch employees", error);
            setLoading(false);
        }
    }, []);

    const handleImportRegister = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImporting(true);
        const toastId = toast.loading("Preparing import...");

        try {
            // Auto-detect site (Use the first one found or default Site 1)
            let siteId = 1;
            try {
                const siteRes = await api.get('/sites');
                if (siteRes.data.data && siteRes.data.data.length > 0) {
                    siteId = siteRes.data.data[0].site_id;
                    console.log(`Auto-detected Site: ${siteRes.data.data[0].site_code} (ID: ${siteId})`);
                }
            } catch (err) {
                console.warn("Could not fetch sites, defaulting to ID 1", err);
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('site_id', siteId);

            toast.loading("Importing Statutory Register...", { id: toastId });

            const res = await api.post('/statutory/import-register', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                const { success, errors, warnings } = res.data.data;
                const successCount = success.length;
                const errorCount = errors.length;
                const warningCount = warnings?.length || 0;

                console.group("Import Results");
                console.log(`Success: ${successCount}`);
                if (warningCount > 0) console.warn("Warnings:", warnings);
                if (errorCount > 0) console.error("Errors:", errors);
                console.groupEnd();

                let msg = `Imported ${successCount} employees.`;

                // Detailed Warning Summary
                if (res.data.data.summary) {
                    const breakdown = Object.entries(res.data.data.summary)
                        .map(([k, v]) => `${k} (${v})`)
                        .join(', ');
                    if (breakdown) msg += ` Warnings: [${breakdown}]`;
                } else if (warningCount > 0) {
                    msg += ` ${warningCount} warnings based on missing/invalid data.`;
                }

                if (errorCount > 0) msg += ` ${errorCount} failed.`;

                if (errorCount > 0) {
                    toast.error(`${msg} Check console for row details.`, { id: toastId, duration: 8000 });
                } else if (warningCount > 0) {
                    toast(`${msg}`, { id: toastId, duration: 8000, icon: '⚠️' });
                } else {
                    toast.success(msg, { id: toastId });
                }

                fetchEmployees(); // Refresh list
            } else {
                toast.error("Import failed with errors", { id: toastId });
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || "Import Failed", { id: toastId });
        } finally {
            setImporting(false);
            if (importInputRef.current) importInputRef.current.value = '';
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    const handleEdit = (emp) => {
        setEditingEmployee(emp);
        setShowForm(true);
    };

    const handleDelete = async (empId, empCode) => {
        if (!empCode) {
            toast.error("Invalid employee code");
            return;
        }

        if (window.confirm(`Are you sure you want to delete employee ${empCode}?`)) {
            try {
                // We use empCode because our backend route is /api/employees/:code
                await employeeService.deleteEmployee(empCode);
                toast.success('Employee deleted successfully');
                fetchEmployees();
            } catch (error) {
                console.error("Delete failed", error);

                // Handle specific error messages from backend
                const msg = error.response?.data?.message || 'Failed to delete employee';
                toast.error(msg);
            }
        }
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingEmployee(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Employee Management</h1>
                    <p className="text-slate-500">Manage your workforce efficiently</p>
                </div>
                <div className="flex gap-3">
                    <input
                        type="file"
                        ref={importInputRef}
                        className="hidden"
                        accept=".xlsx, .xls"
                        onChange={handleImportRegister}
                    />
                    <button
                        onClick={() => importInputRef.current?.click()}
                        disabled={importing}
                        className="flex items-center gap-2 rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        {importing ? 'Importing...' : <><UploadCloud size={16} /> Import Register (Form XIII)</>}
                    </button>
                    <button
                        onClick={() => {
                            setEditingEmployee(null);
                            setShowForm(true);
                        }}
                        className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition-colors"
                    >
                        <Plus size={16} />
                        Add Employee
                    </button>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[400px]">
                <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-700">All Employees ({employees.length})</h3>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-slate-500">Loading employees...</div>
                ) : employees.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                        <div className="mb-4 rounded-full bg-slate-100 p-4">
                            <User size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900">No employees found</h3>
                        <p className="mt-1 text-sm text-slate-500 max-w-sm">
                            Get started by adding your first employee to the system.
                        </p>
                        <button
                            onClick={() => {
                                setEditingEmployee(null);
                                setShowForm(true);
                            }}
                            className="mt-6 rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Add Employee
                        </button>
                    </div>
                ) : (
                    <div className="overflow-visible">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-medium">
                                    <th className="px-6 py-3">Employee Code</th>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-6 py-3">Department</th>
                                    <th className="px-6 py-3">Designation</th>
                                    <th className="px-6 py-3">Joining Date</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {employees.map((emp) => (
                                    <tr key={emp.employee_id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{emp.employee_code}</td>
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            {emp.first_name} {emp.last_name}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                                {emp.department || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">{emp.designation}</td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {new Date(emp.date_of_joining).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${emp.employment_status === 'ACTIVE'
                                                ? 'bg-green-50 text-green-700 ring-green-600/20'
                                                : 'bg-red-50 text-red-700 ring-red-600/20'
                                                }`}>
                                                {emp.employment_status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/employees/${emp.employee_code}`)}
                                                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(emp)}
                                                    className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                    title="Edit Employee"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(emp.employee_id, emp.employee_code)}
                                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Delete Employee"
                                                >
                                                    <Trash size={18} />
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
                <EmployeeForm
                    onClose={handleCloseForm}
                    onSuccess={fetchEmployees}
                    initialData={editingEmployee}
                />
            )}
        </div>
    );
};

export default Employees;
