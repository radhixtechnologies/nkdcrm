import { useState, useEffect, useCallback } from 'react';
import {
    Plus, CreditCard, Receipt, Users, Clock, Gift, Info,
    Calendar, History, GitBranch, Shield, ShieldCheck,
    AlertTriangle, HeartPulse, UserPlus, PhoneCall, Download,
    Printer, CheckCircle2, XCircle, ArrowUpRight, BarChart3
} from 'lucide-react';
import benefitService from '../services/benefitService';
import perkService from '../services/perkService';
import AssignBenefitForm from '../components/forms/AssignBenefitForm';
import AssignPerkForm from '../components/forms/AssignPerkForm';
import ReimbursementClaimForm from '../components/forms/ReimbursementClaimForm';
import WorkflowFlowchart from '../components/charts/WorkflowFlowchart';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const Benefits = () => {
    const { user } = useAuth();
    const isHR = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.roleCode || user?.role?.roleCode);
    const isManager = ['DEPT_MANAGER'].includes(user?.roleCode || user?.role?.roleCode);
    const currentEmployeeCode = user?.employeeCode;

    const [activeTab, setActiveTab] = useState(isHR ? 'insurance-policies' : 'my-benefits');
    const [showAssignForm, setShowAssignForm] = useState(false);
    const [showPerkForm, setShowPerkForm] = useState(false);
    const [showClaimForm, setShowClaimForm] = useState(false);
    const [showDependentModal, setShowDependentModal] = useState(false);
    const [showCardModal, setShowCardModal] = useState(false);
    const [selectedCardBenefit, setSelectedCardBenefit] = useState(null);

    const [benefits, setBenefits] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [dependents, setDependents] = useState([]);
    const [perks, setPerks] = useState([]);
    const [myClaims, setMyClaims] = useState([]);
    const [pendingClaims, setPendingClaims] = useState([]);
    const [allClaims, setAllClaims] = useState([]);
    const [misReports, setMisReports] = useState(null);
    const [loading, setLoading] = useState(true);

    // Dependent Form State
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
                    const res = await benefitService.getMyBenefits(currentEmployeeCode);
                    setBenefits(res.data?.data || []);
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
            } else if (activeTab === 'pending-claims' && (isHR || isManager)) {
                const res = await benefitService.getPendingClaims();
                setPendingClaims(res.data?.data || []);
            } else if (activeTab === 'all-claims' && (isHR || isManager)) {
                const res = await benefitService.getAllClaims();
                setAllClaims(res.data?.data || []);
            } else if (activeTab === 'mis-reports') {
                const res = await benefitService.getMISReports();
                setMisReports(res.data?.data || null);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [activeTab, currentEmployeeCode, isHR, isManager]);

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
            toast.error(error.response?.data?.message || 'Failed to approve');
        }
    };

    const handleReject = async (claimId) => {
        const reason = prompt('Enter rejection reason:');
        if (!reason) return;
        try {
            await benefitService.rejectClaim({ claim_id: claimId, approver_id: user?.employeeId, reason });
            toast.success('Claim Rejected');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reject');
        }
    };

    const handleAddDependent = async (e) => {
        e.preventDefault();
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
            toast.error(err.response?.data?.message || 'Failed to add dependent');
        }
    };

    const formatDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <HeartPulse className="text-primary-600" size={26} />
                        Insurance, Benefits & Reimbursements
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Group Medical (GMC), GPA, Term Life, Perks, Expense Claims & Dependent Management
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {isHR && (
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
                    <button
                        onClick={() => setShowClaimForm(true)}
                        className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary-700 transition-colors"
                    >
                        <Plus size={15} />
                        Submit Expense Claim
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-slate-200 overflow-x-auto">
                <nav className="-mb-px flex space-x-6 min-w-max">
                    <button
                        onClick={() => setActiveTab('insurance-policies')}
                        className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold transition-colors ${activeTab === 'insurance-policies' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <Shield size={16} /> Corporate Policies (GMC / GPA / GTL)
                    </button>
                    <button
                        onClick={() => setActiveTab('my-benefits')}
                        className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold transition-colors ${activeTab === 'my-benefits' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <CreditCard size={16} /> My Enrolled Benefits
                    </button>
                    <button
                        onClick={() => setActiveTab('my-claims')}
                        className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold transition-colors ${activeTab === 'my-claims' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <Receipt size={16} /> Reimbursements (Travel, Fuel, Medical...)
                    </button>
                    <button
                        onClick={() => setActiveTab('dependents')}
                        className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold transition-colors ${activeTab === 'dependents' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <Users size={16} /> Family Dependents
                    </button>
                    <button
                        onClick={() => setActiveTab('my-perks')}
                        className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold transition-colors ${activeTab === 'my-perks' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <Gift size={16} /> Perks & Allowances
                    </button>
                    {(isHR || isManager) && (
                        <>
                            <button
                                onClick={() => setActiveTab('pending-claims')}
                                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold transition-colors ${activeTab === 'pending-claims' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                            >
                                <Clock size={16} /> Pending Approvals
                                {pendingClaims.length > 0 && <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-rose-100 text-rose-700 font-black rounded-full">{pendingClaims.length}</span>}
                            </button>
                            <button
                                onClick={() => setActiveTab('all-claims')}
                                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold transition-colors ${activeTab === 'all-claims' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                            >
                                <History size={16} /> Claims History
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setActiveTab('mis-reports')}
                        className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold transition-colors ${activeTab === 'mis-reports' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <BarChart3 size={16} /> MIS Reports & Analytics
                    </button>
                    <button
                        onClick={() => setActiveTab('flowchart')}
                        className={`flex items-center gap-2 py-3 px-1 border-b-2 text-xs font-bold transition-colors ${activeTab === 'flowchart' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
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
                    {/* 1. CORPORATE INSURANCE POLICIES TAB (GMC, GPA, GTL) */}
                    {activeTab === 'insurance-policies' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {policies.map((p) => {
                                    const isRenewalDue = p.days_to_expiry <= 60;
                                    return (
                                        <div key={p.policy_id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between relative overflow-hidden hover:shadow-md transition-shadow">
                                            <div className="space-y-3">
                                                <div className="flex items-start justify-between">
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
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Policy Number:</span>
                                                        <span className="font-mono font-bold text-slate-700">{p.policy_number}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Sum Insured:</span>
                                                        <span className="font-bold text-emerald-700">{formatCurrency(p.sum_insured)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">TPA Servicing:</span>
                                                        <span className="font-semibold text-slate-700">{p.tpa_name}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">24x7 TPA Helpline:</span>
                                                        <span className="font-mono text-primary-600 font-semibold">{p.tpa_toll_free}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                                                <div>
                                                    <div className="text-[10px] text-slate-400">Valid Until</div>
                                                    <div className="font-semibold text-slate-700">{formatDate(p.expiry_date)}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-slate-400">Policy Renewal</div>
                                                    <div className={`font-bold ${isRenewalDue ? 'text-amber-600' : 'text-slate-600'}`}>
                                                        {p.days_to_expiry} Days remaining
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Info Banner */}
                            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/60 flex items-start gap-3 text-xs text-blue-900">
                                <Shield className="text-blue-600 shrink-0 mt-0.5" size={18} />
                                <div>
                                    <p className="font-bold">Automated Policy Renewal & TPA Cashless Network</p>
                                    <p className="text-blue-800/90 mt-0.5 leading-relaxed">
                                        All field personnel and corporate employees are automatically covered under corporate Group Medical (GMC - ₹5 Lacs cashless hospitalization) and 24x7 Group Personal Accident (GPA - ₹10 Lacs). Claims can be filed cashless via MediAssist TPA across 10,000+ pan-India network hospitals.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. MY ENROLLED BENEFITS (ESS View + Digital Insurance Health Card) */}
                    {activeTab === 'my-benefits' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {benefits.length === 0 ? (
                                    <div className="col-span-3 py-12 text-center bg-white rounded-2xl border border-slate-200 p-8">
                                        <HeartPulse size={40} className="mx-auto text-slate-300 mb-2" />
                                        <h3 className="font-bold text-slate-700">No active insurance benefits found</h3>
                                        <p className="text-xs text-slate-400 mt-1">HR has not yet assigned a dedicated policy to your employee profile.</p>
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
                                                        <span className="font-mono font-semibold text-slate-800">{b.policy_number || 'POL-GMC-2026-9921'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Coverage Start:</span>
                                                        <span className="font-medium text-slate-700">{formatDate(b.start_date)}</span>
                                                    </div>
                                                    {b.end_date && (
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">Valid Till:</span>
                                                            <span className="font-medium text-slate-700">{formatDate(b.end_date)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-3 border-t border-slate-100">
                                                <button
                                                    onClick={() => {
                                                        setSelectedCardBenefit(b);
                                                        setShowCardModal(true);
                                                    }}
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

                    {/* 3. REIMBURSEMENTS (Travel, Mobile, Fuel, Medical, Training) */}
                    {activeTab === 'my-claims' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">My Expense Claims</h3>
                                    <p className="text-xs text-slate-500">Track status of Travel, Fuel, Medical OPD, Mobile & Training claims</p>
                                </div>
                                <button
                                    onClick={() => setShowClaimForm(true)}
                                    className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1"
                                >
                                    <Plus size={14} /> New Claim
                                </button>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
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
                                                        No expense claims submitted yet. Click "New Claim" above to apply.
                                                    </td>
                                                </tr>
                                            ) : (
                                                myClaims.map(c => (
                                                    <tr key={c.claim_id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-5 py-3.5 font-bold text-slate-900">{c.benefit_name}</td>
                                                        <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">{c.description}</td>
                                                        <td className="px-5 py-3.5 font-bold text-slate-900 font-mono">₹{c.amount}</td>
                                                        <td className="px-5 py-3.5 text-slate-500">{formatDate(c.claim_date)}</td>
                                                        <td className="px-5 py-3.5">
                                                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                                                c.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                                c.status === 'PAID' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                                                c.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                                'bg-amber-50 text-amber-700 border border-amber-200'
                                                            }`}>
                                                                {c.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3.5 text-slate-500">{c.paid_on ? formatDate(c.paid_on) : '—'}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. FAMILY DEPENDENTS MANAGEMENT */}
                    {activeTab === 'dependents' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Family Dependents (Insurance Floater)</h3>
                                    <p className="text-xs text-slate-500">Spouse, children & parents covered under Group Medical Floater policy</p>
                                </div>
                                <button
                                    onClick={() => setShowDependentModal(true)}
                                    className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1"
                                >
                                    <UserPlus size={14} /> Add Dependent
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {dependents.length === 0 ? (
                                    <div className="col-span-3 py-12 text-center bg-white rounded-2xl border border-slate-200 p-8">
                                        <Users size={36} className="mx-auto text-slate-300 mb-2" />
                                        <h3 className="font-bold text-slate-700">No family dependents enrolled yet</h3>
                                        <p className="text-xs text-slate-400 mt-1">Add your spouse, children or parents to extend your corporate medical health card coverage.</p>
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
                                                    <p className="text-xs text-slate-500 mt-0.5">Gender: {d.gender} • DOB: {formatDate(d.date_of_birth)}</p>
                                                </div>
                                                <span className={`p-1 rounded-full ${d.is_covered_under_insurance ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                                    <ShieldCheck size={16} />
                                                </span>
                                            </div>
                                            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                                                <CheckCircle2 size={13} />
                                                Cashless Hospitalization Eligible
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
                                <div className="col-span-3 py-12 text-center bg-white rounded-2xl border border-slate-200 p-8">
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
                                            Active since {formatDate(p.start_date)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* 6. PENDING APPROVALS (HR View) */}
                    {activeTab === 'pending-claims' && (
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Pending Expense Claim Approvals</h3>
                                    <p className="text-xs text-slate-500">Review employee travel, food, fuel & medical claims before finance disbursement</p>
                                </div>
                                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold text-xs rounded-full">
                                    {pendingClaims.length} Pending Review
                                </span>
                            </div>

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
                                                    🎉 All claims are cleared! No pending reimbursement requests.
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
                                                    <td className="px-5 py-3.5 font-black text-slate-900 font-mono">₹{c.amount}</td>
                                                    <td className="px-5 py-3.5 text-slate-500">{formatDate(c.claim_date)}</td>
                                                    <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">{c.description}</td>
                                                    <td className="px-5 py-3.5 text-right space-x-2">
                                                        <button
                                                            onClick={() => handleReject(c.claim_id)}
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
                    )}

                    {/* 7. ALL CLAIMS HISTORY (HR View) */}
                    {activeTab === 'all-claims' && (
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Complete Claims Audit Register</h3>
                                    <p className="text-xs text-slate-500">Historical logs of all submitted, approved, rejected, and paid claims</p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-5 py-3">Employee</th>
                                            <th className="px-5 py-3">Category</th>
                                            <th className="px-5 py-3">Amount</th>
                                            <th className="px-5 py-3">Date</th>
                                            <th className="px-5 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                        {allClaims.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="p-8 text-center text-slate-400">No claims history recorded.</td>
                                            </tr>
                                        ) : (
                                            allClaims.map(c => (
                                                <tr key={c.claim_id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-5 py-3.5">
                                                        <div className="font-bold text-slate-900">{c.first_name} {c.last_name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{c.employee_code}</div>
                                                    </td>
                                                    <td className="px-5 py-3.5 font-bold text-slate-800">{c.benefit_name}</td>
                                                    <td className="px-5 py-3.5 font-black text-slate-900 font-mono">₹{c.amount}</td>
                                                    <td className="px-5 py-3.5 text-slate-500">{formatDate(c.claim_date)}</td>
                                                    <td className="px-5 py-3.5">
                                                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                                            c.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                                                            c.status === 'PAID' ? 'bg-blue-50 text-blue-700' :
                                                            c.status === 'REJECTED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                                                        }`}>
                                                            {c.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 8. MIS REPORTS & ANALYTICS TAB */}
                    {activeTab === 'mis-reports' && (
                        <div className="space-y-6">
                            {/* Top Stat Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Insurance Pool Sum Insured</div>
                                    <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                                        {formatCurrency(misReports?.coverage?.total_insurance_pool || 3000000)}
                                    </div>
                                    <div className="text-[11px] text-emerald-600 font-semibold mt-1">Across GMC, GPA & GTL policies</div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Enrolled Employees</div>
                                    <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                                        {misReports?.coverage?.total_enrolled_employees || 1}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-1">Active staff on corporate roll</div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dependents Covered</div>
                                    <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                                        {misReports?.coverage?.total_dependents_covered || 0}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-1">Family members on GMC floater</div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending Claims Amount</div>
                                    <div className="text-2xl font-black text-amber-600 mt-2 font-mono">
                                        {formatCurrency(misReports?.pendingClaims?.pending_amount || 0)}
                                    </div>
                                    <div className="text-[11px] text-amber-700 font-semibold mt-1">
                                        {misReports?.pendingClaims?.pending_count || 0} claims awaiting approval
                                    </div>
                                </div>
                            </div>

                            {/* Category Utilization Register */}
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                    <h3 className="text-sm font-bold text-slate-800">Benefit Category Utilization Register</h3>
                                    <p className="text-xs text-slate-500">Utilization breakdown by Travel, Mobile, Fuel, Medical OPD & Training</p>
                                </div>

                                <div className="overflow-x-auto">
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
                                                        <td className="px-5 py-3.5 font-bold text-slate-900 font-mono">₹{u.total_claimed_amount}</td>
                                                        <td className="px-5 py-3.5 font-bold text-emerald-700 font-mono">₹{u.approved_amount}</td>
                                                        <td className="px-5 py-3.5 font-bold text-blue-700 font-mono">₹{u.disbursed_amount}</td>
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
                            </div>
                        </div>
                    )}

                    {/* 9. PROCESS FLOWCHART */}
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

            {/* ADD DEPENDENT MODAL */}
            {showDependentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                <UserPlus size={18} className="text-primary-600" />
                                Add Family Dependent
                            </h3>
                            <button onClick={() => setShowDependentModal(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddDependent} className="p-6 space-y-4 text-xs">
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

                            <div className="grid grid-cols-2 gap-3">
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
            )}

            {/* DIGITAL HEALTH INSURANCE E-CARD MODAL */}
            {showCardModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
                        {/* Printable E-Card */}
                        <div className="p-6 bg-gradient-to-tr from-slate-900 via-primary-950 to-indigo-900 text-white relative overflow-hidden">
                            <div className="absolute -right-10 -bottom-10 opacity-10">
                                <HeartPulse size={200} />
                            </div>

                            <div className="flex items-start justify-between relative z-10">
                                <div>
                                    <div className="text-[10px] tracking-widest text-primary-300 uppercase font-black">NKD CRM GROUP HEALTH CARD</div>
                                    <h2 className="text-xl font-black mt-0.5 tracking-tight">CASHLESS TPA HEALTH CARD</h2>
                                </div>
                                <div className="text-right">
                                    <span className="px-2.5 py-1 bg-white/10 backdrop-blur-xs border border-white/20 rounded-lg text-[10px] font-black uppercase text-emerald-400">
                                        GMC FLOATER
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-2 gap-4 relative z-10 text-xs">
                                <div>
                                    <div className="text-[10px] text-white/60">PRIMARY INSURED MEMBER</div>
                                    <div className="font-bold text-sm tracking-tight">{user?.fullName || `${user?.firstName || 'Rahmatullah'} ${user?.lastName || 'Quraishi'}`}</div>
                                    <div className="text-[10px] font-mono text-primary-300">ID: {currentEmployeeCode || 'EMP-2026-001'}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-white/60">SUM INSURED</div>
                                    <div className="text-lg font-black font-mono text-emerald-400">₹5,00,000</div>
                                    <div className="text-[10px] text-white/60">Cashless Hospitalization</div>
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-white/10 backdrop-blur-md rounded-xl grid grid-cols-2 gap-2 text-[11px] relative z-10 border border-white/15">
                                <div>
                                    <span className="text-white/60 block text-[9px]">POLICY NUMBER</span>
                                    <span className="font-mono font-bold">{selectedCardBenefit?.policy_number || 'POL-GMC-2026-9921'}</span>
                                </div>
                                <div>
                                    <span className="text-white/60 block text-[9px]">SERVICING TPA</span>
                                    <span className="font-bold">MediAssist TPA (Pan-India)</span>
                                </div>
                                <div className="mt-1">
                                    <span className="text-white/60 block text-[9px]">VALID TILL</span>
                                    <span className="font-semibold text-amber-300">31-Mar-2027</span>
                                </div>
                                <div className="mt-1">
                                    <span className="text-white/60 block text-[9px]">24x7 EMERGENCY HELPLINE</span>
                                    <span className="font-mono font-bold text-emerald-300">1800-425-9449</span>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-[10px] text-white/60 relative z-10">
                                <span>Show this card at hospital TPA desk for cashless admission.</span>
                                <span className="font-bold text-white/90">NKD MANPOWER & FACILITIES</span>
                            </div>
                        </div>

                        {/* Card Actions */}
                        <div className="p-4 bg-slate-50 flex items-center justify-between border-t border-slate-200 text-xs">
                            <span className="text-slate-500">Official digital e-card issued by Corporate HR</span>
                            <div className="flex gap-2">
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
            )}
        </div>
    );
};

export default Benefits;
