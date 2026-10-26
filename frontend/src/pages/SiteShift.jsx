import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import employeeService from '../services/employeeService';
import { MapPin, Clock, Lock, Loader, Building2, Calendar, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const SiteShift = () => {
    const { user, hasRole } = useAuth();
    const [loading, setLoading] = useState(true);
    const [employeeData, setEmployeeData] = useState(null);
    const [allEmployees, setAllEmployees] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const isAdmin = hasRole('SUPER_ADMIN', 'HR_ADMIN') || ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.roleCode || user?.role?.roleCode || user?.role);

    const fetchAllEmployees = React.useCallback(async () => {
        try {
            const res = await employeeService.getEmployees();
            setAllEmployees(res.data.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load employees data');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchProfile = React.useCallback(async () => {
        if (!user?.employeeCode) {
            setLoading(false);
            return;
        }
        try {
            const res = await employeeService.getEmployeeById(user.employeeCode);
            setEmployeeData(res.data.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load site and shift information');
        } finally {
            setLoading(false);
        }
    }, [user?.employeeCode]);

    useEffect(() => {
        if (isAdmin) {
            fetchAllEmployees();
        } else if (user?.employeeCode) {
            fetchProfile();
        } else {
            setLoading(false);
        }
    }, [isAdmin, user?.employeeCode, fetchAllEmployees, fetchProfile]);

    const filteredEmployees = allEmployees.filter(emp =>
        emp.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.site_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader className="animate-spin text-primary-600" size={40} />
            </div>
        );
    }

    if (isAdmin) {
        return (
            <div className="max-w-7xl mx-auto pb-10 px-4">
                <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Site & Shift Management</h1>
                        <p className="text-sm text-slate-500 mt-1">Overview of all employee site assignments and shift timings</p>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search employees or sites..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-full md:w-64"
                        />
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-medium">
                                    <th className="px-6 py-4">Employee</th>
                                    <th className="px-6 py-4">Work Location (Site)</th>
                                    <th className="px-6 py-4">Shift Schedule</th>
                                    <th className="px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredEmployees.length > 0 ? (
                                    filteredEmployees.map((emp) => (
                                        <tr key={emp.employee_id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                                                        {emp.first_name?.[0]}{emp.last_name?.[0]}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-slate-900">{emp.first_name} {emp.last_name}</div>
                                                        <div className="text-xs text-slate-500 font-mono">{emp.employee_code}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {emp.site_name ? (
                                                    <div className="flex items-center gap-2 text-slate-700">
                                                        <MapPin size={16} className="text-slate-400" />
                                                        <span>{emp.site_name}</span>
                                                        <span className="text-xs text-slate-400 font-mono">({emp.site_code})</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">Not Assigned</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {emp.shift_name ? (
                                                    <div>
                                                        <div className="flex items-center gap-2 font-medium text-slate-700">
                                                            <Clock size={16} className="text-slate-400" />
                                                            {emp.shift_name}
                                                        </div>
                                                        <div className="text-xs text-slate-500 mt-0.5 ml-6">
                                                            {emp.start_time?.slice(0, 5)} - {emp.end_time?.slice(0, 5)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">Not Assigned</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${emp.employment_status === 'ACTIVE'
                                                    ? 'bg-green-50 text-green-700 ring-green-600/20'
                                                    : 'bg-red-50 text-red-700 ring-red-600/20'
                                                    }`}>
                                                    {emp.employment_status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <Users size={32} className="text-slate-300 mb-3" />
                                                <p>No employees found matching your search.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto pb-10 px-4">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Site & Shift Setup</h1>
                <p className="text-sm text-slate-500 mt-1">View your assigned work location and shift timing</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Site Information Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Work Location</h3>
                            <p className="text-xs text-slate-500">Your assigned site/branch</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                                Site / Branch
                            </label>
                            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <MapPin size={18} className="text-slate-400" />
                                <span className="font-medium text-slate-800">
                                    {employeeData?.site_name || 'Not Assigned'}
                                </span>
                            </div>
                        </div>

                        {employeeData?.site_code && (
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                                    Site Code
                                </label>
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <span className="font-mono text-sm text-slate-700">
                                        {employeeData.site_code}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Shift Information Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                        <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                            <Clock size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Shift Timing</h3>
                            <p className="text-xs text-slate-500">Your working hours</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                                Shift Name
                            </label>
                            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <Calendar size={18} className="text-slate-400" />
                                <span className="font-medium text-slate-800">
                                    {employeeData?.shift_name || 'Not Assigned'}
                                </span>
                            </div>
                        </div>

                        {employeeData?.start_time && employeeData?.end_time && (
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                                    Working Hours
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                        <p className="text-xs text-green-600 font-medium mb-1">Start Time</p>
                                        <p className="text-lg font-bold text-green-700">
                                            {employeeData.start_time?.slice(0, 5)}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                                        <p className="text-xs text-red-600 font-medium mb-1">End Time</p>
                                        <p className="text-lg font-bold text-red-700">
                                            {employeeData.end_time?.slice(0, 5)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Information Notice */}
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <Lock size={20} className="text-amber-600 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-amber-900 text-sm mb-1">
                            Managed by HR Department
                        </h4>
                        <p className="text-xs text-amber-700">
                            Site and shift assignments are controlled by the HR team. If you need to request a change,
                            please contact your HR representative or manager.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SiteShift;
