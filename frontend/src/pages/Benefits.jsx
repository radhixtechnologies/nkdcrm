import { useState, useEffect, useCallback } from 'react';
import {
    Plus, CreditCard, Receipt, Users, Clock, Gift,
    Calendar, History, GitBranch, Shield, ShieldCheck,
    HeartPulse, UserPlus, Download,
    Printer, CheckCircle2, XCircle, BarChart3, Check, X, Banknote
} from 'lucide-react';
import benefitService from '../services/benefitService';
import perkService from '../services/perkService';
import AssignBenefitForm from '../components/forms/AssignBenefitForm';
import AssignPerkForm from '../components/forms/AssignPerkForm';
import ReimbursementClaimForm from '../components/forms/ReimbursementClaimForm';
import WorkflowFlowchart from '../components/charts/WorkflowFlowchart';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { extractApiError } from '../services/api';
import ModalPortal from '../components/common/ModalPortal';

const formatIstDate = (d) => {
    if (!d) return '—';
    const s = String(d).trim();
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00+05:30`) : new Date(d);
    if (Number.isNaN(parsed.getTime())) return String(d);
    return parsed.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(Number(val) || 0);
};

const Benefits = () => {
    const { user, hasPermission } = useAuth();
    const canAssign = hasPermission('BENEFITS', 'can_update') || hasPermission('BENEFITS', 'can_approve');
    const canApprove = hasPermission('BENEFITS', 'can_approve');
    const canCreateClaim = hasPermission('BENEFITS', 'can_create');
    const currentEmployeeCode = user?.employeeCode;

    const [activeTab, setActiveTab] = useState(
        canAssign ? 'insurance-policies' : (currentEmployeeCode ? 'my-benefits' : 'insurance-policies')
    );
    const [showAssignForm, setShowAssignForm] = useState(false);
    const [showPerkForm, setShowPerkForm] = useState(false);
    const [showClaimForm, setShowClaimForm] = useState(false);
    const [showDependentModal, setShowDependentModal] = useState(false);
    const [showCardModal, setShowCardModal] = useState(false);
    const [selectedCardBenefit, setSelectedCardBenefit] = useState(null);

    // Reject Modal state (replaces window.prompt)
    const [rejectClaimId, setRejectClaimId] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectSubmitting, setRejectSubmitting] = useState(false);

    const [benefits, setBenefits] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [dependents, setDependents] = useState([]);
    const [perks, setPerks] = useState([]);
    const [myClaims, setMyClaims] = useState([]);
    const [pendingClaims, setPendingClaims] = useState([]);
    const [allClaims, setAllClaims] = useState([]);
    const [enrolledDirectory, setEnrolledDirectory] = useState([]);
    const [misReports, setMisReports] = useState(null);
    const [loading, setLoading] = useState(true);

    const [depForm, setDepForm] = useState({
        full_name: '',
        relationship: 'SPOUSE',
        date_of_birth: '',
        gender: 'FEMALE',
        is_covered_under_insurance: true
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (activeTab === 'my-benefits') {
                if (currentEmployeeCode) {
                    const [res, polRes] = await Promise.all([
                        benefitService.getMyBenefits(currentEmployeeCode),
                        benefitService.getInsurancePolicies().catch(() => ({ data: { data: [] } }))
                    ]);
                    setBenefits(res.data?.data || []);
                    if (polRes.data?.data?.length) {
                        setPolicies(polRes.data.data);
                    }
                } else {
                    setBenefits([]);
                }
            } else if (activeTab === 'insurance-policies') {
                const res = await benefitService.getInsurancePolicies();
                setPolicies(res.data?.data || []);
            } else if (activeTab === 'dependents') {
                if (currentEmployeeCode) {
                    const res = await benefitService.getDependents(currentEmployeeCode);
                    setDependents(res.data?.data || []);
                } else {
                    setDependents([]);
                }
            } else if (activeTab === 'my-perks') {
                if (currentEmployeeCode) {
                    const res = await perkService.getMyPerks(currentEmployeeCode);
                    setPerks(res.data?.data || []);
                } else {
                    setPerks([]);
                }
            } else if (activeTab === 'my-claims') {
                if (currentEmployeeCode) {
                    const res = await benefitService.getMyClaims(currentEmployeeCode);
                    setMyClaims(res.data?.data || []);
                } else {
                    setMyClaims([]);
                }
            } else if (activeTab === 'pending-claims' && canApprove) {
                const res = await benefitService.getPendingClaims();
                setPendingClaims(res.data?.data || []);
            } else if (activeTab === 'all-claims' && canAssign) {
                const res = await benefitService.getAllClaims();
                setAllClaims(res.data?.data || []);
            } else if (activeTab === 'enrolled-directory' && canAssign) {
                const res = await benefitService.getAllAssignedBenefits();
                setEnrolledDirectory(res.data?.data || []);
            } else if (activeTab === 'mis-reports' && canAssign) {
                const res = await benefitService.getMISReports();
                setMisReports(res.data?.data || null);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error(extractApiError(error, 'Failed to load benefits data'));
        } finally {
            setLoading(false);
        }
    }, [activeTab, currentEmployeeCode, canApprove, canAssign]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleApprove = async (claimId) => {
        if (!window.confirm('Approve this reimbursement claim?')) return;
        try {
            await benefitService.approveClaim({ claim_id: claimId, approver_id: user?.employeeId });
            toast.success('Claim Approved');
            fetchData();
        } catch (error) {
            toast.error(extractApiError(error, 'Failed to approve claim'));
        }
    };

    const handleConfirmReject = async (e) => {
        e.preventDefault();
        if (!rejectClaimId) return;
        const reason = rejectReason.trim();
        if (!reason) {
            toast.error('Please enter a rejection reason');
            return;
        }
        setRejectSubmitting(true);
        try {
            await benefitService.rejectClaim({
                claim_id: rejectClaimId,
                approver_id: user?.employeeId,
                reason
            });
            toast.success('Claim Rejected');
            setRejectClaimId(null);
            setRejectReason('');
            fetchData();
        } catch (error) {
            toast.error(extractApiError(error, 'Failed to reject claim'));
        } finally {
            setRejectSubmitting(false);
        }
    };

    const handleMarkPaid = async (claimId) => {
        if (!window.confirm('Mark this approved claim as PAID / Disbursed?')) return;
        try {
            await benefitService.markAsPaid({ claim_id: claimId });
            toast.success('Claim marked as Paid');
            fetchData();
        } catch (error) {
            toast.error(extractApiError(error, 'Failed to mark claim as paid'));
        }
    };

    const handleAddDependent = async (e) => {
        e.preventDefault();
        if (!currentEmployeeCode) {
            toast.error('No linked employee profile for your account');
            return;
        }
        try {
            await benefitService.addDependent({
                ...depForm,
                employee_code: currentEmployeeCode
            });
            toast.success('Family dependent added to insurance roll!');
            setShowDependentModal(false);
            setDepForm({
                full_name: '',
                relationship: 'SPOUSE',
                date_of_birth: '',
                gender: 'FEMALE',
                is_covered_under_insurance: true
            });
            fetchData();
        } catch (err) {
            toast.error(extractApiError(err, 'Failed to add dependent'));
        }
    };

    const openCardModal = async (b) => {
        setSelectedCardBenefit(b);
        setShowCardModal(true);
        if (policies.length === 0) {
            try {
                const res = await benefitService.getInsurancePolicies();
                setPolicies(res.data?.data || []);
            } catch {
                // ignore optional enrichment failure
            }
        }
    };

    const claimStatusBadge = (status) => {
        if (status === 'APPROVED') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
        if (status === 'PAID') return 'bg-blue-50 text-blue-700 border border-blue-200';
        if (status === 'REJECTED') return 'bg-rose-50 text-rose-700 border border-rose-200';
        return 'bg-amber-50 text-amber-700 border border-amber-200';
    };

    // Match policy for digital card dynamically from real policies DB
    const gmcPolicy = policies.find(p => p.policy_type === 'GMC') || policies[0] || null;
    const cardPolicy = (selectedCardBenefit?.policy_number &&
        policies.find(p => p.policy_number === selectedCardBenefit.policy_number)) || gmcPolicy;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <HeartPulse className="text-primary-600 shrink-0" size={26} />
                        Insurance, Benefits & Reimbursements
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Group Medical (GMC), GPA, Term Life, Perks, Expense Claims & Dependent Management
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {canAssign && (
                        <>
                            <button
                                onClick={() => setShowAssignForm(true)}
                                className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                            >
                                <ShieldCheck size={15} />
                                Assign Insurance
                            </button>
                            <button
                                onClick={() => setShowPerkForm(true)}
                                className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                            >
                                <Gift size={15} />
                                Assign Perk
                            </button>
                        </>
                    )}
                    {canCreateClaim && (
                        <button
                            onClick={() => setShowClaimForm(true)}
                            className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-700 transition-colors"
                        >
                            <Plus size={15} />
                            Submit Expense Claim
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-slate-200 overflow-x-auto no-scrollbar">
                <nav className="-mb-px flex space-x-6 min-w-max">
                    <button
                        onClick={() => setActiveTab('insurance-policies')}
                        className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${activeTab === 'insurance-policies' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <Shield size={16} /> Corporate Policies (GMC / GPA / GTL)
                    </button>
                    {(currentEmployeeCode || !canAssign) && (
                        <>
                            <button
                                onClick={() => setActiveTab('my-benefits')}
                                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${activeTab === 'my-benefits' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                            >
                                <CreditCard size={16} /> My Enrolled Benefits
                            </button>
                            <button
                                onClick={() => setActiveTab('my-claims')}
                                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${activeTab === 'my-claims' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                            >
                                <Receipt size={16} /> Reimbursements
                            </button>
                            <button
                                onClick={() => setActiveTab('dependents')}
                                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${activeTab === 'dependents' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                            >
                                <Users size={16} /> Family Dependents
                            </button>
                            <button
                                onClick={() => setActiveTab('my-perks')}
                                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${activeTab === 'my-perks' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                            >
                                <Gift size={16} /> Perks & Allowances
                            </button>
                        </>
                    )}
                    {canApprove && (
                        <button
                            onClick={() => setActiveTab('pending-claims')}
                            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${activeTab === 'pending-claims' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        >
                            <Clock size={16} /> Pending Approvals
                            {pendingClaims.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-rose-100 text-rose-700 font-black rounded-full">
                                    {pendingClaims.length}
                                </span>
                            )}
                        </button>
                    )}
                    {canAssign && (
                        <>
                            <button
                                onClick={() => setActiveTab('all-claims')}
                                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${activeTab === 'all-claims' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                            >
                                <History size={16} /> Claims History
                            </button>
                            <button
                                onClick={() => setActiveTab('enrolled-directory')}
                                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${activeTab === 'enrolled-directory' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                            >
                                <ShieldCheck size={16} /> Enrolled Directory
                            </button>
                            <button
                                onClick={() => setActiveTab('mis-reports')}
                                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${activeTab === 'mis-reports' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                            >
                                <BarChart3 size={16} /> MIS Reports & Analytics
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setActiveTab('flowchart')}
                        className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${activeTab === 'flowchart' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <GitBranch size={16} /> Process Flowchart
                    </button>
                </nav>
            </div>

            {/* TAB CONTENTS */}
            {loading ? (
                <div className="py-12 text-center text-slate-400 text-sm">Loading benefits data...</div>
            ) : (
                <>
                    {/* 1. CORPORATE INSURANCE POLICIES TAB */}
                    {activeTab === 'insurance-policies' && (
                        <div className="space-y-6">
                            {policies.length === 0 ? (
                                <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 p-8">
                                    <Shield size={40} className="mx-auto text-slate-300 mb-2" />
                                    <h3 className="font-bold text-slate-700">No corporate insurance policies configured</h3>
                                    <p className="text-xs text-slate-400 mt-1">Contact HR Administration to view master GMC/GPA/GTL schedules.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    {policies.map((p) => {
                                        const isRenewalDue = Number(p.days_to_expiry) <= 60;
                                        return (
                                            <div key={p.policy_id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between relative overflow-hidden hover:shadow-md transition-shadow">
                                                <div className="space-y-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                                            p.policy_type === 'GMC' ? 'bg-blue-100 text-blue-800' :
                                                            p.policy_type === 'GPA' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                                        }`}>
                                                            {p.policy_type} Policy
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            p.calculated_status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                        }`}>
                                                            {p.calculated_status}
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <h3 className="font-bold text-slate-900 text-base">{p.policy_name}</h3>
                                                        <p className="text-xs text-slate-500 mt-0.5">{p.provider_name}</p>
                                                    </div>

                                                    <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                                                        <div className="flex justify-between gap-2">
                                                            <span className="text-slate-500">Policy Number:</span>
                                                            <span className="font-mono font-bold text-slate-700">{p.policy_number || '—'}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-2">
                                                            <span className="text-slate-500">Sum Insured:</span>
                                                            <span className="font-bold text-emerald-700">{formatCurrency(p.sum_insured)}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-2">
                                                            <span className="text-slate-500">TPA Servicing:</span>
                                                            <span className="font-semibold text-slate-700">{p.tpa_name || '—'}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-2">
                                                            <span className="text-slate-500">24x7 TPA Helpline:</span>
                                                            <span className="font-mono text-primary-600 font-semibold">{p.tpa_toll_free || '—'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                                                    <div>
                                                        <div className="text-[10px] text-slate-400">Valid Until</div>
                                                        <div className="font-semibold text-slate-700">{formatIstDate(p.expiry_date)}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[10px] text-slate-400">Policy Renewal</div>
                                                        <div className={`font-bold ${isRenewalDue ? 'text-amber-600' : 'text-slate-600'}`}>
                                                            {p.days_to_expiry ?? 0} Days remaining
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Info Banner */}
                            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/60 flex items-start gap-3 text-xs text-blue-900">
                                <Shield className="text-blue-600 shrink-0 mt-0.5" size={18} />
                                <div>
                                    <p className="font-bold">Automated Policy Renewal & TPA Cashless Network</p>
                                    <p className="text-blue-800/90 mt-0.5 leading-relaxed">
                                        {policies.length > 0
                                            ? `${policies.length} active corporate insurance policy record(s) are tracked above with TPA servicing & cashless hospitalization assistance.`
                                            : 'Corporate Group Medical (GMC), Group Personal Accident (GPA) and Term Life policies are managed centrally with TPA servicing details.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. MY ENROLLED BENEFITS */}
                    {activeTab === 'my-benefits' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {benefits.length === 0 ? (
                                    <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 p-8">
                                        <HeartPulse size={40} className="mx-auto text-slate-300 mb-2" />
                                        <h3 className="font-bold text-slate-700">No active insurance benefits found</h3>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {currentEmployeeCode
                                                ? 'HR has not yet assigned a dedicated policy to your employee profile.'
                                                : 'Your login account is not linked to an employee record.'}
                                        </p>
                                    </div>
                                ) : (
                                    benefits.map(b => (
                                        <div key={b.emp_benefit_id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.category === 'INSURANCE' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                                                        {b.category}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                        Active Cover
                                                    </span>
                                                </div>
                                                <h3 className="font-bold text-slate-900 text-base">{b.name}</h3>
                                                <p className="text-xs text-slate-500 mt-1">{b.description}</p>

                                                <div className="mt-4 p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Policy No:</span>
                                                        <span className="font-mono font-semibold text-slate-800">{b.policy_number || 'Not Assigned'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Coverage Start:</span>
                                                        <span className="font-medium text-slate-700">{formatIstDate(b.start_date)}</span>
                                                    </div>
                                                    {b.end_date && (
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">Valid Till:</span>
                                                            <span className="font-medium text-slate-700">{formatIstDate(b.end_date)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-3 border-t border-slate-100">
                                                <button
                                                    onClick={() => openCardModal(b)}
                                                    className="w-full py-2 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all"
                                                >
                                                    <Download size={14} />
                                                    View & Download Digital Insurance Card
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* 3. REIMBURSEMENTS (MY CLAIMS) */}
                    {activeTab === 'my-claims' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">My Expense Claims</h3>
                                    <p className="text-xs text-slate-500">Track status of Travel, Fuel, Medical OPD, Mobile & Training claims</p>
                                </div>
                                {canCreateClaim && (
                                    <button
                                        onClick={() => setShowClaimForm(true)}
                                        className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1 self-start sm:self-auto"
                                    >
                                        <Plus size={14} /> New Claim
                                    </button>
                                )}
                            </div>

                            {/* Desktop Table */}
                            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-5 py-3">Claim Category</th>
                                                <th className="px-5 py-3">Description & Notes</th>
                                                <th className="px-5 py-3">Claim Amount</th>
                                                <th className="px-5 py-3">Submission Date</th>
                                                <th className="px-5 py-3">Status</th>
                                                <th className="px-5 py-3">Disbursed Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium">
                                            {myClaims.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="p-8 text-center text-slate-400">
                                                        {currentEmployeeCode
                                                            ? 'No expense claims submitted yet. Click "New Claim" above to apply.'
                                                            : 'Your login account is not linked to an employee profile.'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                myClaims.map(c => (
                                                    <tr key={c.claim_id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-5 py-3.5 font-bold text-slate-900">{c.benefit_name}</td>
                                                        <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">{c.description}</td>
                                                        <td className="px-5 py-3.5 font-bold text-slate-900 font-mono">{formatCurrency(c.amount)}</td>
                                                        <td className="px-5 py-3.5 text-slate-500">{formatIstDate(c.claim_date)}</td>
                                                        <td className="px-5 py-3.5">
                                                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${claimStatusBadge(c.status)}`}>
                                                                {c.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3.5 text-slate-500">{c.paid_on ? formatIstDate(c.paid_on) : '—'}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Mobile Cards */}
                            <div className="block md:hidden space-y-3">
                                {myClaims.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                                        No expense claims submitted yet.
                                    </div>
                                ) : (
                                    myClaims.map(c => (
                                        <div key={c.claim_id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2 text-xs">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="font-bold text-slate-900">{c.benefit_name}</div>
                                                    <div className="text-[11px] text-slate-400">{formatIstDate(c.claim_date)}</div>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${claimStatusBadge(c.status)}`}>
                                                    {c.status}
                                                </span>
                                            </div>
                                            {c.description && <p className="text-slate-600">{c.description}</p>}
                                            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                                                <span className="font-black text-slate-900 font-mono text-sm">{formatCurrency(c.amount)}</span>
                                                <span className="text-[11px] text-slate-500">
                                                    {c.paid_on ? `Paid ${formatIstDate(c.paid_on)}` : 'Pending disbursement'}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* 4. FAMILY DEPENDENTS MANAGEMENT */}
                    {activeTab === 'dependents' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Family Dependents (Insurance Floater)</h3>
                                    <p className="text-xs text-slate-500">Spouse, children & parents covered under Group Medical Floater policy</p>
                                </div>
                                {canCreateClaim && currentEmployeeCode && (
                                    <button
                                        onClick={() => setShowDependentModal(true)}
                                        className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1 self-start sm:self-auto"
                                    >
                                        <UserPlus size={14} /> Add Dependent
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {dependents.length === 0 ? (
                                    <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 p-8">
                                        <Users size={36} className="mx-auto text-slate-300 mb-2" />
                                        <h3 className="font-bold text-slate-700">No family dependents enrolled yet</h3>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {currentEmployeeCode
                                                ? 'Add your spouse, children or parents to extend your corporate medical health card coverage.'
                                                : 'Your login account is not linked to an employee profile.'}
                                        </p>
                                    </div>
                                ) : (
                                    dependents.map(d => (
                                        <div key={d.dependent_id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                                                        {d.relationship}
                                                    </span>
                                                    <h4 className="font-bold text-slate-900 mt-1.5">{d.full_name}</h4>
                                                    <p className="text-xs text-slate-500 mt-0.5">Gender: {d.gender} • DOB: {formatIstDate(d.date_of_birth)}</p>
                                                </div>
                                                <span className={`p-1 rounded-full ${d.is_covered_under_insurance ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                                    <ShieldCheck size={16} />
                                                </span>
                                            </div>
                                            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                                                <CheckCircle2 size={13} />
                                                {d.is_covered_under_insurance ? 'Cashless Hospitalization Eligible' : 'Registered Dependent'}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* 5. PERKS & ALLOWANCES */}
                    {activeTab === 'my-perks' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {perks.length === 0 ? (
                                <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 p-8">
                                    <Gift size={40} className="mx-auto text-slate-300 mb-2" />
                                    <h3 className="font-bold text-slate-700">No active perks or allowances assigned</h3>
                                    <p className="text-xs text-slate-400 mt-1">Festival bonus and meal allowances will appear here when configured by HR.</p>
                                </div>
                            ) : (
                                perks.map(p => (
                                    <div key={p.emp_perk_id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${p.is_monetary ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                                                {p.is_monetary ? 'Monetary Allowance' : 'In-Kind Benefit'}
                                            </span>
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                                {p.status}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-base">{p.name}</h3>
                                        <p className="text-xs text-slate-500 mt-1">{p.description}</p>
                                        <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-1">
                                            <Calendar size={13} />
                                            Active since {formatIstDate(p.start_date)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* 6. PENDING APPROVALS */}
                    {activeTab === 'pending-claims' && canApprove && (
                        <div className="space-y-4">
                            <div className="p-4 border border-slate-200 bg-white rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Pending Expense Claim Approvals</h3>
                                    <p className="text-xs text-slate-500">Review employee travel, food, fuel & medical claims before finance disbursement</p>
                                </div>
                                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold text-xs rounded-full self-start sm:self-auto">
                                    {pendingClaims.length} Pending Review
                                </span>
                            </div>

                            {/* Desktop Table */}
                            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-5 py-3">Employee</th>
                                                <th className="px-5 py-3">Claim Type</th>
                                                <th className="px-5 py-3">Amount</th>
                                                <th className="px-5 py-3">Date</th>
                                                <th className="px-5 py-3">Notes</th>
                                                <th className="px-5 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium">
                                            {pendingClaims.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="p-8 text-center text-slate-400">
                                                        All claims are cleared. No pending reimbursement requests.
                                                    </td>
                                                </tr>
                                            ) : (
                                                pendingClaims.map(c => (
                                                    <tr key={c.claim_id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-5 py-3.5">
                                                            <div className="font-bold text-slate-900">{c.first_name} {c.last_name}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">{c.employee_code}</div>
                                                        </td>
                                                        <td className="px-5 py-3.5 font-bold text-slate-800">{c.benefit_name}</td>
                                                        <td className="px-5 py-3.5 font-black text-slate-900 font-mono">{formatCurrency(c.amount)}</td>
                                                        <td className="px-5 py-3.5 text-slate-500">{formatIstDate(c.claim_date)}</td>
                                                        <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">{c.description}</td>
                                                        <td className="px-5 py-3.5 text-right space-x-2">
                                                            <button
                                                                onClick={() => { setRejectClaimId(c.claim_id); setRejectReason(''); }}
                                                                className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                                                            >
                                                                Reject
                                                            </button>
                                                            <button
                                                                onClick={() => handleApprove(c.claim_id)}
                                                                className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors"
                                                            >
                                                                Approve
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Mobile Cards */}
                            <div className="block md:hidden space-y-3">
                                {pendingClaims.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                                        All claims are cleared.
                                    </div>
                                ) : (
                                    pendingClaims.map(c => (
                                        <div key={c.claim_id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2.5 text-xs">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="font-bold text-slate-900">{c.first_name} {c.last_name}</div>
                                                    <div className="text-[11px] font-mono text-slate-400">{c.employee_code}</div>
                                                </div>
                                                <span className="font-black text-slate-900 font-mono text-sm">{formatCurrency(c.amount)}</span>
                                            </div>
                                            <div className="flex justify-between text-[11px] text-slate-600">
                                                <span className="font-semibold text-slate-800">{c.benefit_name}</span>
                                                <span>{formatIstDate(c.claim_date)}</span>
                                            </div>
                                            {c.description && <p className="text-slate-600">{c.description}</p>}
                                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                                <button
                                                    onClick={() => { setRejectClaimId(c.claim_id); setRejectReason(''); }}
                                                    className="px-3 py-1.5 font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(c.claim_id)}
                                                    className="px-3.5 py-1.5 font-bold text-white bg-emerald-600 rounded-lg"
                                                >
                                                    Approve
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* 7. ALL CLAIMS HISTORY */}
                    {activeTab === 'all-claims' && canAssign && (
                        <div className="space-y-4">
                            <div className="p-4 border border-slate-200 bg-white rounded-2xl">
                                <h3 className="text-sm font-bold text-slate-800">Complete Claims Audit Register</h3>
                                <p className="text-xs text-slate-500">Historical logs of all submitted, approved, rejected, and paid claims</p>
                            </div>

                            {/* Desktop Table */}
                            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-5 py-3">Employee</th>
                                                <th className="px-5 py-3">Category</th>
                                                <th className="px-5 py-3">Amount</th>
                                                <th className="px-5 py-3">Date</th>
                                                <th className="px-5 py-3">Status</th>
                                                <th className="px-5 py-3 text-right">Disbursement</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium">
                                            {allClaims.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="p-8 text-center text-slate-400">No claims history recorded.</td>
                                                </tr>
                                            ) : (
                                                allClaims.map(c => (
                                                    <tr key={c.claim_id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-5 py-3.5">
                                                            <div className="font-bold text-slate-900">{c.first_name} {c.last_name}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">{c.employee_code}</div>
                                                        </td>
                                                        <td className="px-5 py-3.5 font-bold text-slate-800">{c.benefit_name}</td>
                                                        <td className="px-5 py-3.5 font-black text-slate-900 font-mono">{formatCurrency(c.amount)}</td>
                                                        <td className="px-5 py-3.5 text-slate-500">{formatIstDate(c.claim_date)}</td>
                                                        <td className="px-5 py-3.5">
                                                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${claimStatusBadge(c.status)}`}>
                                                                {c.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3.5 text-right">
                                                            {c.status === 'APPROVED' ? (
                                                                <button
                                                                    onClick={() => handleMarkPaid(c.claim_id)}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                                                                >
                                                                    <Banknote size={12} /> Mark Paid
                                                                </button>
                                                            ) : c.paid_on ? (
                                                                <span className="text-[11px] text-emerald-700 font-semibold">Paid {formatIstDate(c.paid_on)}</span>
                                                            ) : (
                                                                <span className="text-slate-400">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Mobile Cards */}
                            <div className="block md:hidden space-y-3">
                                {allClaims.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                                        No claims history recorded.
                                    </div>
                                ) : (
                                    allClaims.map(c => (
                                        <div key={c.claim_id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2 text-xs">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="font-bold text-slate-900">{c.first_name} {c.last_name}</div>
                                                    <div className="text-[11px] text-slate-400 font-mono">{c.employee_code}</div>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${claimStatusBadge(c.status)}`}>
                                                    {c.status}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-slate-600">
                                                <span className="font-semibold text-slate-800">{c.benefit_name}</span>
                                                <span className="font-black text-slate-900 font-mono">{formatCurrency(c.amount)}</span>
                                            </div>
                                            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                                                <span className="text-[11px] text-slate-500">{formatIstDate(c.claim_date)}</span>
                                                {c.status === 'APPROVED' && (
                                                    <button
                                                        onClick={() => handleMarkPaid(c.claim_id)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-blue-600 text-white rounded-lg"
                                                    >
                                                        <Banknote size={12} /> Mark Paid
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* 8. ENROLLED DIRECTORY (HR / Finance View) */}
                    {activeTab === 'enrolled-directory' && canAssign && (
                        <div className="space-y-4">
                            <div className="p-4 border border-slate-200 bg-white rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Enrolled Employee Benefits Directory</h3>
                                    <p className="text-xs text-slate-500">Active corporate benefit & policy assignments across employees</p>
                                </div>
                                <span className="px-2.5 py-1 bg-primary-50 text-primary-700 font-bold text-xs rounded-full self-start sm:self-auto">
                                    {enrolledDirectory.length} Active Enrollments
                                </span>
                            </div>

                            {/* Desktop Table */}
                            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-5 py-3">Employee</th>
                                                <th className="px-5 py-3">Benefit Plan</th>
                                                <th className="px-5 py-3">Category</th>
                                                <th className="px-5 py-3">Policy / Ref No.</th>
                                                <th className="px-5 py-3">Effective Period</th>
                                                <th className="px-5 py-3">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium">
                                            {enrolledDirectory.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="p-8 text-center text-slate-400">
                                                        No active employee benefit assignments found. Click "Assign Insurance" above to enroll staff.
                                                    </td>
                                                </tr>
                                            ) : (
                                                enrolledDirectory.map(row => (
                                                    <tr key={row.emp_benefit_id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-5 py-3.5">
                                                            <div className="font-bold text-slate-900">{row.first_name} {row.last_name}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">{row.employee_code}</div>
                                                        </td>
                                                        <td className="px-5 py-3.5 font-bold text-slate-800">{row.name}</td>
                                                        <td className="px-5 py-3.5">
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{row.category}</span>
                                                        </td>
                                                        <td className="px-5 py-3.5 font-mono text-slate-700">{row.policy_number || '—'}</td>
                                                        <td className="px-5 py-3.5 text-slate-500">
                                                            {formatIstDate(row.start_date)} {row.end_date ? `→ ${formatIstDate(row.end_date)}` : ''}
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                {row.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Mobile Cards */}
                            <div className="block md:hidden space-y-3">
                                {enrolledDirectory.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                                        No active benefit enrollments found.
                                    </div>
                                ) : (
                                    enrolledDirectory.map(row => (
                                        <div key={row.emp_benefit_id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2 text-xs">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="font-bold text-slate-900">{row.first_name} {row.last_name}</div>
                                                    <div className="text-[11px] font-mono text-slate-400">{row.employee_code}</div>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                                    {row.status}
                                                </span>
                                            </div>
                                            <div className="font-bold text-slate-800">{row.name}</div>
                                            <div className="flex justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                                                <span className="font-mono">{row.policy_number || '—'}</span>
                                                <span>From {formatIstDate(row.start_date)}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* 9. MIS REPORTS & ANALYTICS TAB */}
                    {activeTab === 'mis-reports' && canAssign && (
                        <div className="space-y-6">
                            {/* Top Stat Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Insurance Pool Sum Insured</div>
                                    <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                                        {formatCurrency(misReports?.coverage?.total_insurance_pool ?? 0)}
                                    </div>
                                    <div className="text-[11px] text-emerald-600 font-semibold mt-1">Across active corporate policies</div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Enrolled Employees</div>
                                    <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                                        {misReports?.coverage?.total_enrolled_employees ?? 0}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-1">Active staff with benefit policies</div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dependents Covered</div>
                                    <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                                        {misReports?.coverage?.total_dependents_covered ?? 0}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-1">Family members on floater policy</div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending Claims Amount</div>
                                    <div className="text-2xl font-black text-amber-600 mt-2 font-mono">
                                        {formatCurrency(misReports?.pendingClaims?.pending_amount ?? 0)}
                                    </div>
                                    <div className="text-[11px] text-amber-700 font-semibold mt-1">
                                        {misReports?.pendingClaims?.pending_count ?? 0} claims awaiting approval
                                    </div>
                                </div>
                            </div>

                            {/* Category Utilization Register */}
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                    <h3 className="text-sm font-bold text-slate-800">Benefit Category Utilization Register</h3>
                                    <p className="text-xs text-slate-500">Utilization breakdown by Travel, Mobile, Fuel, Medical OPD & Training</p>
                                </div>

                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-5 py-3">Category Name</th>
                                                <th className="px-5 py-3">Type</th>
                                                <th className="px-5 py-3">Total Claims Filed</th>
                                                <th className="px-5 py-3">Total Claimed</th>
                                                <th className="px-5 py-3">Approved Amount</th>
                                                <th className="px-5 py-3">Disbursed (Paid)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium">
                                            {misReports?.utilization && misReports.utilization.length > 0 ? (
                                                misReports.utilization.map((u, i) => (
                                                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-5 py-3.5 font-bold text-slate-900">{u.benefit_name}</td>
                                                        <td className="px-5 py-3.5">
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                                                {u.category}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3.5 font-mono text-slate-800">{u.total_claims}</td>
                                                        <td className="px-5 py-3.5 font-bold text-slate-900 font-mono">{formatCurrency(u.total_claimed_amount)}</td>
                                                        <td className="px-5 py-3.5 font-bold text-emerald-700 font-mono">{formatCurrency(u.approved_amount)}</td>
                                                        <td className="px-5 py-3.5 font-bold text-blue-700 font-mono">{formatCurrency(u.disbursed_amount)}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="6" className="p-8 text-center text-slate-400">
                                                        No utilization records available yet.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="block md:hidden divide-y divide-slate-100">
                                    {misReports?.utilization && misReports.utilization.length > 0 ? (
                                        misReports.utilization.map((u, i) => (
                                            <div key={i} className="p-4 text-xs space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-slate-900">{u.benefit_name}</span>
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{u.category}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                                                    <div>Claims: <span className="font-mono font-bold">{u.total_claims}</span></div>
                                                    <div>Claimed: <span className="font-mono font-bold">{formatCurrency(u.total_claimed_amount)}</span></div>
                                                    <div className="text-emerald-700">Approved: <span className="font-mono font-bold">{formatCurrency(u.approved_amount)}</span></div>
                                                    <div className="text-blue-700">Paid: <span className="font-mono font-bold">{formatCurrency(u.disbursed_amount)}</span></div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-6 text-center text-xs text-slate-400">No utilization records available yet.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 10. PROCESS FLOWCHART */}
                    {activeTab === 'flowchart' && (
                        <div className="animate-in fade-in duration-300">
                            <WorkflowFlowchart defaultWorkflow="lifecycle" allowSwitch={true} />
                        </div>
                    )}
                </>
            )}

            {/* MODALS */}
            {showAssignForm && <AssignBenefitForm onClose={() => setShowAssignForm(false)} onSuccess={fetchData} />}
            {showPerkForm && <AssignPerkForm onClose={() => setShowPerkForm(false)} onSuccess={fetchData} />}
            {showClaimForm && <ReimbursementClaimForm onClose={() => setShowClaimForm(false)} onSuccess={fetchData} employeeId={user?.employeeId || null} />}

            {/* REJECT CLAIM MODAL (replaces browser prompt) */}
            {rejectClaimId && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                    <XCircle size={18} className="text-rose-600" />
                                    Reject Reimbursement Claim
                                </h3>
                                <button onClick={() => setRejectClaimId(null)} className="text-slate-400 hover:text-slate-600">
                                    <X size={18} />
                                </button>
                            </div>
                            <form onSubmit={handleConfirmReject} className="p-5 space-y-4 overflow-y-auto text-xs">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Rejection Reason *</label>
                                    <textarea
                                        required
                                        rows="3"
                                        placeholder="Provide a clear reason (e.g. Missing original GST bill/receipt)..."
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-rose-500"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setRejectClaimId(null)}
                                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={rejectSubmitting}
                                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold disabled:opacity-50"
                                    >
                                        {rejectSubmitting ? 'Rejecting...' : 'Confirm Reject'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* ADD DEPENDENT MODAL */}
            {showDependentModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                    <UserPlus size={18} className="text-primary-600" />
                                    Add Family Dependent
                                </h3>
                                <button onClick={() => setShowDependentModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <XCircle size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleAddDependent} className="p-6 space-y-4 text-xs overflow-y-auto">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Full Legal Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Priya Sharma"
                                        value={depForm.full_name}
                                        onChange={(e) => setDepForm({ ...depForm, full_name: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Relationship *</label>
                                        <select
                                            value={depForm.relationship}
                                            onChange={(e) => setDepForm({ ...depForm, relationship: e.target.value })}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                        >
                                            <option value="SPOUSE">Spouse</option>
                                            <option value="CHILD">Child</option>
                                            <option value="FATHER">Father</option>
                                            <option value="MOTHER">Mother</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Gender</label>
                                        <select
                                            value={depForm.gender}
                                            onChange={(e) => setDepForm({ ...depForm, gender: e.target.value })}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                        >
                                            <option value="FEMALE">Female</option>
                                            <option value="MALE">Male</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Date of Birth</label>
                                    <input
                                        type="date"
                                        value={depForm.date_of_birth}
                                        onChange={(e) => setDepForm({ ...depForm, date_of_birth: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                    />
                                </div>

                                <div className="pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={depForm.is_covered_under_insurance}
                                            onChange={(e) => setDepForm({ ...depForm, is_covered_under_insurance: e.target.checked })}
                                            className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4"
                                        />
                                        Include under Group Medical Floater (Cashless Hospitalization)
                                    </label>
                                </div>

                                <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowDependentModal(false)}
                                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-xs"
                                    >
                                        Save Dependent
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* DIGITAL HEALTH INSURANCE E-CARD MODAL */}
            {showCardModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
                            <div className="overflow-y-auto">
                                {/* Printable E-Card */}
                                <div className="p-6 bg-gradient-to-tr from-slate-900 via-primary-950 to-indigo-900 text-white relative overflow-hidden">
                                    <div className="absolute -right-10 -bottom-10 opacity-10">
                                        <HeartPulse size={200} />
                                    </div>

                                    <div className="flex items-start justify-between gap-2 relative z-10">
                                        <div>
                                            <div className="text-[10px] tracking-widest text-primary-300 uppercase font-black">NKD CRM GROUP HEALTH CARD</div>
                                            <h2 className="text-lg sm:text-xl font-black mt-0.5 tracking-tight">CASHLESS TPA HEALTH CARD</h2>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="px-2.5 py-1 bg-white/10 backdrop-blur-xs border border-white/20 rounded-lg text-[10px] font-black uppercase text-emerald-400">
                                                {cardPolicy?.policy_type ? `${cardPolicy.policy_type} COVER` : (selectedCardBenefit?.category || 'INSURANCE')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10 text-xs">
                                        <div>
                                            <div className="text-[10px] text-white/60">PRIMARY INSURED MEMBER</div>
                                            <div className="font-bold text-sm tracking-tight">
                                                {user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Insured Employee'}
                                            </div>
                                            <div className="text-[10px] font-mono text-primary-300">ID: {currentEmployeeCode || 'Not Assigned'}</div>
                                        </div>
                                        <div className="sm:text-right">
                                            <div className="text-[10px] text-white/60">SUM INSURED</div>
                                            <div className="text-lg font-black font-mono text-emerald-400">
                                                {cardPolicy?.sum_insured ? formatCurrency(cardPolicy.sum_insured) : 'As Per Policy'}
                                            </div>
                                            <div className="text-[10px] text-white/60">{selectedCardBenefit?.name || 'Corporate Cover'}</div>
                                        </div>
                                    </div>

                                    <div className="mt-4 p-3 bg-white/10 backdrop-blur-md rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] relative z-10 border border-white/15">
                                        <div>
                                            <span className="text-white/60 block text-[9px]">POLICY NUMBER</span>
                                            <span className="font-mono font-bold">{selectedCardBenefit?.policy_number || cardPolicy?.policy_number || '—'}</span>
                                        </div>
                                        <div>
                                            <span className="text-white/60 block text-[9px]">SERVICING TPA</span>
                                            <span className="font-bold">{cardPolicy?.tpa_name || cardPolicy?.provider_name || '—'}</span>
                                        </div>
                                        <div className="mt-1">
                                            <span className="text-white/60 block text-[9px]">VALID TILL</span>
                                            <span className="font-semibold text-amber-300">
                                                {formatIstDate(selectedCardBenefit?.end_date || cardPolicy?.expiry_date)}
                                            </span>
                                        </div>
                                        <div className="mt-1">
                                            <span className="text-white/60 block text-[9px]">24x7 EMERGENCY HELPLINE</span>
                                            <span className="font-mono font-bold text-emerald-300">{cardPolicy?.tpa_toll_free || '—'}</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-white/60 relative z-10">
                                        <span>Show this card at hospital TPA desk for cashless admission.</span>
                                        <span className="font-bold text-white/90">NKD MANPOWER & FACILITIES</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card Actions */}
                            <div className="p-4 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-200 text-xs shrink-0">
                                <span className="text-slate-500">Official digital e-card issued by Corporate HR</span>
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={() => window.print()}
                                        className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100 flex items-center gap-1.5 shadow-xs"
                                    >
                                        <Printer size={14} /> Print / Save PDF
                                    </button>
                                    <button
                                        onClick={() => setShowCardModal(false)}
                                        className="px-4 py-1.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 shadow-xs"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
};

export default Benefits;
