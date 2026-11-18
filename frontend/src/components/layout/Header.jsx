import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import {
    User,
    LogOut,
    Menu,
    Smartphone,
    ShieldCheck
} from 'lucide-react';
import { getBackendOrigin, getFileUrl } from '../../services/api';

const Header = ({ toggleMobileSidebar }) => {
    const { user, logout, getRoleCode } = useAuth();
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    const roleCode = (user?.roleCode || user?.role?.roleCode || (typeof user?.role === 'string' ? user.role : '') || getRoleCode() || '').toUpperCase();
    const isAdminOrSuperAdmin = roleCode === 'SUPER_ADMIN' || roleCode === 'ADMIN' || roleCode === 'ADMINISTRATOR';

    const apkUrl = `${getBackendOrigin()}/api/download/apk`;
    const roleLabel = user?.role?.roleName || (typeof user?.role === 'string' ? user.role : '') || user?.roleName || getRoleCode() || 'User';

    const handleLogout = async () => {
        setDropdownOpen(false);
        await logout();
        navigate('/login');
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <header className="shrink-0 z-30 flex h-16 w-full items-center justify-between bg-white border-b border-slate-200 px-3 sm:px-4 md:px-8 shadow-xs transition-all duration-200">
            {/* Left Side: Mobile Hamburger & Logo */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <button
                    onClick={toggleMobileSidebar}
                    className="md:hidden p-2 -ml-1 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors btn-press focus:outline-none shrink-0"
                    aria-label="Open sidebar"
                >
                    <Menu size={22} />
                </button>
                <Link to="/dashboard" className="flex items-center gap-2 md:hidden min-w-0">
                    <div className="w-8 h-8 bg-gradient-to-tr from-primary-700 to-primary-500 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs shadow-primary-500/30 shrink-0">N</div>
                    <span className="font-bold text-slate-900 text-base tracking-tight truncate">NKD <span className="text-primary-600">CRM</span></span>
                </Link>

                {/* Desktop Welcome Breadcrumb */}
                <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 font-semibold text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                        Live Operations
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-700 font-bold">NKD Power Solutions</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500 font-medium">Power, Solar & Electrical Site Operations</span>
                </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                {/* Security & Recycle Bin Direct Access (Admins & Super Admins) */}
                {isAdminOrSuperAdmin && (
                    <Link
                        to="/audit-security"
                        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all duration-200 active:scale-95 shadow-2xs border border-slate-700/60"
                        title="Audit Logs, Forensic Trails & 1-Click Recycle Bin"
                    >
                        <ShieldCheck size={14} className="text-emerald-400" />
                        <span>Security & Recycle</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                    </Link>
                )}

                {/* Download Android APK Direct Action Button */}
                <a
                    href={apkUrl}
                    download="NKD-CRM.apk"
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 hover:bg-primary-100/80 text-primary-700 border border-primary-200/80 text-xs font-bold transition-all duration-200 active:scale-95 shadow-2xs"
                    title="Download NKD CRM Android APK"
                >
                    <Smartphone size={14} className="text-primary-600" />
                    <span>Download APK</span>
                </a>

                {/* User quick pill */}
                <div className="hidden sm:flex flex-col text-right">
                    <span className="text-xs font-bold text-slate-800 leading-tight">
                        {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.fullName || 'Portal User'}
                    </span>
                    <span className="text-[10px] font-semibold text-primary-600 uppercase tracking-wider">
                        {roleLabel}
                    </span>
                </div>

                {/* Profile Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="rounded-full focus:outline-none transition-transform duration-200 active:scale-95 group"
                        aria-label="Account menu"
                    >
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-primary-600 to-sky-400 p-0.5 shadow-xs group-hover:shadow-md group-hover:shadow-primary-500/20 transition-all">
                            <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-primary-700 font-bold text-xs uppercase overflow-hidden">
                                {user?.avatar ? (
                                    <img src={getFileUrl(user.avatar)} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <span>{user?.firstName?.[0] || 'U'}{user?.lastName?.[0] || ''}</span>
                                )}
                            </div>
                        </div>
                    </button>

                    {/* Dropdown Menu */}
                    {dropdownOpen && (
                        <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 animate-scale-in z-50">
                            <div className="px-4 py-2.5 border-b border-slate-100 mb-1">
                                <p className="text-sm font-bold text-slate-900 leading-tight truncate">
                                    {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Portal User'}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{roleLabel}</p>
                            </div>

                            <Link
                                to="/profile"
                                className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-slate-700 hover:text-primary-600 hover:bg-primary-50/80 transition-colors rounded-lg mx-1"
                                onClick={() => setDropdownOpen(false)}
                            >
                                <User size={15} className="text-slate-400" /> My Profile
                            </Link>

                            {isAdminOrSuperAdmin && (
                                <Link
                                    to="/audit-security"
                                    className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-slate-700 hover:text-primary-600 hover:bg-primary-50/80 transition-colors rounded-lg mx-1"
                                    onClick={() => setDropdownOpen(false)}
                                >
                                    <ShieldCheck size={15} className="text-emerald-500" /> Audit & Security Hub
                                </Link>
                            )}

                            <a
                                href={apkUrl}
                                download="NKD-CRM.apk"
                                className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-slate-700 hover:text-primary-600 hover:bg-primary-50/80 transition-colors rounded-lg mx-1"
                                onClick={() => setDropdownOpen(false)}
                            >
                                <Smartphone size={15} className="text-primary-600" /> Download APK File
                            </a>

                            <div className="h-px bg-slate-100 my-1"></div>

                            <button
                                onClick={handleLogout}
                                className="w-[calc(100%-0.5rem)] flex items-center gap-3 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left rounded-lg mx-1"
                            >
                                <LogOut size={15} /> Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
