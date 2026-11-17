import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, User, Edit, Trash, Eye, UploadCloud, FileText, ShieldCheck, FileCheck, IndianRupee } from 'lucide-react';
import EmployeeForm from '../components/forms/EmployeeForm';
import api, { extractApiError, getFileUrl } from '../services/api';
import employeeService from '../services/employeeService';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const formatJoiningDate = (val) => {
    if (!val) return 'N/A';
    const str = String(val).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? str : d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
};

const Employees = () => {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('EMPLOYEES', 'can_create');
    const canUpdate = hasPermission('EMPLOYEES', 'can_update');
    const canDelete = hasPermission('EMPLOYEES', 'can_delete');

    const [showForm, setShowForm] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [importing, setImporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const importInputRef = useRef(null);

    const fetchEmployees = useCallback(async () => {
        try {
            const response = await api.get('/employees');
            setEmployees(response.data.data || []);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch employees", error);
            toast.error(extractApiError(error, 'Failed to fetch employees'));
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

    const filteredEmployees = employees.filter(emp => {
        const term = searchTerm.toLowerCase();
        return (
            emp.full_name?.toLowerCase().includes(term) ||
            `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(term) ||
            emp.employee_code?.toLowerCase().includes(term) ||
            emp.department?.toLowerCase().includes(term) ||
            emp.designation?.toLowerCase().includes(term)
        );
    });

    return (
        <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto pb-16">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Employee Master</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage deployed workforce, statutory records & deployments</p>
                </div>
                {canCreate && (
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <input
                            type="file"
                            ref={importInputRef}
                            className="hidden"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleImportRegister}
                        />
                        <button
                            onClick={() => importInputRef.current?.click()}
                            disabled={importing}
                            className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs btn-press"
                        >
                            {importing ? 'Importing...' : <><UploadCloud size={15} className="text-primary-600" /> Import Register / Joining Sheet</>}
                        </button>
                        <button
                            onClick={() => {
                                setEditingEmployee(null);
                                setShowForm(true);
                            }}
                            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 px-4 py-2 text-xs font-bold text-white shadow-xs hover:shadow-md hover:shadow-primary-500/20 transition-all btn-press"
                        >
                            <Plus size={15} />
                            Add Employee
                        </button>
                    </div>
                )}
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="relative w-full sm:w-80">
                    <input
                        type="text"
                        placeholder="Search by name, code, designation, or department..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-3 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all bg-slate-50/50 hover:bg-white"
                    />
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="font-semibold text-slate-700">
                        Showing {filteredEmployees.length} of {employees.length} employees
                    </span>
                </div>
            </div>

            {/* Directory Container */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden min-h-[360px]">
                <div className="border-b border-slate-200/80 bg-slate-50/60 px-4 sm:px-6 py-4 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-sm">All Registered Employees</h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200/50">
                        {filteredEmployees.length} Total
                    </span>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                        <span>Loading employee directory...</span>
                    </div>
                ) : filteredEmployees.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                        <div className="mb-4 rounded-2xl bg-slate-100 p-4">
                            <User size={32} className="text-slate-400" />
                        </div>
                        <h3 className="text-base font-bold text-slate-800">No employees found</h3>
                        <p className="mt-1 text-xs text-slate-500 max-w-sm">
                            {searchTerm ? 'No results matched your search term.' : 'Get started by adding your first employee or importing Form XIII.'}
                        </p>
                        {canCreate && (
                            <button
                                onClick={() => {
                                    setEditingEmployee(null);
                                    setShowForm(true);
                                }}
                                className="mt-5 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs btn-press"
                            >
                                + Add Employee
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Mobile Cards View */}
                        <div className="block md:hidden divide-y divide-slate-100">
                            {filteredEmployees.map((emp) => (
                                <div key={emp.employee_id} className="p-4 space-y-2.5 hover:bg-slate-50/60">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {(emp.documents?.employee_photo || emp.documents?.photo) ? (
                                                <img
                                                    src={getFileUrl(emp.documents?.employee_photo || emp.documents?.photo)}
                                                    alt=""
                                                    className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                                                    onError={(e) => { e.target.style.display = 'none'; }}
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                                    {(emp.first_name?.[0] || 'E')}{(emp.last_name?.[0] || '')}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="font-mono text-xs font-bold text-primary-700">{emp.employee_code}</p>
                                                <h4 className="font-bold text-slate-900 text-sm truncate">
                                                    {emp.first_name} {emp.last_name}
                                                </h4>
                                                <p className="text-xs text-slate-500 truncate">
                                                    {emp.designation || 'Staff'} • {emp.department || 'Operations'}
                                                    {emp.father_name && ` • S/o ${emp.father_name}`}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold shrink-0 ${
                                            emp.employment_status === 'ACTIVE'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                        }`}>
                                            {emp.employment_status || 'ACTIVE'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                        <span className="text-[11px] font-mono text-slate-500">
                                            Joined: {formatJoiningDate(emp.date_of_joining)}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => navigate(`/employees/${emp.employee_code}`)}
                                                className="p-1.5 text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg border border-slate-200"
                                                title="View Profile Details"
                                            >
                                                <Eye size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => employeeService.downloadOshAppointmentLetter(emp.employee_id || emp.employee_code, emp.employee_code)}
                                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200"
                                                title="Download OSH Code Annexure-I Worker Appointment Letter"
                                            >
                                                <FileText size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => employeeService.downloadIntegrityAgreement(emp.employee_id || emp.employee_code, emp.employee_code)}
                                                className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg border border-slate-200"
                                                title="Download Integrity & Confidentiality Agreement (NDA)"
                                            >
                                                <ShieldCheck size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => employeeService.downloadStaffJoiningLetter(emp.employee_id || emp.employee_code, emp.employee_code)}
                                                className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg border border-slate-200"
                                                title="Download Official Staff Joining Letter (10 Terms + HR Signature)"
                                            >
                                                <FileCheck size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => employeeService.downloadSalaryStructure(emp.employee_id || emp.employee_code, emp.employee_code)}
                                                className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg border border-slate-200"
                                                title="Download Official Salary Structure & CTC Annexure"
                                            >
                                                <IndianRupee size={15} />
                                            </button>
                                            {canUpdate && (
                                                <button
                                                    onClick={() => handleEdit(emp)}
                                                    className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg border border-slate-200"
                                                    title="Edit Employee"
                                                >
                                                    <Edit size={15} />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDelete(emp.employee_id, emp.employee_code)}
                                                    className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200"
                                                    title="Delete Employee"
                                                >
                                                    <Trash size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-600">
                                <thead>
                                    <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider">
                                        <th className="px-6 py-3.5">Code</th>
                                        <th className="px-6 py-3.5">Name</th>
                                        <th className="px-6 py-3.5">Department</th>
                                        <th className="px-6 py-3.5">Designation</th>
                                        <th className="px-6 py-3.5">Joining Date</th>
                                        <th className="px-6 py-3.5">Status</th>
                                        <th className="px-6 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredEmployees.map((emp) => (
                                        <tr key={emp.employee_id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-6 py-4 font-mono font-bold text-primary-700 text-xs">{emp.employee_code}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {(emp.documents?.employee_photo || emp.documents?.photo) ? (
                                                        <img
                                                            src={getFileUrl(emp.documents?.employee_photo || emp.documents?.photo)}
                                                            alt=""
                                                            className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-xs shrink-0"
                                                            onError={(e) => { e.target.style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                                                            {(emp.first_name?.[0] || 'E')}{(emp.last_name?.[0] || '')}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <span className="font-bold text-slate-900 block truncate">
                                                            {emp.first_name} {emp.last_name}
                                                        </span>
                                                        {emp.father_name && (
                                                            <span className="text-[11px] text-slate-400 block truncate font-normal">
                                                                S/o {emp.father_name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                                    {emp.department || 'Operations'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-700">{emp.designation || 'Staff'}</td>
                                            <td className="px-6 py-4 text-slate-500 font-mono">
                                                {formatJoiningDate(emp.date_of_joining)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                                    emp.employment_status === 'ACTIVE'
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                }`}>
                                                    {emp.employment_status || 'ACTIVE'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => navigate(`/employees/${emp.employee_code}`)}
                                                        className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors btn-press"
                                                        title="View Profile Details"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => employeeService.downloadOshAppointmentLetter(emp.employee_id || emp.employee_code, emp.employee_code)}
                                                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors btn-press"
                                                        title="Download OSH Code Annexure-I Worker Appointment Letter"
                                                    >
                                                        <FileText size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => employeeService.downloadIntegrityAgreement(emp.employee_id || emp.employee_code, emp.employee_code)}
                                                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors btn-press"
                                                        title="Download Integrity & Confidentiality Agreement (NDA)"
                                                    >
                                                        <ShieldCheck size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => employeeService.downloadStaffJoiningLetter(emp.employee_id || emp.employee_code, emp.employee_code)}
                                                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors btn-press"
                                                        title="Download Official Staff Joining Letter (10 Terms + HR Signature)"
                                                    >
                                                        <FileCheck size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => employeeService.downloadSalaryStructure(emp.employee_id || emp.employee_code, emp.employee_code)}
                                                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors btn-press"
                                                        title="Download Official Salary Structure & CTC Annexure"
                                                    >
                                                        <IndianRupee size={16} />
                                                    </button>
                                                    {canUpdate && (
                                                        <button
                                                            onClick={() => handleEdit(emp)}
                                                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors btn-press"
                                                            title="Edit Employee"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                    )}
                                                    {canDelete && (
                                                        <button
                                                            onClick={() => handleDelete(emp.employee_id, emp.employee_code)}
                                                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors btn-press"
                                                            title="Delete Employee"
                                                        >
                                                            <Trash size={16} />
                                                        </button>
                                                    )}
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
