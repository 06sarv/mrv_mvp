import React, { type ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
    children: ReactNode;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    selectedRoomId?: string | null;
    showZoneInsights?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, selectedRoomId, showZoneInsights }) => {
    const getPageTitle = () => {
        switch (activeTab) {
            case 'dashboard': return 'Dashboard';
            case 'monitoring': return 'Live Monitoring';
            case 'energy': return 'Energy Optimization Reports';
            case 'settings': return 'Settings';
            case 'control': return 'Appliance Control';
            case 'alerts': return 'Alerts';
            default: return 'Dashboard';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                selectedRoomId={selectedRoomId}
                showZoneInsights={showZoneInsights}
            />
            <div className="flex-1 ml-64 flex flex-col">
                <Header title={getPageTitle()} />
                <main className="flex-1 p-8 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;
