import React from 'react';
import { Users, AlertTriangle } from 'lucide-react';
import { useEnergy } from '../../context/EnergyContext';

const OccupancyWidget: React.FC = () => {
    const { peopleCount, roomCapacity, occupancyLevel } = useEnergy();
    const percentage = Math.min((peopleCount / roomCapacity) * 100, 100);

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-500" />
                    Occupancy Status
                </h3>
                {occupancyLevel === 'High' && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-bold animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        OVERCROWDED
                    </div>
                )}
            </div>

            <div className="flex items-end gap-3 mb-4">
                <span className="text-5xl font-bold text-slate-900 tracking-tight">{peopleCount}</span>
                <div className="mb-2">
                    <span className="text-sm font-medium text-slate-500">detected</span>
                    <span className="text-xs text-slate-400 block">/ {roomCapacity} capacity</span>
                </div>
            </div>

            <div className="relative w-full h-3 bg-slate-100 rounded-full mb-4 overflow-hidden">
                <div
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out ${occupancyLevel === 'High' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                            occupancyLevel === 'Medium' ? 'bg-orange-500' :
                                'bg-purple-500'
                        }`}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            <div className="flex items-center justify-between text-xs">
                <span className={`font-medium ${occupancyLevel === 'High' ? 'text-red-600' :
                        occupancyLevel === 'Medium' ? 'text-orange-600' :
                            'text-purple-600'
                    }`}>
                    {occupancyLevel === 'Low' ? 'Optimal Range' :
                        occupancyLevel === 'Medium' ? 'Moderate Load' :
                            'Optimization Required'}
                </span>
                <span className="text-slate-400">{percentage.toFixed(0)}% Full</span>
            </div>
        </div>
    );
};

export default OccupancyWidget;
