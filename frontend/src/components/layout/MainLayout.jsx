import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AIChatbotWidget from '../ai/AIChatbotWidget';
import MobileBottomNav from './MobileBottomNav';

const MainLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
            <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
            <div className={`flex-1 transition-all duration-300 ease-in-out md:${sidebarOpen ? 'ml-64' : 'ml-20'} ml-0 flex flex-col min-h-screen`}>
                <Header />
                <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 transition-all duration-300 ease-in-out">
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
