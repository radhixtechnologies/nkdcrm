import React, { useState, useEffect } from 'react';
import {
    Briefcase, Users, FileCheck, UserPlus, Plus,
    CheckCircle2, Clock, Calendar, Star, ArrowRight,
    Search, Filter, Eye, AlertCircle, X, ChevronRight,
    Mail, Phone, MapPin, Building2, UserCheck, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import recruitmentService from '../services/recruitmentService';
import siteService from '../services/siteService';
import aiService from '../services/aiService';

const Recruitment = () => {
    const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline', 'requisitions', 'offers'
    const [loading, setLoading] = useState(true);
    const [requisitions, setRequisitions] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [offers, setOffers] = useState([]);
    const [sites, setSites] = useState([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [stageFilter, setStageFilter] = useState('ALL');

    // Modals
    const [showReqModal, setShowReqModal] = useState(false);
    const [showCandModal, setShowCandModal] = useState(false);
    const [showOfferModal, setShowOfferModal] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [screeningId, setScreeningId] = useState(null);

    const handleAiScreen = async (candId) => {
        setScreeningId(candId);
        try {
            const res = await aiService.screenCandidate(candId);
            const data = res.data?.data || res.data || {};
            toast.success(`AI Match Score: ${data.match_score}% (${data.recommendation})`);
            fetchData();
        } catch (err) {
            toast.error('AI Screening failed');
        } finally {
            setScreeningId(null);
        }
    };

    // Form states
    const [reqForm, setReqForm] = useState({
        title: '',
        department: 'Operations',
        job_location: 'Head Office',
        vacancies: 1,
        experience_required: '1-3 Years',
        min_salary: '',
        max_salary: '',
        employment_type: 'FULL_TIME',
        job_description: ''
    });

    const [candForm, setCandForm] = useState({
        requisition_id: '',
        full_name: '',
        email: '',
        phone: '',
        current_company: '',
        current_designation: '',
        experience_years: '2',
        resume_url: ''
    });

    const [interviewForm, setInterviewForm] = useState({
        stage: 'INTERVIEW_SCHEDULED',
        interview_date: '',
        interviewer_name: '',
        interview_feedback: '',
        rating: 4
    });

    const [offerForm, setOfferForm] = useState({
        candidate_id: '',
        designation: '',
        department: 'Operations',
        site_id: '',
        offered_ctc: '',
        joining_date: '',
        terms_and_conditions: 'Standard employment agreement with provident fund & statutory insurance benefits.'
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [reqRes, candRes, offRes, siteRes] = await Promise.all([
                recruitmentService.getRequisitions().catch(() => ({ data: { data: [] } })),
                recruitmentService.getCandidates().catch(() => ({ data: { data: [] } })),
                recruitmentService.getOffers().catch(() => ({ data: { data: [] } })),
                (siteService.getAllSites ? siteService.getAllSites() : siteService.getSites()).catch(() => ({ data: { data: [] } }))
            ]);
            setRequisitions(reqRes.data?.data || []);
            setCandidates(candRes.data?.data || []);
            setOffers(offRes.data?.data || []);
            setSites(siteRes.data?.data || []);
        } catch (err) {
            console.error('Error fetching recruitment data:', err);
            toast.error('Failed to load recruitment data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Handlers
    const handleCreateRequisition = async (e) => {
        e.preventDefault();
        try {
            await recruitmentService.createRequisition(reqForm);
            toast.success('Job Requisition created successfully!');
            setShowReqModal(false);
            setReqForm({
                title: '',
                department: 'Operations',
                job_location: 'Head Office',
                vacancies: 1,
                experience_required: '1-3 Years',
                min_salary: '',
                max_salary: '',
                employment_type: 'FULL_TIME',
                job_description: ''
            });
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create requisition');
        }
    };

    const handleCreateCandidate = async (e) => {
        e.preventDefault();
        try {
            await recruitmentService.createCandidate(candForm);
            toast.success('Candidate profile registered!');
            setShowCandModal(false);
            setCandForm({
                requisition_id: '',
                full_name: '',
                email: '',
                phone: '',
                current_company: '',
                current_designation: '',
                experience_years: '2',
                resume_url: ''
            });
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to register candidate');
        }
    };

    const handleUpdateStage = async (e) => {
        e.preventDefault();
        if (!selectedCandidate) return;
        try {
            await recruitmentService.updateCandidateStage(selectedCandidate.candidate_id, interviewForm);
            toast.success('Candidate stage & interview updated!');
            setShowScheduleModal(false);
            setSelectedCandidate(null);
            loadData();
        } catch (err) {
            toast.error('Failed to update candidate status');
        }
    };

    const handleCreateOffer = async (e) => {
        e.preventDefault();
        try {
            await recruitmentService.createOffer(offerForm);
            toast.success('Offer Letter generated and candidate notified!');
            setShowOfferModal(false);
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to generate offer letter');
        }
    };

    const handleConvertToEmployee = async (cand) => {
        if (!window.confirm(`Confirm onboarding ${cand.full_name} as an active employee in NKD CRM Employee Master?`)) return;
        try {
            const res = await recruitmentService.convertToEmployee(cand.candidate_id);
            toast.success(`🎉 ${cand.full_name} onboarded! Assigned Employee Code: ${res.data?.data?.employee_code}`);
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to onboard candidate');
        }
    };

    const filteredCandidates = candidates.filter(cand => {
        const matchesSearch = cand.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cand.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (cand.phone && cand.phone.includes(searchTerm));
        const matchesStage = stageFilter === 'ALL' || cand.current_stage === stageFilter;
        return matchesSearch && matchesStage;
    });

    const stages = [
        { key: 'APPLIED', label: 'Applied', color: 'bg-slate-100 text-slate-700' },
        { key: 'SHORTLISTED', label: 'Shortlisted', color: 'bg-blue-100 text-blue-700' },
        { key: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled', color: 'bg-amber-100 text-amber-700' },
        { key: 'OFFER_EXTENDED', label: 'Offer Extended', color: 'bg-purple-100 text-purple-700' },
        { key: 'HIRED', label: 'Hired & Joined', color: 'bg-emerald-100 text-emerald-700' },
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Recruitment & Onboarding</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Manage job requisitions, candidate interviews, offer letters, and 1-click joining</p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={() => setShowReqModal(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
                    >
                        <Plus size={15} /> New Requisition
                    </button>
                    <button
                        onClick={() => setShowCandModal(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-xs font-semibold text-white shadow-xs transition-colors"
                    >
                        <UserPlus size={15} /> Add Candidate
                    </button>
                </div>
            </div>

            {/* Visual Process Flow Indicator */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Recruitment to Onboarding Flow</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="inline-block p-2 rounded-lg bg-blue-100 text-blue-700 mb-1"><Briefcase size={16} /></span>
                        <p className="text-xs font-bold text-slate-800">1. Requisition</p>
                        <p className="text-[11px] text-slate-500">{requisitions.length} Openings</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="inline-block p-2 rounded-lg bg-indigo-100 text-indigo-700 mb-1"><Users size={16} /></span>
                        <p className="text-xs font-bold text-slate-800">2. Sourcing</p>
                        <p className="text-[11px] text-slate-500">{candidates.filter(c => c.current_stage === 'APPLIED').length} Applications</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="inline-block p-2 rounded-lg bg-amber-100 text-amber-700 mb-1"><Calendar size={16} /></span>
                        <p className="text-xs font-bold text-slate-800">3. Interview</p>
                        <p className="text-[11px] text-slate-500">{candidates.filter(c => c.current_stage === 'INTERVIEW_SCHEDULED').length} Scheduled</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="inline-block p-2 rounded-lg bg-purple-100 text-purple-700 mb-1"><FileCheck size={16} /></span>
                        <p className="text-xs font-bold text-slate-800">4. Offer Letter</p>
                        <p className="text-[11px] text-slate-500">{offers.length} Extended</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="inline-block p-2 rounded-lg bg-emerald-100 text-emerald-700 mb-1"><UserCheck size={16} /></span>
                        <p className="text-xs font-bold text-slate-800">5. Onboarded</p>
                        <p className="text-[11px] text-slate-500">{candidates.filter(c => c.current_stage === 'HIRED').length} Employees</p>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
                <button
                    onClick={() => setActiveTab('pipeline')}
                    className={`pb-3 transition-colors flex items-center gap-2 ${activeTab === 'pipeline' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <Users size={16} /> Candidates & Pipeline ({candidates.length})
                </button>
                <button
                    onClick={() => setActiveTab('requisitions')}
                    className={`pb-3 transition-colors flex items-center gap-2 ${activeTab === 'requisitions' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <Briefcase size={16} /> Job Requisitions ({requisitions.length})
                </button>
                <button
                    onClick={() => setActiveTab('offers')}
                    className={`pb-3 transition-colors flex items-center gap-2 ${activeTab === 'offers' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <FileCheck size={16} /> Offer Letters ({offers.length})
                </button>
            </div>

            {/* TAB 1: CANDIDATES & PIPELINE */}
            {activeTab === 'pipeline' && (
                <div className="space-y-4">
                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search by name, email, or phone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Filter size={15} className="text-slate-500" />
                            <select
                                value={stageFilter}
                                onChange={(e) => setStageFilter(e.target.value)}
                                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                                <option value="ALL">All Pipeline Stages</option>
                                <option value="APPLIED">Applied</option>
                                <option value="SHORTLISTED">Shortlisted</option>
                                <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
                                <option value="OFFER_EXTENDED">Offer Extended</option>
                                <option value="HIRED">Hired / Joined</option>
                            </select>
                        </div>
                    </div>

                    {/* Candidate Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {loading ? (
                            <div className="col-span-3 text-center py-12 text-slate-400 text-sm">Loading candidates...</div>
                        ) : filteredCandidates.length === 0 ? (
                            <div className="col-span-3 text-center py-12 text-slate-400 text-sm bg-white rounded-xl border border-dashed border-slate-200">
                                No candidates found matching your criteria. Click "Add Candidate" to begin.
                            </div>
                        ) : (
                            filteredCandidates.map((cand) => {
                                const stageObj = stages.find(s => s.key === cand.current_stage) || { label: cand.current_stage, color: 'bg-slate-100 text-slate-600' };
                                return (
                                    <div key={cand.candidate_id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="font-bold text-slate-900 text-sm">{cand.full_name}</h3>
                                                    <p className="text-xs text-slate-500">{cand.current_designation || 'Candidate'} {cand.current_company ? `@ ${cand.current_company}` : ''}</p>
                                                </div>
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${stageObj.color}`}>
                                                    {stageObj.label}
                                                </span>
                                            </div>

                                            <div className="mt-3 space-y-1 text-xs text-slate-600">
                                                <div className="flex items-center gap-2">
                                                    <Mail size={13} className="text-slate-400" />
                                                    <span className="truncate">{cand.email}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Phone size={13} className="text-slate-400" />
                                                    <span>{cand.phone}</span>
                                                </div>
                                                {cand.requisition_title && (
                                                    <div className="flex items-center gap-2">
                                                        <Briefcase size={13} className="text-slate-400" />
                                                        <span className="font-medium text-primary-700">{cand.requisition_title}</span>
                                                    </div>
                                                )}
                                                {cand.interview_date && (
                                                    <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-100 text-[11px] text-amber-800">
                                                        <p className="font-semibold flex items-center gap-1">
                                                            <Calendar size={12} /> Interview: {new Date(cand.interview_date).toLocaleString()}
                                                        </p>
                                                        {cand.interviewer_name && <p>Interviewer: {cand.interviewer_name}</p>}
                                                        {cand.interview_feedback && <p className="italic mt-0.5">"{cand.interview_feedback}"</p>}
                                                    </div>
                                                )}

                                                {/* AI Resume Screening Result or Action */}
                                                {cand.ai_match_score ? (
                                                    <div className="mt-2.5 p-2 rounded-lg bg-indigo-50/80 border border-indigo-100 text-[11px] text-indigo-900">
                                                        <div className="font-semibold flex items-center justify-between">
                                                            <span className="flex items-center gap-1 text-indigo-700">
                                                                <Sparkles size={12} className="text-indigo-600" />
                                                                AI Match: {cand.ai_match_score}%
                                                            </span>
                                                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                                                cand.ai_recommendation === 'STRONG_HIRE' ? 'bg-emerald-100 text-emerald-800' :
                                                                cand.ai_recommendation === 'CONSIDER' ? 'bg-amber-100 text-amber-800' :
                                                                'bg-rose-100 text-rose-800'
                                                            }`}>
                                                                {cand.ai_recommendation}
                                                            </span>
                                                        </div>
                                                        {cand.ai_screening_summary && (
                                                            <p className="text-slate-600 mt-1 whitespace-pre-line text-[10px] leading-tight">
                                                                {cand.ai_screening_summary}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAiScreen(cand.candidate_id)}
                                                        disabled={screeningId === cand.candidate_id}
                                                        className="mt-2 w-full py-1 px-2 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 border border-indigo-200 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                                                    >
                                                        <Sparkles size={11} className={screeningId === cand.candidate_id ? 'animate-spin' : ''} />
                                                        {screeningId === cand.candidate_id ? 'AI Screening...' : 'Run AI Resume Screening'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                            <button
                                                onClick={() => {
                                                    setSelectedCandidate(cand);
                                                    setInterviewForm({
                                                        stage: cand.current_stage,
                                                        interview_date: cand.interview_date ? new Date(cand.interview_date).toISOString().slice(0, 16) : '',
                                                        interviewer_name: cand.interviewer_name || '',
                                                        interview_feedback: cand.interview_feedback || '',
                                                        rating: cand.rating || 4
                                                    });
                                                    setShowScheduleModal(true);
                                                }}
                                                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                Interview / Stage
                                            </button>

                                            {cand.current_stage !== 'HIRED' && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => {
                                                            setOfferForm({
                                                                candidate_id: cand.candidate_id,
                                                                designation: cand.current_designation || 'Field Staff',
                                                                department: cand.department || 'Operations',
                                                                site_id: '',
                                                                offered_ctc: '300000',
                                                                joining_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                                                                terms_and_conditions: 'Standard terms.'
                                                            });
                                                            setShowOfferModal(true);
                                                        }}
                                                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                                                    >
                                                        Make Offer
                                                    </button>
                                                    <button
                                                        onClick={() => handleConvertToEmployee(cand)}
                                                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                                                        title="1-Click Onboard to Employee Master"
                                                    >
                                                        Join Now
                                                    </button>
                                                </div>
                                            )}

                                            {cand.current_stage === 'HIRED' && (
                                                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                                    <CheckCircle2 size={13} /> Active Employee
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: JOB REQUISITIONS */}
            {activeTab === 'requisitions' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                        <div>
                            <h2 className="text-sm font-bold text-slate-800">Active Job Requisitions</h2>
                            <p className="text-xs text-slate-500">Staffing demands raised by site managers & departments</p>
                        </div>
                        <button
                            onClick={() => setShowReqModal(true)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700"
                        >
                            <Plus size={14} /> New Opening
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3">Code / Title</th>
                                    <th className="px-4 py-3">Department</th>
                                    <th className="px-4 py-3">Location</th>
                                    <th className="px-4 py-3">Vacancies</th>
                                    <th className="px-4 py-3">Candidates</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {requisitions.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="py-8 text-center text-slate-400">
                                            No job requisitions found. Click "New Opening" to post one.
                                        </td>
                                    </tr>
                                ) : (
                                    requisitions.map((req) => (
                                        <tr key={req.requisition_id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-slate-900">{req.title}</p>
                                                <p className="text-[11px] text-slate-400 font-mono">{req.requisition_code}</p>
                                            </td>
                                            <td className="px-4 py-3">{req.department}</td>
                                            <td className="px-4 py-3">{req.job_location}</td>
                                            <td className="px-4 py-3 font-semibold text-slate-800">{req.vacancies}</td>
                                            <td className="px-4 py-3">
                                                <span className="font-semibold text-primary-600">{req.total_candidates || 0} applied</span>
                                                <span className="text-[11px] text-slate-400 ml-1">({req.hired_count || 0} hired)</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    req.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' :
                                                    req.status === 'FILLED' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {req.status}
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

            {/* TAB 3: OFFER LETTERS */}
            {activeTab === 'offers' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                        <div>
                            <h2 className="text-sm font-bold text-slate-800">Issued Offer Letters</h2>
                            <p className="text-xs text-slate-500">Formal employment offers extended to candidates</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3">Offer Code</th>
                                    <th className="px-4 py-3">Candidate</th>
                                    <th className="px-4 py-3">Designation & Site</th>
                                    <th className="px-4 py-3">Annual CTC</th>
                                    <th className="px-4 py-3">Joining Date</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {offers.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="py-8 text-center text-slate-400">
                                            No offer letters generated yet.
                                        </td>
                                    </tr>
                                ) : (
                                    offers.map((off) => (
                                        <tr key={off.offer_id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-4 py-3 font-mono font-bold text-slate-800">{off.offer_code}</td>
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-slate-900">{off.candidate_name}</p>
                                                <p className="text-[11px] text-slate-400">{off.candidate_email}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-semibold text-slate-800">{off.designation}</p>
                                                <p className="text-[11px] text-slate-400">{off.site_name || 'All Sites'}</p>
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-900">
                                                ₹{Number(off.offered_ctc).toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-4 py-3">{new Date(off.joining_date).toLocaleDateString()}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    off.status === 'JOINED' ? 'bg-emerald-100 text-emerald-700' :
                                                    off.status === 'ACCEPTED' ? 'bg-blue-100 text-blue-700' :
                                                    off.status === 'OFFERED' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {off.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {off.status !== 'JOINED' && (
                                                    <button
                                                        onClick={() => handleConvertToEmployee({ candidate_id: off.candidate_id, full_name: off.candidate_name })}
                                                        className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700 text-[11px]"
                                                    >
                                                        Confirm Joining
                                                    </button>
                                                )}
                                                {off.status === 'JOINED' && (
                                                    <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                                                        <CheckCircle2 size={12} /> Onboarded
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL 1: Create Requisition */}
            {showReqModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900">New Job Requisition</h3>
                            <button onClick={() => setShowReqModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleCreateRequisition} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Site Security Supervisor, Field Officer"
                                    value={reqForm.title}
                                    onChange={(e) => setReqForm({ ...reqForm, title: e.target.value })}
                                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                                    <select
                                        value={reqForm.department}
                                        onChange={(e) => setReqForm({ ...reqForm, department: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    >
                                        <option value="Operations">Operations</option>
                                        <option value="Security">Security</option>
                                        <option value="Housekeeping">Housekeeping</option>
                                        <option value="Administration">Administration</option>
                                        <option value="Accounts">Accounts</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
                                    <input
                                        type="text"
                                        placeholder="City or Site"
                                        value={reqForm.job_location}
                                        onChange={(e) => setReqForm({ ...reqForm, job_location: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Number of Vacancies</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={reqForm.vacancies}
                                        onChange={(e) => setReqForm({ ...reqForm, vacancies: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Experience Required</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 1-3 Years"
                                        value={reqForm.experience_required}
                                        onChange={(e) => setReqForm({ ...reqForm, experience_required: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowReqModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700">Create Opening</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: Add Candidate */}
            {showCandModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900">Register New Candidate</h3>
                            <button onClick={() => setShowCandModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleCreateCandidate} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Requisition</label>
                                <select
                                    value={candForm.requisition_id}
                                    onChange={(e) => setCandForm({ ...candForm, requisition_id: e.target.value })}
                                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                >
                                    <option value="">General Candidate Pool</option>
                                    {requisitions.map(r => (
                                        <option key={r.requisition_id} value={r.requisition_id}>{r.title} ({r.department})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Candidate Full Name"
                                    value={candForm.full_name}
                                    onChange={(e) => setCandForm({ ...candForm, full_name: e.target.value })}
                                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="email@example.com"
                                        value={candForm.email}
                                        onChange={(e) => setCandForm({ ...candForm, email: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                                    <input
                                        type="tel"
                                        required
                                        placeholder="10-digit mobile"
                                        value={candForm.phone}
                                        onChange={(e) => setCandForm({ ...candForm, phone: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Current Company</label>
                                    <input
                                        type="text"
                                        placeholder="Current Employer"
                                        value={candForm.current_company}
                                        onChange={(e) => setCandForm({ ...candForm, current_company: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Current Designation</label>
                                    <input
                                        type="text"
                                        placeholder="Role / Title"
                                        value={candForm.current_designation}
                                        onChange={(e) => setCandForm({ ...candForm, current_designation: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowCandModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700">Add to Pipeline</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: Update Stage & Schedule Interview */}
            {showScheduleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-900">Update Pipeline: {selectedCandidate?.full_name}</h3>
                                <p className="text-xs text-slate-500">Record interview schedule, rating & interviewer feedback</p>
                            </div>
                            <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleUpdateStage} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Pipeline Stage *</label>
                                <select
                                    value={interviewForm.stage}
                                    onChange={(e) => setInterviewForm({ ...interviewForm, stage: e.target.value })}
                                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                >
                                    <option value="APPLIED">Applied</option>
                                    <option value="SHORTLISTED">Shortlisted</option>
                                    <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
                                    <option value="INTERVIEW_COMPLETED">Interview Completed</option>
                                    <option value="OFFER_EXTENDED">Offer Extended</option>
                                    <option value="REJECTED">Rejected</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Interview Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        value={interviewForm.interview_date}
                                        onChange={(e) => setInterviewForm({ ...interviewForm, interview_date: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Interviewer Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Operations Manager"
                                        value={interviewForm.interviewer_name}
                                        onChange={(e) => setInterviewForm({ ...interviewForm, interviewer_name: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Rating (1 to 5 Stars)</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            type="button"
                                            key={star}
                                            onClick={() => setInterviewForm({ ...interviewForm, rating: star })}
                                            className={`p-1.5 rounded-lg border ${interviewForm.rating >= star ? 'bg-amber-50 border-amber-300 text-amber-500' : 'border-slate-200 text-slate-300'}`}
                                        >
                                            <Star size={16} fill={interviewForm.rating >= star ? 'currentColor' : 'none'} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Interviewer Feedback & Notes</label>
                                <textarea
                                    rows="3"
                                    placeholder="Evaluation on communication, technical skill, discipline..."
                                    value={interviewForm.interview_feedback}
                                    onChange={(e) => setInterviewForm({ ...interviewForm, interview_feedback: e.target.value })}
                                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowScheduleModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700">Save Stage</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: Generate Offer Letter */}
            {showOfferModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-900">Generate Employment Offer Letter</h3>
                                <p className="text-xs text-slate-500">Official employment terms & CTC package</p>
                            </div>
                            <button onClick={() => setShowOfferModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleCreateOffer} className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Designation *</label>
                                    <input
                                        type="text"
                                        required
                                        value={offerForm.designation}
                                        onChange={(e) => setOfferForm({ ...offerForm, designation: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Deployment Site</label>
                                    <select
                                        value={offerForm.site_id}
                                        onChange={(e) => setOfferForm({ ...offerForm, site_id: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    >
                                        <option value="">Head Office / Unassigned</option>
                                        {sites.map(s => (
                                            <option key={s.site_id} value={s.site_id}>{s.site_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Offered Annual CTC (₹) *</label>
                                    <input
                                        type="number"
                                        required
                                        placeholder="e.g. 360000"
                                        value={offerForm.offered_ctc}
                                        onChange={(e) => setOfferForm({ ...offerForm, offered_ctc: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Joining Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={offerForm.joining_date}
                                        onChange={(e) => setOfferForm({ ...offerForm, joining_date: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowOfferModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700">Extend Offer Letter</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Recruitment;

