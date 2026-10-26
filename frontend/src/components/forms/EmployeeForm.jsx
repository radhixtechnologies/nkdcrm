import { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { X, Save, User, Briefcase, CreditCard, FileText, CheckCircle, Upload, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import shiftService from '../../services/shiftService';
import siteService from '../../services/siteService';


const Wrapper = ({ children, isModal }) => isModal ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40">{children}</div>
) : <>{children}</>;

const EmployeeForm = ({ onClose, onSuccess, initialData = null, isModal = true, viewOnly = false }) => {
    const isEdit = !!initialData;
    const [shifts, setShifts] = useState([]);
    const [sites, setSites] = useState([]);
    const [roles, setRoles] = useState([]);
    const [managers, setManagers] = useState([]);

    const [activeTab, setActiveTab] = useState('basic');
    const [uploading, setUploading] = useState({});
    const [createUserAccount, setCreateUserAccount] = useState(!!initialData?.role_id && initialData?.is_active !== false);
    const [userPassword, setUserPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState(initialData?.role_id ? String(initialData.role_id) : '5');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [shiftsRes, sitesRes, rolesRes, employeesRes] = await Promise.all([
                    shiftService.getAllShifts(),
                    siteService.getAllSites(),
                    api.get('/auth/roles'), // Fetch roles for dropdown
                    api.get('/employees')   // Fetch employees for manager dropdown
                ]);
                setShifts(shiftsRes.data.data || []);
                setSites(sitesRes.data.data || []);
                setRoles(rolesRes.data.data || []);
                setManagers(employeesRes.data.data || []);
            } catch (err) {
                console.error("Failed to load form data", err);
            }
        };
        loadData();

    }, []);

    const formik = useFormik({
        initialValues: {
            // Basic Info
            employee_code: initialData?.employee_code || '',
            first_name: initialData?.first_name || '',
            last_name: initialData?.last_name || '',
            mobile: initialData?.mobile || '',
            email: initialData?.email || '',
            personal_email: initialData?.personal_email || '',
            address: initialData?.address || '',
            emergency_contact: initialData?.emergency_contact || '',
            blood_group: initialData?.blood_group || '',

            // Statutory Fields (Form XIII)
            gender: initialData?.gender || '',
            father_name: initialData?.father_name || '',
            dob: initialData?.dob ? new Date(initialData.dob).toISOString().split('T')[0] : '',
            nationality: initialData?.nationality || 'Indian',
            education: initialData?.education || '',
            skill_category: initialData?.skill_category || '',
            permanent_address: initialData?.permanent_address || '',
            identification_mark: initialData?.identification_mark || '',
            service_book_no: initialData?.service_book_no || '',
            remarks: initialData?.remarks || '',

            // Employment
            designation: initialData?.designation || '',
            department: initialData?.department || '',
            date_of_joining: initialData?.date_of_joining ? new Date(initialData.date_of_joining).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            employment_status: initialData?.employment_status || 'ACTIVE',
            employment_type: initialData?.employment_type || 'PERMANENT',
            site_id: initialData?.site_id || '',
            shift_id: initialData?.shift_id || '',
            manager_id: initialData?.manager_id || '',

            // Salary
            wage_type: initialData?.wage_type || 'MONTHLY',
            basic_salary: initialData?.basic_salary !== undefined && initialData?.basic_salary !== '' ? initialData.basic_salary : 0,
            ot_rate: initialData?.ot_rate || '',
            hra: initialData?.hra || '',
            conveyance: initialData?.conveyance || '',
            special_allowance: initialData?.special_allowance || '',
            other_allowance: initialData?.other_allowance || '',

            // Statutory Config
            pf_applicable: initialData?.pf_applicable || false,
            esi_applicable: initialData?.esi_applicable || false,
            pt_applicable: initialData?.pt_applicable || false,
            uan_number: initialData?.uan_number || '',
            esi_number: initialData?.esi_number || '',
            pan_number: initialData?.pan_number || '',
            aadhaar_number: initialData?.aadhaar_number || '',

            // Bank Details
            bank_name: initialData?.bank_name || '',
            account_number: initialData?.account_number || '',
            ifsc_code: initialData?.ifsc_code || '',

            // Documents (JSONB)
            documents: initialData?.documents || {},
        },
        validationSchema: Yup.object({
            employee_code: Yup.string().max(20, 'Max 20 chars'),
            first_name: Yup.string().required('First Name is required').max(50, 'Max 50 chars'),
            wage_type: Yup.string().required('Wage type is required'),
            basic_salary: Yup.number().typeError('Must be a number').min(0, 'Cannot be negative').default(0),
            email: Yup.string().email('Invalid email').max(100, 'Max 100 chars').nullable(),
            personal_email: Yup.string().email('Invalid personal email').max(100, 'Max 100 chars').nullable(),
            mobile: Yup.string().nullable().test('valid-phone', 'Must be a 10-digit number', val => !val || /^[0-9]{10}$/.test(String(val).replace(/[\s-+]/g, ''))),
            date_of_joining: Yup.date().required('Date of Joining is required').default(() => new Date()),
            pan_number: Yup.string().max(10, 'Max 10 chars'),
            aadhaar_number: Yup.string().max(12, 'Max 12 chars'),
        }),
        onSubmit: async (values) => {
            try {
                // Validate password for new user account creation
                const isNewLoginAccess = createUserAccount && (!initialData?.role_id);

                if ((!isEdit || isNewLoginAccess) && !userPassword && createUserAccount) {
                    toast.error('Password is required when creating new login access');
                    return;
                }

                // Sanitize payload
                const cleanedValues = {
                    ...values,
                    employee_code: values.employee_code && values.employee_code.trim() !== '' ? values.employee_code.trim() : null,
                    date_of_joining: values.date_of_joining || new Date().toISOString().split('T')[0],
                    basic_salary: Number(values.basic_salary || 0),
                    hra: Number(values.hra || 0),
                    conveyance: Number(values.conveyance || 0),
                    special_allowance: Number(values.special_allowance || 0),
                    other_allowance: Number(values.other_allowance || 0),
                    ot_rate: Number(values.ot_rate || 0),
                    site_id: values.site_id ? Number(values.site_id) : null,
                    shift_id: values.shift_id ? Number(values.shift_id) : null,
                    manager_id: values.manager_id ? Number(values.manager_id) : null,
                };

                // Add login access data
                if (createUserAccount) {
                    cleanedValues.createUser = true;
                    if (userPassword) cleanedValues.userPassword = userPassword;
                    cleanedValues.roleId = parseInt(selectedRole);
                } else {
                    cleanedValues.createUser = false;
                }

                console.log("Submitting:", cleanedValues);

                if (isEdit) {
                    await api.put(`/employees/${initialData.employee_code}`, cleanedValues);
                    toast.success('Employee updated successfully');
                } else {
                    await api.post('/employees', cleanedValues);
                    if (createUserAccount) {
                        toast.success('Employee and user account created successfully!');
                    } else {
                        toast.success('Employee created successfully');
                    }
                }

                if (onSuccess) onSuccess();
                onClose();
            } catch (error) {
                console.error("Submission Error:", error.response?.data || error.message);
                toast.error(error.response?.data?.message || 'Failed to save employee');
            }
        },
    });

    // File Upload Handler
    const handleFileUpload = async (e, docType) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(prev => ({ ...prev, [docType]: true }));

        try {
            const res = await api.post('/employees/upload-document', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                formik.setFieldValue(`documents.${docType}`, res.data.url);
                toast.success(`${docType.replace('_', ' ')} uploaded!`);
            }
        } catch (error) {
            console.error('Upload failed', error);
            toast.error('Upload failed');
        } finally {
            setUploading(prev => ({ ...prev, [docType]: false }));
        }
    };

    const removeDocument = (docType) => {
        const newDocs = { ...formik.values.documents };
        delete newDocs[docType];
        formik.setFieldValue('documents', newDocs);
    };

    // Tabs Configuration
    const tabs = [
        { id: 'basic', label: 'Basic Info', icon: <User size={18} /> },
        { id: 'job', label: 'Job Info', icon: <Briefcase size={18} /> },
        { id: 'salary', label: 'Salary Info', icon: <CreditCard size={18} /> },
        { id: 'docs', label: 'Documents', icon: <FileText size={18} /> },
        { id: 'statutory', label: 'Statutory Info', icon: <FileText size={18} /> },
        { id: 'user', label: 'Login Access', icon: <CheckCircle size={18} /> },
    ];

    const tabFieldMap = {
        basic: ['first_name', 'last_name', 'mobile', 'email', 'personal_email'],
        job: ['date_of_joining', 'designation', 'department', 'site_id', 'shift_id', 'manager_id'],
        salary: ['wage_type', 'basic_salary', 'hra', 'conveyance'],
        docs: ['pan_number', 'aadhaar_number'],
        statutory: ['gender', 'father_name', 'dob', 'nationality', 'education', 'skill_category', 'permanent_address', 'service_book_no', 'identification_mark', 'remarks', 'uan_number', 'esi_number'],
        user: []
    };

    const handlePrevTab = () => {
        const tabOrder = ['basic', 'job', 'salary', 'docs', 'statutory', 'user'];
        const idx = tabOrder.indexOf(activeTab);
        if (idx > 0) setActiveTab(tabOrder[idx - 1]);
    };

    const handleSaveClick = async (e) => {
        if (e) e.preventDefault();
        const errors = await formik.validateForm();
        if (Object.keys(errors).length > 0) {
            formik.setTouched(
                Object.keys(errors).reduce((acc, key) => ({ ...acc, [key]: true }), {})
            );
            const tabOrder = ['basic', 'job', 'salary', 'docs', 'statutory', 'user'];
            const firstErrorTab = tabOrder.find(t => (tabFieldMap[t] || []).some(f => errors[f]));
            if (firstErrorTab) {
                setActiveTab(firstErrorTab);
            }
            const firstErrorKey = Object.keys(errors)[0];
            const firstErrorMsg = errors[firstErrorKey];
            toast.error(`Please fix ${firstErrorKey.replace(/_/g, ' ')}: ${firstErrorMsg}`);
            return;
        }
        formik.handleSubmit();
    };

    const handleSaveAndNext = async (e) => {
        if (e) e.preventDefault();

        const tabOrder = ['basic', 'job', 'salary', 'docs', 'statutory', 'user'];
        const currentIdx = tabOrder.indexOf(activeTab);
        const isLastTab = currentIdx === tabOrder.length - 1;

        if (isLastTab) {
            return handleSaveClick(e);
        }

        // Validate fields belonging to the current active tab
        const currentFields = tabFieldMap[activeTab] || [];
        const errors = await formik.validateForm();
        const currentTabErrors = Object.keys(errors).filter(field => currentFields.includes(field));

        if (currentTabErrors.length > 0) {
            const touchedCurrent = currentTabErrors.reduce((acc, k) => ({ ...acc, [k]: true }), {});
            formik.setTouched({ ...formik.touched, ...touchedCurrent });

            const firstErrField = currentTabErrors[0];
            toast.error(`Please fix ${firstErrField.replace(/_/g, ' ')}: ${errors[firstErrField]}`);
            return;
        }

        // If current tab is valid, advance to the next tab automatically!
        const nextTabId = tabOrder[currentIdx + 1];
        const nextTabObj = tabs.find(t => t.id === nextTabId);
        setActiveTab(nextTabId);
        toast.success(`Saved! Proceeding to ${nextTabObj?.label || 'next section'}.`, { duration: 1500 });
    };

    return (
        <Wrapper isModal={isModal}>
            <div className={`flex flex-col bg-white overflow-hidden ${isModal ? 'w-full max-w-5xl rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 h-[90vh]' : 'w-full h-full'}`}>

                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">
                            {viewOnly ? 'Employee Details' : (isEdit ? 'Edit Employee' : 'New Employee Onboarding')}
                        </h2>
                        <p className="text-sm text-slate-500">Central Employee Master</p>
                    </div>
                    <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-white px-6 overflow-x-auto">
                    {tabs.map(tab => {
                        const errCount = (tabFieldMap[tab.id] || []).filter(f => formik.touched[f] && formik.errors[f]).length;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors relative ${activeTab === tab.id
                                    ? 'border-primary-600 text-primary-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                                {errCount > 0 && (
                                    <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                                        {errCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <form onSubmit={formik.handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">

                        {/* Tab Content: Basic Info */}
                        <fieldset disabled={viewOnly} className="contents">
                            {activeTab === 'basic' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Personal Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-1">
                                                <label className="input-label">Employee Code {isEdit ? '' : <span className="text-xs text-slate-400 font-normal normal-case">(Auto-generated if blank)</span>}</label>
                                                <input
                                                    type="text"
                                                    {...formik.getFieldProps('employee_code')}
                                                    disabled={isEdit}
                                                    className="input-field font-mono disabled:bg-slate-100 disabled:text-slate-500 placeholder:text-slate-400"
                                                    placeholder={isEdit ? "" : "Leave blank to auto-generate"}
                                                />
                                                {formik.touched.employee_code && formik.errors.employee_code && <p className="error-msg">{formik.errors.employee_code}</p>}
                                            </div>

                                            <div className="space-y-1">
                                                <label className="input-label">First Name <span className="text-red-500">*</span></label>
                                                <input type="text" {...formik.getFieldProps('first_name')} className="input-field" />
                                                {formik.touched.first_name && formik.errors.first_name && <p className="error-msg">{formik.errors.first_name}</p>}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Last Name</label>
                                                <input type="text" {...formik.getFieldProps('last_name')} className="input-field" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Blood Group</label>
                                                <select {...formik.getFieldProps('blood_group')} className="input-field">
                                                    <option value="">Select...</option>
                                                    <option value="A+">A+</option><option value="A-">A-</option>
                                                    <option value="B+">B+</option><option value="B-">B-</option>
                                                    <option value="O+">O+</option><option value="O-">O-</option>
                                                    <option value="AB+">AB+</option><option value="AB-">AB-</option>
                                                </select>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Contact Information</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-1">
                                                <label className="input-label">Mobile Number</label>
                                                <input type="tel" {...formik.getFieldProps('mobile')} className="input-field" />
                                                {formik.touched.mobile && formik.errors.mobile && <p className="error-msg">{formik.errors.mobile}</p>}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Official Email</label>
                                                <input type="email" {...formik.getFieldProps('email')} className="input-field" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Personal Email</label>
                                                <input type="email" {...formik.getFieldProps('personal_email')} className="input-field" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Emergency Contact</label>
                                                <input type="tel" {...formik.getFieldProps('emergency_contact')} className="input-field" />
                                            </div>
                                            <div className="col-span-2 space-y-1">
                                                <label className="input-label">Residential Address</label>
                                                <textarea {...formik.getFieldProps('address')} className="input-field min-h-[80px]" placeholder="Full address..." />
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {/* Tab Content: Job Info */}
                            {activeTab === 'job' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-1">
                                                <label className="input-label">Designation</label>
                                                <input type="text" {...formik.getFieldProps('designation')} className="input-field" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Department</label>
                                                <select {...formik.getFieldProps('department')} className="input-field">
                                                    <option value="">Select...</option>
                                                    <option value="IT">IT</option>
                                                    <option value="HR">HR</option>
                                                    <option value="Sales">Sales</option>
                                                    <option value="Operations">Operations</option>
                                                    <option value="Marketing">Marketing</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Date of Joining <span className="text-red-500">*</span></label>
                                                <input type="date" {...formik.getFieldProps('date_of_joining')} className="input-field" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Employment Type <span className="text-red-500">*</span></label>
                                                <select {...formik.getFieldProps('employment_type')} className="input-field">
                                                    <option value="PERMANENT">Permanent</option>
                                                    <option value="CONTRACT">Contract</option>
                                                    <option value="INTERN">Intern</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Employment Status</label>
                                                <select {...formik.getFieldProps('employment_status')} className="input-field">
                                                    <option value="ACTIVE">Active</option>
                                                    <option value="RESIGNED">Resigned</option>
                                                    <option value="TERMINATED">Terminated</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Shift Timing</label>
                                                <select {...formik.getFieldProps('shift_id')} className="input-field">
                                                    <option value="">Select Shift...</option>
                                                    {shifts.map(shift => (
                                                        <option key={shift.shift_id} value={shift.shift_id}>
                                                            {shift.shift_name} ({shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Site / Branch</label>
                                                <select {...formik.getFieldProps('site_id')} className="input-field">
                                                    <option value="">Select Site...</option>
                                                    {sites.map(site => (
                                                        <option key={site.site_id} value={site.site_id}>
                                                            {site.site_name} ({site.site_code})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Reports To (Manager)</label>
                                                <select {...formik.getFieldProps('manager_id')} className="input-field">
                                                    <option value="">No Manager / Self</option>
                                                    {managers
                                                        .filter(emp => !initialData || emp.employee_id !== initialData.employee_id)
                                                        .map(emp => (
                                                            <option key={emp.employee_id} value={emp.employee_id}>
                                                                {emp.first_name} {emp.last_name} ({emp.employee_code})
                                                            </option>
                                                        ))}
                                                </select>
                                            </div>

                                        </div>
                                    </section>
                                </div>
                            )}

                            {/* Tab Content: Salary Info */}
                            {activeTab === 'salary' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm mb-4">
                                        <p className="font-semibold">⚠️ Important:</p>
                                        This is Salary Configuration only (Base Data), NOT Payroll processing.
                                    </div>

                                    <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Earnings Structure</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-1">
                                                <label className="input-label">Wage Type <span className="text-red-500">*</span></label>
                                                <select {...formik.getFieldProps('wage_type')} className="input-field">
                                                    <option value="MONTHLY">Monthly</option>
                                                    <option value="PER_DAY">Per Day</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Basic Salary <span className="text-red-500">*</span></label>
                                                <input type="number" {...formik.getFieldProps('basic_salary')} className="input-field" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">OT Rate (Per Hour)</label>
                                                <input type="number" {...formik.getFieldProps('ot_rate')} className="input-field" placeholder="0" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">HRA</label>
                                                <input type="number" {...formik.getFieldProps('hra')} className="input-field" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Conveyance</label>
                                                <input type="number" {...formik.getFieldProps('conveyance')} className="input-field" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Special / Other Allowances</label>
                                                <input type="number" {...formik.getFieldProps('special_allowance')} className="input-field" />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Statutory & Bank</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" {...formik.getFieldProps('pf_applicable')} checked={formik.values.pf_applicable} className="w-4 h-4" />
                                                <span className="text-sm font-medium">PF Applicable</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" {...formik.getFieldProps('esi_applicable')} checked={formik.values.esi_applicable} className="w-4 h-4" />
                                                <span className="text-sm font-medium">ESI Applicable</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" {...formik.getFieldProps('pt_applicable')} checked={formik.values.pt_applicable} className="w-4 h-4" />
                                                <span className="text-sm font-medium">PT Applicable</span>
                                            </label>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-1">
                                                <label className="input-label">Bank Name</label>
                                                <input type="text" {...formik.getFieldProps('bank_name')} className="input-field" placeholder="Bank Name" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Account Number</label>
                                                <input type="text" {...formik.getFieldProps('account_number')} className="input-field" placeholder="Account Number" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">IFSC Code</label>
                                                <input type="text" {...formik.getFieldProps('ifsc_code')} className="input-field uppercase" placeholder="IFSC Code" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">PAN Number</label>
                                                <input type="text" {...formik.getFieldProps('pan_number')} className="input-field uppercase" placeholder="PAN Number" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Aadhaar Number</label>
                                                <input type="text" {...formik.getFieldProps('aadhaar_number')} className="input-field" placeholder="Aadhaar Number" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">UAN Number</label>
                                                <input
                                                    type="text"
                                                    {...formik.getFieldProps('uan_number')}
                                                    disabled={!formik.values.pf_applicable}
                                                    className="input-field disabled:bg-slate-100 disabled:text-slate-400"
                                                    placeholder={formik.values.pf_applicable ? "UAN Number" : "N/A"}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">ESI Number</label>
                                                <input
                                                    type="text"
                                                    {...formik.getFieldProps('esi_number')}
                                                    disabled={!formik.values.esi_applicable}
                                                    className="input-field disabled:bg-slate-100 disabled:text-slate-400"
                                                    placeholder={formik.values.esi_applicable ? "ESI Number" : "N/A"}
                                                />
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {/* Tab Content: Statutory Info */}
                            {activeTab === 'statutory' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Personal Statutory Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-1">
                                                <label className="input-label">Gender</label>
                                                <select {...formik.getFieldProps('gender')} className="input-field">
                                                    <option value="">Select...</option>
                                                    <option value="Male">Male</option>
                                                    <option value="Female">Female</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Father / Spouse Name</label>
                                                <input type="text" {...formik.getFieldProps('father_name')} className="input-field" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Date of Birth</label>
                                                <input type="date" {...formik.getFieldProps('dob')} className="input-field" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Nationality</label>
                                                <input type="text" {...formik.getFieldProps('nationality')} className="input-field" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Education Level</label>
                                                <input type="text" {...formik.getFieldProps('education')} className="input-field" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Skill Category</label>
                                                <select {...formik.getFieldProps('skill_category')} className="input-field">
                                                    <option value="">Select...</option>
                                                    <option value="Highly Skilled">Highly Skilled</option>
                                                    <option value="Skilled">Skilled</option>
                                                    <option value="Semi-Skilled">Semi-Skilled</option>
                                                    <option value="Unskilled">Unskilled</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1 col-span-3">
                                                <label className="input-label">Permanent Address</label>
                                                <textarea {...formik.getFieldProps('permanent_address')} className="input-field min-h-[60px]" placeholder="Permanent Home Address (as per Aadhaar)" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Identification Mark</label>
                                                <input type="text" {...formik.getFieldProps('identification_mark')} className="input-field" placeholder="Mole on right cheek, etc." />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Service Book No.</label>
                                                <input type="text" {...formik.getFieldProps('service_book_no')} className="input-field" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="input-label">Remarks</label>
                                                <input type="text" {...formik.getFieldProps('remarks')} className="input-field" />
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {/* Tab Content: Documents */}
                            {activeTab === 'docs' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Employee Documents</h3>
                                        <p className="text-sm text-slate-500 mb-6">Upload clear copies of the following documents. Supported formats: PDF, JPG, PNG.</p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {['Aadhaar Card', 'PAN Card', 'Bank Proof', 'Offer Letter', 'Joining Report', 'Resume'].map((docName) => {
                                                const docKey = docName.toLowerCase().replace(' ', '_');
                                                const fileUrl = formik.values.documents[docKey];
                                                const isUploading = uploading[docKey];

                                                return (
                                                    <div key={docKey} className="border border-slate-200 rounded-lg p-4 bg-slate-50 hover:bg-white transition-colors">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="font-medium text-slate-700">{docName}</span>
                                                            {fileUrl && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Uploaded</span>}
                                                        </div>

                                                        {fileUrl ? (
                                                            <div className="flex items-center gap-3 mt-2">
                                                                <a href={`${api.defaults.baseURL}${fileUrl}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800">
                                                                    <Eye size={16} /> View
                                                                </a>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeDocument(docKey)}
                                                                    className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
                                                                >
                                                                    <Trash2 size={16} /> Remove
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="relative">
                                                                <input
                                                                    type="file"
                                                                    id={`file-${docKey}`}
                                                                    className="hidden"
                                                                    onChange={(e) => handleFileUpload(e, docKey)}
                                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                                    disabled={isUploading}
                                                                />
                                                                <label
                                                                    htmlFor={`file-${docKey}`}
                                                                    className={`cursor-pointer flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed border-slate-300 rounded-md text-sm font-medium text-slate-600 hover:border-primary-500 hover:text-primary-600 transition-all ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                >
                                                                    {isUploading ? (
                                                                        <>Uploading...</>
                                                                    ) : (
                                                                        <><Upload size={16} /> click to upload</>
                                                                    )}
                                                                </label>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </div>
                            )}

                            {/* Tab Content: Login Access */}
                            {activeTab === 'user' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm mb-4">
                                        <p className="font-semibold">💡 Login Access</p>
                                        <p className="mt-1">Enable this option to grant this employee access to the CRM system with their assigned role.</p>
                                    </div>

                                    <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                        <div className="flex items-center gap-3 mb-6">
                                            <input
                                                type="checkbox"
                                                id="createUserAccount"
                                                checked={createUserAccount}
                                                onChange={(e) => setCreateUserAccount(e.target.checked)}
                                                className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                                            />
                                            <label htmlFor="createUserAccount" className="text-base font-semibold text-slate-900 cursor-pointer">
                                                Enable login access for this employee
                                            </label>
                                        </div>

                                        {createUserAccount && (
                                            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-1">
                                                        <label className="input-label">Login Email <span className="text-red-500">*</span></label>
                                                        <input
                                                            type="email"
                                                            value={formik.values.email}
                                                            disabled
                                                            className="input-field bg-slate-100 text-slate-600"
                                                            placeholder="Email from Basic Info will be used"
                                                        />
                                                        <p className="text-xs text-slate-500 mt-1">This email will be used for login</p>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="input-label">
                                                            {isEdit ? 'Change Password' : 'Temporary Password'}
                                                            {!isEdit && <span className="text-red-500">*</span>}
                                                        </label>
                                                        <input
                                                            type="password"
                                                            value={userPassword}
                                                            onChange={(e) => setUserPassword(e.target.value)}
                                                            className="input-field"
                                                            placeholder={isEdit ? "Leave blank to keep current" : "Enter temporary password"}
                                                            required={createUserAccount && !isEdit}
                                                            minLength="8"
                                                        />
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            {isEdit ? 'Only enter if you want to change the password.' : 'Minimum 8 characters. User can change on login.'}
                                                        </p>
                                                    </div>

                                                    <div className="space-y-1 md:col-span-2">
                                                        <label className="input-label">Assign Role <span className="text-red-500">*</span></label>
                                                        <select
                                                            value={selectedRole}
                                                            onChange={(e) => setSelectedRole(e.target.value)}
                                                            className="input-field"
                                                            required={createUserAccount}
                                                        >
                                                            <option value="">Select a role...</option>
                                                            {roles.map(role => (
                                                                <option key={role.role_id} value={role.role_id}>
                                                                    {role.role_name} - {role.description}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <p className="text-xs text-slate-500 mt-1">This determines what the employee can access in the system</p>
                                                    </div>
                                                </div>

                                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                                    <h4 className="font-semibold text-amber-900 mb-2">📋 Role Permissions Summary:</h4>
                                                    <ul className="text-sm text-amber-800 space-y-1">
                                                        {selectedRole === '1' && <li>• <strong>Super Admin:</strong> Full system access - all modules, user management, settings</li>}
                                                        {selectedRole === '2' && <li>• <strong>HR Admin:</strong> Employees, attendance, leaves, benefits, payroll (view)</li>}
                                                        {selectedRole === '3' && <li>• <strong>Finance Manager:</strong> Payroll, reimbursements, financial reports</li>}
                                                        {selectedRole === '4' && <li>• <strong>Department Manager:</strong> Team data, approve team leaves, team attendance</li>}
                                                        {selectedRole === '5' && <li>• <strong>Employee:</strong> Self-service - own data, payslips, leaves, claims</li>}
                                                        {!selectedRole && <li className="text-slate-500">Select a role to see permissions</li>}
                                                    </ul>
                                                </div>
                                            </div>
                                        )}

                                        {!createUserAccount && (
                                            <div className="text-center py-8 text-slate-500">
                                                <p>Check the box above to enable user account creation</p>
                                                <p className="text-sm mt-2">You can create a user account later from the User Management page</p>
                                            </div>
                                        )}
                                    </section>
                                </div>
                            )}
                        </fieldset>
                    </div>

                    {/* Footer Actions */}
                    <div className="border-t border-slate-200 bg-white p-4 flex justify-between items-center z-10 flex-shrink-0">
                        <div>
                            {activeTab !== 'basic' && (
                                <button
                                    type="button"
                                    onClick={handlePrevTab}
                                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    ← Previous
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            {!viewOnly && activeTab !== 'user' && (
                                <button
                                    type="button"
                                    onClick={handleSaveClick}
                                    disabled={formik.isSubmitting || Object.values(uploading).some(Boolean)}
                                    className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                                    title="Save employee immediately"
                                >
                                    Save Directly
                                </button>
                            )}
                            {!viewOnly && (
                                <button
                                    type="button"
                                    onClick={handleSaveAndNext}
                                    disabled={formik.isSubmitting || Object.values(uploading).some(Boolean)}
                                    className="flex items-center gap-2 rounded-lg bg-primary-600 px-7 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-primary-700 hover:shadow-primary-500/20 transition-all disabled:opacity-70 cursor-pointer"
                                >
                                    {activeTab === 'user' ? (
                                        <>
                                            <Save size={18} /> Save Employee
                                        </>
                                    ) : (
                                        <>
                                            <Save size={18} /> Save & Next →
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>

            <style>{`
                .input-label { @apply text-xs font-semibold text-slate-600 uppercase mb-1 block; }
                .input-field { @apply w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-500 border shadow-sm transition-all; }
                .error-msg { @apply text-xs text-red-500 mt-1; }
            `}</style>
        </Wrapper>
    );
};

export default EmployeeForm;
