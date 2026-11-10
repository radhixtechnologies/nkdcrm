import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import employeeService from '../services/employeeService';
import { getFileUrl, extractApiError } from '../services/api';
import { User, Mail, Phone, MapPin, Lock, Save, Loader, Edit2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const Profile = () => {
    const { user, refreshSession, getRoleCode } = useAuth();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const [formData, setFormData] = useState({
        mobile: '',
        personal_email: '',
        address: '',
        emergency_contact: '',
        blood_group: ''
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [employeeData, setEmployeeData] = useState(null);

    const fetchProfile = useCallback(async () => {
        setLoading(true);
        try {
            const res = await employeeService.getMyProfile();
            const data = res.data?.data || null;
            setEmployeeData(data);
            if (data) {
                setFormData({
                    mobile: data.mobile || '',
                    personal_email: data.personal_email || '',
                    address: data.address || '',
                    emergency_contact: data.emergency_contact || '',
                    blood_group: data.blood_group || ''
                });
            }
        } catch (error) {
            if (error?.response?.status === 404) {
                setEmployeeData(null);
            } else {
                toast.error(extractApiError(error, 'Failed to load profile'), { id: 'profile-load-err' });
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        if (!employeeData) return;

        setSubmitting(true);
        try {
            await employeeService.updateMyProfile({
                mobile: formData.mobile,
                personal_email: formData.personal_email,
                address: formData.address,
                emergency_contact: formData.emergency_contact,
                blood_group: formData.blood_group
            });
            toast.success('Profile updated successfully');
            setIsEditing(false);
            await Promise.all([fetchProfile(), refreshSession()]);
        } catch (error) {
            toast.error(extractApiError(error, 'Update failed'));
        } finally {
            setSubmitting(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!passwordForm.currentPassword) {
            return toast.error('Current password is required');
        }
        if (passwordForm.newPassword.length < 8) {
            return toast.error('New password must be at least 8 characters');
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            return toast.error('New passwords do not match');
        }

        setChangingPassword(true);
        try {
            await employeeService.changePassword({
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            toast.success('Password updated successfully');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            toast.error(extractApiError(error, 'Failed to update password'));
        } finally {
            setChangingPassword(false);
        }
    };

    if (loading) {
        return <div className="text-center py-10"><Loader className="animate-spin mx-auto text-primary-600" /></div>;
    }

    const roleDisplay = user?.role?.roleName || user?.roleName || getRoleCode() || 'User';

    return (
        <div className="max-w-7xl mx-auto pb-10">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-6">My Profile</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ID Card / Read Only Info */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
                        <div className="w-24 h-24 bg-primary-100 rounded-full mx-auto flex items-center justify-center text-primary-600 mb-4 text-3xl font-bold border-4 border-white overflow-hidden shadow-sm">
                            {user?.avatar ? <img src={getFileUrl(user.avatar)} alt="Profile" className="w-full h-full object-cover" /> : <User size={40} />}
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">{user?.firstName} {user?.lastName}</h2>
                        <p className="text-slate-500 text-xs mt-1">{user?.email}</p>
                        {employeeData?.employee_code && (
                            <p className="text-slate-600 text-xs mt-2 font-mono bg-slate-100 inline-block px-2.5 py-0.5 rounded">
                                {employeeData.employee_code}
                            </p>
                        )}

                        <div className="mt-6 pt-6 border-t border-slate-100 space-y-3 text-sm text-left">
                            <div className="flex justify-between items-center gap-2">
                                <span className="text-slate-500">Role</span>
                                <span className="font-semibold text-primary-600 bg-primary-50 px-2.5 py-1 rounded text-xs truncate">
                                    {roleDisplay}
                                </span>
                            </div>
                            {employeeData && (
                                <>
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-slate-500">Designation</span>
                                        <span className="font-medium text-slate-800 text-right">{employeeData.designation || '-'}</span>
                                    </div>
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-slate-500">Department</span>
                                        <span className="font-medium text-slate-800">{employeeData.department || '-'}</span>
                                    </div>
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-slate-500">Joined On</span>
                                        <span className="font-medium text-slate-800">
                                            {employeeData.date_of_joining
                                                ? new Date(
                                                    typeof employeeData.date_of_joining === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(employeeData.date_of_joining.trim())
                                                        ? `${employeeData.date_of_joining.trim()}T00:00:00+05:30`
                                                        : employeeData.date_of_joining
                                                ).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
                                                : '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-slate-500">Employment</span>
                                        <span className="font-medium text-slate-800">{employeeData.employment_type || 'Permanent'}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {employeeData && (
                        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <User size={64} />
                            </div>
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">Basic Salary</p>
                            <h3 className="text-2xl font-bold text-slate-800">₹ {parseFloat(employeeData.basic_salary || 0).toLocaleString('en-IN')}</h3>
                            <p className="text-slate-400 text-xs mt-2">Confidential Information</p>
                        </div>
                    )}
                </div>

                {/* Right Column: Contact Details + Security Password Change */}
                <div className="md:col-span-2 space-y-6">
                    {employeeData ? (
                        <form onSubmit={handleProfileSubmit} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 md:p-8">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Personal Details</h3>
                                        <p className="text-xs text-slate-500">Update your contact information</p>
                                    </div>
                                </div>
                                {!isEditing && (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(true)}
                                        className="flex items-center gap-2 text-primary-600 hover:bg-primary-50 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Edit2 size={16} /> Edit Details
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                                        <Phone size={14} className="text-slate-400" /> Mobile
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.mobile}
                                        onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                                        disabled={!isEditing}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                                        placeholder="+91..."
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                                        <Mail size={14} className="text-slate-400" /> Personal Email
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.personal_email}
                                        onChange={e => setFormData({ ...formData, personal_email: e.target.value })}
                                        disabled={!isEditing}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                                        placeholder="you@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Blood Group</label>
                                    <select
                                        value={formData.blood_group}
                                        onChange={e => setFormData({ ...formData, blood_group: e.target.value })}
                                        disabled={!isEditing}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none transition-colors bg-white disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Select Group</option>
                                        <option value="A+">A+</option>
                                        <option value="A-">A-</option>
                                        <option value="B+">B+</option>
                                        <option value="B-">B-</option>
                                        <option value="O+">O+</option>
                                        <option value="O-">O-</option>
                                        <option value="AB+">AB+</option>
                                        <option value="AB-">AB-</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Emergency Contact</label>
                                    <input
                                        type="text"
                                        value={formData.emergency_contact}
                                        onChange={e => setFormData({ ...formData, emergency_contact: e.target.value })}
                                        disabled={!isEditing}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                                        placeholder="Name & Phone"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                                        <MapPin size={14} className="text-slate-400" /> Current Address
                                    </label>
                                    <textarea
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        disabled={!isEditing}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                                        rows="3"
                                        placeholder="House No, Street, City, Pincode"
                                    />
                                </div>
                            </div>

                            {isEditing && (
                                <div className="flex flex-wrap justify-end pt-5 mt-5 border-t border-slate-100 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditing(false);
                                            fetchProfile();
                                        }}
                                        className="px-5 py-2 text-sm text-slate-600 font-semibold hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-primary-700 transition-all disabled:opacity-70"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader size={16} className="animate-spin" /> Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save size={16} /> Save Changes
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </form>
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 flex items-start gap-3">
                            <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl shrink-0">
                                <ShieldCheck size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Portal Account</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Signed in as <span className="font-semibold text-slate-700">{roleDisplay}</span> ({user?.email}).
                                    This portal login is not tied to an HR payroll master profile.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Security / Change Password Card */}
                    <form onSubmit={handlePasswordSubmit} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                                <Lock size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Security</h3>
                                <p className="text-xs text-slate-500">Update your portal login password</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Current Password</label>
                                <input
                                    type="password"
                                    value={passwordForm.currentPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
                                <input
                                    type="password"
                                    value={passwordForm.newPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                                    placeholder="Min 8 characters"
                                    minLength={8}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                                <input
                                    type="password"
                                    value={passwordForm.confirmPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                                    placeholder="Repeat password"
                                    minLength={8}
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-5 mt-5 border-t border-slate-100">
                            <button
                                type="submit"
                                disabled={changingPassword}
                                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-70"
                            >
                                {changingPassword ? (
                                    <>
                                        <Loader size={16} className="animate-spin" /> Updating...
                                    </>
                                ) : (
                                    <>
                                        <Lock size={16} /> Update Password
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Profile;
