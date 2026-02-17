import React, { type ReactNode } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

interface LayoutProps {
    children: ReactNode;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
    const getPageTitle = () => {
        switch (activeTab) {
            case 'dashboard': return 'Alerts & Suggestions';
            case 'monitoring': return 'Live Monitoring';
            case 'settings': return 'Settings';
            default: return 'Dashboard';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Header
                title={getPageTitle()}
                onHome={() => setActiveTab('dashboard')}
            />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
                <main className="flex-1 p-8 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;
