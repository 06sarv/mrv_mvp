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
  const handleNavigate = (view: string, roomId?: string) => {
    setActiveTab(view);
    if (roomId) setSelectedRoomId(roomId);
  };

  return (
    <EnergyProvider>
      <Layout
        activeTab={activeTab}
        setActiveTab={handleNavigate}
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
        {activeTab === 'settings' && <SettingsView />}
      </Layout>
    </EnergyProvider>
  );
}

export default App;
