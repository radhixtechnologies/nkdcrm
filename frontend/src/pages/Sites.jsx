import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash, MapPin } from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import siteService from '../services/siteService';
import { extractApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import ModalPortal from '../components/common/ModalPortal';

const formatDateInput = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
};

const SiteFormModal = ({ onClose, onSuccess, initialData = null }) => {
    const isEdit = !!initialData;

    const formik = useFormik({
        enableReinitialize: true,
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
            labour_license_no: initialData?.labour_license_no || '',
            labour_license_expiry: formatDateInput(initialData?.labour_license_expiry),
            max_labour_capacity: initialData?.max_labour_capacity || '',
            license_authority: initialData?.license_authority || '',
        },
        validationSchema: Yup.object({
            site_code: Yup.string().required('Required').max(20, 'Max 20 chars'),
            site_name: Yup.string().required('Required').max(100, 'Max 100 chars'),
            city: Yup.string().required('Required'),
            state: Yup.string().required('Required'),
            pincode: Yup.string().nullable().test('pincode-format', 'Must be 6 digits', val => !val || /^\d{6}$/.test(String(val).trim())),
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
                toast.error(extractApiError(err, "Failed to save site"));
            }
        },
    });

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40">
            <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-slate-50 px-5 sm:px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-slate-800">{isEdit ? 'Edit Site' : 'Add New Site'}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
                </div>
                <form onSubmit={formik.handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                        {/* Labour License Compliance (CLRA Act) */}
                        <div className="pt-3 border-t border-slate-200 mt-3">
                            <div className="mb-2">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Labour License & Capacity (CLRA Compliance)</h4>
                                <p className="text-[11px] text-slate-500">Contract Labour statutory license & permitted strength</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-600">Labour License No.</label>
                                    <input
                                        type="text"
                                        {...formik.getFieldProps('labour_license_no')}
                                        className="w-full rounded-lg border-slate-300 px-3 py-2 text-xs focus:ring-primary-500 focus:border-primary-500 border font-mono"
                                        placeholder="e.g. CLRA/2026/0491"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-600">License Expiry Date</label>
                                    <input
                                        type="date"
                                        {...formik.getFieldProps('labour_license_expiry')}
                                        className="w-full rounded-lg border-slate-300 px-3 py-2 text-xs focus:ring-primary-500 focus:border-primary-500 border"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-600">Max Permitted Workmen</label>
                                    <input
                                        type="number"
                                        {...formik.getFieldProps('max_labour_capacity')}
                                        className="w-full rounded-lg border-slate-300 px-3 py-2 text-xs focus:ring-primary-500 focus:border-primary-500 border"
                                        placeholder="e.g. 100"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-600">Licensing Authority</label>
                                    <input
                                        type="text"
                                        {...formik.getFieldProps('license_authority')}
                                        className="w-full rounded-lg border-slate-300 px-3 py-2 text-xs focus:ring-primary-500 focus:border-primary-500 border"
                                        placeholder="e.g. ALC / Commissioner"
                                    />
                                </div>
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
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('SITES', 'can_create');
    const canUpdate = hasPermission('SITES', 'can_update');
    const canDelete = hasPermission('SITES', 'can_delete');

    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingSite, setEditingSite] = useState(null);

    const fetchSites = useCallback(async () => {
        try {
            const res = await siteService.getAllSites();
            setSites(res.data.data || res.data || []);
            setLoading(false);
        } catch (err) {
            console.error(err);
            toast.error(extractApiError(err, "Failed to load sites"));
            setLoading(false);
        }
    }, []);

    const getLicenseBadge = (site) => {
        if (!site.labour_license_no) {
            return <span className="text-[11px] text-slate-400 italic">Not Registered</span>;
        }
        const expiryStr = formatDateInput(site.labour_license_expiry);
        if (!expiryStr) {
            return <span className="text-xs font-mono font-semibold text-slate-700">{site.labour_license_no}</span>;
        }
        const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
        const diffDays = Math.ceil((new Date(`${expiryStr}T00:00:00+05:30`) - new Date(`${todayIst}T00:00:00+05:30`)) / (1000 * 60 * 60 * 24));
        const displayExpiry = `${expiryStr.slice(8, 10)}/${expiryStr.slice(5, 7)}/${expiryStr.slice(0, 4)}`;
        if (diffDays < 0) {
            return (
                <div>
                    <span className="text-xs font-mono font-bold text-slate-800">{site.labour_license_no}</span>
                    <span className="block text-[10px] font-bold text-rose-600">Expired ({displayExpiry})</span>
                </div>
            );
        }
        if (diffDays <= 30) {
            return (
                <div>
                    <span className="text-xs font-mono font-bold text-slate-800">{site.labour_license_no}</span>
                    <span className="block text-[10px] font-bold text-amber-600">Expires in {diffDays} days</span>
                </div>
            );
        }
        return (
            <div>
                <span className="text-xs font-mono font-semibold text-slate-800">{site.labour_license_no}</span>
                <span className="block text-[10px] text-emerald-600">Valid till {displayExpiry}</span>
            </div>
        );
    };

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
            toast.error(extractApiError(err, "Delete failed"));
        }
    };

    return (
        <div className="space-y-6 pb-16">
            <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Site Management</h1>
                    <p className="text-xs sm:text-sm text-slate-500">Manage multiple business locations and branches</p>
                </div>
                {canCreate && (
                    <button
                        onClick={() => { setEditingSite(null); setShowForm(true); }}
                        className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition shadow-sm font-medium text-xs sm:text-sm"
                    >
                        <Plus size={16} /> Add Site
                    </button>
                )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Loading sites...</div>
                ) : sites.length === 0 ? (
                    <div className="p-12 text-center">
                        <MapPin size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">No Sites Found</h3>
                        <p className="text-slate-500 mb-6">Create your first site location to assign employees.</p>
                        {canCreate && (
                            <button
                                onClick={() => { setEditingSite(null); setShowForm(true); }}
                                className="text-primary-600 font-medium hover:underline"
                            >
                                Create First Site
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Mobile Cards View */}
                        <div className="block md:hidden divide-y divide-slate-100">
                            {sites.map(site => (
                                <div key={site.site_id} className="p-4 space-y-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <span className="text-[11px] font-mono text-slate-500">{site.site_code}</span>
                                            <h3 className="font-bold text-slate-900 text-sm truncate">{site.site_name}</h3>
                                            <p className="text-xs text-slate-600">{site.city}, {site.state}</p>
                                            {site.address && <p className="text-[11px] text-slate-400 line-clamp-1">{site.address}</p>}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${site.is_active ? 'bg-green-50 text-green-700 ring-1 ring-green-600/20' : 'bg-slate-100 text-slate-600'}`}>
                                            {site.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                        <div>{getLicenseBadge(site)}</div>
                                        {(canUpdate || canDelete) && (
                                            <div className="flex gap-1.5">
                                                {canUpdate && (
                                                    <button
                                                        onClick={() => { setEditingSite(site); setShowForm(true); }}
                                                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200"
                                                    >
                                                        <Edit size={15} />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDelete(site.site_id)}
                                                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200"
                                                    >
                                                        <Trash size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-medium">
                                    <tr>
                                        <th className="px-6 py-3">Code</th>
                                        <th className="px-6 py-3">Site Name</th>
                                        <th className="px-6 py-3">Location</th>
                                        <th className="px-6 py-3">Labour License (CLRA)</th>
                                        <th className="px-6 py-3">Status</th>
                                        {(canUpdate || canDelete) && <th className="px-6 py-3 text-right">Actions</th>}
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
                                                {getLicenseBadge(site)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${site.is_active ? 'bg-green-50 text-green-700 ring-1 ring-green-600/20' : 'bg-slate-100 text-slate-600'}`}>
                                                    {site.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            {(canUpdate || canDelete) && (
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {canUpdate && (
                                                            <button
                                                                onClick={() => { setEditingSite(site); setShowForm(true); }}
                                                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                onClick={() => handleDelete(site.site_id)}
                                                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                            >
                                                                <Trash size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {showForm && (
                <ModalPortal>
                    <SiteFormModal
                        initialData={editingSite}
                        onClose={() => setShowForm(false)}
                        onSuccess={fetchSites}
                    />
                </ModalPortal>
            )}
        </div>
    );
};

export default Sites;
