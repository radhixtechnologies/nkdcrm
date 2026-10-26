import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import './UserManagement.css';

const UserManagement = () => {
    const [employees, setEmployees] = useState([]);
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        roleId: '',
        employeeId: null
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);

            // Fetch employees, users, and roles
            const [employeesRes, usersRes, rolesRes] = await Promise.all([
                api.get('/employees'),
                api.get('/users'),
                api.get('/users/roles')
            ]);

            setEmployees(employeesRes.data.data || []);
            setUsers(usersRes.data.data || []);
            setRoles(rolesRes.data.data || []);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openCreateModal = (employee) => {
        setSelectedEmployee(employee);
        setFormData({
            email: employee.email || '',
            password: '',
            roleId: '5', // Default to Employee role
            employeeId: employee.employee_id
        });
        setShowCreateModal(true);
        setError('');
        setSuccess('');
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            await api.post('/auth/register', {
                email: formData.email,
                password: formData.password,
                roleId: parseInt(formData.roleId),
                employeeId: formData.employeeId
            });

            setSuccess('Login access enabled successfully!');
            setShowCreateModal(false);
            fetchData(); // Refresh data
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create user');
        }
    };

    const handleRoleChange = async (userId, newRoleId) => {
        try {
            await api.put(`/users/${userId}/role`, {
                roleId: parseInt(newRoleId)
            });

            setSuccess('Role updated successfully!');
            fetchData(); // Refresh data
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update role');
        }
    };

    const toggleUserStatus = async (userId, currentStatus) => {
        try {
            await api.put(`/users/${userId}/status`, {
                isActive: !currentStatus
            });

            setSuccess(`Login access ${!currentStatus ? 'enabled' : 'disabled'} successfully!`);
            fetchData(); // Refresh data
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update status');
        }
    };

    // Get employees without user accounts
    const employeesWithoutAccounts = employees.filter(emp =>
        !users.some(user => user.employee_id === emp.employee_id)
    );

    if (loading) {
        return (
            <div className="user-management-loading">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className="user-management">
            <div className="page-header">
                <h1>Login Access Management</h1>
                <p>Manage system login access and assign roles</p>
            </div>

            {error && (
                <div className="alert alert-error">
                    <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                        <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    {error}
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            {success && (
                <div className="alert alert-success">
                    <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                        <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    {success}
                    <button onClick={() => setSuccess('')}>×</button>
                </div>
            )}

            {/* Existing Users */}
            <div className="section">
                <h2>Employees with Login Access ({users.length})</h2>
                <div className="users-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Employee Name</th>
                                <th>Email</th>
                                <th>Current Role</th>
                                <th>Status</th>
                                <th>Last Login</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => {
                                const employee = employees.find(e => e.employee_id === user.employee_id);
                                return (
                                    <tr key={user.user_id}>
                                        <td>{employee ? `${employee.first_name} ${employee.last_name}` : 'N/A'}</td>
                                        <td>{user.email}</td>
                                        <td>
                                            <select
                                                value={user.role_id}
                                                onChange={(e) => handleRoleChange(user.user_id, e.target.value)}
                                                className="role-dropdown"
                                            >
                                                {roles.map(role => (
                                                    <option key={role.role_id} value={role.role_id}>
                                                        {role.role_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                                                {user.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                                        <td>
                                            <button
                                                onClick={() => toggleUserStatus(user.user_id, user.is_active)}
                                                className={`btn-action ${user.is_active ? 'btn-deactivate' : 'btn-activate'}`}
                                            >
                                                {user.is_active ? 'Disable' : 'Enable'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Employees Without Accounts */}
            <div className="section">
                <h2>Employees without Login Access ({employeesWithoutAccounts.length})</h2>
                <div className="employees-grid">
                    {employeesWithoutAccounts.map(employee => (
                        <div key={employee.employee_id} className="employee-card">
                            <div className="employee-info">
                                <h3>{employee.first_name} {employee.last_name}</h3>
                                <p className="employee-email">{employee.email}</p>
                                <p className="employee-designation">{employee.designation}</p>
                                <p className="employee-department">{employee.department}</p>
                            </div>
                            <button
                                onClick={() => openCreateModal(employee)}
                                className="btn-create-account"
                            >
                                <svg viewBox="0 0 24 24" fill="none">
                                    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                Enable Login Access
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Enable Login Access</h2>
                            <button onClick={() => setShowCreateModal(false)} className="modal-close">×</button>
                        </div>

                        <form onSubmit={handleCreateUser} className="user-form">
                            <div className="form-group">
                                <label>Employee</label>
                                <input
                                    type="text"
                                    value={selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : ''}
                                    disabled
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label>Login Email Address *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    className="form-input"
                                    placeholder="user@nkdcrm.com"
                                />
                            </div>

                            <div className="form-group">
                                <label>Temporary Password *</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                    className="form-input"
                                    placeholder="Minimum 8 characters"
                                    minLength="8"
                                />
                                <small>User will be prompted to change this on first login</small>
                            </div>

                            <div className="form-group">
                                <label>Assign Role *</label>
                                <select
                                    value={formData.roleId}
                                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                                    required
                                    className="form-select"
                                >
                                    <option value="">Select a role...</option>
                                    {roles.map(role => (
                                        <option key={role.role_id} value={role.role_id}>
                                            {role.role_name} - {role.description}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-cancel">
                                    Cancel
                                </button>
                                <button type="submit" className="btn-submit">
                                    Enable Access
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
