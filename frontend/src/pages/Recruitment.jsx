import React, { useState, useEffect } from 'react';
import {
    Briefcase, Users, FileCheck, UserPlus, Plus,
    CheckCircle2, Clock, Calendar, Star, ArrowRight,
    Search, Filter, Eye, AlertCircle, X, ChevronRight,
    Mail, Phone, MapPin, Building2, UserCheck, Sparkles,
    Download, Send, FileText, Check, ShieldCheck, CheckSquare,
    Paperclip, ExternalLink, RefreshCw, Upload,
    ChevronDown, ChevronUp, Layers, ListOrdered
} from 'lucide-react';
import toast from 'react-hot-toast';
import recruitmentService from '../services/recruitmentService';
import siteService from '../services/siteService';
import aiService from '../services/aiService';
import api from '../services/api';

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

    // 10-Step Workflow: Document Collection Modal State
    const [showDocModal, setShowDocModal] = useState(false);
    const [selectedCandForDocs, setSelectedCandForDocs] = useState(null);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [docForm, setDocForm] = useState({
        aadhaar_number: '',
        pan_number: '',
        bank_name: '',
        bank_account_no: '',
        bank_ifsc: '',
        documents: {}
    });

    // 10-Step Interactive Lifecycle Controls
    const [workflowView, setWorkflowView] = useState('milestones'); // 'milestones' | 'timeline'
    const [isWorkflowExpanded, setIsWorkflowExpanded] = useState(true);

    const workflowMilestones = [
        {
            phase: 'Phase 1',
            title: 'Sourcing & KYC',
            badge: 'HR Owner',
            steps: [
                { num: 1, title: 'Candidate Selected', desc: 'Screened & shortlisted from pipeline', role: 'HR Recruiter' },
                { num: 2, title: 'KYC & Doc Collection', desc: 'Aadhaar, PAN & Bank IFSC uploaded', role: 'Candidate / HR' }
            ],
            actionTab: 'pipeline'
        },
        {
            phase: 'Phase 2',
            title: 'Compensation & Clearance',
            badge: 'HR & Director',
            steps: [
                { num: 3, title: 'Salary Structure Approval', desc: 'CTC breakdown verified & approved', role: 'HR Manager' },
                { num: 4, title: 'Appointment Drafted', desc: 'Official terms & offer reference assigned', role: 'System Engine' },
                { num: 5, title: 'Management Approval', desc: 'Director sign-off & digital authorization', role: 'Director' }
            ],
            actionTab: 'offers'
        },
        {
            phase: 'Phase 3',
            title: 'Issuance & Signoff',
            badge: 'System & Candidate',
            steps: [
                { num: 6, title: 'Signed PDF Generated', desc: 'Formal letterhead appointment letter', role: 'System Engine' },
                { num: 7, title: 'Email Dispatch', desc: 'Delivered to candidate inbox with PDF', role: 'HR Dispatch' },
                { num: 8, title: 'Offer Acceptance', desc: 'Terms accepted by candidate', role: 'Candidate' }
            ],
            actionTab: 'offers'
        },
        {
            phase: 'Phase 4',
            title: 'Employee Activation',
            badge: 'HRMS Live',
            steps: [
                { num: 9, title: 'Employee ID Created', desc: 'System assigns official EMP-XXXXXX code', role: 'HRMS System' },
                { num: 10, title: 'Joining Completed', desc: 'Active in Employee Master, GPS & Payroll', role: 'Operations' }
            ],
            actionTab: 'offers'
        }
    ];

    const workflowSteps = [
        { num: 1, title: 'Candidate Selected', sub: 'Pipeline Shortlist', role: 'HR Recruiter', phase: 'Sourcing' },
        { num: 2, title: 'KYC & Document Collection', sub: 'Aadhaar, PAN & Bank', role: 'Candidate/HR', phase: 'Sourcing' },
        { num: 3, title: 'Salary Structure Approval', sub: 'CTC & Statutory Review', role: 'HR Manager', phase: 'Clearance' },
        { num: 4, title: 'Appointment Letter Draft', sub: 'OFR Code & CTC Split', role: 'System Engine', phase: 'Clearance' },
        { num: 5, title: 'Management Approval', sub: 'Director Digital Signoff', role: 'Director', phase: 'Clearance' },
        { num: 6, title: 'Signed PDF Generation', sub: 'Official Letterhead & Seal', role: 'System Engine', phase: 'Issuance' },
        { num: 7, title: 'Email Dispatch', sub: 'Automated Candidate Mail', role: 'HR Dispatch', phase: 'Issuance' },
        { num: 8, title: 'Candidate Acceptance', sub: 'Formal Signoff & Offer OK', role: 'Candidate', phase: 'Issuance' },
        { num: 9, title: 'Employee ID Creation', sub: 'EMP-XXXXXX Code Assigned', role: 'HRMS System', phase: 'Activation' },
        { num: 10, title: 'Joining Completed', sub: 'Active in Master & GPS', role: 'Operations', phase: 'Activation' },
    ];

    const getOfferStep = (off) => {
        if (off.status === 'JOINED') {
            return { step: 10, label: 'Active Joined', pct: 100, color: 'bg-emerald-600', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
        }
        if (off.employee_code) {
            return { step: 9, label: 'Emp ID Created', pct: 90, color: 'bg-sky-600', badgeColor: 'bg-sky-50 text-sky-700 border-sky-200' };
        }
        if (off.acceptance_status === 'ACCEPTED' || off.status === 'ACCEPTED') {
            return { step: 8, label: 'Offer Accepted', pct: 80, color: 'bg-blue-600', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' };
        }
        if (off.email_dispatch_status === 'SENT') {
            return { step: 7, label: 'Email Dispatched', pct: 70, color: 'bg-teal-600', badgeColor: 'bg-teal-50 text-teal-700 border-teal-200' };
        }
        if (off.pdf_generated_at) {
            return { step: 6, label: 'Signed PDF Ready', pct: 60, color: 'bg-cyan-600', badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
        }
        if (off.management_approved_by) {
            return { step: 5, label: 'Director Approved', pct: 50, color: 'bg-purple-600', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' };
        }
        if (off.offer_code) {
            return { step: 4, label: 'Letter Drafted', pct: 40, color: 'bg-indigo-600', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
        }
        if (off.salary_approved_by) {
            return { step: 3, label: 'Salary Approved', pct: 30, color: 'bg-amber-600', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' };
        }
        if (off.aadhaar_number || off.pan_number || off.bank_account_no) {
            return { step: 2, label: 'KYC Collected', pct: 20, color: 'bg-indigo-600', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
        }
        return { step: 1, label: 'Candidate Selected', pct: 10, color: 'bg-slate-500', badgeColor: 'bg-slate-50 text-slate-700 border-slate-200' };
    };

    const handleOpenDocModal = (cand) => {
        setSelectedCandForDocs(cand);
        setDocForm({
            aadhaar_number: cand.aadhaar_number || '',
            pan_number: cand.pan_number || '',
            bank_name: cand.bank_name || '',
            bank_account_no: cand.bank_account_no || '',
            bank_ifsc: cand.bank_ifsc || '',
            documents: cand.documents || cand.candidate_documents || {}
        });
        setShowDocModal(true);
    };

    const handleFileUpload = async (docType, file) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        setUploadingDoc(true);
        try {
            const res = await api.post('/employees/upload-document', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const fileUrl = res.data?.url || res.data?.data?.url;
            setDocForm(prev => ({
                ...prev,
                documents: { ...prev.documents, [docType]: fileUrl }
            }));
            toast.success(`${docType.toUpperCase()} file uploaded!`);
        } catch (err) {
            toast.error('Failed to upload document file');
        } finally {
            setUploadingDoc(false);
        }
    };

    const handleSaveDocuments = async (e) => {
        e.preventDefault();
        if (!selectedCandForDocs) return;
        try {
            await recruitmentService.updateCandidateDocuments(selectedCandForDocs.candidate_id, docForm);
            toast.success(`Documents & Bank details saved for ${selectedCandForDocs.full_name}!`);
            setShowDocModal(false);
            loadData();
        } catch (err) {
            toast.error('Failed to update candidate documents');
        }
    };

    const handleApproveSalary = async (offerId) => {
        try {
            await recruitmentService.approveSalary(offerId, { approver: 'HR Manager' });
            toast.success('✅ Step 3: Salary structure approved by HR Manager!');
            loadData();
        } catch (err) {
            toast.error('Failed to approve salary structure');
        }
    };

    const handleApproveManagement = async (offerId) => {
        try {
            await recruitmentService.approveManagement(offerId, { approver: 'Director' });
            toast.success('✅ Step 5: Letter approved by Management/Director!');
            loadData();
        } catch (err) {
            toast.error('Failed to approve letter by Director');
        }
    };

    const handleDispatchEmail = async (offer) => {
        const loadingToast = toast.loading(`Sending appointment letter to ${offer.candidate_email}...`);
        try {
            await recruitmentService.dispatchEmail(offer.offer_id);
            toast.dismiss(loadingToast);
            toast.success(`✅ Step 7: Appointment Letter email dispatched to ${offer.candidate_email}!`);
            loadData();
        } catch (err) {
            toast.dismiss(loadingToast);
            toast.error('Email dispatch failed');
        }
    };

    const handleAcceptOffer = async (offerId) => {
        try {
            await recruitmentService.acceptOffer(offerId);
            toast.success('✅ Step 8: Employee offer acceptance confirmed!');
            loadData();
        } catch (err) {
            toast.error('Failed to record acceptance');
        }
    };

    const handleDownloadPdf = (offerId) => {
        const url = recruitmentService.getAppointmentLetterPdfUrl(offerId);
        window.open(url, '_blank');
        toast.success('✅ Step 6: Opening official signed Appointment Letter PDF...');
        setTimeout(() => loadData(), 2000);
    };

    const handleAiScreen = async (candId) => {
        setScreeningId(candId);
        try {
            const res = await aiService.screenCandidate(candId);
            const data = res.data?.data || res.data || {};
            toast.success(`AI Match Score: ${data.match_score}% (${data.recommendation})`);
            loadData();
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

            {/* 10-Step Candidate Selection to Joining Lifecycle Engine */}
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden transition-all duration-300">
                {/* Header Bar */}
                <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-primary-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-xs shrink-0">
                            <CheckCircle2 size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                                    10-Step Candidate Selection to Joining Lifecycle
                                </h2>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                    Active Engine
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                End-to-end recruitment workflow: KYC ➔ Multi-Tier Approvals ➔ Signed PDF ➔ Email Dispatch ➔ Joining
                            </p>
                        </div>
                    </div>

                    {/* View Controls & Action Counters */}
                    <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
                        {/* Quick Counters */}
                        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-slate-100/80 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200/60">
                            <span className="text-primary-700 font-bold">{candidates.length}</span> Candidates
                            <span className="text-slate-300">•</span>
                            <span className="text-indigo-700 font-bold">{offers.length}</span> Offers
                            <span className="text-slate-300">•</span>
                            <span className="text-emerald-700 font-bold">{candidates.filter(c => c.current_stage === 'HIRED').length}</span> Onboarded
                        </div>

                        {/* View Switcher: 4 Phases vs 10-Step Timeline */}
                        <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs">
                            <button
                                onClick={() => setWorkflowView('milestones')}
                                className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                                    workflowView === 'milestones'
                                        ? 'bg-white text-primary-700 shadow-2xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title="Grouped by 4 Enterprise Phases"
                            >
                                <Layers size={13} />
                                <span className="hidden sm:inline">4 Phases</span>
                            </button>
                            <button
                                onClick={() => setWorkflowView('timeline')}
                                className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                                    workflowView === 'timeline'
                                        ? 'bg-white text-primary-700 shadow-2xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title="View continuous 10-step timeline track"
                            >
                                <ListOrdered size={13} />
                                <span className="hidden sm:inline">10 Steps</span>
                            </button>
                        </div>

                        {/* Collapse / Expand Button */}
                        <button
                            onClick={() => setIsWorkflowExpanded(!isWorkflowExpanded)}
                            className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                            title={isWorkflowExpanded ? "Collapse workflow guide" : "Expand workflow guide"}
                        >
                            {isWorkflowExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    </div>
                </div>

                {/* Workflow Body */}
                {isWorkflowExpanded && (
                    <div className="p-4 sm:p-5 bg-white">
                        {/* VIEW 1: 4 Logical Milestone Phases (Spacious, Elegant, No Text Clipping) */}
                        {workflowView === 'milestones' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                                {workflowMilestones.map((phase, pIdx) => (
                                    <div
                                        key={phase.phase}
                                        className="rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-primary-300 hover:shadow-md transition-all duration-200 p-4 flex flex-col justify-between group"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/70">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 font-bold text-[10px] flex items-center justify-center">
                                                        {pIdx + 1}
                                                    </span>
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary-700">
                                                        {phase.phase}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 shadow-2xs">
                                                    {phase.badge}
                                                </span>
                                            </div>

                                            <h3 className="font-bold text-slate-900 text-xs mt-2.5 mb-2">
                                                {phase.title}
                                            </h3>

                                            <div className="space-y-2 mt-3">
                                                {phase.steps.map((st) => (
                                                    <div key={st.num} className="bg-white rounded-lg p-2.5 border border-slate-200/60 shadow-2xs">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                                                    {st.num}
                                                                </span>
                                                                <p className="font-bold text-slate-800 text-[11px] leading-snug">
                                                                    {st.title}
                                                                </p>
                                                            </div>
                                                            <span className="text-[9px] font-semibold text-primary-700 bg-primary-50 px-1.5 py-0.2 rounded shrink-0">
                                                                {st.role}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 mt-1 pl-5.5 leading-tight">
                                                            {st.desc}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setActiveTab(phase.actionTab)}
                                            className="mt-3 pt-2 border-t border-slate-200/60 text-[11px] font-semibold text-primary-600 hover:text-primary-800 flex items-center justify-between group-hover:translate-x-0.5 transition-transform"
                                        >
                                            <span>Go to {phase.actionTab === 'pipeline' ? 'Candidates' : 'Offer Letters'}</span>
                                            <ArrowRight size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* VIEW 2: Continuous 10-Step Timeline Track (Horizontal Connected Stepper) */}
                        {workflowView === 'timeline' && (
                            <div className="overflow-x-auto pb-3 pt-1 scrollbar-thin">
                                <div className="flex items-center gap-2 min-w-max">
                                    {workflowSteps.map((st, sIdx) => (
                                        <React.Fragment key={st.num}>
                                            <div className="w-48 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-primary-400 hover:shadow-md transition-all duration-200 shrink-0">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white font-black text-xs shadow-2xs">
                                                        {st.num}
                                                    </span>
                                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700">
                                                        {st.phase}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-slate-900 text-xs leading-snug">
                                                    {st.title}
                                                </h4>
                                                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                                                    {st.sub}
                                                </p>
                                                <div className="mt-2 pt-1.5 border-t border-slate-200/70 flex items-center justify-between text-[10px]">
                                                    <span className="text-slate-400">Owner:</span>
                                                    <span className="font-bold text-primary-700">{st.role}</span>
                                                </div>
                                            </div>

                                            {sIdx < workflowSteps.length - 1 && (
                                                <div className="flex items-center justify-center text-slate-300 shrink-0 px-0.5">
                                                    <ArrowRight size={16} className="text-slate-400" />
                                                </div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
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
                                    <div key={cand.candidate_id} className="card-hover-effect bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between group">
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

                                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                                            <div className="flex items-center gap-1.5">
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
                                                    className="text-xs font-semibold px-2 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                                                >
                                                    Interview
                                                </button>
                                                <button
                                                    onClick={() => handleOpenDocModal(cand)}
                                                    className={`text-xs font-semibold px-2 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                                                        cand.aadhaar_number || cand.pan_number ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                                    }`}
                                                    title="Step 2: Collect Aadhaar, PAN & Bank Details"
                                                >
                                                    <FileText size={12} />
                                                    {cand.aadhaar_number || cand.pan_number ? 'Docs ✓' : 'KYC Docs'}
                                                </button>
                                            </div>

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

            {/* TAB 3: OFFER LETTERS & 10-STEP ONBOARDING WORKFLOW */}
            {activeTab === 'offers' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div>
                            <h2 className="text-sm font-bold text-slate-800">10-Step Onboarding & Appointment Letters</h2>
                            <p className="text-xs text-slate-500">Track KYC documents, multi-tier approvals, signed PDF generation, email dispatch and joining</p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                            {offers.length} Active Candidates in Onboarding Pipeline
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3">Candidate & Ref</th>
                                    <th className="px-4 py-3">Role & CTC</th>
                                    <th className="px-4 py-3">Step 2: KYC Docs</th>
                                    <th className="px-4 py-3">Steps 3 & 5: Approvals</th>
                                    <th className="px-4 py-3">Steps 6 & 7: PDF & Mail</th>
                                    <th className="px-4 py-3">Step 8: Acceptance</th>
                                    <th className="px-4 py-3">Steps 9 & 10: Onboarding</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {offers.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="py-8 text-center text-slate-400">
                                            No offer letters generated yet. Extend an offer from the Candidates tab.
                                        </td>
                                    </tr>
                                ) : (
                                    offers.map((off) => {
                                        const hasDocs = off.aadhaar_number || off.pan_number || off.bank_account_no;
                                        const isSalaryApproved = !!off.salary_approved_by;
                                        const isDirectorApproved = !!off.management_approved_by;
                                        const isEmailSent = off.email_dispatch_status === 'SENT';
                                        const isAccepted = off.acceptance_status === 'ACCEPTED' || off.status === 'ACCEPTED' || off.status === 'JOINED';
                                        const isJoined = off.status === 'JOINED';
                                        const stepInfo = getOfferStep(off);

                                        return (
                                            <tr key={off.offer_id} className="hover:bg-slate-50/70 transition-colors">
                                                {/* Candidate & Ref (Step 1 & 4) */}
                                                <td className="px-4 py-3">
                                                    <p className="font-bold text-slate-900">{off.candidate_name}</p>
                                                    <p className="text-[11px] font-mono text-primary-700 font-semibold">{off.offer_code}</p>
                                                    <p className="text-[11px] text-slate-400">{off.candidate_email}</p>

                                                    {/* Live 10-Step Progress Tracker */}
                                                    <div className="mt-2 min-w-[180px] max-w-[210px] p-1.5 rounded-lg bg-slate-50 border border-slate-200/70">
                                                        <div className="flex items-center justify-between text-[10px] mb-1">
                                                            <span className="font-bold text-slate-700">Step {stepInfo.step}/10</span>
                                                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${stepInfo.badgeColor}`}>
                                                                {stepInfo.label}
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                                                            <div className={`h-full rounded-full transition-all duration-500 ${stepInfo.color}`} style={{ width: `${stepInfo.pct}%` }} />
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Role & CTC */}
                                                <td className="px-4 py-3">
                                                    <p className="font-semibold text-slate-900">{off.designation}</p>
                                                    <p className="text-[11px] text-slate-500">{off.site_name || 'Assigned Site'}</p>
                                                    <p className="text-xs font-bold text-slate-800 mt-0.5">
                                                        ₹{Number(off.offered_ctc).toLocaleString('en-IN')}/yr
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">
                                                        Joining: {new Date(off.joining_date).toLocaleDateString('en-IN')}
                                                    </p>
                                                </td>

                                                {/* Step 2: KYC Docs */}
                                                <td className="px-4 py-3">
                                                    <div className="space-y-1">
                                                        <div className="text-[11px]">
                                                            {hasDocs ? (
                                                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                                                    <Check size={11} /> KYC Added
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-medium">
                                                                    <Clock size={10} /> Pending
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => handleOpenDocModal({
                                                                candidate_id: off.candidate_id,
                                                                full_name: off.candidate_name,
                                                                aadhaar_number: off.aadhaar_number,
                                                                pan_number: off.pan_number,
                                                                bank_name: off.bank_name,
                                                                bank_account_no: off.bank_account_no,
                                                                bank_ifsc: off.bank_ifsc,
                                                                candidate_documents: off.candidate_documents
                                                            })}
                                                            className="text-[10px] text-primary-600 hover:text-primary-800 font-semibold underline block"
                                                        >
                                                            {hasDocs ? 'View / Edit Docs' : '+ Upload Aadhaar/PAN'}
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Steps 3 & 5: Approvals */}
                                                <td className="px-4 py-3">
                                                    <div className="space-y-1.5">
                                                        {/* Step 3: HR Salary Approval */}
                                                        <div>
                                                            {isSalaryApproved ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded" title={`Approved at ${off.salary_approved_at}`}>
                                                                    <Check size={10} /> Salary: {off.salary_approved_by}
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleApproveSalary(off.offer_id)}
                                                                    className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-semibold transition-colors"
                                                                >
                                                                    Approve Salary (HR)
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Step 5: Director Approval */}
                                                        <div>
                                                            {isDirectorApproved ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded" title={`Approved at ${off.management_approved_at}`}>
                                                                    <ShieldCheck size={10} /> Director: {off.management_approved_by}
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleApproveManagement(off.offer_id)}
                                                                    className="px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-semibold transition-colors"
                                                                >
                                                                    Approve (Director)
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Steps 6 & 7: PDF Generation & Email Dispatch */}
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-1.5">
                                                        {/* Step 6: PDF */}
                                                        <button
                                                            onClick={() => handleDownloadPdf(off.offer_id)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold shadow-2xs transition-colors"
                                                            title="Generate and view signed appointment PDF"
                                                        >
                                                            <Download size={12} className="text-primary-600" />
                                                            Download PDF
                                                        </button>

                                                        {/* Step 7: Email */}
                                                        {isEmailSent ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                                                                <Check size={10} /> Email Sent
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleDispatchEmail(off)}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-[10px] font-semibold transition-colors"
                                                            >
                                                                <Send size={10} /> Send Email
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Step 8: Candidate Acceptance */}
                                                <td className="px-4 py-3">
                                                    {isAccepted ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
                                                            <CheckCircle2 size={11} /> Accepted
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleAcceptOffer(off.offer_id)}
                                                            className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-semibold text-[10px] transition-colors"
                                                            title="Mark offer as accepted by candidate"
                                                        >
                                                            Mark Accepted
                                                        </button>
                                                    )}
                                                </td>

                                                {/* Steps 9 & 10: ID Creation & Joining */}
                                                <td className="px-4 py-3">
                                                    {isJoined ? (
                                                        <div className="space-y-0.5">
                                                            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                                                <CheckCircle2 size={13} /> Active Employee
                                                            </span>
                                                            <p className="text-[10px] font-mono text-slate-400">Onboarding Complete</p>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleConvertToEmployee({ candidate_id: off.candidate_id, full_name: off.candidate_name })}
                                                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 text-[11px] shadow-2xs flex items-center gap-1 transition-colors"
                                                            title="Generate Employee Code (EMP-XXXXXX) & activate employee record"
                                                        >
                                                            <UserCheck size={12} /> Confirm Joining
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
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

            {/* MODAL 5: Step 2 - Candidate KYC & Document Collection */}
            {showDocModal && selectedCandForDocs && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded">
                                    Step 2: KYC & Compliance
                                </span>
                                <h3 className="font-bold text-slate-900 mt-1">Collect Documents: {selectedCandForDocs.full_name}</h3>
                                <p className="text-xs text-slate-500">Aadhaar, PAN, and Bank details for verification & payroll activation</p>
                            </div>
                            <button onClick={() => setShowDocModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSaveDocuments} className="p-5 space-y-4">
                            {/* Statutory IDs */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Aadhaar Number (12 Digits)</label>
                                    <input
                                        type="text"
                                        maxLength="12"
                                        placeholder="e.g. 543210987654"
                                        value={docForm.aadhaar_number}
                                        onChange={(e) => setDocForm({ ...docForm, aadhaar_number: e.target.value.replace(/\D/g, '') })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">PAN Number (10 Characters)</label>
                                    <input
                                        type="text"
                                        maxLength="10"
                                        placeholder="e.g. ABCDE1234F"
                                        value={docForm.pan_number}
                                        onChange={(e) => setDocForm({ ...docForm, pan_number: e.target.value.toUpperCase() })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 uppercase font-mono"
                                    />
                                </div>
                            </div>

                            {/* Bank Details */}
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Bank Account Details (For Salary Credit)</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Bank Name</label>
                                        <input
                                            type="text"
                                            placeholder="SBI, HDFC, etc."
                                            value={docForm.bank_name}
                                            onChange={(e) => setDocForm({ ...docForm, bank_name: e.target.value })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Account Number</label>
                                        <input
                                            type="text"
                                            placeholder="Account No."
                                            value={docForm.bank_account_no}
                                            onChange={(e) => setDocForm({ ...docForm, bank_account_no: e.target.value })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-slate-600 mb-1">IFSC Code</label>
                                        <input
                                            type="text"
                                            placeholder="SBIN0001234"
                                            value={docForm.bank_ifsc}
                                            onChange={(e) => setDocForm({ ...docForm, bank_ifsc: e.target.value.toUpperCase() })}
                                            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 uppercase font-mono bg-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Document File Attachments */}
                            <div className="space-y-2">
                                <label className="block text-xs font-semibold text-slate-700">Attach Verified Document Files (PDF / Images)</label>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    {['aadhaar_card', 'pan_card', 'bank_passbook'].map((docKey) => {
                                        const label = docKey === 'aadhaar_card' ? 'Aadhaar Card' : docKey === 'pan_card' ? 'PAN Card' : 'Bank Passbook';
                                        const uploadedUrl = docForm.documents?.[docKey];

                                        return (
                                            <div key={docKey} className="p-2.5 rounded-lg border border-slate-200 bg-white flex flex-col justify-between">
                                                <div>
                                                    <span className="font-semibold text-slate-800 text-[11px] block">{label}</span>
                                                    {uploadedUrl ? (
                                                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                                                            <Check size={11} /> Uploaded
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 mt-0.5 block">Not attached</span>
                                                    )}
                                                </div>
                                                <div className="mt-2">
                                                    <label className="cursor-pointer inline-flex items-center gap-1 text-[10px] font-semibold text-primary-600 hover:text-primary-800 bg-primary-50 px-2 py-1 rounded">
                                                        <Upload size={10} />
                                                        {uploadedUrl ? 'Replace' : 'Upload'}
                                                        <input
                                                            type="file"
                                                            accept=".pdf,image/*"
                                                            className="hidden"
                                                            onChange={(e) => handleFileUpload(docKey, e.target.files[0])}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {uploadingDoc && <p className="text-[11px] text-primary-600 animate-pulse">Uploading file to server...</p>}
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <button type="button" onClick={() => setShowDocModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 shadow-2xs">Save KYC Details</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Recruitment;

