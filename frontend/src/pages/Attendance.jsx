import { useState } from 'react';
import { UploadCloud, Calendar as CalendarIcon, Clock, GitBranch } from 'lucide-react';
import ShiftManagement from '../components/attendance/ShiftManagement';
import AttendanceImport from '../components/attendance/AttendanceImport';
import DailyAttendance from '../components/attendance/DailyAttendance';
import AttendanceWidget from '../components/AttendanceWidget';
import WorkflowFlowchart from '../components/charts/WorkflowFlowchart';
import { useAuth } from '../context/AuthContext';

const Attendance = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('daily'); // daily, import, shifts, tracker, flowchart
    const isManager = ['SUPER_ADMIN', 'HR_ADMIN', 'DEPT_MANAGER'].includes(user?.roleCode);

    return (
        <div className="space-y-6 pt-1 sm:pt-2">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Attendance Management</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Track real-time attendance, configure shifts, biometric sync & muster register</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-8 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('daily')}
                        className={`
                            flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap
                            ${activeTab === 'daily'
                                ? 'border-primary-500 text-primary-600 font-semibold'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
                        `}
                    >
                        <CalendarIcon size={18} />
                        Daily Logs
                    </button>

                    <button
                        onClick={() => setActiveTab('tracker')}
                        className={`
                            flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap
                            ${activeTab === 'tracker'
                                ? 'border-primary-500 text-primary-600 font-semibold'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
                        `}
                    >
                        <Clock size={18} />
                        Time Tracker
                    </button>

                    {isManager && (
                        <button
                            onClick={() => setActiveTab('import')}
                            className={`
                            flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap
                            ${activeTab === 'import'
                                    ? 'border-primary-500 text-primary-600 font-semibold'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
                        `}
                        >
                            <UploadCloud size={18} />
                            Import / Upload
                        </button>
                    )}

                    {isManager && (
                        <button
                            onClick={() => setActiveTab('shifts')}
                            className={`
                            flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap
                            ${activeTab === 'shifts'
                                    ? 'border-primary-500 text-primary-600 font-semibold'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
                        `}
                        >
                            <Clock size={18} />
                            Shift Configuration
                        </button>
                    )}

                    <button
                        onClick={() => setActiveTab('flowchart')}
                        className={`
                            flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap
                            ${activeTab === 'flowchart'
                                ? 'border-primary-500 text-primary-600 font-semibold'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
                        `}
                    >
                        <GitBranch size={18} />
                        Biometric Sync Flowchart
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'daily' && (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                        <DailyAttendance />
                    </div>
                )}

                {activeTab === 'tracker' && (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-300 py-6">
                        <AttendanceWidget />
                    </div>
                )}

                {activeTab === 'import' && (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                        {isManager ? <AttendanceImport /> : <div className="p-8 text-center text-red-500">Access Denied</div>}
                    </div>
                )}

                {activeTab === 'shifts' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        {isManager ? <ShiftManagement /> : <div className="p-8 text-center text-red-500">Access Denied</div>}
                    </div>
                )}

                {activeTab === 'flowchart' && (
                    <div className="animate-in fade-in duration-300">
                        <WorkflowFlowchart defaultWorkflow="attendance" allowSwitch={false} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Attendance;
