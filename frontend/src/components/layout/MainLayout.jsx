import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AIChatbotWidget from '../ai/AIChatbotWidget';
import MobileBottomNav from './MobileBottomNav';
import GlobalSearchModal from '../search/GlobalSearchModal';

const MainLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setSearchOpen((prev) => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="fixed inset-0 flex h-full w-full overflow-hidden bg-slate-50 text-slate-900 font-sans">
            <Sidebar
                isOpen={sidebarOpen}
                toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                mobileOpen={mobileOpen}
                closeMobileSidebar={() => setMobileOpen(false)}
            />
            <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
                <Header
                    toggleMobileSidebar={() => setMobileOpen(!mobileOpen)}
                    onOpenSearch={() => setSearchOpen(true)}
                />
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 pb-24 md:pb-8 min-w-0">
                    <Outlet />
                </main>
            </div>
            {/* Global Search & Command Palette Modal */}
            <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
            {/* Global AI Assistant Floating Widget */}
            <AIChatbotWidget />
            {/* Mobile Bottom Navigation Bar for Smart Phones */}
            <MobileBottomNav />
        </div>
    );
};

export default MainLayout;
