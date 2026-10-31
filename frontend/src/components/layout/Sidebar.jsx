import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    Users,
    LayoutDashboard,
    CalendarCheck,
    IndianRupee,
    FileText,
    Briefcase,
    CreditCard,
    Building,
    Clock,
    ChevronLeft,
    ChevronRight,
    ShieldCheck,
    UserPlus,
    Receipt,
    Package,
    Truck,
    Smartphone,
    X
} from 'lucide-react';

const Sidebar = ({ isOpen, toggleSidebar, mobileOpen, closeMobileSidebar }) => {
    const { user, hasPermission } = useAuth();

    const roleCode = (user?.roleCode || user?.role?.roleCode || (typeof user?.role === 'string' ? user.role : '') || '').toUpperCase();
    const isSuperAdmin = roleCode === 'SUPER_ADMIN';

    const menuItems = [
        { title: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} />, moduleCode: 'DASHBOARD' },
        { title: 'Mobile App View', path: '/mobile', icon: <Smartphone size={20} />, moduleCode: 'ATTENDANCE' },
        { title: 'Recruitment', path: '/recruitment', icon: <UserPlus size={20} />, moduleCode: 'RECRUITMENT' },
        { title: 'Client Invoices', path: '/invoices', icon: <Receipt size={20} />, moduleCode: 'INVOICES' },
        { title: 'Vendors', path: '/vendors', icon: <Truck size={20} />, moduleCode: 'VENDORS' },
        { title: 'Assets & PPE', path: '/assets', icon: <Package size={20} />, moduleCode: 'ASSETS' },
        { title: 'Site & Shift', path: '/site-shift', icon: <Clock size={20} />, moduleCode: 'SITES' },
        { title: 'Sites & Branches', path: '/sites', icon: <Building size={20} />, moduleCode: 'SITES' },
        { title: 'Employees', path: '/employees', icon: <Users size={20} />, moduleCode: 'EMPLOYEES' },
        { title: 'Attendance', path: '/attendance', icon: <CalendarCheck size={20} />, moduleCode: 'ATTENDANCE' },
        { title: 'Leave', path: '/leaves', icon: <Briefcase size={20} />, moduleCode: 'LEAVES' },
        { title: 'Payroll', path: '/payroll', icon: <IndianRupee size={20} />, moduleCode: 'PAYROLL' },
        { title: 'Benefits & Perks', path: '/benefits', icon: <CreditCard size={20} />, moduleCode: 'BENEFITS' },
        { title: 'Reports', path: '/reports', icon: <FileText size={20} />, moduleCode: 'REPORTS' },
        { title: 'User Management', path: '/users', icon: <ShieldCheck size={20} />, moduleCode: 'USERS', superAdminOnly: true },
    ];

    const filteredMenuItems = menuItems.filter(item => {
        if (isSuperAdmin) return true;
        if (item.superAdminOnly) return false;

        // Dynamic permission check based on moduleCode
        if (item.moduleCode && typeof hasPermission === 'function') {
            return hasPermission(item.moduleCode, 'can_view');
        }
        return true;
    });

    return (
        <>
            {/* Mobile Backdrop Overlay */}
            {mobileOpen && (
                <div
                    onClick={closeMobileSidebar}
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 md:hidden transition-opacity"
                />
            )}

            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 h-screen border-r border-slate-200 bg-white flex flex-col
                    transition-all duration-300 ease-in-out
                    ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
                    md:translate-x-0 md:sticky md:top-0 md:shrink-0
                    ${isOpen ? 'w-64' : 'w-64 md:w-20'}
                `}
            >
                {/* Desktop Toggle Button */}
                <button
                    onClick={toggleSidebar}
                    className="hidden md:flex absolute -right-3 top-20 bg-white border border-slate-200 text-slate-500 rounded-full p-1.5 hover:text-primary-600 hover:border-primary-300 shadow-md transition-all z-50 items-center justify-center cursor-pointer"
                    aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
                >
                    {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </button>

                {/* Sidebar Header */}
                <div className={`flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 px-5 transition-all duration-300 ${!isOpen && 'md:justify-center md:px-0'}`}>
                    {isOpen ? (
                        <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-700 to-primary-500 flex items-center justify-center text-white font-bold text-sm shadow-xs shadow-primary-500/30">N</div>
                            <h1 className="text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap overflow-hidden">
                                NKD <span className="text-primary-600">CRM</span>
                            </h1>
                        </div>
                    ) : (
                        <>
                            <div className="hidden md:flex w-9 h-9 bg-gradient-to-tr from-primary-700 to-primary-500 rounded-xl items-center justify-center text-white font-bold text-base shadow-xs shadow-primary-500/30">N</div>
                            <h1 className="text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap md:hidden">NKD <span className="text-primary-600">CRM</span></h1>
                        </>
                    )}

                    {/* Mobile Close Button */}
                    <button
                        onClick={closeMobileSidebar}
                        className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        aria-label="Close sidebar"
                    >
                        <X size={18} />
                    </button>
                </div>

                <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto min-h-0">
                    {filteredMenuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => {
                                if (closeMobileSidebar) closeMobileSidebar();
                            }}
                            className={({ isActive }) =>
                                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-200 whitespace-nowrap ${isActive
                                    ? 'bg-gradient-to-r from-primary-50 to-sky-50/50 text-primary-700 shadow-2xs font-bold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-primary-600 before:rounded-r-full'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:translate-x-0.5'
                                } ${!isOpen && 'md:justify-center md:px-0'}`
                            }
                            title={!isOpen ? item.title : ''}
                        >
                            <div className="min-w-[20px] shrink-0 transition-transform duration-200 group-hover:scale-110">{item.icon}</div>
                            <span className={`transition-opacity duration-200 truncate ${isOpen ? 'opacity-100' : 'md:opacity-0 md:w-0 md:hidden opacity-100'}`}>
                                {item.title}
                            </span>
                        </NavLink>
                    ))}
                </nav>

                <div className={`shrink-0 border-t border-slate-100 px-4 py-3 text-xs text-slate-400 transition-all duration-300 ${isOpen ? 'opacity-100' : 'md:hidden opacity-100'}`}>
                    <p className="truncate text-[11px] font-medium text-slate-400">&copy; 2026 NKD Group • v2.0</p>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
