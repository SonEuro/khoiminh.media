import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { StaffGroupsProvider } from './contexts/StaffGroupsContext';
import { subscribePush } from './utils/pushSubscribe';
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
import WorkSchedule from './pages/WorkSchedule';
import NccAdmin from './pages/NccAdmin';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user, can } = useAuth();
  useEffect(() => { if (user) subscribePush(); }, [user]);
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="equipment" element={<Equipment />} />
        <Route path="export"   element={can('exportEvent') ? <ExportForm /> : <Navigate to="/" replace />} />
        <Route path="return"        element={can('intake') || can('confirmFix') ? <ReturnForm /> : <Navigate to="/" replace />} />
        <Route path="event-return"  element={can('returnEvent') ? <EventReturn /> : <Navigate to="/" replace />} />
        <Route path="events"   element={<Events />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="reports"    element={<Reports />} />
        <Route path="violations"    element={<ViolationReport />} />
        <Route path="event-report" element={<EventReport />} />
        <Route path="work-schedule" element={<WorkSchedule />} />
        <Route path="users"      element={can('manageUsers') ? <Users /> : <Navigate to="/" replace />} />
        <Route path="ncc-admin"  element={can('manageNcc') ? <NccAdmin /> : <Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StaffGroupsProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </StaffGroupsProvider>
    </AuthProvider>
  );
}
