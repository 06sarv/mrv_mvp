import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { SystemState, Appliance, OccupancyLevel, Notification, OptimizationResult, Action } from '../types';
import { supabase } from '../lib/supabase';


interface EnergyContextType extends SystemState {
    toggleAppliance: (id: string) => void;
    setApplianceMode: (id: string, isAuto: boolean) => void;
    updateSettings: (settings: Partial<SystemState>) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    setPeopleCount: (count: number) => void;
    setFps: (fps: number) => void;
    systemRooms: any[];
    acceptedActions: Record<string, Set<string>>;
    acceptAction: (roomId: string, actionId: string, applianceId: string, wattsAffected: number) => void;
}

const EnergyContext = createContext<EnergyContextType | undefined>(undefined);

export const EnergyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [peopleCount, setPeopleCount] = useState(0);
    const [occupancyLevel, setOccupancyLevel] = useState<OccupancyLevel>('Low');
    const [roomCapacity, setRoomCapacity] = useState(50);
    const [fps, setFps] = useState(24);
    const [searchQuery, setSearchQuery] = useState('');
    const [appliances, setAppliances] = useState<Appliance[]>([]);
    const [systemRooms, setSystemRooms] = useState<any[]>([]);
    const [acceptedActions, setAcceptedActions] = useState<Record<string, Set<string>>>({});
    const [optimizationResults, setOptimizationResults] = useState<Record<string, OptimizationResult>>({});

    // Track energy stats derived from real appliance data
    const [stats, setStats] = useState({
        currentUsage: 0,
        optimizedUsage: 0,
        totalSavings: 0,
        costSaved: 0
    });

    const [history, setHistory] = useState([
        { time: '10:00', peopleCount: 3, energyUsage: 1.2 },
        { time: '11:00', peopleCount: 8, energyUsage: 2.1 },
        { time: '12:00', peopleCount: 15, energyUsage: 3.5 },
    ]);

    const [notifications, setNotifications] = useState<Notification[]>([]);

    // -------------------------------------------------------------------------
    // Fetch Room Data from Supabase — ALL appliances start ON
    // -------------------------------------------------------------------------
    useEffect(() => {
        const fetchSystemData = async () => {
            const { data: rooms, error: roomError } = await supabase.from('rooms').select('*');
            const { data: systems, error: sysError } = await supabase.from('room_systems').select('*');

            if (roomError || sysError) {
                console.error("Supabase Error:", roomError || sysError);
                return;
            }

            if (rooms && systems) {
                const sortedRooms = [...rooms].sort((a, b) => a.room_name.localeCompare(b.room_name));

                const formattedRooms = sortedRooms.map((room: any, index: number) => {
                    const roomSystems = systems.filter((sys: any) => sys.room_id === room.room_id);

                    // ALL appliances start ON with all units active
                    const roomAppliances: Appliance[] = roomSystems.map((sys: any) => {
                        let type: 'Light' | 'Fan' | 'AC' | 'Other' = 'Other';
                        if (sys.system_type === 'LIGHTING') type = 'Light';
                        else if (sys.system_type === 'AC') type = 'AC';
                        else if (sys.system_type === 'FAF') type = 'Fan';

                        return {
                            id: sys.system_id,
                            name: `${sys.system_type} (${sys.unit_count})`,
                            type: type,
                            isOn: true,  // ALL ON initially
                            powerConsumption: sys.unit_power_watts || 0,
                            isAuto: true,
                            count: sys.unit_count || 0,
                            totalWatts: sys.total_power_watts || 0,
                            activeCount: sys.unit_count || 0  // ALL units active initially
                        };
                    });

                    const mappedId = (index + 1).toString();

                    // Max load = sum of all appliance totalWatts (everything ON)
                    const maxLoadWatts = roomAppliances.reduce((acc: number, curr: any) => acc + (curr.totalWatts || 0), 0);

                    return {
                        id: mappedId,
                        uuid: room.room_id,
                        name: room.room_name,
                        capacity: room.seating_capacity,
                        floor: room.floor,
                        dimensions: `${room.length_m}m x ${room.width_m}m`,
                        appliances: roomAppliances,
                        actions: [] as Action[], // Will be populated by optimizer
                        occupancy: 0,
                        status: 'Optimization Suggested' as const,
                        currentLoad: maxLoadWatts / 1000,  // Start at max (all ON)
                        maxLoad: maxLoadWatts / 1000,
                        energySavedPercent: 0,
                        applianceCount: roomAppliances.reduce((acc: number, curr: any) => acc + (curr.count || 0), 0)
                    };
                });

                setSystemRooms(formattedRooms);
                if (formattedRooms.length > 0) {
                    setAppliances(formattedRooms[0].appliances);
                    setRoomCapacity(formattedRooms[0].capacity);
                }
            }
        };
        fetchSystemData();
    }, []);

    // -------------------------------------------------------------------------
    // Real-time Occupancy — poll latest from occupancy_logs
    // -------------------------------------------------------------------------
    useEffect(() => {
        const fetchLatestOccupancy = async () => {
            try {
                const { data, error } = await supabase
                    .from('occupancy_logs')
                    .select('people_count, detected_at')
                    .order('detected_at', { ascending: false })
                    .limit(1);

                if (!error && data && data.length > 0) {
                    const latest = data[0].people_count;
                    setPeopleCount(prev => prev !== latest ? latest : prev);
                }
            } catch (e) {
                console.error('Failed to fetch latest occupancy:', e);
            }
        };

        // Initial fetch
        fetchLatestOccupancy();

        // Poll every 5 seconds for new detections
        const interval = setInterval(fetchLatestOccupancy, 5000);
        return () => clearInterval(interval);
    }, []);

    // -------------------------------------------------------------------------
    // Accept Action — user checks off a suggestion
    // -------------------------------------------------------------------------
    const acceptAction = useCallback(async (roomId: string, actionId: string, systemUuid: string, wattsAffected: number) => {
        // Toggle the action in local accepted state
        let isAccepting = false;
        setAcceptedActions(prev => {
            const roomSet = new Set(prev[roomId] || []);
            if (roomSet.has(actionId)) {
                roomSet.delete(actionId); // Un-accept
                isAccepting = false;
            } else {
                roomSet.add(actionId);    // Accept
                isAccepting = true;
            }
            return { ...prev, [roomId]: roomSet };
        });

        // Update Supabase room_systems active_count using the real UUID
        if (!systemUuid) {
            console.warn('No system UUID provided, skipping Supabase update');
            return;
        }
        try {
            const { data: sysData, error: fetchErr } = await supabase
                .from('room_systems')
                .select('system_id, active_count, unit_count, total_power_watts')
                .eq('system_id', systemUuid)
                .single();

            if (fetchErr) {
                console.error('Supabase fetch error:', fetchErr);
                return;
            }

            if (sysData) {
                const currentActive = sysData.active_count ?? sysData.unit_count ?? 0;
                const unitCount = sysData.unit_count ?? 0;
                const totalPower = sysData.total_power_watts ?? 0;
                // If accepting: decrement. If un-accepting: increment back.
                const newActive = isAccepting
                    ? Math.max(0, currentActive - 1)
                    : Math.min(unitCount, currentActive + 1);

                const { error: updateErr } = await supabase
                    .from('room_systems')
                    .update({ active_count: newActive })
                    .eq('system_id', systemUuid);

                if (updateErr) {
                    console.error('Supabase update error:', updateErr);
                } else {
                    console.log(`✅ Supabase: ${systemUuid} active_count ${currentActive} → ${newActive}`);

                    // Log state change to system_state table
                    const newStatus = newActive > 0 ? 'ON' : 'OFF';
                    const loadPercent = unitCount > 0 ? (newActive / unitCount) * 100 : 0;
                    const estimatedPower = unitCount > 0 ? (newActive / unitCount) * totalPower : 0;

                    const { error: stateErr } = await supabase
                        .from('system_state')
                        .insert({
                            system_id: systemUuid,
                            status: newStatus,
                            load_percent: Math.round(loadPercent * 100) / 100,
                            estimated_power_watts: Math.round(estimatedPower * 100) / 100,
                            source: 'user_optimization'
                        });

                    if (stateErr) {
                        console.error('system_state insert error:', stateErr);
                    } else {
                        console.log(`📝 system_state: ${systemUuid} → ${newStatus} (${loadPercent.toFixed(0)}% load, ${estimatedPower.toFixed(0)}W, saved ${wattsAffected}W)`);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to update Supabase active_count:', e);
        }
    }, []);

    // -------------------------------------------------------------------------
    // Fetch Optimization — generate suggestions based on occupancy
    // -------------------------------------------------------------------------
    useEffect(() => {
        const fetchOptimization = async () => {
            if (systemRooms.length === 0) return;

            const backendUrl = import.meta.env.VITE_AI_ENGINE_URL || 'http://localhost:8000';
            const newResults: Record<string, OptimizationResult> = {};

            await Promise.all(systemRooms.map(async (room) => {
                try {
                    const payload = {
                        room: {
                            room_id: parseInt(room.id, 10) || 1,
                            max_capacity: room.capacity
                        },
                        occupancy: {
                            room_id: parseInt(room.id, 10) || 1,
                            people_count: peopleCount,
                            confidence: 0.95
                        },
                        appliances: room.appliances.map((app: any, idx: number) => ({
                            appliance_id: idx + 1,  // Unique 1-based index
                            room_id: parseInt(room.id, 10) || 1,
                            appliance_type: app.type === 'Light' ? 'LIGHT' : app.type === 'Fan' ? 'FAN' : 'AC',
                            max_power_watts: app.powerConsumption || 60,
                            adjustable: true,
                            number_of_appliances: app.count
                        })),
                        // Mahindra Research Valley, Chennai
                        latitude: 12.79,
                        longitude: 80.22
                    };

                    const response = await fetch(`${backendUrl}/optimize`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        const data = await response.json();
                        newResults[room.id] = data;
                    } else {
                        console.error(`Optimization failed for ${room.id}:`, await response.text());
                    }
                } catch (err) {
                    console.error(`Optimization Error for ${room.id}:`, err);
                }
            }));

            setOptimizationResults(newResults);
        };

        const timeoutId = setTimeout(fetchOptimization, 500);
        return () => clearTimeout(timeoutId);
    }, [peopleCount, systemRooms]);

    // -------------------------------------------------------------------------
    // Recalculate energy stats whenever accepted actions or results change
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (systemRooms.length === 0) return;

        let totalMaxWatts = 0;
        let totalCurrentWatts = 0;
        let totalOptimizedWatts = 0;

        systemRooms.forEach(room => {
            const roomMaxWatts = (room.maxLoad || 0) * 1000;
            totalMaxWatts += roomMaxWatts;

            // Calculate watts turned off by accepted actions in this room
            const roomAccepted = acceptedActions[room.id] || new Set();
            let wattsOff = 0;

            const result = optimizationResults[room.id];
            if (result?.recommendations) {
                result.recommendations.forEach(rec => {
                    const actionId = `rec-${rec.appliance_id}`;
                    // Match appliance by index (consistent with OptimizationSection)
                    const appliance = room.appliances?.[rec.appliance_id - 1];

                    if (rec.status === 'OFF' && roomAccepted.has(actionId)) {
                        wattsOff += appliance?.totalWatts || rec.estimated_power_watts;
                    } else if (rec.status === 'ON' && roomAccepted.has(actionId)) {
                        // Any appliance reduced — savings = max - recommended
                        if (appliance) {
                            wattsOff += Math.max(0, (appliance.totalWatts || 0) - rec.estimated_power_watts);
                        }
                    }
                });
            }

            totalCurrentWatts += (roomMaxWatts - wattsOff);
            totalOptimizedWatts += (result?.total_estimated_power_watts || roomMaxWatts);
        });

        // Energy saved % = (turned off power / total before) × 100
        const savedWatts = totalMaxWatts - totalCurrentWatts;
        const savedPercent = totalMaxWatts > 0 ? Math.round((savedWatts / totalMaxWatts) * 100) : 0;

        setStats({
            currentUsage: Number((totalCurrentWatts / 1000).toFixed(2)),
            optimizedUsage: Number((totalOptimizedWatts / 1000).toFixed(2)),
            totalSavings: savedPercent,
            costSaved: Number((savedWatts * 0.008 / 1000).toFixed(2)) // ~₹8/kWh approx
        });
    }, [systemRooms, acceptedActions, optimizationResults]);

    // Trim history / notifications to avoid memory leaks
    useEffect(() => {
        if (history.length > 100) setHistory(prev => prev.slice(1));
    }, [history]);
    useEffect(() => {
        if (notifications.length > 5) setNotifications(prev => prev.slice(1));
    }, [notifications]);

    // Update Occupancy Level
    useEffect(() => {
        const percentage = (peopleCount / roomCapacity) * 100;
        if (percentage < 30) setOccupancyLevel('Low');
        else if (percentage < 70) setOccupancyLevel('Medium');
        else setOccupancyLevel('High');
    }, [peopleCount, roomCapacity]);

    const toggleAppliance = (id: string) => {
        setAppliances(prev => prev.map(app =>
            app.id === id ? { ...app, isOn: !app.isOn } : app
        ));
    };

    const setApplianceMode = (id: string, isAuto: boolean) => {
        setAppliances(prev => prev.map(app =>
            app.id === id ? { ...app, isAuto } : app
        ));
    };

    const updateSettings = (settings: Partial<SystemState>) => {
        if (settings.roomCapacity) setRoomCapacity(settings.roomCapacity);
    };

    return (
        <EnergyContext.Provider value={{
            peopleCount,
            occupancyLevel,
            roomCapacity,
            fps,
            searchQuery,
            setSearchQuery,
            appliances,
            stats,
            history,
            optimizationResults,
            notifications,
            systemRooms,
            acceptedActions,
            acceptAction,
            toggleAppliance,
            setApplianceMode,
            updateSettings,
            setPeopleCount,
            setFps
        }}>
            {children}
        </EnergyContext.Provider>
    );
};

export const useEnergy = () => {
    const context = useContext(EnergyContext);
    if (context === undefined) {
        throw new Error('useEnergy must be used within an EnergyProvider');
    }
    return context;
};
