import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    CalendarCheck,
    MapPin,
    Briefcase,
    User,
    IndianRupee,
    ClipboardList,
    Boxes,
    Receipt
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const MobileBottomNav = () => {
    const { hasPermission, getRoleCode } = useAuth();
    const isClient = getRoleCode() === 'CLIENT_LOGIN';
    const canAttendance = hasPermission('ATTENDANCE', 'can_view');

    if (isClient || !canAttendance) {
        return (
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 py-1.5 px-2 flex items-center justify-around shadow-lg">
                <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                            isActive ? 'text-primary-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                        }`
                    }
                >
                    <LayoutDashboard size={19} />
                    <span>Home</span>
                </NavLink>

                {hasPermission('DPR', 'can_view') && (
                    <NavLink
                        to="/dpr"
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                                isActive ? 'text-primary-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                            }`
                        }
                    >
                        <ClipboardList size={19} />
                        <span>DPR</span>
                    </NavLink>
                )}

                {hasPermission('PROCUREMENT', 'can_view') && (
                    <NavLink
                        to="/procurement"
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-0.5 -mt-4 py-1.5 px-3 rounded-full shadow-md transition-transform active:scale-95 ${
                                isActive
                                    ? 'bg-primary-700 text-white ring-4 ring-primary-100'
                                    : 'bg-gradient-to-tr from-primary-600 to-indigo-600 text-white ring-4 ring-white'
                            }`
                        }
                    >
                        <Boxes size={19} />
                        <span className="text-[9px] font-bold tracking-tight">GTPL</span>
                    </NavLink>
                )}

                {hasPermission('INVOICES', 'can_view') && (
                    <NavLink
                        to="/invoices"
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                                isActive ? 'text-primary-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                            }`
                        }
                    >
                        <Receipt size={19} />
                        <span>Invoices</span>
                    </NavLink>
                )}

                <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                            isActive ? 'text-primary-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                        }`
                    }
                >
                    <User size={19} />
                    <span>Profile</span>
                </NavLink>
            </div>
        );
    }

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 py-1.5 px-2 flex items-center justify-around shadow-lg">
            <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                        isActive ? 'text-primary-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                    }`
                }
            >
                <LayoutDashboard size={19} />
                <span>Home</span>
            </NavLink>

            <NavLink
                to="/attendance"
                className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                        isActive ? 'text-primary-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                    }`
                }
            >
                <CalendarCheck size={19} />
                <span>Attendance</span>
            </NavLink>

            <NavLink
                to="/mobile"
                className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 -mt-4 py-1 px-3 rounded-full shadow-md transition-transform active:scale-95 ${
                        isActive
                            ? 'bg-primary-700 text-white ring-4 ring-primary-100'
                            : 'bg-gradient-to-tr from-primary-600 to-indigo-600 text-white ring-4 ring-white'
                    }`
                }
            >
                <div className="p-1">
                    <MapPin size={20} className="animate-bounce" />
                </div>
                <span className="text-[9px] font-bold tracking-tight">Punch</span>
            </NavLink>

            {hasPermission('LEAVES', 'can_view') ? (
                <NavLink
                    to="/leaves"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                            isActive ? 'text-primary-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                        }`
                    }
                >
                    <Briefcase size={19} />
                    <span>Leaves</span>
                </NavLink>
            ) : (
                <NavLink
                    to="/dpr"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                            isActive ? 'text-primary-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                        }`
                    }
                >
                    <ClipboardList size={19} />
                    <span>DPR</span>
                </NavLink>
            )}

            {hasPermission('PAYROLL', 'can_view') ? (
                <NavLink
                    to="/payroll"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                            isActive ? 'text-primary-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                        }`
                    }
                >
                    <IndianRupee size={19} />
                    <span>Payslip</span>
                </NavLink>
            ) : (
                <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                            isActive ? 'text-primary-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                        }`
                    }
                >
                    <User size={19} />
                    <span>Profile</span>
                </NavLink>
            )}
        </div>
    );
};

export default MobileBottomNav;
