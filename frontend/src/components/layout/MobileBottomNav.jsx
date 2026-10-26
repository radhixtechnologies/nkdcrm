import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    CalendarCheck,
    MapPin,
    Briefcase,
    User,
    IndianRupee
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const MobileBottomNav = () => {
    const { user } = useAuth();

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-2 flex items-center justify-around shadow-lg">
            <NavLink
                to="/"
                className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
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
                    `flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
                        isActive ? 'text-primary-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                    }`
                }
            >
                <CalendarCheck size={19} />
                <span>Attendance</span>
            </NavLink>

            {/* Central Highlighted Punch-In Button */}
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

            <NavLink
                to="/leaves"
                className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
                        isActive ? 'text-primary-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                    }`
                }
            >
                <Briefcase size={19} />
                <span>Leaves</span>
            </NavLink>

            <NavLink
                to="/payroll"
                className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
                        isActive ? 'text-primary-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                    }`
                }
            >
                <IndianRupee size={19} />
                <span>Payslip</span>
            </NavLink>
        </div>
    );
};

export default MobileBottomNav;
