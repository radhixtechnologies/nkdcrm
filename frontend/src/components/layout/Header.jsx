import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import {
    User,
    LogOut,

} from 'lucide-react';

const Header = () => {
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
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between bg-white border-b border-slate-200 px-6 shadow-sm">
            {/* Left Side (Breadcrumbs or Page Title - Optional) */}
            <div className="flex items-center gap-4">
                {/* <button className="text-slate-500 hover:text-slate-700 md:hidden">
                    <Menu size={24} />
                </button> */}
                {/* <h2 className="text-lg font-semibold text-slate-800">Dashboard</h2> */}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">






                {/* Profile Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="rounded-full focus:outline-none transition-transform active:scale-95"
                    >
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold border-2 border-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                            {user?.avatar ? (
                                <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <span>{user?.firstName?.[0]}{user?.lastName?.[0]}</span>
                            )}
                        </div>
                    </button>

                    {/* Dropdown Menu */}
                    {dropdownOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-2 animate-in fade-in zoom-in-95 duration-200">
                            <div className="px-4 py-2 border-b border-slate-100 mb-1 md:hidden">
                                <p className="text-sm font-semibold text-slate-800">{user?.firstName} {user?.lastName}</p>
                                <p className="text-xs text-slate-500 capitalize">{user?.role?.roleName || user?.role}</p>
                            </div>



                            <Link
                                to="/profile"
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                                onClick={() => setDropdownOpen(false)}
                            >
                                <User size={16} /> Profile
                            </Link>



                            <div className="h-px bg-slate-100 my-1"></div>

                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                            >
                                <LogOut size={16} /> Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
