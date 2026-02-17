import React, { useState } from 'react';
import {
    Thermometer,
    Lightbulb,
    Fan,
    Zap,
    CheckCircle,
    Users,
    Leaf
} from 'lucide-react';

import { type Room, type Action } from '../../types';
import { useEnergy } from '../../context/EnergyContext';

const ActionCard: React.FC<{
    action: Action;
    isChecked: boolean;
    onToggle: () => void;
}> = ({ action, isChecked, onToggle }) => {
    const getIcon = () => {
        switch (action.type) {
            case 'AC': return <Thermometer className="w-5 h-5 text-slate-600" />;
            case 'Light': return <Lightbulb className="w-5 h-5 text-slate-600" />;
            case 'Fan': return <Fan className="w-5 h-5 text-slate-600" />;
            default: return <Zap className="w-5 h-5 text-slate-600" />;
        }
    };

    const getBgColor = () => {
        if (isChecked) return 'bg-green-50 border-green-200';
        switch (action.type) {
            case 'AC': return 'bg-cyan-50 border-cyan-100 hover:border-cyan-200';
            case 'Light': return 'bg-amber-50 border-amber-100 hover:border-amber-200';
            case 'Fan': return 'bg-rose-50 border-rose-100 hover:border-rose-200';
            default: return 'bg-slate-50 border-slate-100 hover:border-slate-200';
        }
    };

    return (
        <div
            onClick={onToggle}
            className={`p-4 rounded-xl border ${getBgColor()} flex items-center justify-between group cursor-pointer transition-all hover:shadow-md`}
        >
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors ${isChecked ? 'bg-green-100' : 'bg-white'}`}>
                    {isChecked ? <CheckCircle className="w-5 h-5 text-green-600" /> : getIcon()}
                </div>
                <div>
                    <h4 className={`font-semibold text-sm ${isChecked ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                        {action.title}
                    </h4>
                    <p className={`text-xs ${isChecked ? 'text-green-600 font-medium' : 'text-slate-500'}`}>
                        {isChecked ? '✓ Done — state updated' : action.description}
                    </p>
                </div>
            </div>
            <div className={`w-6 h-6 border-2 rounded-md flex items-center justify-center transition-colors ${isChecked
                ? 'bg-green-600 border-green-600'
                : 'bg-white border-slate-300 group-hover:border-blue-400'
                }`}>
                {isChecked && <CheckCircle className="w-4 h-4 text-white" />}
            </div>
        </div>
    );
};

const RoomCard: React.FC<{
    room: Room;
    onNavigate: (view: string, roomId?: string) => void;
    acceptedSet: Set<string>;
    onAcceptAction: (actionId: string, applianceId: string, wattsAffected: number) => void;
}> = ({ room, onNavigate, acceptedSet, onAcceptAction }) => {
    const isOptimal = room.status === 'Optimal Efficiency';
    const energySavedPercent = room.energySavedPercent || 0;

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 transition-all hover:shadow-md group/card">
            {/* Room header — clickable to navigate */}
            <div
                className="flex items-start justify-between mb-4 cursor-pointer"
                onClick={() => onNavigate('room-details', room.id)}
            >
                <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover/card:text-blue-600 transition-colors">
                        {room.name}
                    </h3>
                    {room.dimensions && (
                        <p className="text-xs text-slate-400 font-medium mt-0.5">{room.dimensions}</p>
                    )}
                    {room.applianceCount && (
                        <p className="text-xs text-slate-500 mt-1">
                            <span className="font-bold text-slate-700">{room.applianceCount}</span> Total Appliances
                        </p>
                    )}
                </div>
                <div className="flex flex-col items-end">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">OCCUPANCY</div>
                    <div className="flex items-center gap-2 text-slate-700 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="text-xl font-bold">{room.occupancy}</span>
                    </div>
                </div>
            </div>

            {/* Power & Savings Row */}
            <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1.5">
                    <div className={`p-1 rounded-full ${isOptimal ? 'bg-green-100' : 'bg-amber-100'} animate-pulse`}>
                        <Zap className={`w-3.5 h-3.5 ${isOptimal ? 'text-green-600' : 'text-amber-600'}`} fill="currentColor" />
                    </div>
                    <span className="font-mono text-sm font-semibold text-slate-700">
                        {(room.currentLoad || 0).toFixed(2)} kW
                    </span>
                    <span className="text-slate-400 text-[10px] uppercase tracking-wide">Load</span>
                </div>
                {energySavedPercent > 0 && (
                    <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                        <Leaf className="w-3 h-3 text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-700">{energySavedPercent}% Saved</span>
                    </div>
                )}
            </div>

            {/* Status badge */}
            <div className={`mb-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${isOptimal
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
                }`}>
                {isOptimal ? <CheckCircle className="w-3 h-3 mr-1.5" /> : <Zap className="w-3 h-3 mr-1.5" />}
                {room.status}
            </div>

            {/* Action items — checkable alerts */}
            <div className="flex items-center justify-between text-sm mb-3">
                <div className="text-slate-500">
                    Suggested Actions <span className="ml-1 font-bold text-blue-600">{room.actions.length}</span>
                </div>
            </div>

            <div className="space-y-3">
                {room.actions.length > 0 ? (
                    room.actions.map(action => (
                        <ActionCard
                            key={action.id}
                            action={action}
                            isChecked={acceptedSet.has(action.id)}
                            onToggle={() => {
                                // Get the appliance index from the action ID (rec-<1-based-idx>)
                                const appIdx = parseInt(action.id.replace('rec-', ''), 10) - 1;
                                const optimizableAppliances = (room.appliances || []).filter((a: any) => a.type !== 'Other');
                                const appliance = optimizableAppliances[appIdx];
                                const systemUuid = appliance?.id || '';
                                onAcceptAction(action.id, systemUuid, action.wattsAffected || 0);
                            }}
                        />
                    ))
                ) : (
                    <div className="text-center py-4 text-slate-400 text-sm italic">
                        No actions needed — room is optimized.
                    </div>
                )}
            </div>
        </div>
    );
};

