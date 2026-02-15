import React, { useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { useEnergy } from '../../context/EnergyContext';

const SettingsView: React.FC = () => {
    const { roomCapacity, updateSettings } = useEnergy();
    const [capacity, setCapacity] = useState(roomCapacity);
    const [threshold, setThreshold] = useState(0.85);

    const handleSave = () => {
        updateSettings({ roomCapacity: capacity });
        alert('Settings saved successfully!');
    };

    return (
        <div className="max-w-2xl space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
                <div>
                    <h3 className="font-semibold text-slate-900 mb-1">Room Configuration</h3>
                    <p className="text-sm text-slate-500 mb-4">Define the physical parameters.</p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Max Room Capacity</label>
                            <input
                                type="number"
                                value={capacity}
                                onChange={(e) => setCapacity(parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Zone Name</label>
                            <input
                                type="text"
                                defaultValue="Main Conference Hall"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>
                </div>

                <hr className="border-slate-100" />

                <div>
                    <h3 className="font-semibold text-slate-900 mb-1">AI Detection Parameters</h3>
                    <p className="text-sm text-slate-500 mb-4">Fine-tune the YOLO model behavior.</p>

                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between mb-1">
                                <label className="text-sm font-medium text-slate-700">Confidence Threshold</label>
                                <span className="text-sm text-slate-500">{threshold.toFixed(2)}</span>
                            </div>
                            <input
                                type="range"
                                min="0.5"
                                max="0.99"
                                step="0.01"
                                value={threshold}
                                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                    <button className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Reset
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
