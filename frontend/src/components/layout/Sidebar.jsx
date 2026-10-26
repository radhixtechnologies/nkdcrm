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
    Smartphone
} from 'lucide-react';

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const { user } = useAuth();

    // Check user roles
    const isEmployee = user?.role === 'EMPLOYEE' || user?.role?.roleCode === 'EMPLOYEE' || user?.roleCode === 'EMPLOYEE';
    const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role?.roleCode === 'SUPER_ADMIN' || user?.roleCode === 'SUPER_ADMIN';

    const menuItems = [
        { title: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
        { title: 'Mobile App View', path: '/mobile', icon: <Smartphone size={20} /> },
        { title: 'Recruitment', path: '/recruitment', icon: <UserPlus size={20} />, restricted: true },
        { title: 'Client Invoices', path: '/invoices', icon: <Receipt size={20} />, restricted: true },
        { title: 'Vendors', path: '/vendors', icon: <Truck size={20} />, restricted: true },
        { title: 'Assets & PPE', path: '/assets', icon: <Package size={20} />, restricted: true },
        { title: 'Site & Shift', path: '/site-shift', icon: <Clock size={20} /> },
        { title: 'Sites & Branches', path: '/sites', icon: <Building size={20} />, restricted: true },
        { title: 'Employees', path: '/employees', icon: <Users size={20} />, restricted: true },
        { title: 'Attendance', path: '/attendance', icon: <CalendarCheck size={20} /> },
        { title: 'Leave', path: '/leaves', icon: <Briefcase size={20} /> },
        { title: 'Payroll', path: '/payroll', icon: <IndianRupee size={20} /> },
        { title: 'Benefits & Perks', path: '/benefits', icon: <CreditCard size={20} /> },
        { title: 'Reports', path: '/reports', icon: <FileText size={20} />, restricted: true },
        { title: 'User Management', path: '/users', icon: <ShieldCheck size={20} />, superAdminOnly: true },
    ];

    const filteredMenuItems = menuItems.filter(item => {
        if (item.superAdminOnly && !isSuperAdmin) return false;
        if (isEmployee && item.restricted) return false;
        return true;
    });

    return (
        <aside
            className={`hidden md:block fixed left-0 top-0 z-40 h-screen border-r border-slate-200 bg-white transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-20'
                }`}
        >
            {/* Toggle Button */}
            <button
                onClick={toggleSidebar}
                className="absolute -right-2.5 top-20 bg-white border border-slate-200 text-slate-500 rounded-full p-1 hover:text-primary-600 hover:border-primary-300 shadow-sm transition-colors z-50 flex items-center justify-center cursor-pointer"
            >
                {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>

            <div className={`flex h-16 items-center border-b border-slate-200 px-6 transition-all duration-300 ${isOpen ? 'justify-start' : 'justify-center px-0'}`}>
                {isOpen ? (
                    <h1 className="text-xl font-bold text-primary-600 tracking-tight whitespace-nowrap overflow-hidden">NKD CRM</h1>
                ) : (
                    <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-base">N</div>
                )}
            </div>

            <nav className="mt-6 flex flex-col gap-1 px-3">
                {filteredMenuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors overflow-hidden whitespace-nowrap ${isActive
                                ? 'bg-primary-50 text-primary-700'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            } ${!isOpen && 'justify-center px-0'}`
                        }
                        title={!isOpen ? item.title : ''}
                    >
                        <div className="min-w-[20px]">{item.icon}</div>
                        <span className={`transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>
                            {item.title}
                        </span>
                    </NavLink>
                ))}
            </nav>

            <div className={`absolute bottom-4 w-full px-6 text-xs text-slate-400 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                <p>&copy; 2024 NKD Group</p>
            </div>
        </aside>
    );
};

export default Sidebar;
