import React, { useEffect, useState } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, MapPin } from 'lucide-react';

interface WeatherData {
    temperature: number;
    weathercode: number;
}

const WeatherWidget: React.FC = () => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const response = await fetch(
                    'https://api.open-meteo.com/v1/forecast?latitude=12.719130&longitude=80.013645&current_weather=true&temperature_unit=celsius&windspeed_unit=kmh&timezone=Asia/Kolkata'
                );
                const data = await response.json();
                setWeather(data.current_weather);
            } catch (error) {
                console.error('Error fetching weather:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchWeather();
        const interval = setInterval(fetchWeather, 900000); // Update every 15 mins
        return () => clearInterval(interval);
    }, []);

    const getWeatherIcon = (code: number) => {
        if (code === 0 || code === 1) return <Sun className="w-5 h-5 text-amber-500" />;
        if (code === 2 || code === 3) return <Cloud className="w-5 h-5 text-slate-500" />;
        if (code >= 45 && code <= 48) return <Cloud className="w-5 h-5 text-slate-600" />;
        if (code >= 51 && code <= 67) return <CloudRain className="w-5 h-5 text-blue-500" />;
        if (code >= 71 && code <= 77) return <CloudSnow className="w-5 h-5 text-sky-300" />;
        if (code >= 80 && code <= 82) return <CloudRain className="w-5 h-5 text-blue-600" />;
        if (code >= 95 && code <= 99) return <CloudLightning className="w-5 h-5 text-purple-500" />;
        return <Sun className="w-5 h-5 text-amber-500" />;
    };

    if (loading) return <div className="animate-pulse h-8 w-32 bg-slate-100 rounded-lg"></div>;

    return (
        <div className="flex items-center gap-4 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                <MapPin className="w-4 h-4 text-blue-600" />
                <div className="flex flex-col justify-center">
                    <span className="text-xs font-semibold text-slate-700 leading-tight">Mahindra Research Valley</span>
                </div>
            </div>

            {weather && (
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        {getWeatherIcon(weather.weathercode)}
                        <span className="text-sm font-bold text-slate-800">{weather.temperature}°C</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WeatherWidget;
