import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Equipment from './pages/Equipment';
import ExportForm from './pages/ExportForm';
import ReturnForm from './pages/ReturnForm';
import Events from './pages/Events';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="equipment" element={<Equipment />} />
          <Route path="export" element={<ExportForm />} />
          <Route path="return" element={<ReturnForm />} />
          <Route path="events" element={<Events />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
