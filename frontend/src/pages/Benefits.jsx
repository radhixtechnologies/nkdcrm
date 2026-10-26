import { useState, useEffect, useCallback } from 'react';
import { Plus, CreditCard, Receipt, Users, Clock, Gift, Info, Calendar, History, GitBranch } from 'lucide-react';
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
    const isHR = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.roleCode);
    const isManager = ['DEPT_MANAGER'].includes(user?.roleCode);
    const currentEmployeeCode = user?.employeeCode;

    const [activeTab, setActiveTab] = useState(isHR ? 'pending-claims' : 'my-benefits');
    const [showAssignForm, setShowAssignForm] = useState(false);
    const [showPerkForm, setShowPerkForm] = useState(false);
    const [showClaimForm, setShowClaimForm] = useState(false);

    const [benefits, setBenefits] = useState([]);
    const [perks, setPerks] = useState([]);
    const [myClaims, setMyClaims] = useState([]);
    const [pendingClaims, setPendingClaims] = useState([]);
    const [allClaims, setAllClaims] = useState([]);
    const [loading, setLoading] = useState(true);

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
        if (!window.confirm('Approve this claim?')) return;
        try {
            await benefitService.approveClaim({ claim_id: claimId, approver_id: user?.employeeId });
            toast.success('Claim Approved');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to approve');
        }
    };

    const handleReject = async (claimId) => {
        const reason = prompt('Rejection Reason:');
        if (!reason) return;
        try {
            await benefitService.rejectClaim({ claim_id: claimId, approver_id: user?.employeeId, reason });
            toast.success('Claim Rejected');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reject');
        }
    };

    const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Benefits & Reimbursements</h1>
                    <p className="text-slate-500">Manage insurance, perks, and expense claims</p>
                </div>
                <div className="flex gap-2">
                    {isHR && (
                        <>
                            <button
                                onClick={() => setShowAssignForm(true)}
                                className="flex items-center gap-2 rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                            >
                                <Users size={16} />
                                Assign Benefit
                            </button>
                            <button
                                onClick={() => setShowPerkForm(true)}
                                className="flex items-center gap-2 rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                            >
                                <Gift size={16} />
                                Assign Perk
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setShowClaimForm(true)}
                        className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition-colors"
                    >
                        <Plus size={16} />
                        New Claim
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-8 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('my-benefits')}
                        className={`flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'my-benefits' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <CreditCard size={18} /> My Benefits
                    </button>
                    <button
                        onClick={() => setActiveTab('my-perks')}
                        className={`flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'my-perks' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <Gift size={18} /> My Perks
                    </button>
                    <button
                        onClick={() => setActiveTab('my-claims')}
                        className={`flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'my-claims' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <Receipt size={18} /> My Claims
                    </button>
                    {(isHR || isManager) && (
                        <>
                            <button
                                onClick={() => setActiveTab('pending-claims')}
                                className={`flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'pending-claims' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                <Clock size={18} /> Pending Approvals
                                {pendingClaims.length > 0 && <span className="ml-1 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">{pendingClaims.length}</span>}
                            </button>
                            <button
                                onClick={() => setActiveTab('all-claims')}
                                className={`flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'all-claims' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                <History size={18} /> All Claims (History)
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setActiveTab('flowchart')}
                        className={`flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'flowchart' ? 'border-primary-500 text-primary-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <GitBranch size={18} /> Process Flowchart
                    </button>
                </nav>
            </div>

            {/* Content */}
            {loading ? (
                <div className="py-10 text-center text-slate-500">Loading...</div>
            ) : (
                <>
                    {/* My Benefits */}
                    {activeTab === 'my-benefits' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                            {benefits.length === 0 ? <p className="col-span-3 text-center text-slate-500 py-10">No active benefits assigned.</p> : benefits.map(b => (
                                <div key={b.emp_benefit_id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <CreditCard size={64} />
                                    </div>
                                    <div className="mb-4">
                                        <span className={`text-xs px-2 py-1 rounded font-medium ${b.category === 'INSURANCE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                            {b.category}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-lg mb-1">{b.name}</h3>
                                    <p className="text-sm text-slate-500 mb-4">{b.description}</p>

                                    <div className="space-y-2 text-sm border-t border-slate-100 pt-3">
                                        {b.policy_number && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Policy No:</span>
                                                <span className="font-medium text-slate-700">{b.policy_number}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Valid From:</span>
                                            <span className="font-medium text-slate-700">{formatDate(b.start_date)}</span>
                                        </div>
                                        {b.end_date && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Valid To:</span>
                                                <span className="font-medium text-slate-700">{formatDate(b.end_date)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* My Perks */}
                    {activeTab === 'my-perks' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                            {perks.length === 0 ? (
                                <div className="col-span-3 py-10 text-center bg-slate-50 rounded-xl border-dashed border-2 border-slate-200">
                                    <Gift size={48} className="mx-auto text-slate-300 mb-4" />
                                    <h3 className="text-lg font-medium text-slate-700">No perks assigned</h3>
                                </div>
                            ) : perks.map(perk => (
                                <div key={perk.emp_perk_id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
                                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Gift size={80} />
                                    </div>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${perk.is_monetary ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {perk.is_monetary ? 'Monetary' : 'Standard'}
                                        </span>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${perk.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                            {perk.status}
                                        </span>
                                    </div>

                                    <h3 className="font-bold text-slate-800 text-lg mb-1">{perk.name}</h3>
                                    <p className="text-sm text-slate-500 mb-4 h-10 overflow-hidden text-ellipsis">{perk.description}</p>

                                    <div className="space-y-2 text-sm border-t border-slate-100 pt-3">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Calendar size={14} className="text-slate-400" />
                                            <span>Since {new Date(perk.start_date).toLocaleDateString('en-IN')}</span>
                                        </div>
                                        {perk.remarks && (
                                            <div className="flex items-start gap-2 text-slate-600 bg-slate-50 p-2 rounded text-xs">
                                                <Info size={14} className="text-slate-400 mt-0.5 shrink-0" />
                                                <span>{perk.remarks}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* My Claims */}
                    {activeTab === 'my-claims' && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                                        <tr>
                                            <th className="px-6 py-3">Category</th>
                                            <th className="px-6 py-3">Description</th>
                                            <th className="px-6 py-3">Amount</th>
                                            <th className="px-6 py-3">Date</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3">Paid On</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {myClaims.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-slate-500">No claims found.</td></tr> : myClaims.map(c => (
                                            <tr key={c.claim_id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-medium">{c.benefit_name}</td>
                                                <td className="px-6 py-4 text-slate-600">{c.description}</td>
                                                <td className="px-6 py-4 font-bold text-slate-700">₹{c.amount}</td>
                                                <td className="px-6 py-4 text-slate-500">{formatDate(c.claim_date)}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${c.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                        c.status === 'PAID' ? 'bg-blue-100 text-blue-700' :
                                                            c.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                                'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {c.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500">{c.paid_on ? formatDate(c.paid_on) : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Pending Claims (HR) */}
                    {activeTab === 'pending-claims' && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                                        <tr>
                                            <th className="px-6 py-3">Employee</th>
                                            <th className="px-6 py-3">Claim</th>
                                            <th className="px-6 py-3">Amount</th>
                                            <th className="px-6 py-3">Date</th>
                                            <th className="px-6 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {pendingClaims.length === 0 ? <tr><td colSpan="5" className="p-8 text-center text-slate-500">No pending claims.</td></tr> : pendingClaims.map(c => (
                                            <tr key={c.claim_id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-800">{c.first_name} {c.last_name}</div>
                                                    <div className="text-xs text-slate-500">{c.employee_code}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-700">{c.benefit_name}</div>
                                                    <div className="text-xs text-slate-500">{c.description}</div>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-700">₹{c.amount}</td>
                                                <td className="px-6 py-4 text-slate-500">{formatDate(c.claim_date)}</td>
                                                <td className="px-6 py-4 text-right space-x-2">
                                                    <button onClick={() => handleApprove(c.claim_id)} className="px-3 py-1 bg-green-50 text-green-700 rounded border border-green-200 text-xs font-medium hover:bg-green-100">Approve</button>
                                                    <button onClick={() => handleReject(c.claim_id)} className="px-3 py-1 bg-red-50 text-red-700 rounded border border-red-200 text-xs font-medium hover:bg-red-100">Reject</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* All Claims History (HR) */}
                    {activeTab === 'all-claims' && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <h3 className="font-semibold text-slate-700 text-sm">Full Reimbursement History</h3>
                                <div className="text-xs text-slate-500">Showing all approved, rejected, and paid claims</div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                                        <tr>
                                            <th className="px-6 py-3">Employee</th>
                                            <th className="px-6 py-3">Claim</th>
                                            <th className="px-6 py-3">Amount</th>
                                            <th className="px-6 py-3">Date</th>
                                            <th className="px-6 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {allClaims.length === 0 ? <tr><td colSpan="5" className="p-8 text-center text-slate-500">No claims history found.</td></tr> : allClaims.map(c => (
                                            <tr key={c.claim_id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-800">{c.first_name} {c.last_name}</div>
                                                    <div className="text-xs text-slate-500">{c.employee_code}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-700">{c.benefit_name}</div>
                                                    <div className="text-xs text-slate-500">{c.description}</div>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-700">₹{c.amount}</td>
                                                <td className="px-6 py-4 text-slate-500">{formatDate(c.claim_date)}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${c.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                        c.status === 'PAID' ? 'bg-blue-100 text-blue-700' :
                                                            c.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                                'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {c.status}
                                                    </span>
                                                    {c.rejection_reason && <div className="text-xs text-red-500 mt-1 max-w-[150px] truncate" title={c.rejection_reason}>Reason: {c.rejection_reason}</div>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Flowchart Tab */}
                    {activeTab === 'flowchart' && (
                        <div className="animate-in fade-in duration-300">
                            <WorkflowFlowchart defaultWorkflow="lifecycle" allowSwitch={true} />
                        </div>
                    )}
                </>
            )}

            {showAssignForm && <AssignBenefitForm onClose={() => setShowAssignForm(false)} onSuccess={fetchData} />}
            {showPerkForm && <AssignPerkForm onClose={() => setShowPerkForm(false)} onSuccess={fetchData} />}
            {showClaimForm && <ReimbursementClaimForm onClose={() => setShowClaimForm(false)} onSuccess={fetchData} employeeId={user?.employeeId || null} />}
        </div>
    );
};

export default Benefits;
