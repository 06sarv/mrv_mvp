import React from 'react';
import { Search, User } from 'lucide-react';
import { useEnergy } from '../../context/EnergyContext';
import WeatherWidget from './WeatherWidget';

const Header: React.FC<{ title: string }> = ({ title }) => {
    const { searchQuery, setSearchQuery } = useEnergy();

    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-slate-800 tracking-tight">{title}</h2>
                <div className="h-6 w-px bg-slate-200 mx-2 hidden sm:block" />
                <div className="hidden md:block">
                    <WeatherWidget />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-full focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm w-48 transition-all focus:w-64"
                    />
                </div>

                <div className="h-8 w-px bg-slate-200 mx-2" />

                <div className="flex items-center gap-3 pl-2">
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-semibold text-slate-900 leading-none">Facility Manager</div>
                    </div>
                    <div className="w-9 h-9 border border-slate-300 rounded-full flex items-center justify-center text-slate-800 bg-white">
                        <User className="w-5 h-5" />
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
