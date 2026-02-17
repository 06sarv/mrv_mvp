import { LayoutDashboard, Activity } from 'lucide-react';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'monitoring', label: 'Monitoring', icon: Activity },
];

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
    const resolvedTab = ['room-details', 'room-surveillance'].includes(activeTab)
        ? 'dashboard'
        : activeTab;

    return (
        <aside className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0">
            <nav className="flex-1 py-4 px-3 space-y-1">
                {navItems.map(({ id, label, icon: Icon }) => {
                    const isActive = resolvedTab === id;
                    return (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                }`}
                        >
                            <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                            {label}
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
};

export default Sidebar;
