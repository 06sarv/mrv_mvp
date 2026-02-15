import React from 'react';
import LiveFeedWidget from '../dashboard/LiveFeedWidget';
import { useEnergy } from '../../context/EnergyContext';
import { ShieldCheck, Maximize2 } from 'lucide-react';

const MonitoringView: React.FC<{ initialRoomId?: string | null }> = () => {
    const { peopleCount, systemRooms } = useEnergy();

    return (
        <div className="space-y-6 animate-fade-in relative">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                        Live Surveillance
                    </h2>
                    <p className="text-slate-500">
                        Real-time CCTV feeds for all zones.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 bg-green-50 px-4 py-2 rounded-lg border border-green-100 text-green-700 text-sm font-medium">
                        <ShieldCheck className="w-5 h-5" />
                        All Surveillance Operational
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {systemRooms?.map(room => (
                    <div
                        key={room.id}
                        className="h-[400px] cursor-pointer transition-transform hover:scale-[1.01] hover:shadow-lg rounded-xl overflow-hidden relative group"
                    >
                        <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-black/50 p-2 rounded-lg text-white backdrop-blur-sm">
                                <Maximize2 className="w-5 h-5" />
                            </div>
                        </div>
                        <LiveFeedWidget
                            roomId={room.id}
                            roomName={`${room.name} - ${room.id === 'A101' ? 'Live' : 'Feed'}`}
                            occupancy={peopleCount}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MonitoringView;
