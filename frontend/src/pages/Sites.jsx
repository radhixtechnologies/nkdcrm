import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash, MapPin } from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import siteService from '../services/siteService';
import toast from 'react-hot-toast';

const SiteFormModal = ({ onClose, onSuccess, initialData = null }) => {
    const isEdit = !!initialData;

    const formik = useFormik({
        initialValues: {
            site_code: initialData?.site_code || '',
            site_name: initialData?.site_name || '',
            city: initialData?.city || '',
            state: initialData?.state || '',
            address: initialData?.address || '',
            pincode: initialData?.pincode || '',
            is_active: initialData?.is_active ?? true,
            principal_employer_name: initialData?.principal_employer_name || '',
            principal_employer_address: initialData?.principal_employer_address || '',
            main_contractor_name: initialData?.main_contractor_name || '',
            main_contractor_address: initialData?.main_contractor_address || '',
            nature_of_work: initialData?.nature_of_work || '',
        },
        validationSchema: Yup.object({
            site_code: Yup.string().required('Required').max(20, 'Max 20 chars'),
            site_name: Yup.string().required('Required').max(100, 'Max 100 chars'),
            city: Yup.string().required('Required'),
            state: Yup.string().required('Required'),
            pincode: Yup.string().matches(/^\d{6}$/, "Must be 6 digits"),
            principal_employer_name: Yup.string(),
            principal_employer_address: Yup.string(),
            main_contractor_name: Yup.string(),
            main_contractor_address: Yup.string(),
            nature_of_work: Yup.string(),
        }),
        onSubmit: async (values) => {
            try {
                if (isEdit) {
                    await siteService.updateSite(initialData.site_id, values);
                    toast.success('Site updated successfully');
                } else {
                    await siteService.createSite(values);
                    toast.success('Site created successfully');
                }
                onSuccess();
                onClose();
            } catch (err) {
                console.error(err);
                toast.error(err.response?.data?.message || "Failed to save site");
            }
        },
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40 overflow-y-auto">
            <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-slate-800">{isEdit ? 'Edit Site' : 'Add New Site'}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
                </div>
                <form onSubmit={formik.handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-600 uppercase">Site Code *</label>
                            <input
                                type="text"
                                {...formik.getFieldProps('site_code')}
                                className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500 border"
                                placeholder="e.g. PNQ01"
                            />
                            {formik.touched.site_code && formik.errors.site_code && <p className="text-xs text-red-500">{formik.errors.site_code}</p>}
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-600 uppercase">Site Name *</label>
                            <input
                                type="text"
                                {...formik.getFieldProps('site_name')}
                                className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500 border"
                                placeholder="e.g. Pune Branch"
                            />
                            {formik.touched.site_name && formik.errors.site_name && <p className="text-xs text-red-500">{formik.errors.site_name}</p>}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 uppercase">Address</label>
                        <textarea
                            {...formik.getFieldProps('address')}
                            rows="2"
                            className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500 border"
                            placeholder="Full Address"
                        ></textarea>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-600 uppercase">City *</label>
                            <input
                                type="text"
                                {...formik.getFieldProps('city')}
                                className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500 border"
                            />
                            {formik.touched.city && formik.errors.city && <p className="text-xs text-red-500">{formik.errors.city}</p>}
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-600 uppercase">State *</label>
                            <input
                                type="text"
                                {...formik.getFieldProps('state')}
                                className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500 border"
                            />
                            {formik.touched.state && formik.errors.state && <p className="text-xs text-red-500">{formik.errors.state}</p>}
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-600 uppercase">Pincode</label>
                            <input
                                type="text"
                                {...formik.getFieldProps('pincode')}
                                className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500 border"
                            />
                            {formik.touched.pincode && formik.errors.pincode && <p className="text-xs text-red-500">{formik.errors.pincode}</p>}
                        </div>
                    </div>

                    {/* Statutory Contract Labour Details (Form XIII & Form B/D Compliance) */}
                    <div className="pt-2 border-t border-slate-200">
                        <div className="mb-3">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Statutory / Labour Law Compliance (Optional)</h4>
                            <p className="text-[11px] text-slate-500">Required for Form XIII, Form B/D Register generation</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-600">Principal Employer Name</label>
                                <input
                                    type="text"
                                    {...formik.getFieldProps('principal_employer_name')}
                                    className="w-full rounded-lg border-slate-300 px-3 py-2 text-xs focus:ring-primary-500 focus:border-primary-500 border"
                                    placeholder="e.g. Nath Bros Exims"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-600">Main Contractor Name</label>
                                <input
                                    type="text"
                                    {...formik.getFieldProps('main_contractor_name')}
                                    className="w-full rounded-lg border-slate-300 px-3 py-2 text-xs focus:ring-primary-500 focus:border-primary-500 border"
                                    placeholder="e.g. NKD Facilities Pvt Ltd"
                                />
                            </div>
                        </div>

                        <div className="space-y-1 mb-3">
                            <label className="text-xs font-medium text-slate-600">Nature of Work</label>
                            <input
                                type="text"
                                {...formik.getFieldProps('nature_of_work')}
                                className="w-full rounded-lg border-slate-300 px-3 py-2 text-xs focus:ring-primary-500 focus:border-primary-500 border"
                                placeholder="e.g. Housekeeping, Security, Maintenance"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-600">Principal Employer Address</label>
                                <textarea
                                    {...formik.getFieldProps('principal_employer_address')}
                                    rows="2"
                                    className="w-full rounded-lg border-slate-300 px-3 py-1.5 text-xs focus:ring-primary-500 focus:border-primary-500 border"
                                    placeholder="Employer address"
                                ></textarea>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-600">Main Contractor Address</label>
                                <textarea
                                    {...formik.getFieldProps('main_contractor_address')}
                                    rows="2"
                                    className="w-full rounded-lg border-slate-300 px-3 py-1.5 text-xs focus:ring-primary-500 focus:border-primary-500 border"
                                    placeholder="Contractor address"
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button
                            type="submit"
                            disabled={formik.isSubmitting}
                            className="px-4 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50"
                        >
                            {isEdit ? 'Update Site' : 'Create Site'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const Sites = () => {
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingSite, setEditingSite] = useState(null);

    const fetchSites = useCallback(async () => {
        try {
            const res = await siteService.getAllSites();
            setSites(res.data.data || res.data); // Handle wrapper logic if any
            setLoading(false);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load sites");
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSites();
    }, [fetchSites]);

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this site?")) return;
        try {
            await siteService.deleteSite(id);
            toast.success("Site deleted");
            fetchSites();
        } catch (err) {
            toast.error(err.response?.data?.message || "Delete failed");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Site Management</h1>
                    <p className="text-slate-500">Manage multiple business locations and branches</p>
                </div>
                <button
                    onClick={() => { setEditingSite(null); setShowForm(true); }}
                    className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition shadow-sm font-medium text-sm"
                >
                    <Plus size={16} /> Add Site
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Loading sites...</div>
                ) : sites.length === 0 ? (
                    <div className="p-12 text-center">
                        <MapPin size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No Sites Found</h3>
                        <p className="text-slate-500 mb-6">Create your first site location to assign employees.</p>
                        <button
                            onClick={() => { setEditingSite(null); setShowForm(true); }}
                            className="text-primary-600 font-medium hover:underline"
                        >
                            Create First Site
                        </button>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-medium">
                            <tr>
                                <th className="px-6 py-3">Code</th>
                                <th className="px-6 py-3">Site Name</th>
                                <th className="px-6 py-3">Location</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sites.map(site => (
                                <tr key={site.site_id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4 font-mono text-slate-500 text-xs">{site.site_code}</td>
                                    <td className="px-6 py-4 font-medium text-slate-900">{site.site_name}</td>
                                    <td className="px-6 py-4 text-slate-600">
                                        {site.city}, {site.state}
                                        <div className="text-xs text-slate-400 truncate max-w-[200px]">{site.address}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${site.is_active ? 'bg-green-50 text-green-700 ring-1 ring-green-600/20' : 'bg-slate-100 text-slate-600'}`}>
                                            {site.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => { setEditingSite(site); setShowForm(true); }}
                                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(site.site_id)}
                                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showForm && (
                <SiteFormModal
                    initialData={editingSite}
                    onClose={() => setShowForm(false)}
                    onSuccess={fetchSites}
                />
            )}
        </div>
    );
};

export default Sites;
