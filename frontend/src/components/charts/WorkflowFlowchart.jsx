import { useState } from 'react';
import {
    UserCheck, Clock, Calendar, DollarSign, FileSpreadsheet,
    ArrowRight, CheckCircle2, ShieldCheck, Cpu, UploadCloud,
    CreditCard, Building2, HelpCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

const WORKFLOWS = {
    lifecycle: {
        title: "NKD CRM Master Process Flow",
        subtitle: "End-to-End Employee Lifecycle, Operations & Compliance Automation",
        steps: [
            {
                id: 1,
                title: "1. Employee Onboarding",
                desc: "Bio-data, KYC documents, site & shift tagging, and portal credential creation.",
                icon: UserCheck,
                color: "bg-blue-50 text-blue-600 border-blue-200",
                link: "/employees",
                linkText: "Manage Employees"
            },
            {
                id: 2,
                title: "2. Shift & Site Assignment",
                desc: "Configure working hours, Grace period, overtime rules, and branch location.",
                icon: Building2,
                color: "bg-cyan-50 text-cyan-600 border-cyan-200",
                link: "/site-shift",
                linkText: "Configure Shifts"
            },
            {
                id: 3,
                title: "3. Daily Attendance Tracking",
                desc: "Real-time punch in/out, biometric device sync, duration calculation & live logs.",
                icon: Clock,
                color: "bg-emerald-50 text-emerald-600 border-emerald-200",
                link: "/attendance",
                linkText: "Attendance Logs"
            },
            {
                id: 4,
                title: "4. Leave & Exception Audit",
                desc: "Employee leave request, balance deduction, and automatic daily attendance sync.",
                icon: Calendar,
                color: "bg-amber-50 text-amber-600 border-amber-200",
                link: "/leaves",
                linkText: "Review Leaves"
            },
            {
                id: 5,
                title: "5. Benefits & Claims",
                desc: "Travel, health allowance, medical claims submission, HR audit & approvals.",
                icon: CreditCard,
                color: "bg-rose-50 text-rose-600 border-rose-200",
                link: "/benefits",
                linkText: "Benefits & Perks"
            },
            {
                id: 6,
                title: "6. Automated Payroll Engine",
                desc: "Present days calculation, PF/ESI/PT statutory deductions, and payslip generation.",
                icon: DollarSign,
                color: "bg-indigo-50 text-indigo-600 border-indigo-200",
                link: "/payroll",
                linkText: "Process Payroll"
            },
            {
                id: 7,
                title: "7. Statutory Reports & Returns",
                desc: "Monthly PF ECR file, ESI returns, Professional Tax statement, and bank transfer CSV.",
                icon: FileSpreadsheet,
                color: "bg-purple-50 text-purple-600 border-purple-200",
                link: "/reports",
                linkText: "Export Reports"
            }
        ]
    },
    attendance: {
        title: "Attendance & Biometric Sync Flow",
        subtitle: "How punch logs convert into verified attendance records",
        steps: [
            {
                id: 1,
                title: "Punch Recorded",
                desc: "Employee punches on Biometric Machine or clicks Check In on Time Tracker.",
                icon: Clock,
                color: "bg-blue-50 text-blue-600 border-blue-200",
            },
            {
                id: 2,
                title: "Import & Verification",
                desc: "Biometric machine CSV uploaded or real-time API logs captured into database.",
                icon: UploadCloud,
                color: "bg-teal-50 text-teal-600 border-teal-200",
            },
            {
                id: 3,
                title: "Shift Rule Evaluation",
                desc: "System validates against assigned shift start time, grace period, and lunch hours.",
                icon: Cpu,
                color: "bg-indigo-50 text-indigo-600 border-indigo-200",
            },
            {
                id: 4,
                title: "Duration & Status Computation",
                desc: "Check-in and Check-out calculated into total work hours, Present / Half Day / Late.",
                icon: CheckCircle2,
                color: "bg-emerald-50 text-emerald-600 border-emerald-200",
            },
            {
                id: 5,
                title: "Muster Roll Integration",
                desc: "Logs feed into Monthly Attendance Register ready for 1-click Payroll generation.",
                icon: FileSpreadsheet,
                color: "bg-purple-50 text-purple-600 border-purple-200",
            }
        ]
    },
    leave: {
        title: "Leave Approval Hierarchy Flow",
        subtitle: "Step-by-step process of leave validation and status propagation",
        steps: [
            {
                id: 1,
                title: "Application Submitted",
                desc: "Employee selects leave category (CL, SL, EL), date range and states reason.",
                icon: Calendar,
                color: "bg-sky-50 text-sky-600 border-sky-200",
            },
            {
                id: 2,
                title: "Automated Balance Check",
                desc: "System checks available balance and verifies no overlapping leave request exists.",
                icon: ShieldCheck,
                color: "bg-amber-50 text-amber-600 border-amber-200",
            },
            {
                id: 3,
                title: "Manager / HR Review",
                desc: "HR receives notification under Pending Approvals with 1-click action buttons.",
                icon: UserCheck,
                color: "bg-indigo-50 text-indigo-600 border-indigo-200",
            },
            {
                id: 4,
                title: "Decision & Attendance Sync",
                desc: "Upon Approval, dates are automatically marked as 'L' (Leave) in Daily Attendance.",
                icon: CheckCircle2,
                color: "bg-emerald-50 text-emerald-600 border-emerald-200",
            }
        ]
    },
    payroll: {
        title: "Payroll & Statutory Disbursal Flow",
        subtitle: "How gross pay, deductions and net salary are computed for Indian compliance",
        steps: [
            {
                id: 1,
                title: "Monthly Cutoff & Freeze",
                desc: "Month end attendance logs and approved leaves are locked for calculation.",
                icon: Clock,
                color: "bg-blue-50 text-blue-600 border-blue-200",
            },
            {
                id: 2,
                title: "Salary Engine Run",
                desc: "Basic salary + HRA + Allowances are pro-rated based on days worked vs total days.",
                icon: Cpu,
                color: "bg-indigo-50 text-indigo-600 border-indigo-200",
            },
            {
                id: 3,
                title: "Statutory Deductions",
                desc: "12% PF (EPFO rules), 0.75% ESI (ESIC rules), and state-wise PT are auto-computed.",
                icon: ShieldCheck,
                color: "bg-amber-50 text-amber-600 border-amber-200",
            },
            {
                id: 4,
                title: "Payslip & Bank Payout",
                desc: "HR finalizes batch, PDF payslips are generated, and Bank Transfer CSV is exported.",
                icon: DollarSign,
                color: "bg-emerald-50 text-emerald-600 border-emerald-200",
            }
        ]
    }
};

const WorkflowFlowchart = ({ defaultWorkflow = 'lifecycle', allowSwitch = true }) => {
    const [selectedWorkflow, setSelectedWorkflow] = useState(defaultWorkflow);
    const [activeStep, setActiveStep] = useState(null);

    const currentFlow = WORKFLOWS[selectedWorkflow] || WORKFLOWS.lifecycle;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary-600"></span>
                        {currentFlow.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{currentFlow.subtitle}</p>
                </div>

                {allowSwitch && (
                    <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-medium">
                        <button
                            onClick={() => { setSelectedWorkflow('lifecycle'); setActiveStep(null); }}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${selectedWorkflow === 'lifecycle' ? 'bg-white text-primary-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Master Lifecycle
                        </button>
                        <button
                            onClick={() => { setSelectedWorkflow('attendance'); setActiveStep(null); }}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${selectedWorkflow === 'attendance' ? 'bg-white text-primary-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Attendance Sync
                        </button>
                        <button
                            onClick={() => { setSelectedWorkflow('leave'); setActiveStep(null); }}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${selectedWorkflow === 'leave' ? 'bg-white text-primary-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Leave Approval
                        </button>
                        <button
                            onClick={() => { setSelectedWorkflow('payroll'); setActiveStep(null); }}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${selectedWorkflow === 'payroll' ? 'bg-white text-primary-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Payroll Engine
                        </button>
                    </div>
                )}
            </div>

            {/* Horizontal Flowchart Cards */}
            <div className="relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {currentFlow.steps.map((step, idx) => {
                        const IconComponent = step.icon;
                        const isSelected = activeStep === step.id;

                        return (
                            <div
                                key={step.id}
                                onClick={() => setActiveStep(isSelected ? null : step.id)}
                                className={`group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                                    isSelected
                                        ? 'border-primary-500 bg-primary-50/40 shadow-md ring-2 ring-primary-100'
                                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                }`}
                            >
                                {/* Step number badge */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className={`p-2 rounded-lg border ${step.color}`}>
                                        <IconComponent size={18} />
                                    </div>
                                    <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                                        Step {idx + 1}
                                    </span>
                                </div>

                                <h4 className="font-semibold text-slate-800 text-sm group-hover:text-primary-600 transition-colors">
                                    {step.title}
                                </h4>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed">
                                    {step.desc}
                                </p>

                                {step.link && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-primary-600">
                                        <Link
                                            to={step.link}
                                            onClick={(e) => e.stopPropagation()}
                                            className="hover:underline flex items-center gap-1"
                                        >
                                            {step.linkText} <ArrowRight size={12} />
                                        </Link>
                                    </div>
                                )}

                                {/* Arrow Indicator for sequence */}
                                {idx < currentFlow.steps.length - 1 && (
                                    <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 bg-white text-slate-300 rounded-full border border-slate-200 p-0.5 shadow-xs pointer-events-none">
                                        <ArrowRight size={12} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Active Step Details Drawer if clicked */}
            {activeStep !== null && (
                <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3 animate-in fade-in duration-200">
                    <div className="p-2 rounded-lg bg-primary-100 text-primary-700 font-bold shrink-0">
                        INFO
                    </div>
                    <div>
                        <div className="font-bold text-slate-800 text-sm mb-1">
                            {currentFlow.steps.find(s => s.id === activeStep)?.title}
                        </div>
                        <div>
                            {currentFlow.steps.find(s => s.id === activeStep)?.desc}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkflowFlowchart;

