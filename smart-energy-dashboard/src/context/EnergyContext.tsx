import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { ZoneConfig, ZoneState, Detection, DetectResponse } from '../types';

interface EnergyContextType {
    zones: ZoneConfig[];
    zoneStates: ZoneState[];
    detections: Detection[];
    peopleCount: number;
    totalPowerWatts: number;
    zonesOccupied: number;
    zonesTotal: number;
    isProcessing: boolean;
    fps: number;
    updateDetectionResults: (response: DetectResponse) => void;
    setIsProcessing: (v: boolean) => void;
    setFps: (v: number) => void;
}

const EnergyContext = createContext<EnergyContextType | undefined>(undefined);

export const EnergyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [zones, setZones] = useState<ZoneConfig[]>([]);
    const [zoneStates, setZoneStates] = useState<ZoneState[]>([]);
    const [detections, setDetections] = useState<Detection[]>([]);
    const [peopleCount, setPeopleCount] = useState(0);
    const [totalPowerWatts, setTotalPowerWatts] = useState(0);
    const [zonesOccupied, setZonesOccupied] = useState(0);
    const [zonesTotal, setZonesTotal] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [fps, setFps] = useState(0);

    // Fetch zone config once on mount
    useEffect(() => {
        const fetchZones = async () => {
            try {
                const backendUrl = import.meta.env.VITE_AI_ENGINE_URL || 'http://localhost:8000';
                const res = await fetch(`${backendUrl}/zones`);
                if (res.ok) {
                    const data = await res.json();
                    setZones(data.zones || []);
                    setZonesTotal(data.zones?.length || 0);
                }
            } catch (e) {
                console.error('Failed to fetch zones:', e);
            }
        };
        fetchZones();
    }, []);

    const updateDetectionResults = useCallback((response: DetectResponse) => {
        setPeopleCount(response.people_count);
        setDetections(response.detections);
        setZoneStates(response.zone_states);
        setTotalPowerWatts(response.total_power_watts);
        setZonesOccupied(response.zones_occupied);
        setZonesTotal(response.zones_total);
    }, []);

    return (
        <EnergyContext.Provider value={{
            zones,
            zoneStates,
            detections,
            peopleCount,
            totalPowerWatts,
            zonesOccupied,
            zonesTotal,
            isProcessing,
            fps,
            updateDetectionResults,
            setIsProcessing,
            setFps,
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
