import React from 'react';
import { Zap, TrendingDown } from 'lucide-react';
import { useEnergy } from '../../context/EnergyContext';

const EnergyWidget: React.FC = () => {
    const { stats, systemRooms } = useEnergy();

    // Total max load across all rooms (all appliances ON)
    const totalMaxKW = systemRooms.reduce((acc: number, room: any) => acc + (room.maxLoad || 0), 0);

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                        <div className="p-1.5 bg-yellow-100 text-yellow-600 rounded-lg">
                            <Zap className="w-4 h-4" fill="currentColor" />
                        </div>
                        Energy Overview
                    </h3>
                    <p className="text-xs text-slate-500 ml-9 mt-0.5">Real-time power tracking</p>
                </div>
                {stats.totalSavings > 0 && (
                    <div className="flex items-center text-emerald-600 text-xs font-bold bg-emerald-50 px-2.5 py-1.5 rounded-full border border-emerald-100">
                        <TrendingDown className="w-3.5 h-3.5 mr-1.5" />
                        {stats.totalSavings}% SAVED
                    </div>
                )}
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                    <div className="text-xs font-medium text-red-500 uppercase tracking-wider mb-1">Max Load</div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-red-700">{totalMaxKW.toFixed(2)}</span>
                        <span className="text-xs font-medium text-red-400">kW</span>
                    </div>
                    <div className="text-[10px] text-red-400 mt-1">All appliances ON</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Current</div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-slate-900">{stats.currentUsage.toFixed(2)}</span>
                        <span className="text-xs font-medium text-slate-500">kW</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">After accepted actions</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Zap className="w-10 h-10 text-blue-600" />
                    </div>
                    <div className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-1">AI Optimal</div>
                    <div className="flex items-baseline gap-1 relative z-10">
                        <span className="text-xl font-bold text-blue-700">{stats.optimizedUsage.toFixed(2)}</span>
                        <span className="text-xs font-medium text-blue-500">kW</span>
                    </div>
                    <div className="text-[10px] text-blue-400 mt-1">Recommended by optimizer</div>
                </div>
            </div>

            {/* Savings progress bar */}
            {stats.totalSavings > 0 && (
                <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">Energy Saved</span>
                        <span className="font-bold text-emerald-600">{stats.totalSavings}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                            className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-2 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(stats.totalSavings, 100)}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnergyWidget;
