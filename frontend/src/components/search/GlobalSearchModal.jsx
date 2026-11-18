import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    X,
    LayoutDashboard,
    ClipboardList,
    Boxes,
    Users,
    Receipt,
    Truck,
    IndianRupee,
    Package,
    Building,
    Clock,
    CalendarCheck,
    Briefcase,
    CreditCard,
    FileText,
    ShieldCheck,
    Activity,
    RotateCcw,
    Smartphone,
    User,
    FileSpreadsheet,
    Plus,
    Download,
    CornerDownLeft,
    Sparkles,
    ArrowRight,
    SlidersHorizontal,
    HardHat
} from 'lucide-react';
import { getBackendOrigin } from '../../services/api';

const GlobalSearchModal = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const apkUrl = `${getBackendOrigin()}/api/download/apk`;

    // Comprehensive Directory of all Modules, Features, Functions, and Quick Actions
    const SEARCH_ITEMS = useMemo(() => [
        // ==================== 1. CORE MODULES ==================== //
        {
            id: 'mod-dashboard',
            title: 'Dashboard Overview',
            subtitle: 'Real-time KPI metrics, operational stats, security activity stream',
            category: 'MODULES',
            path: '/dashboard',
            icon: <LayoutDashboard className="text-primary-600" size={18} />,
            badge: 'Core',
            keywords: ['dashboard', 'home', 'main', 'stats', 'analytics', 'kpi', 'overview', 'overview page']
        },
        {
            id: 'mod-dpr',
            title: 'DPR Management Hub',
            subtitle: 'Multi-site Daily Progress Reports, Lumina Airoli site tracking, showstoppers',
            category: 'MODULES',
            path: '/dpr',
            icon: <ClipboardList className="text-emerald-600" size={18} />,
            badge: 'Hub',
            keywords: ['dpr', 'daily progress report', 'lumina', 'gtpl', 'airoli', 'site report', 'site progress', 'mumbai', 'show stoppers', 'daily report']
        },
        {
            id: 'mod-dpr-excel',
            title: 'DPR Client Excel Sheet Editor',
            subtitle: 'Interactive Google Sheet replica with 13 activity rows, 11 manpower trades, and yellow total',
            category: 'TOOLS',
            path: '/dpr',
            icon: <FileSpreadsheet className="text-emerald-700" size={18} />,
            badge: 'Live Sheet',
            keywords: ['excel', 'sheet', 'spreadsheet', 'google sheet', 'dpr excel', 'manpower sheet', 'today activity', 'planned activity', 'live sheet', 'formula']
        },
        {
            id: 'mod-procurement',
            title: 'Procurement Tracker (GTPL)',
            subtitle: '11KV Cables, Earthing Strips, Polycab, SAIL, DMP POs, Drawing approvals & site receipt',
            category: 'MODULES',
            path: '/procurement',
            icon: <Boxes className="text-cyan-600" size={18} />,
            badge: 'GTPL',
            keywords: ['procurement', 'purchase order', 'po', 'gtpl', 'polycab', 'sail', 'cables', '11kv', 'earthing strip', 'vendor po', 'drawing', 'material']
        },
        {
            id: 'mod-employees',
            title: 'Employees Directory (HR Master)',
            subtitle: 'NKD-00001 formatted IDs, central staff roster, department, designation & documents',
            category: 'MODULES',
            path: '/employees',
            icon: <Users className="text-indigo-600" size={18} />,
            badge: 'HR',
            keywords: ['employee', 'staff', 'worker', 'karmchari', 'employees list', 'roster', 'hr', 'staff master', 'emp id', 'nkd-00001']
        },
        {
            id: 'mod-invoices',
            title: 'Client Invoices & Billing',
            subtitle: 'Client billing, GST invoices, Tax billing, Lumina billing & payment tracking',
            category: 'MODULES',
            path: '/invoices',
            icon: <Receipt className="text-purple-600" size={18} />,
            badge: 'Finance',
            keywords: ['invoice', 'invoices', 'client invoice', 'bill', 'billing', 'gst', 'tax', 'lumina billing', 'payment receipt', 'challan']
        },
        {
            id: 'mod-vendors',
            title: 'Vendor Master Directory',
            subtitle: 'Suppliers, Subcontractors, Vendor profiles, GSTIN, Bank details',
            category: 'MODULES',
            path: '/vendors',
            icon: <Truck className="text-amber-600" size={18} />,
            badge: 'Vendors',
            keywords: ['vendor', 'vendors', 'supplier', 'suppliers', 'subcontractor', 'thekedaar', 'vendor list', 'merchant']
        },
        {
            id: 'mod-vendor-payments',
            title: 'Vendor Payments Tracker (FY 26-27)',
            subtitle: 'Multi-site vendor disbursement register, UTR details, bank accounts, pending balances',
            category: 'MODULES',
            path: '/vendor-payments',
            icon: <IndianRupee className="text-emerald-600" size={18} />,
            badge: 'FY 26-27',
            keywords: ['vendor payment', 'vendor payments', 'payment tracker', 'utr', 'bank payment', 'disbursement', 'paisa', 'hisab', 'due payment', 'pending']
        },
        {
            id: 'mod-assets',
            title: 'Assets & PPE Management',
            subtitle: 'Safety Helmets, Safety Shoes, High-Vis Uniforms, Laptops, Security gear allocation',
            category: 'MODULES',
            path: '/assets',
            icon: <Package className="text-teal-600" size={18} />,
            badge: 'Assets',
            keywords: ['asset', 'assets', 'ppe', 'helmet', 'uniform', 'shoes', 'laptop', 'gear', 'saman', 'equipment', 'safety gear', 'allocation', 'return']
        },
        {
            id: 'mod-sites',
            title: 'Sites & Branches Master',
            subtitle: 'GTPL Lumina Airoli, Korba, Mundra Adani, site codes, geofencing coordinates',
            category: 'MODULES',
            path: '/sites',
            icon: <Building className="text-blue-600" size={18} />,
            badge: 'Sites',
            keywords: ['site', 'sites', 'branch', 'branches', 'project', 'airoli', 'korba', 'mundra', 'adani', 'site location', 'jagah', 'office']
        },
        {
            id: 'mod-site-shift',
            title: 'Site & Shift Timings',
            subtitle: 'Shift schedules, General shift, Night shift, Site operating rosters',
            category: 'MODULES',
            path: '/site-shift',
            icon: <Clock className="text-sky-600" size={18} />,
            badge: 'Shifts',
            keywords: ['shift', 'shifts', 'timing', 'work hours', 'schedule', 'day shift', 'night shift', 'duty', 'roster']
        },
        {
            id: 'mod-attendance',
            title: 'Attendance Register & Muster Roll',
            subtitle: 'Daily employee check-in, punch-in/out, biometric site attendance, muster roll',
            category: 'MODULES',
            path: '/attendance',
            icon: <CalendarCheck className="text-green-600" size={18} />,
            badge: 'HR',
            keywords: ['attendance', 'hazri', 'muster', 'punch', 'check in', 'check out', 'present', 'absent', 'daily attendance', 'biometric']
        },
        {
            id: 'mod-leaves',
            title: 'Leaves & Time-off Management',
            subtitle: 'Casual Leave, Sick Leave, Earned Leave applications, leave balance approval',
            category: 'MODULES',
            path: '/leaves',
            icon: <Briefcase className="text-orange-600" size={18} />,
            badge: 'HR',
            keywords: ['leave', 'leaves', 'chutti', 'holiday', 'casual leave', 'sick leave', 'earned leave', 'time off', 'vacation', 'leave approval']
        },
        {
            id: 'mod-payroll',
            title: 'Payroll & Monthly Salary Slips',
            subtitle: 'Salary generation, Korba & Mundra payroll, PF, ESIC, PT deductions, Net pay',
            category: 'MODULES',
            path: '/payroll',
            icon: <IndianRupee className="text-rose-600" size={18} />,
            badge: 'Finance',
            keywords: ['payroll', 'salary', 'vetan', 'payslip', 'paisa', 'salary slip', 'pf', 'esic', 'pt', 'ctc', 'take home', 'monthly salary']
        },
        {
            id: 'mod-benefits',
            title: 'Benefits & Perks',
            subtitle: 'Employee health insurance, Perks, Allowances, PF/ESI statutory records',
            category: 'MODULES',
            path: '/benefits',
            icon: <CreditCard className="text-pink-600" size={18} />,
            badge: 'Perks',
            keywords: ['benefit', 'benefits', 'perks', 'insurance', 'allowance', 'health insurance', 'mediclaim', 'statutory']
        },
        {
            id: 'mod-reports',
            title: 'Reports & Export Analytics',
            subtitle: 'Export Excel reports, PDF summaries, Site progress audits, HR & Accounts reports',
            category: 'MODULES',
            path: '/reports',
            icon: <FileText className="text-slate-600" size={18} />,
            badge: 'Reports',
            keywords: ['report', 'reports', 'export', 'download report', 'analytics', 'audit report', 'monthly report', 'excel download']
        },

        // ==================== 2. SECURITY & RECYCLE BIN ==================== //
        {
            id: 'sec-audit',
            title: 'Audit & Security Hub (Action Logs)',
            subtitle: 'Forensic trail ("Kisne kya kiya"), who created, updated, or deleted records with IP & time',
            category: 'SECURITY',
            path: '/audit-security',
            icon: <Activity className="text-emerald-500" size={18} />,
            badge: 'Live Trail',
            keywords: ['security', 'audit', 'audit log', 'kisne kya kiya', 'action log', 'forensic', 'tracking', 'history', 'who modified', 'suraksha', 'activity log']
        },
        {
            id: 'sec-recycle-bin',
            title: 'Recycle Bin (1-Click Data Recovery)',
            subtitle: 'Zero Data Loss Policy: Instant undelete/restore for deleted employees, invoices, DPRs & assets',
            category: 'SECURITY',
            path: '/audit-security?tab=recycle',
            icon: <RotateCcw className="text-rose-500" size={18} />,
            badge: 'Restore Center',
            keywords: ['recycle bin', 'recycle', 'restore', 'recover', 'undelete', 'trash', 'wapas', 'recovery', 'deleted items', 'accidentally deleted', 'data recovery']
        },
        {
            id: 'sec-users',
            title: 'User Management & Role Permissions',
            subtitle: 'Super Admin, Admin, Role-based Access Control (RBAC), user accounts & passwords',
            category: 'SECURITY',
            path: '/users',
            icon: <ShieldCheck className="text-indigo-600" size={18} />,
            badge: 'Admin Only',
            keywords: ['users', 'user management', 'roles', 'permissions', 'rbac', 'super admin', 'admin', 'password', 'access control', 'create user']
        },

        // ==================== 3. QUICK ACTIONS & FUNCTIONS ==================== //
        {
            id: 'act-download-apk',
            title: 'Download Android APK (NKD-CRM.apk)',
            subtitle: 'Directly download the native Android mobile app for field engineers and on-site staff',
            category: 'ACTIONS',
            action: () => {
                window.location.href = apkUrl;
            },
            icon: <Download className="text-primary-600" size={18} />,
            badge: 'App File',
            keywords: ['apk', 'download apk', 'android', 'android app', 'mobile apk', 'install app', 'app download', 'phone app']
        },
        {
            id: 'act-new-employee',
            title: 'Onboard New Employee (Step-by-Step)',
            subtitle: 'Generate NKD-00001 ID, upload Aadhaar, PAN, Bank Proof, Offer Letter & Salary info',
            category: 'ACTIONS',
            path: '/employees?action=new',
            icon: <Plus className="text-indigo-600" size={18} />,
            badge: 'Onboarding',
            keywords: ['add employee', 'new employee', 'onboard', 'onboarding', 'create employee', 'nayi joining', 'aadhaar upload', 'pan upload']
        },
        {
            id: 'act-dpr-pdf',
            title: 'Download DPR Acrobat PDF (GTPL Lumina)',
            subtitle: 'Generate exact 2-page landscape Adobe Acrobat reference PDF with yellow total & photo matrix',
            category: 'ACTIONS',
            path: '/dpr',
            icon: <FileText className="text-rose-600" size={18} />,
            badge: 'Acrobat PDF',
            keywords: ['pdf', 'download pdf', 'dpr pdf', 'acrobat', 'adobe', '2 page pdf', 'landscape pdf', 'print dpr']
        },
        {
            id: 'act-allocate-asset',
            title: 'Allocate PPE / Safety Gear to Employee',
            subtitle: 'Issue safety helmet, jacket, uniform, laptop or tools to on-site technicians',
            category: 'ACTIONS',
            path: '/assets',
            icon: <HardHat className="text-amber-600" size={18} />,
            badge: 'PPE Issue',
            keywords: ['allocate asset', 'issue helmet', 'issue uniform', 'safety helmet', 'ppe allocation', 'laptop allocation', 'equipment issue']
        },
        {
            id: 'act-mobile-view',
            title: 'Mobile App Simulator (On-Site View)',
            subtitle: 'Experience the smartphone interface for attendance punch, DPR submission & field tasks',
            category: 'TOOLS',
            path: '/mobile',
            icon: <Smartphone className="text-sky-600" size={18} />,
            badge: 'Mobile',
            keywords: ['mobile', 'mobile view', 'phone view', 'mobile app view', 'on site mobile', 'punch in mobile', 'qr']
        },
        {
            id: 'act-my-profile',
            title: 'My Profile & Security Settings',
            subtitle: 'Manage user credentials, phone, avatar, and personal account details',
            category: 'MODULES',
            path: '/profile',
            icon: <User className="text-slate-600" size={18} />,
            badge: 'Account',
            keywords: ['profile', 'my profile', 'account', 'password', 'change password', 'settings', 'email', 'avatar']
        }
    ], [apkUrl]);

    // Categories
    const CATEGORIES = [
        { id: 'ALL', label: 'All Items' },
        { id: 'MODULES', label: 'Modules & Pages' },
        { id: 'ACTIONS', label: 'Quick Actions' },
        { id: 'TOOLS', label: 'Excel & Tools' },
        { id: 'SECURITY', label: 'Security & Recovery' }
    ];

    // Filter Items based on search query and category
    const filteredItems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return SEARCH_ITEMS.filter((item) => {
            // Category filter
            if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
                return false;
            }

            // Text search
            if (!query) return true;

            const inTitle = item.title.toLowerCase().includes(query);
            const inSubtitle = item.subtitle.toLowerCase().includes(query);
            const inKeywords = (item.keywords || []).some(k => k.toLowerCase().includes(query));
            const inCategory = item.category.toLowerCase().includes(query);
            const inPath = (item.path || '').toLowerCase().includes(query);

            return inTitle || inSubtitle || inKeywords || inCategory || inPath;
        });
    }, [SEARCH_ITEMS, searchQuery, selectedCategory]);

    // Reset selected index when query or category changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [searchQuery, selectedCategory]);

    // Auto-focus input on modal open
    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setSelectedCategory('ALL');
            setSelectedIndex(0);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    // Global Hotkey (Ctrl+K or Cmd+K)
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Scroll through results
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
                scrollIntoView(selectedIndex + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
                scrollIntoView(selectedIndex - 1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredItems[selectedIndex]) {
                    handleSelectItem(filteredItems[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredItems, selectedIndex]);

    const scrollIntoView = (index) => {
        if (listRef.current) {
            const element = listRef.current.children[index];
            if (element) {
                element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    };

    const handleSelectItem = (item) => {
        onClose();
        if (item.action && typeof item.action === 'function') {
            item.action();
        } else if (item.path) {
            navigate(item.path);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4">
            {/* Backdrop Blur Overlay */}
            <div
                onClick={onClose}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fade-in"
            />

            {/* Modal Dialog */}
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[82vh] z-10 animate-scale-in">
                {/* Search Input Bar */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 bg-white">
                    <Search size={20} className="text-slate-400 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search any module, feature, action (e.g. DPR, Excel, Payroll, Restore, Helmet, Invoice)..."
                        className="flex-1 bg-transparent text-sm sm:text-base text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-2 py-1 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        ESC
                    </button>
                </div>

                {/* Category Filtering Chips */}
                <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100 bg-slate-50/60 overflow-x-auto no-scrollbar text-xs">
                    <SlidersHorizontal size={13} className="text-slate-400 shrink-0 mr-1" />
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition-all text-xs cursor-pointer ${
                                selectedCategory === cat.id
                                    ? 'bg-primary-600 text-white shadow-2xs'
                                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                    <span className="ml-auto text-[11px] text-slate-400 shrink-0 font-medium pl-2">
                        {filteredItems.length} {filteredItems.length === 1 ? 'match' : 'matches'}
                    </span>
                </div>

                {/* Results List */}
                <div
                    ref={listRef}
                    className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-50"
                >
                    {filteredItems.length === 0 ? (
                        <div className="py-14 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                                <Search size={22} />
                            </div>
                            <h4 className="text-sm font-bold text-slate-700">No matching module or function found</h4>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                Try searching with different keywords like <span className="text-primary-600 font-semibold">"Excel", "DPR", "Payroll", "Security", "APK"</span>
                            </p>
                        </div>
                    ) : (
                        filteredItems.map((item, index) => {
                            const isSelected = index === selectedIndex;
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => handleSelectItem(item)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`group flex items-center justify-between gap-3 p-3 rounded-xl cursor-pointer transition-all duration-150 ${
                                        isSelected
                                            ? 'bg-primary-50/90 text-primary-900 border border-primary-200/80 shadow-2xs'
                                            : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`p-2.5 rounded-xl shrink-0 transition-transform duration-200 ${
                                            isSelected ? 'bg-white shadow-xs scale-105' : 'bg-slate-100 group-hover:bg-white'
                                        }`}>
                                            {item.icon}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className={`text-xs sm:text-sm font-bold truncate ${
                                                    isSelected ? 'text-primary-900' : 'text-slate-800'
                                                }`}>
                                                    {item.title}
                                                </h4>
                                                {item.badge && (
                                                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ${
                                                        item.category === 'SECURITY'
                                                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                            : item.category === 'ACTIONS'
                                                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                                            : item.category === 'TOOLS'
                                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                    }`}>
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                                {item.subtitle}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Right Arrow / Action hint */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {item.path && (
                                            <span className="hidden sm:inline-block text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                                                {item.path}
                                            </span>
                                        )}
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                            isSelected ? 'bg-primary-600 text-white' : 'text-slate-400 group-hover:text-slate-700'
                                        }`}>
                                            <ArrowRight size={14} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Keyboard Navigation Footer */}
                <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-medium">
                            <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white border border-slate-300 rounded shadow-2xs">↑</kbd>
                            <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white border border-slate-300 rounded shadow-2xs">↓</kbd>
                            navigate
                        </span>
                        <span className="flex items-center gap-1 font-medium">
                            <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white border border-slate-300 rounded shadow-2xs">↵</kbd>
                            open
                        </span>
                        <span className="flex items-center gap-1 font-medium">
                            <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white border border-slate-300 rounded shadow-2xs">esc</kbd>
                            close
                        </span>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-1 text-slate-400">
                        <Sparkles size={12} className="text-amber-500" />
                        NKD Omnisearch v2.0
                    </span>
                </div>
            </div>
        </div>
    );
};

export default GlobalSearchModal;
