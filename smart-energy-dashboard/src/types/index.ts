export type OccupancyLevel = 'Low' | 'Medium' | 'High';

export interface Appliance {
    id: string;
    name: string;
    type: 'Light' | 'Fan' | 'AC' | 'Other';
    isOn: boolean;
    powerConsumption: number; // per-unit watts
    isAuto: boolean;
    count?: number;        // total units
    totalWatts?: number;   // total power (all units)
    activeCount?: number;  // currently active units
}

export interface EnergyStats {
    currentUsage: number; // kW — real current load
    optimizedUsage: number; // kW — optimizer-recommended load
    totalSavings: number; // % — energy saved
    costSaved: number;
}

export interface SystemState {
    peopleCount: number;
    occupancyLevel: OccupancyLevel;
    roomCapacity: number;
    fps: number;
    appliances: Appliance[];
    stats: EnergyStats;
    optimizationResults: Record<string, OptimizationResult>;
    systemRooms: Room[];
}

export interface OptimizationRecommendation {
    appliance_id: number;
    appliance_type: 'AC' | 'FAN' | 'LIGHT' | 'Other' | 'UNKNOWN';
    status: 'ON' | 'OFF';
    level: number | null;
    estimated_power_watts: number;
}

export interface OptimizationResult {
    room_id: number;
    people_count: number;
    outside_temp_c: number | null;
    total_estimated_power_watts: number;
    recommendations: OptimizationRecommendation[];
    optimization_id?: string;
}

export interface Action {
    id: string;
    type: 'Light' | 'Fan' | 'AC' | 'Other';
    title: string;
    description: string;
    impact?: 'High' | 'Medium' | 'Low';
    wattsAffected?: number; // watts that would be saved if accepted
}

export interface Room {
    id: string;
    name: string;
    type: string;
    capacity: number;
    occupancy: number;
    temperature: number;
    humidity: number;
    lighting: number;
    status: 'Optimal Efficiency' | 'Optimization Suggested';
    actions: Action[];
    applianceCount?: number;
    currentLoad?: number;      // kW — current active load
    maxLoad?: number;          // kW — all appliances ON
    energySavedPercent?: number;
    dimensions?: string;
    floor?: number;
    appliances?: Appliance[];
}
