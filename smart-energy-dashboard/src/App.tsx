import { useState } from 'react';
import { EnergyProvider } from './context/EnergyContext';
import Layout from './components/layout/Layout';
import Dashboard from './components/dashboard/Dashboard';
import SettingsView from './components/views/SettingsView';
import MonitoringView from './components/views/MonitoringView';
import RoomDetailsView from './components/views/RoomDetailsView';
import RoomSurveillanceView from './components/views/RoomSurveillanceView';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showZoneInsights, setShowZoneInsights] = useState(false);

  const handleNavigate = (view: string, roomId?: string) => {
    setActiveTab(view);
    if (view === 'room-details') {
      setShowZoneInsights(true);
    }
    if (roomId) setSelectedRoomId(roomId);
    else if (view === 'dashboard' || view === 'monitoring') {
      // Keep selectedRoomId if we want persistent selection
    }
  };

  return (
    <EnergyProvider>
      <Layout
        activeTab={activeTab}
        setActiveTab={handleNavigate}
        selectedRoomId={selectedRoomId}
        showZoneInsights={showZoneInsights}
      >
        {activeTab === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
        {activeTab === 'monitoring' && <MonitoringView />}
        {activeTab === 'room-details' && (
          <RoomDetailsView
            roomId={selectedRoomId}
            onBack={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
          />
        )}
        {activeTab === 'room-surveillance' && (
          <RoomSurveillanceView
            roomId={selectedRoomId}
            onBack={() => handleNavigate('room-details', selectedRoomId || undefined)}
          />
        )}
        {activeTab === 'energy' && <div className="p-8 text-center text-slate-500">Energy Optimization Reports (Coming Soon)</div>}
        {activeTab === 'settings' && <SettingsView />}
        {activeTab === 'control' && <div className="p-8 text-center text-slate-500">Appliance Control is available in the Dashboard view.</div>}
        {activeTab === 'alerts' && <div className="p-8 text-center text-slate-500">No new alerts.</div>}
      </Layout>
    </EnergyProvider>
  );
}

export default App;