const OptimizationSection: React.FC<{ onNavigate: (view: string, roomId?: string) => void }> = ({ onNavigate }) => {
    const { peopleCount, optimizationResults, systemRooms, acceptedActions, acceptAction } = useEnergy();
    const [filter, setFilter] = useState<'Action Required' | 'All Rooms'>('Action Required');

    // Build live rooms with optimization data and accepted state
    const liveRooms = (systemRooms || []).map(room => {
        const result = optimizationResults[room.id];
        const roomAccepted = acceptedActions[room.id] || new Set();

        // Calculate max load (all ON) from room data
        const maxLoadWatts = (room.maxLoad || 0) * 1000;

        if (result) {
            // Build actionable suggestions — only show "turn OFF" or "reduce level"
            const apiActions: Action[] = [];

            if (result.recommendations) {
                // Build the same filtered list that was sent to the optimizer (excludes UPS/Other)
                const optimizableAppliances = (room.appliances || []).filter((a: any) => a.type !== 'Other');

                result.recommendations.forEach(rec => {
                    const recType = rec.appliance_type;
                    const uiType = recType === 'LIGHT' ? 'Light' : recType === 'FAN' ? 'Fan' : recType === 'AC' ? 'AC' : 'Other';

                    // appliance_id is 1-based index into the filtered (optimizable) list
                    const appliance = optimizableAppliances[rec.appliance_id - 1];

                    if (rec.status === 'OFF') {
                        // Suggestion: turn this appliance off entirely
                        const watts = appliance?.totalWatts || rec.estimated_power_watts;
                        apiActions.push({
                            id: `rec-${rec.appliance_id}`,
                            type: uiType as any,
                            title: `Turn OFF ${recType} (${appliance?.count || '?'} units)`,
                            description: `Save ${watts}W — not needed for ${peopleCount} people`,
                            impact: watts > 1000 ? 'High' : watts > 200 ? 'Medium' : 'Low',
                            wattsAffected: watts
                        });
                    } else if (rec.status === 'ON' && rec.level !== null) {
                        // Suggestion: reduce level/units for any appliance type
                        const currentWatts = appliance?.totalWatts || 0;
                        const savedWatts = Math.max(0, currentWatts - rec.estimated_power_watts);
                        if (savedWatts > 0) {
                            // Calculate how many units the optimizer wants ON
                            const perUnitWatts = appliance?.powerConsumption || 60;
                            const unitsOn = perUnitWatts > 0 ? Math.max(1, Math.round(rec.estimated_power_watts / perUnitWatts)) : 1;
                            const totalUnits = appliance?.count || 1;
                            const label = recType === 'AC'
                                ? `Reduce AC to Level ${rec.level}`
                                : `Reduce ${recType} to ${unitsOn}/${totalUnits} units`;
                            apiActions.push({
                                id: `rec-${rec.appliance_id}`,
                                type: uiType as any,
                                title: label,
                                description: `Save ${savedWatts}W — optimal for ${peopleCount} people`,
                                impact: savedWatts > 5000 ? 'High' : savedWatts > 200 ? 'Medium' : 'Low',
                                wattsAffected: savedWatts
                            });
                        }
                    }
                    // "Keep ON" — no action needed, skip
                });
            }

            // Calculate current load considering accepted actions
            let wattsOff = 0;
            apiActions.forEach(action => {
                if (roomAccepted.has(action.id)) {
                    wattsOff += action.wattsAffected || 0;
                }
            });

            // Cap wattsOff at maxLoad to prevent negative values
            wattsOff = Math.min(wattsOff, maxLoadWatts);

            const currentLoadWatts = maxLoadWatts - wattsOff;
            const energySavedPercent = maxLoadWatts > 0
                ? Math.min(100, Math.round((wattsOff / maxLoadWatts) * 100))
                : 0;

            // Only show "Optimization Suggested" if there are unchecked actions
            const uncheckedActions = apiActions.filter(a => !roomAccepted.has(a.id));
            const status = uncheckedActions.length > 0 ? 'Optimization Suggested' : 'Optimal Efficiency';

            return {
                ...room,
                occupancy: peopleCount,
                actions: apiActions,
                status: status,
                currentLoad: currentLoadWatts / 1000,
                energySavedPercent: energySavedPercent,
                optimization_id: result.optimization_id
            } as Room & { optimization_id?: string };
        }

        return {
            ...room,
            occupancy: peopleCount,
            actions: [] as Action[],
            status: 'Optimal Efficiency' as const // Default to optimal if no data
        };
    });

    const filteredRooms = filter === 'All Rooms'
        ? liveRooms
        : liveRooms.filter(r => r.status === 'Optimization Suggested');

    const actionRequiredCount = liveRooms.filter(r => r.status === 'Optimization Suggested').length;
    const optimalCount = liveRooms.filter(r => r.status === 'Optimal Efficiency').length;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Stats Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                    <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-slate-500">Action Required:</span>
                        <span className="text-xl font-bold text-slate-900">{actionRequiredCount}</span>
                    </div>
                    <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                    <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-slate-500">Optimal:</span>
                        <span className="text-xl font-bold text-green-600">{optimalCount}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">Show:</span>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setFilter('Action Required')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filter === 'Action Required' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Action Required
                        </button>
                        <button
                            onClick={() => setFilter('All Rooms')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filter === 'All Rooms' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            All Rooms
                        </button>
                    </div>
                </div>
            </div>

            {/* Room Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredRooms.map(room => (
                    <RoomCard
                        key={room.id}
                        room={room}
                        onNavigate={onNavigate}
                        acceptedSet={acceptedActions[room.id] || new Set()}
                        onAcceptAction={(actionId, appId, watts) => acceptAction(room.id, actionId, appId, watts)}
                    />
                ))}
            </div>
        </div>
    );
};

export default OptimizationSection;
