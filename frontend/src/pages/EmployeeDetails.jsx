import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck, FileCheck, Laptop } from 'lucide-react';
import EmployeeForm from '../components/forms/EmployeeForm';
import api, { extractApiError, getFileUrl } from '../services/api';
import employeeService from '../services/employeeService';
import toast from 'react-hot-toast';

const EmployeeDetails = () => {
    const { id } = useParams(); // 'id' matches route param
    const navigate = useNavigate();
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEmployee = async () => {
            try {
                const res = await api.get(`/employees/${id}`);
                setEmployee(res.data.data || res.data);
            } catch (err) {
                console.error(err);
                toast.error(extractApiError(err, 'Failed to load employee details'));
                navigate('/employees');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchEmployee();
        }
    }, [id, navigate]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (!employee) return null;

    return (
        <div className="flex flex-col min-h-0 space-y-4 pb-16">
            <div className="flex flex-wrap items-center gap-3">
                <button
                    onClick={() => navigate('/employees')}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors shrink-0"
                    title="Back to Employees"
                >
                    <ArrowLeft size={20} className="text-slate-600" />
                </button>
                <div className="flex items-center gap-3.5 min-w-0">
                    {(employee.documents?.employee_photo || employee.documents?.photo) ? (
                        <img
                            src={getFileUrl(employee.documents?.employee_photo || employee.documents?.photo)}
                            alt=""
                            className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md ring-2 ring-primary-500/20 shrink-0"
                        />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-md shrink-0">
                            {(employee.first_name?.[0] || 'E')}{(employee.last_name?.[0] || '')}
                        </div>
                    )}
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">
                                {employee.first_name} {employee.last_name}
                            </h1>
                            <span className="font-mono text-xs sm:text-sm text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                                {employee.employee_code}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                            {employee.designation || 'Staff'} • {employee.department || 'Operations'}
                            {employee.father_name && ` • S/o ${employee.father_name}`}
                        </p>
                    </div>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => employeeService.downloadOshAppointmentLetter(employee.employee_id || employee.employee_code, employee.employee_code)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                        title="Download Official OSH Code 2020 Annexure-I Appointment Letter"
                    >
                        <FileText size={15} />
                        <span>Download OSH Appointment Letter (Annexure-I)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => employeeService.downloadIntegrityAgreement(employee.employee_id || employee.employee_code, employee.employee_code)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                        title="Download Integrity & Confidentiality Agreement (NDA)"
                    >
                        <ShieldCheck size={15} />
                        <span>Download NDA / Integrity Agreement</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => employeeService.downloadStaffJoiningLetter(employee.employee_id || employee.employee_code, employee.employee_code)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                        title="Download Official Staff Joining Letter (10 Terms + HR Signature)"
                    >
                        <FileCheck size={15} />
                        <span>Download Staff Joining Letter</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => employeeService.downloadAssetHandoverForm(employee.employee_id || employee.employee_code, employee.employee_code)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                        title="Download IT Asset Handover Form (Laptop / Devices)"
                    >
                        <Laptop size={15} />
                        <span>Download Asset Handover Form</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <EmployeeForm
                    initialData={employee}
                    isModal={false}
                    viewOnly={true}
                    onClose={() => navigate('/employees')}
                    onSuccess={() => {
                        toast.success("Changes saved");
                    }}
                />
            </div>
        </div>
    );
};

export default EmployeeDetails;
