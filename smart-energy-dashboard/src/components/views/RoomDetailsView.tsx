import React, { useRef } from 'react';
import { type Action } from '../../types';
import { useEnergy } from '../../context/EnergyContext';
import {
    Lightbulb,
    Fan,
    Zap,
    Users,
    ArrowLeft,
    CheckCircle,
    Cpu,
    Leaf
} from 'lucide-react';
import LiveFeedWidget from '../dashboard/LiveFeedWidget';


const ActionItem: React.FC<{
    action: Action;
    isChecked: boolean;
    onToggle: () => void;
}> = ({ action, isChecked, onToggle }) => {
    const getIcon = () => {
        switch (action.type) {
            case 'AC': return <Zap className="w-5 h-5 text-slate-600" />;
            case 'Light': return <Lightbulb className="w-5 h-5 text-slate-600" />;
            case 'Fan': return <Fan className="w-5 h-5 text-slate-600" />;
            default: return <Zap className="w-5 h-5 text-slate-600" />;
        }
    };
    return (
        <div
            onClick={onToggle}
            className={`p-4 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${isChecked ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100 hover:border-blue-200 hover:shadow-sm'}`}>
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors ${isChecked ? 'bg-green-100 text-green-600' : 'bg-white text-slate-500 group-hover:text-blue-600'}`}>
                    {isChecked ? <CheckCircle className="w-5 h-5 text-green-600" /> : getIcon()}
                </div>
                <div>
                    <h4 className={`font-semibold text-sm ${isChecked ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{action.title}</h4>
                    <p className={`text-xs ${isChecked ? 'text-green-600 font-medium' : 'text-slate-500'}`}>
                        {isChecked ? `✓ Done — saving ${action.wattsAffected || 0}W` : action.description}
                    </p>
                </div>
            </div>
            <div className={`w-6 h-6 border-2 rounded-md flex items-center justify-center transition-colors ${isChecked ? 'bg-green-600 border-green-600' : 'bg-white border-slate-300 group-hover:border-blue-400'}`}>
                {isChecked && <CheckCircle className="w-4 h-4 text-white" />}
            </div>
        </div>
    );
};

interface RoomDetailsViewProps {
    roomId: string | null;
    onBack: () => void;
    onNavigate: (view: string, roomId?: string) => void;
}

const RoomDetailsView: React.FC<RoomDetailsViewProps> = ({ roomId, onBack, onNavigate: _onNavigate }) => {
    const { peopleCount, optimizationResults, systemRooms, acceptedActions, acceptAction } = useEnergy();
    const selectedRoom = systemRooms?.find(r => r.id === roomId) || systemRooms?.[0];

    const cameraSectionRef = useRef<HTMLDivElement>(null);
    const scrollToCamera = () => {
        cameraSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    if (!selectedRoom) return <div>Room not found</div>;

    const result = optimizationResults[selectedRoom.id];
    const roomAccepted = acceptedActions[selectedRoom.id] || new Set();

    // --- Build actions from optimizer results ---
    const actions: Action[] = [];
    if (result?.recommendations) {
        result.recommendations.forEach(rec => {
            const recType = rec.appliance_type;
            const uiType = recType === 'LIGHT' ? 'Light' : recType === 'FAN' ? 'Fan' : recType === 'AC' ? 'AC' : 'Other';

            // Match appliance by index: appliance_id is 1-based index into room.appliances
            const appliance = selectedRoom.appliances?.[rec.appliance_id - 1];

            if (rec.status === 'OFF') {
                const watts = appliance?.totalWatts || rec.estimated_power_watts;
                actions.push({
                    id: `rec-${rec.appliance_id}`,
                    type: uiType as any,
                    title: `Turn OFF ${recType} (${appliance?.count || '?'} units)`,
                    description: `Save ${watts}W — not needed for ${peopleCount} people`,
                    impact: watts > 1000 ? 'High' : watts > 200 ? 'Medium' : 'Low',
                    wattsAffected: watts
                });
            } else if (rec.status === 'ON' && rec.level !== null) {
                const currentWatts = appliance?.totalWatts || 0;
                const savedWatts = Math.max(0, currentWatts - rec.estimated_power_watts);
                if (savedWatts > 0) {
                    const perUnitWatts = appliance?.powerConsumption || 60;
                    const unitsOn = perUnitWatts > 0 ? Math.max(1, Math.round(rec.estimated_power_watts / perUnitWatts)) : 1;
                    const totalUnits = appliance?.count || 1;
                    const label = recType === 'AC'
                        ? `Reduce AC to Level ${rec.level}`
                        : `Reduce ${recType} to ${unitsOn}/${totalUnits} units`;
                    actions.push({
                        id: `rec-${rec.appliance_id}`,
                        type: uiType as any,
                        title: label,
                        description: `Save ${savedWatts}W — optimal for ${peopleCount} people`,
                        impact: savedWatts > 5000 ? 'High' : savedWatts > 200 ? 'Medium' : 'Low',
                        wattsAffected: savedWatts
                    });
                }
            }
        });
    }

    // --- Energy calculations using user's formulas ---
    const maxLoadWatts = (selectedRoom.maxLoad || 0) * 1000;

    let wattsOff = 0;
    actions.forEach(action => {
        if (roomAccepted.has(action.id)) {
            wattsOff += action.wattsAffected || 0;
        }
    });

    // Cap at max to prevent negative values
    wattsOff = Math.min(wattsOff, maxLoadWatts);

    const currentLoadWatts = maxLoadWatts - wattsOff;
    const currentLoadKW = (currentLoadWatts / 1000).toFixed(2);

    // Energy Saved (%) = (turnedOffPower / totalPowerBefore) × 100
    const energySavedPercent = maxLoadWatts > 0
        ? Math.min(100, Math.round((wattsOff / maxLoadWatts) * 100))
        : 0;

    // Build per-system-type status for the insight card
    const systemStatusList = (selectedRoom.appliances || []).map((app: any, idx: number) => {
        const actionId = `rec-${idx + 1}`;
        const isAccepted = roomAccepted.has(actionId);
        const action = actions.find(a => a.id === actionId);
        return {
            name: app.name,
            type: app.type,
            count: app.count,
            totalWatts: app.totalWatts,
            status: isAccepted ? (action?.title?.startsWith('Turn OFF') ? 'OFF' : 'Reduced') : 'ON'
        };
    });

    // Status
    const uncheckedActions = actions.filter(a => !roomAccepted.has(a.id));
    const isOptimal = uncheckedActions.length === 0 && actions.length > 0;


    return (
        <div className="space-y-6 animate-fade-in relative h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-900"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                            {selectedRoom.name}
                            <span className={`text-xs px-2 py-1 rounded-full border ${isOptimal
                                ? 'bg-green-50 text-green-700 border-green-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                                }`}>
                                {isOptimal ? 'Optimal Efficiency' : 'Optimization Suggested'}
                            </span>
                        </h1>
                        <p className="text-slate-500 text-sm">Zone ID: {selectedRoom.id} • {selectedRoom.dimensions}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={scrollToCamera}
                        className="flex items-center gap-2 group cursor-pointer hover:opacity-80 transition-opacity"
                    >
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span className="text-sm font-medium text-slate-700 underline underline-offset-4 decoration-slate-300 group-hover:decoration-green-500 group-hover:text-green-700 transition-all">
                            Live Camera
                        </span>
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-300">

                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                    <Users className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Live</span>
                            </div>
                            <div className="mt-2">
                                <span className="text-2xl font-bold text-slate-900">{peopleCount}</span>
                                <span className="text-slate-400 text-sm ml-1">occupants</span>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                                    <Zap className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-2">
                                <span className="text-2xl font-bold text-slate-900">{currentLoadKW}</span>
                                <span className="text-slate-400 text-sm ml-1">kW</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">Current Load</p>
                        </div>
                    </div>

                    {/* Insight Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl text-white shadow-lg">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-white/10 rounded-lg">
                                    <Cpu className="w-6 h-6 text-blue-300" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">System Status</h3>
                                    <p className="text-slate-400 text-xs">Per appliance type</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {systemStatusList.map((sys: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                        <span className="text-slate-300">{sys.name}</span>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sys.status === 'OFF' ? 'bg-red-500/20 text-red-300'
                                            : sys.status === 'Reduced' ? 'bg-amber-500/20 text-amber-300'
                                                : 'bg-green-500/20 text-green-300'
                                            }`}>{sys.status}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 text-xs text-slate-400 bg-white/5 p-2 rounded-lg">
                                Optimized for {peopleCount} occupants
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 rounded-xl text-white shadow-lg">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-white/10 rounded-lg">
                                    <Leaf className="w-6 h-6 text-emerald-300" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">Energy Savings</h3>
                                    <p className="text-emerald-200 text-xs">Vs. All Appliances ON</p>
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold">{energySavedPercent}%</span>
                                <span className="text-emerald-200 text-sm">Saved</span>
                            </div>
                            <div className="mt-4 text-xs text-emerald-200 bg-white/5 p-2 rounded-lg">
                                Est. {wattsOff}W avoided
                            </div>
                        </div>
                    </div>

                    {/* Live Feed */}
                    <div ref={cameraSectionRef} className="scroll-mt-24">
                        <LiveFeedWidget roomId={selectedRoom.id} roomName={selectedRoom.name} />
                    </div>
                </div>

                {/* Right Column: Optimization Checklist */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6 h-full overflow-y-auto">
                    <div>
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-500" />
                            Optimization Recommendations
                        </h3>
                        {actions.length > 0 ? (
                            <div className="space-y-3">
                                {actions.map((action: Action) => (
                                    <ActionItem
                                        key={action.id}
                                        action={action}
                                        isChecked={roomAccepted.has(action.id)}
                                        onToggle={() => {
                                            const appIdx = parseInt(action.id.replace('rec-', ''), 10) - 1;
                                            const appliance = selectedRoom.appliances?.[appIdx];
                                            const systemUuid = appliance?.id || '';
                                            acceptAction(selectedRoom.id, action.id, systemUuid, action.wattsAffected || 0);
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-slate-400 text-sm italic border border-dashed rounded-lg">
                                No specific actions found. Room is optimized.
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default RoomDetailsView;
