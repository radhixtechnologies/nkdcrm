import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import employeeService from '../services/employeeService';
import { User, Mail, Phone, MapPin, Lock, Save, Loader, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Profile = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        mobile: '',
        personal_email: '',
        address: '',
        emergency_contact: '',
        blood_group: '',
        password: '',
        confirm_password: ''
    });
    const [employeeData, setEmployeeData] = useState(null);

    const fetchProfile = React.useCallback(async () => {
        if (!user?.employeeCode) {
            setLoading(false);
            return;
        }
        try {
            const res = await employeeService.getEmployeeById(user.employeeCode);
            const data = res.data.data;
            setEmployeeData(data);
            setFormData({
                mobile: data.mobile || '',
                personal_email: data.personal_email || '',
                address: data.address || '',
                emergency_contact: data.emergency_contact || '',
                blood_group: data.blood_group || '',
                password: '',
                confirm_password: ''
            });
        } catch (error) {
            console.error(error);
            toast.error('Failed to load profile');
        } finally {
            setLoading(false);
        }
    }, [user?.employeeCode]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password && formData.password !== formData.confirm_password) {
            return toast.error('Passwords do not match');
        }

        setSubmitting(true);
        try {
            const updatePayload = {
                mobile: formData.mobile,
                personal_email: formData.personal_email,
                address: formData.address,
                emergency_contact: formData.emergency_contact,
                blood_group: formData.blood_group,
            };
            if (formData.password) updatePayload.password = formData.password;

            await employeeService.updateMyProfile(updatePayload);
            toast.success('Profile updated successfully');
            setFormData(prev => ({ ...prev, password: '', confirm_password: '' }));
            setIsEditing(false);
            fetchProfile(); // Refresh
        } catch (error) {
            toast.error(error.response?.data?.message || 'Update failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="text-center py-10"><Loader className="animate-spin mx-auto text-primary-600" /></div>;

    return (
        <div className="max-w-7xl mx-auto pb-10 px-4">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">My Profile</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ID Card / Read Only Info */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
                        <div className="w-24 h-24 bg-primary-100 rounded-full mx-auto flex items-center justify-center text-primary-600 mb-4 text-3xl font-bold border-4 border-white overflow-hidden">
                            {user?.avatar ? <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" /> : <User size={40} />}
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">{user?.firstName} {user?.lastName}</h2>
                        <p className="text-slate-500 text-sm mt-1 font-mono bg-slate-100 inline-block px-2 py-0.5 rounded">{user?.employeeCode || 'N/A'}</p>

                        <div className="mt-6 pt-6 border-t border-slate-100 space-y-3 text-sm text-left">
                            <div className="flex justify-between items-center group">
                                <span className="text-slate-500 group-hover:text-slate-700 transition-colors">Role</span>
                                <span className="font-semibold text-primary-600 bg-primary-50 px-2 py-1 rounded text-xs">{employeeData?.role_code || user.role?.roleName || user.role?.roleCode}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Designation</span>
                                <span className="font-medium text-slate-800 text-right">{employeeData?.designation || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Department</span>
                                <span className="font-medium text-slate-800">{employeeData?.department || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Joined On</span>
                                <span className="font-medium text-slate-800">{employeeData?.date_of_joining ? new Date(employeeData.date_of_joining).toLocaleDateString() : '-'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Employment</span>
                                <span className="font-medium text-slate-800">{employeeData?.employment_type || 'Permanent'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Read Only Salary Box (Optional/Secure) */}
                    <div className="bg-white rounded-xl border border-gray-300 p-6 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <User size={64} />
                        </div>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">Basic Salary</p>
                        <h3 className="text-2xl font-bold text-slate-800">₹ {parseFloat(employeeData?.basic_salary || 0).toLocaleString()}</h3>
                        <p className="text-slate-400 text-xs mt-2">Confidential Information</p>
                    </div>
                </div>

                {/* Edit Form */}
                <div className="md:col-span-2">
                    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 md:p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
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
                                    className="flex items-center gap-2 text-primary-600 hover:bg-primary-50 px-4 py-2 rounded-lg font-medium transition-colors"
                                >
                                    <Edit2 size={16} /> Edit Details
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                                    <Phone size={14} className="text-slate-400" /> Mobile
                                </label>
                                <input
                                    type="text"
                                    value={formData.mobile}
                                    onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                                    placeholder="+91..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                                    <Mail size={14} className="text-slate-400" /> Personal Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.personal_email}
                                    onChange={e => setFormData({ ...formData, personal_email: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                                    placeholder="you@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Blood Group</label>
                                <div className="relative">
                                    <select
                                        value={formData.blood_group}
                                        onChange={e => setFormData({ ...formData, blood_group: e.target.value })}
                                        disabled={!isEditing}
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none transition-colors appearance-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
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
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Emergency Contact</label>
                                <input
                                    type="text"
                                    value={formData.emergency_contact}
                                    onChange={e => setFormData({ ...formData, emergency_contact: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                                    placeholder="Name & Relationship"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                                    <MapPin size={14} className="text-slate-400" /> Current Address
                                </label>
                                <textarea
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                                    rows="3"
                                    placeholder="House No, Street, City, Pincode"
                                ></textarea>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                                <Lock size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Security</h3>
                                <p className="text-xs text-slate-500">Change your password</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none transition-colors bg-slate-50 focus:bg-white placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                                    placeholder="Has at least 8 characters"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                                <input
                                    type="password"
                                    value={formData.confirm_password}
                                    onChange={e => setFormData({ ...formData, confirm_password: e.target.value })}
                                    disabled={!isEditing}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none transition-colors bg-slate-50 focus:bg-white placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                                    placeholder="Repeat new password"
                                />
                            </div>
                        </div>

                        {isEditing && (
                            <div className="flex justify-end pt-4 border-t border-slate-100 gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditing(false);
                                        fetchProfile(); // Reset form data
                                    }}
                                    className="px-6 py-2.5 text-slate-600 font-semibold hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex items-center gap-2 bg-primary-600 text-white px-8 py-2.5 rounded-lg font-semibold shadow-lg shadow-primary-200 hover:bg-primary-700 hover:shadow-primary-300 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:translate-y-0 disabled:shadow-none"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader size={18} className="animate-spin" /> Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={18} /> Save Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Profile;
