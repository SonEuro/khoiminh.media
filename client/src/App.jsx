import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Equipment from './pages/Equipment';
import ExportForm from './pages/ExportForm';
import ReturnForm from './pages/ReturnForm';
import EventReturn from './pages/EventReturn';
import Events from './pages/Events';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Users from './pages/Users';
import ViolationReport from './pages/ViolationReport';
import EventReport from './pages/EventReport';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user, can } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="equipment" element={<Equipment />} />
        <Route path="export"   element={can('transact') ? <ExportForm /> : <Navigate to="/" replace />} />
        <Route path="return"        element={can('transact') ? <ReturnForm />   : <Navigate to="/" replace />} />
        <Route path="event-return"  element={can('transact') ? <EventReturn /> : <Navigate to="/" replace />} />
        <Route path="events"   element={<Events />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="reports"    element={<Reports />} />
        <Route path="violations"    element={<ViolationReport />} />
        <Route path="event-report" element={<EventReport />} />
        <Route path="users"      element={can('manageUsers') ? <Users /> : <Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
