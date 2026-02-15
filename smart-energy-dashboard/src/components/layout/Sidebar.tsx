import React from 'react';
import { LayoutDashboard, Zap, Activity, CornerDownRight } from 'lucide-react';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    selectedRoomId?: string | null;
    showZoneInsights?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, showZoneInsights = false }) => {
    const menuItems = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: LayoutDashboard,
            subItems: showZoneInsights ? [
                {
                    id: 'room-details',
                    label: 'Zone Insights',
                    icon: CornerDownRight
                }
            ] : undefined
        },
        { id: 'monitoring', label: 'Live Monitoring', icon: Activity },
        { id: 'energy', label: 'Energy Optimization Reports', icon: Zap },
    ];

    return (
        <div className="h-screen w-64 bg-[#0f172a] text-slate-300 flex flex-col fixed left-0 top-0 overflow-y-auto border-r border-slate-800 shadow-xl z-50">
            <div className="p-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20">
                        <Zap className="w-6 h-6 text-white" fill="currentColor" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white tracking-tight leading-none">MRV</h1>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    // Check if this item is active or one of its children is active
                    const isChildActive = item.subItems?.some(sub => sub.id === activeTab);
                    const isSelfActive = activeTab === item.id;
                    const isActive = isSelfActive || isChildActive;

                    return (
                        <div key={item.id}>
                            <button
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative text-left ${isActive
                                    ? 'bg-blue-600/10 text-blue-400'
                                    : 'hover:bg-slate-800/50 hover:text-white'
                                    }`}
                            >
                                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-blue-500 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`flex-shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-400 group-hover:text-white transition-colors'}`} />
                                <span className={`font-medium flex-1 ${isActive ? 'text-white' : ''}`}>{item.label}</span>
                            </button>

                            {/* Render Subitems if active or if specific conditions met */}
                            {(isActive || (item.id === 'dashboard' && showZoneInsights)) && item.subItems && (
                                <div className="mt-1 space-y-1 pl-4 relative">
                                    {/* Vertical line for tree structure */}
                                    <div className="absolute left-6 top-0 bottom-4 w-px bg-slate-800" />

                                    {item.subItems.map(subItem => {
                                        const SubIcon = subItem.icon;
                                        const isSubActive = activeTab === subItem.id;

                                        return (
                                            <button
                                                key={subItem.id}
                                                onClick={() => setActiveTab(subItem.id)}
                                                className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 text-sm relative ${isSubActive
                                                    ? 'text-blue-400'
                                                    : 'text-slate-500 hover:text-slate-300'
                                                    }`}
                                            >
                                                <SubIcon size={16} className={isSubActive ? 'text-blue-500' : 'text-slate-600'} />
                                                <span className="font-medium">{subItem.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>
        </div>
    );
};

export default Sidebar;
