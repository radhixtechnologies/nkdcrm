import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AIChatbotWidget from '../ai/AIChatbotWidget';
import MobileBottomNav from './MobileBottomNav';

const MainLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
            <Sidebar
                isOpen={sidebarOpen}
                toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                mobileOpen={mobileOpen}
                closeMobileSidebar={() => setMobileOpen(false)}
            />
            <div className="flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ease-in-out">
                <Header toggleMobileSidebar={() => setMobileOpen(!mobileOpen)} />
                <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 min-w-0 overflow-x-hidden">
                    <Outlet />
                </main>
            </div>
            {/* Global AI Assistant Floating Widget */}
            <AIChatbotWidget />
            {/* Mobile Bottom Navigation Bar for Smart Phones */}
            <MobileBottomNav />
        </div>
    );
};

export default MainLayout;
