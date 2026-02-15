import React from 'react';
import { Lightbulb, Fan, Snowflake, Monitor, Power } from 'lucide-react';
import { useEnergy } from '../../context/EnergyContext';
import type { Appliance } from '../../types';

const ApplianceControlWidget: React.FC = () => {
    const { appliances, toggleAppliance, setApplianceMode } = useEnergy();

    const getIcon = (type: Appliance['type']) => {
        switch (type) {
            case 'Light': return Lightbulb;
            case 'Fan': return Fan;
            case 'AC': return Snowflake;
            default: return Monitor;
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Power className="w-4 h-4 text-slate-500" />
                Appliance Control
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {appliances.map((app) => {
                    const Icon = getIcon(app.type);
                    return (
                        <div key={app.id} className={`p-4 rounded-xl border transition-all ${app.isOn
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-slate-50 border-slate-200 opacity-75'
                            }`}>
                            <div className="flex justify-between items-start mb-3">
                                <div className={`p-2 rounded-lg ${app.isOn ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500'
                                    }`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col items-end">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={app.isOn}
                                            onChange={() => toggleAppliance(app.id)}
                                        />
                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <div className="font-medium text-slate-900">{app.name}</div>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs text-slate-500">{app.powerConsumption}W</span>
                                    <button
                                        onClick={() => setApplianceMode(app.id, !app.isAuto)}
                                        className={`text-xs px-2 py-0.5 rounded border ${app.isAuto
                                            ? 'bg-purple-100 text-purple-700 border-purple-200'
                                            : 'bg-slate-100 text-slate-500 border-slate-200'
                                            }`}
                                    >
                                        {app.isAuto ? 'AUTO' : 'MANUAL'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ApplianceControlWidget;
