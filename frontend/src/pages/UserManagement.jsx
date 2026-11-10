import React, { useState, useEffect, useCallback } from 'react';
import {
    Users, Shield, Search, UserPlus, CheckCircle2, XCircle,
    Clock, Mail, X, RefreshCw, KeyRound
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { extractApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ModalPortal from '../components/common/ModalPortal';

const formatLastLoginIST = (val) => {
    if (!val) return 'Never';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return 'Never';
    return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

const UserManagement = () => {
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('USERS', 'can_create');
    const canUpdate = hasPermission('USERS', 'can_update');

    const [employees, setEmployees] = useState([]);
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        roleId: '',
        employeeId: null
    });

    const getDefaultRoleId = useCallback((loadedRoles) => {
        if (!Array.isArray(loadedRoles) || loadedRoles.length === 0) return '';
        const empRole = loadedRoles.find(r => r.role_code === 'EMPLOYEE');
        return String((empRole || loadedRoles[0]).role_id);
    }, []);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [employeesRes, usersRes, rolesRes] = await Promise.all([
                api.get('/employees').catch(() => ({ data: { data: [] } })),
                api.get('/users'),
                api.get('/users/roles')
            ]);

            setEmployees(employeesRes.data?.data || []);
            setUsers(usersRes.data?.data || []);
            setRoles(rolesRes.data?.data || []);
        } catch (err) {
            console.error('Error fetching user management data:', err);
            toast.error(extractApiError(err, 'Failed to load login access data'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openCreateModal = (employee = null) => {
        setSelectedEmployee(employee);
        setFormData({
            email: employee?.email || '',
            password: '',
            roleId: getDefaultRoleId(roles),
            employeeId: employee?.employee_id || null
        });
        setShowCreateModal(true);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!formData.email.trim()) {
            toast.error('Login email is required');
            return;
        }
        if (!formData.password || formData.password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        if (!formData.roleId) {
            toast.error('Please select a role');
            return;
        }

        setSubmitting(true);
        try {
            await api.post('/auth/register', {
                email: formData.email.trim(),
                password: formData.password,
                roleId: parseInt(formData.roleId, 10),
                employeeId: formData.employeeId || null
            });

            toast.success('Portal login access created successfully!');
            setShowCreateModal(false);
            fetchData();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to create user'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleRoleChange = async (userId, newRoleId) => {
        try {
            await api.put(`/users/${userId}/role`, {
                roleId: parseInt(newRoleId, 10)
            });
            toast.success('Role updated successfully');
            fetchData();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to update role'));
        }
    };

    const toggleUserStatus = async (userId, currentStatus) => {
        try {
            await api.put(`/users/${userId}/status`, {
                isActive: !currentStatus
            });
            toast.success(`Login access ${!currentStatus ? 'enabled' : 'disabled'} successfully`);
            fetchData();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to update status'));
        }
    };

    const q = searchTerm.trim().toLowerCase();

    const filteredUsers = users.filter((u) => {
        if (!q) return true;
        const emp = employees.find(e => e.employee_id === u.employee_id);
        const empName = emp ? `${emp.first_name} ${emp.last_name}`.toLowerCase() : '';
        const roleName = String(u.role_name || u.role_code || '').toLowerCase();
        return (
            empName.includes(q) ||
            String(u.email || '').toLowerCase().includes(q) ||
            roleName.includes(q) ||
            String(emp?.employee_code || '').toLowerCase().includes(q)
        );
    });

    const employeesWithoutAccounts = employees
        .filter(emp => !users.some(u => u.employee_id === emp.employee_id))
        .filter(emp => {
            if (!q) return true;
            const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
            return (
                fullName.includes(q) ||
                String(emp.email || '').toLowerCase().includes(q) ||
                String(emp.employee_code || '').toLowerCase().includes(q) ||
                String(emp.designation || '').toLowerCase().includes(q) ||
                String(emp.department || '').toLowerCase().includes(q)
            );
        });

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[360px] gap-3 text-slate-500">
                <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Loading user access directory...</span>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-16">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Shield className="text-primary-600 shrink-0" size={24} />
                        Login Access Management
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        Manage portal login accounts, role assignments (RBAC), and client/staff access
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        type="button"
                        onClick={fetchData}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                    {canCreate && (
                        <button
                            type="button"
                            onClick={() => openCreateModal(null)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors"
                        >
                            <UserPlus size={15} /> Create Portal User
                        </button>
                    )}
                </div>
            </div>

            {/* Search & Stats */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="relative w-full sm:w-96">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search user name, email, employee code, or role..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-slate-50/50"
                    />
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 flex-wrap">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {users.filter(u => u.is_active).length} Active Accounts
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {employeesWithoutAccounts.length} Pending Access
                    </span>
                </div>
            </div>

            {/* Existing Users Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Users size={16} className="text-primary-600" />
                        Portal Accounts ({filteredUsers.length})
                    </h2>
                </div>

                {filteredUsers.length === 0 ? (
                    <div className="p-10 text-center text-slate-500 text-sm">
                        No portal accounts matched your filter.
                    </div>
                ) : (
                    <>
                        {/* Mobile Cards */}
                        <div className="block md:hidden divide-y divide-slate-100">
                            {filteredUsers.map((u) => {
                                const emp = employees.find(e => e.employee_id === u.employee_id);
                                return (
                                    <div key={u.user_id} className="p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-900 text-sm truncate">
                                                    {emp ? `${emp.first_name} ${emp.last_name}` : (u.full_name || 'Portal / Client Account')}
                                                </p>
                                                <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                                    <Mail size={12} className="shrink-0" /> {u.email}
                                                </p>
                                            </div>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                                u.is_active
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                            }`}>
                                                {u.is_active ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                                                {u.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">Assigned Role</label>
                                            <select
                                                value={u.role_id || ''}
                                                disabled={!canUpdate}
                                                onChange={(e) => handleRoleChange(u.user_id, e.target.value)}
                                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 disabled:bg-slate-100"
                                            >
                                                {roles.map(role => (
                                                    <option key={role.role_id} value={role.role_id}>
                                                        {role.role_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex items-center justify-between pt-1">
                                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                                <Clock size={12} /> {formatLastLoginIST(u.last_login)}
                                            </span>
                                            {canUpdate && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleUserStatus(u.user_id, u.is_active)}
                                                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                                                        u.is_active
                                                            ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                                    }`}
                                                >
                                                    {u.is_active ? 'Disable' : 'Enable'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-600">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider">
                                        <th className="px-6 py-3.5">Account Holder</th>
                                        <th className="px-6 py-3.5">Email</th>
                                        <th className="px-6 py-3.5">Assigned Role</th>
                                        <th className="px-6 py-3.5">Status</th>
                                        <th className="px-6 py-3.5">Last Login (IST)</th>
                                        <th className="px-6 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredUsers.map(u => {
                                        const emp = employees.find(e => e.employee_id === u.employee_id);
                                        return (
                                            <tr key={u.user_id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-900">
                                                        {emp ? `${emp.first_name} ${emp.last_name}` : (u.full_name || 'Portal / Client User')}
                                                    </div>
                                                    <div className="text-[11px] font-mono text-slate-500">
                                                        {emp?.employee_code || 'Standalone Account'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-slate-700">{u.email}</td>
                                                <td className="px-6 py-4">
                                                    <select
                                                        value={u.role_id || ''}
                                                        disabled={!canUpdate}
                                                        onChange={(e) => handleRoleChange(u.user_id, e.target.value)}
                                                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-primary-500 focus:outline-none disabled:bg-slate-100"
                                                    >
                                                        {roles.map(role => (
                                                            <option key={role.role_id} value={role.role_id}>
                                                                {role.role_name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                                        u.is_active
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    }`}>
                                                        {u.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 font-mono text-[11px]">
                                                    {formatLastLoginIST(u.last_login)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {canUpdate && (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleUserStatus(u.user_id, u.is_active)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                                u.is_active
                                                                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                                            }`}
                                                        >
                                                            {u.is_active ? 'Disable' : 'Enable'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Employees Without Accounts */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm sm:text-base font-bold text-slate-800">
                        Employees without Login Access ({employeesWithoutAccounts.length})
                    </h2>
                </div>

                {employeesWithoutAccounts.length === 0 ? (
                    <div className="text-center py-8 text-xs sm:text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
                        All filtered employees already have login accounts.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {employeesWithoutAccounts.map(employee => (
                            <div
                                key={employee.employee_id}
                                className="flex flex-col justify-between bg-slate-50/70 border border-slate-200 rounded-xl p-4 hover:border-primary-300 transition-colors"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-bold text-slate-900 text-sm truncate">
                                            {employee.first_name} {employee.last_name}
                                        </h3>
                                        <span className="text-[11px] font-mono text-primary-700 font-semibold shrink-0">
                                            {employee.employee_code}
                                        </span>
                                    </div>
                                    <p className="text-xs text-primary-600 truncate">
                                        {employee.email || 'No email on file'}
                                    </p>
                                    <p className="text-xs text-slate-500 truncate">
                                        {employee.designation || 'Staff'} • {employee.department || 'Operations'}
                                    </p>
                                </div>

                                {canCreate && (
                                    <button
                                        type="button"
                                        onClick={() => openCreateModal(employee)}
                                        className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 px-3 py-2 text-xs font-bold text-white shadow-xs transition-colors"
                                    >
                                        <KeyRound size={14} /> Enable Login Access
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <ModalPortal>
                    <div
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
                        onClick={() => setShowCreateModal(false)}
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                                <h2 className="text-base font-bold text-slate-800">
                                    {selectedEmployee ? 'Enable Employee Login Access' : 'Create Portal / Client Account'}
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="rounded-full p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateUser} className="p-6 space-y-4 overflow-y-auto">
                                {selectedEmployee ? (
                                    <div>
                                        <label className="input-label">Employee</label>
                                        <input
                                            type="text"
                                            value={`${selectedEmployee.first_name} ${selectedEmployee.last_name} (${selectedEmployee.employee_code})`}
                                            disabled
                                            className="input-field bg-slate-100 text-slate-600"
                                        />
                                    </div>
                                ) : (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                                        Create a standalone account (e.g., <strong>Client Login</strong> or external administrator) not tied to an employee master profile.
                                    </div>
                                )}

                                <div>
                                    <label className="input-label">Login Email Address *</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                        className="input-field"
                                        placeholder="user@nkdpowersolutions.com"
                                    />
                                </div>

                                <div>
                                    <label className="input-label">Temporary Password *</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required
                                        minLength={8}
                                        className="input-field"
                                        placeholder="Minimum 8 characters"
                                    />
                                    <p className="text-[11px] text-slate-500 mt-1">Minimum 8 characters required.</p>
                                </div>

                                <div>
                                    <label className="input-label">Assign Role *</label>
                                    <select
                                        value={formData.roleId}
                                        onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                                        required
                                        className="input-field"
                                    >
                                        <option value="">Select a role...</option>
                                        {roles.map(role => (
                                            <option key={role.role_id} value={role.role_id}>
                                                {role.role_name}{role.description ? ` - ${role.description}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2.5 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-xs disabled:opacity-60"
                                    >
                                        {submitting ? 'Creating...' : 'Create Account'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
};

export default UserManagement;
