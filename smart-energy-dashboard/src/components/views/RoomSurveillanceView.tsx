import React from 'react';
import LiveFeedWidget from '../dashboard/LiveFeedWidget';
import { useEnergy } from '../../context/EnergyContext';
import { ArrowLeft } from 'lucide-react';

interface RoomSurveillanceViewProps {
    roomId: string | null;
    onBack: () => void;
}

const RoomSurveillanceView: React.FC<RoomSurveillanceViewProps> = ({ roomId, onBack }) => {
    const { peopleCount, systemRooms } = useEnergy();
    const selectedRoom = systemRooms?.find(r => r.id === roomId) || systemRooms?.[0];

    if (!selectedRoom) return <div>Room not found</div>;

    return (
        <div className="space-y-6 animate-fade-in relative h-full flex flex-col">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                        {selectedRoom.name} Surveillance
                    </h2>
                    <p className="text-slate-500">
                        Live secure feed • ID: {selectedRoom.id}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Insights
                    </button>
                    <div className="flex items-center gap-3 bg-red-50 px-4 py-2 rounded-lg border border-red-100 text-red-700 text-sm font-medium animate-pulse">
                        <div className="w-2 h-2 bg-red-600 rounded-full" />
                        LIVE
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 relative">
                <LiveFeedWidget
                    roomId={selectedRoom.id}
                    roomName={`${selectedRoom.name} - ${selectedRoom.id === 'A101' ? 'Live' : 'Feed'}`}
                    occupancy={peopleCount}
                />
            </div>
        </div>
    );
};

export default RoomSurveillanceView;
