import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import {
    User,
    LogOut,
    Menu,
    Smartphone,
    Download
} from 'lucide-react';

const Header = ({ toggleMobileSidebar }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Close dropdown when clicking outside
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
        <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between glass-surface border-b border-slate-200/80 px-4 md:px-8 shadow-xs transition-all duration-200">
            {/* Left Side: Mobile Hamburger & Logo */}
            <div className="flex items-center gap-3">
                <button
                    onClick={toggleMobileSidebar}
                    className="md:hidden p-2 -ml-1 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors btn-press focus:outline-none"
                    aria-label="Open sidebar"
                >
                    <Menu size={22} />
                </button>
                <div className="flex items-center gap-2 md:hidden">
                    <div className="w-8 h-8 bg-gradient-to-tr from-primary-700 to-primary-500 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs shadow-primary-500/30">N</div>
                    <span className="font-bold text-slate-900 text-base tracking-tight">NKD <span className="text-primary-600">CRM</span></span>
                </div>
                
                {/* Desktop Welcome Breadcrumb */}
                <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 font-semibold text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                        Live Operations
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-600 font-medium">Security & Facility Workforce Management</span>
                </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
                {/* Download Android APK Direct Action Button */}
                <a
                    href="/api/download/apk"
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
                        {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.fullName || 'Administrator'}
                    </span>
                    <span className="text-[10px] font-semibold text-primary-600 uppercase tracking-wider">
                        {user?.role?.roleName || user?.role || user?.roleCode || 'Super Admin'}
                    </span>
                </div>

                {/* Profile Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="rounded-full focus:outline-none transition-transform duration-200 active:scale-95 group"
                    >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-600 to-sky-400 p-0.5 shadow-xs group-hover:shadow-md group-hover:shadow-primary-500/20 transition-all">
                            <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-primary-700 font-bold text-xs uppercase overflow-hidden">
                                {user?.avatar ? (
                                    <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <span>{user?.firstName?.[0] || 'A'}{user?.lastName?.[0] || 'D'}</span>
                                )}
                            </div>
                        </div>
                    </button>

                    {/* Dropdown Menu */}
                    {dropdownOpen && (
                        <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 animate-scale-in z-50">
                            <div className="px-4 py-2.5 border-b border-slate-100 mb-1">
                                <p className="text-sm font-bold text-slate-900 leading-tight">{user?.firstName} {user?.lastName}</p>
                                <p className="text-xs text-slate-500 mt-0.5 capitalize">{user?.role?.roleName || user?.role || user?.roleCode}</p>
                            </div>

                            <Link
                                to="/profile"
                                className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-slate-700 hover:text-primary-600 hover:bg-primary-50/80 transition-colors rounded-lg mx-1"
                                onClick={() => setDropdownOpen(false)}
                            >
                                <User size={15} className="text-slate-400 group-hover:text-primary-600" /> My Profile
                            </Link>

                            <a
                                href="/api/download/apk"
                                download="NKD-CRM.apk"
                                className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-slate-700 hover:text-primary-600 hover:bg-primary-50/80 transition-colors rounded-lg mx-1"
                                onClick={() => setDropdownOpen(false)}
                            >
                                <Smartphone size={15} className="text-primary-600" /> Download APK File
                            </a>

                            <div className="h-px bg-slate-100 my-1"></div>

                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left rounded-lg mx-1"
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
