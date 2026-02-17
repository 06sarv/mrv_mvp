import { User, Zap } from 'lucide-react';
import WeatherWidget from './WeatherWidget';

const Header: React.FC<{ title: string; onHome?: () => void }> = ({ title, onHome }) => {
    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-4">
                <button
                    onClick={onHome}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                    <div className="p-1.5 bg-blue-600 rounded shadow-sm shadow-blue-600/20">
                        <Zap className="w-4 h-4 text-white" fill="currentColor" />
                    </div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tighter">MRV</h1>
                </button>
                <div className="h-6 w-px bg-slate-200 mx-2" />
                <h2 className="text-lg font-semibold text-slate-800 tracking-tight">{title}</h2>
                <div className="h-6 w-px bg-slate-200 mx-2 hidden sm:block" />
                <div className="hidden md:block">
                    <WeatherWidget />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 pl-2">
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-semibold text-slate-900 leading-none">Facility Manager</div>
                    </div>
                    <div className="w-9 h-9 border border-slate-300 rounded-full flex items-center justify-center text-slate-800 bg-white">
                        <User className="w-5 h-5" />
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
