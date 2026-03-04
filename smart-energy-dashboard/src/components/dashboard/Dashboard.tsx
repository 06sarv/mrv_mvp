import React from 'react';
import { Users, Zap, Activity } from 'lucide-react';
import VideoFeedWidget from './VideoFeedWidget';
import ZoneStatusPanel from './ZoneStatusPanel';
import { useEnergy } from '../../context/EnergyContext';

const Dashboard: React.FC = () => {
    const { peopleCount, totalPowerWatts, zonesOccupied, zonesTotal, zoneStates } = useEnergy();

    return (
        <div className="space-y-6 h-full">
            <div className="flex flex-col lg:flex-row gap-6 h-full">
                {/* Left: Video Feed */}
                <div className="lg:w-2/3">
                    <VideoFeedWidget />
                </div>

                {/* Right: Zone Status */}
                <div className="lg:w-1/3 flex flex-col gap-4">
                    {/* Summary cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 text-center">
                            <Users className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                            <p className="text-2xl font-bold text-slate-900">{peopleCount}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">People</p>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 text-center">
                            <Activity className="w-4 h-4 text-green-500 mx-auto mb-1" />
                            <p className="text-2xl font-bold text-slate-900">{zonesOccupied}<span className="text-sm text-slate-400">/{zonesTotal}</span></p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Zones Active</p>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 text-center">
                            <Zap className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                            <p className="text-2xl font-bold text-slate-900">{totalPowerWatts}<span className="text-sm text-slate-400">W</span></p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Power</p>
                        </div>
                    </div>

                    {/* Zone panel */}
                    <div className="flex-1 overflow-y-auto">
                        <ZoneStatusPanel zoneStates={zoneStates} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
