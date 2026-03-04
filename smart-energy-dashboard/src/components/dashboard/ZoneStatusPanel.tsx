import React from 'react';
import type { ZoneState } from '../../types';
import { Lightbulb, Fan, Clock, Zap } from 'lucide-react';

interface ZoneStatusPanelProps {
    zoneStates: ZoneState[];
}

const ZoneStatusPanel: React.FC<ZoneStatusPanelProps> = ({ zoneStates }) => {
    if (!zoneStates || zoneStates.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center text-slate-400 text-sm">
                Waiting for detection data...
            </div>
        );
    }

    const getTimeSince = (isoStr: string | null): string => {
        if (!isoStr) return '—';
        const diff = Date.now() - new Date(isoStr).getTime();
        const seconds = Math.floor(diff / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        return `${Math.floor(minutes / 60)}h ago`;
    };

    const occupiedCount = zoneStates.filter(z => z.is_occupied).length;
    const totalPower = zoneStates.reduce((sum, z) => sum + z.zone_power_watts, 0);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">Zone Status</h4>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-500" />
                        {totalPower}W
                    </span>
                    <span className="text-xs text-slate-500">
                        {occupiedCount}/{zoneStates.length} active
                    </span>
                    <div className={`w-2 h-2 rounded-full ${occupiedCount > 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                </div>
            </div>

            {/* Zone list */}
            <div className="divide-y divide-slate-50">
                {zoneStates.map((zone) => (
                    <div
                        key={zone.zone_id}
                        className={`px-4 py-3 flex items-center justify-between transition-colors ${zone.is_occupied ? 'bg-green-50/50' : 'bg-slate-50/30'}`}
                    >
                        <div className="flex items-center gap-3">
                            {/* Status dot */}
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${zone.is_occupied
                                ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]'
                                : 'bg-slate-300'
                                }`} />

                            <div>
                                <p className="text-sm font-medium text-slate-800">{zone.zone_name}</p>
                                <div className="flex items-center gap-3 mt-0.5">
                                    <span className={`inline-flex items-center gap-1 text-[10px] ${zone.fan_on ? 'text-green-600' : 'text-slate-400'}`}>
                                        <Fan className="w-3 h-3" />
                                        Fan {zone.fan_on ? 'ON' : 'OFF'}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 text-[10px] ${zone.light_on ? 'text-amber-600' : 'text-slate-400'}`}>
                                        <Lightbulb className="w-3 h-3" />
                                        Light {zone.light_on ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-right">
                            {/* Power */}
                            {zone.zone_power_watts > 0 && (
                                <span className="text-[10px] font-medium text-amber-600">
                                    {zone.zone_power_watts}W
                                </span>
                            )}

                            {/* Last detected */}
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                <Clock className="w-3 h-3" />
                                {getTimeSince(zone.last_detected)}
                            </div>

                            {/* Appliance state badge */}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${zone.appliance_state === 'ON'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-100 text-slate-500'
                                }`}>
                                {zone.appliance_state}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ZoneStatusPanel;
