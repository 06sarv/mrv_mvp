import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useEnergy } from '../../context/EnergyContext';

const AnalyticsView: React.FC = () => {
    const { history } = useEnergy();

    // Mock data for weekly comparisons
    const weeklyData = [
        { day: 'Mon', usage: 45, optimized: 32 },
        { day: 'Tue', usage: 52, optimized: 38 },
        { day: 'Wed', usage: 49, optimized: 35 },
        { day: 'Thu', usage: 63, optimized: 45 },
        { day: 'Fri', usage: 58, optimized: 42 },
        { day: 'Sat', usage: 24, optimized: 18 },
        { day: 'Sun', usage: 20, optimized: 15 },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">Analytics & History</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Real-time Trend */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-4">Real-time Energy Trend</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="energyUsage" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} name="Usage (kW)" />
                                <Area type="monotone" dataKey="peopleCount" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} name="People" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Weekly Comparison */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-4">Weekly Optimization Impact</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                                <Bar dataKey="usage" name="Normal Usage" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="optimized" name="AI Optimized" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsView;
