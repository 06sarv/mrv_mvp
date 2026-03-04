import { EnergyProvider } from './context/EnergyContext';
import Layout from './components/layout/Layout';
import Dashboard from './components/dashboard/Dashboard';

function App() {
  return (
    <EnergyProvider>
      <Layout>
        <Dashboard />
      </Layout>
    </EnergyProvider>
  );
}

export default App;
