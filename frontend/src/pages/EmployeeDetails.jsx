import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import EmployeeForm from '../components/forms/EmployeeForm';
import api from '../services/api';
import toast from 'react-hot-toast';

const EmployeeDetails = () => {
    const { id } = useParams(); // 'id' matches route param
    const navigate = useNavigate();
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEmployee = async () => {
            try {
                // If id is numeric (like 123) it might be ID, but we usually use code.
                // Assuming route /employees/:id uses employee_code or employee_id.
                // Backend GET /:code calls getEmployeeByCode.
                // Frontend usually passes employee_code.
                const res = await api.get(`/employees/${id}`);
                setEmployee(res.data.data || res.data);
            } catch (err) {
                console.error(err);
                toast.error("Failed to load employee details");
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
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (!employee) return null;

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/employees')}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    title="Back to Employees"
                >
                    <ArrowLeft size={20} className="text-slate-600" />
                </button>
                <h1 className="text-2xl font-bold text-slate-800">
                    {employee.first_name} {employee.last_name}
                </h1>
                <span className="font-mono text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    {employee.employee_code}
                </span>
            </div>

            <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <EmployeeForm
                    initialData={employee}
                    isModal={false}
                    viewOnly={true}
                    onClose={() => navigate('/employees')}
                    onSuccess={() => {
                        // Refresh data or just confirm
                        toast.success("Changes saved");
                        // Ideally refetch, but for now navigate or stay is fine.
                    }}
                />
            </div>
        </div>
    );
};

export default EmployeeDetails;
