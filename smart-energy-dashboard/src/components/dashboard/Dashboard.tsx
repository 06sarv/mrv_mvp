import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import OptimizationSection from './OptimizationSection';

const Dashboard: React.FC<{ onNavigate: (view: string, roomId?: string) => void }> = ({ onNavigate }) => {
    // Left occupancyLevel here in case we want to use it later,
    // but the variable was unused in the previous truncated version.
    // To suppress the warning, we can either remove it or use it.
    // For now, removing it to be clean.
    // const { occupancyLevel } = useEnergy();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedFacility, setSelectedFacility] = useState('Main Facility Zone 1');
    const facilities = ['Main Facility Zone 1', 'Main Facility Zone 2', 'Annex Building'];

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Alerts & Suggestions</h1>

                    <div className="mt-2 relative">
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="bg-white border border-slate-200 shadow-sm pr-10 pl-3 py-2 text-sm font-medium text-slate-700 rounded-lg cursor-pointer focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:border-slate-300 hover:shadow flex items-center min-w-[200px] text-left relative"
                        >
                            <span>{selectedFacility}</span>
                            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <div className={`absolute top-full left-0 mt-2 w-full bg-white border border-slate-100 rounded-xl shadow-xl z-50 overflow-hidden transition-all duration-200 origin-top ${isDropdownOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}>
                            {facilities.map((facility) => (
                                <button
                                    key={facility}
                                    onClick={() => {
                                        setSelectedFacility(facility);
                                        setIsDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-slate-50 flex items-center justify-between ${selectedFacility === facility ? 'text-blue-600 font-medium bg-blue-50/50' : 'text-slate-600'}`}
                                >
                                    {facility}
                                    {selectedFacility === facility && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">

                </div>
            </header >

            {/* Room Optimization Cards */}
            < OptimizationSection onNavigate={onNavigate} />
        </div >
    );
};

export default Dashboard;
