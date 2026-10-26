import { useState, useEffect, useCallback } from 'react';
import { Gift, Calendar, Info } from 'lucide-react';
import perkService from '../services/perkService';
import AssignPerkForm from '../components/forms/AssignPerkForm';
import { useAuth } from '../context/AuthContext';

const Perks = () => {
    const { user } = useAuth();
    const isHR = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.roleCode);
    const employeeIdentifier = user?.employeeCode || user?.employeeId;

    const [perks, setPerks] = useState([]);
    const [showAssignForm, setShowAssignForm] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (employeeIdentifier) {
                const res = await perkService.getMyPerks(employeeIdentifier);
                setPerks(res.data?.data || []);
            } else {
                setPerks([]);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [employeeIdentifier]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Gift className="text-primary-600" />
                        My Perks & Benefits
                    </h1>
                    <p className="text-slate-500">View your assigned non-salary perks</p>
                </div>
                {isHR && (
                    <button
                        onClick={() => setShowAssignForm(true)}
                        className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition-colors"
                    >
                        <Gift size={16} />
                        Assign Perk (HR)
                    </button>
                )}
            </div>

            {/* Content */}
            {loading ? (
                <div className="py-10 text-center text-slate-500">Loading...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {perks.length === 0 ? (
                        <div className="col-span-full py-16 text-center bg-slate-50 rounded-xl border-dashed border-2 border-slate-200">
                            <Gift size={48} className="mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-700">No perks assigned yet</h3>
                            <p className="text-slate-500">Perks assigned to you will appear here.</p>
                        </div>
                    ) : (
                        perks.map(perk => (
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
                                        <span>Since {formatDate(perk.start_date)}</span>
                                    </div>
                                    {perk.remarks && (
                                        <div className="flex items-start gap-2 text-slate-600 bg-slate-50 p-2 rounded text-xs">
                                            <Info size={14} className="text-slate-400 mt-0.5 shrink-0" />
                                            <span>{perk.remarks}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {showAssignForm && <AssignPerkForm onClose={() => setShowAssignForm(false)} onSuccess={fetchData} />}
        </div>
    );
};

export default Perks;
