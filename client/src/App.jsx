import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { StaffGroupsProvider } from './contexts/StaffGroupsContext';
import { subscribePush } from './utils/pushSubscribe';
import { buildSlipHTML } from './utils/printSlip';
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
import VanHanhKeToan from './pages/VanHanhKeToan';

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
        <Route path="van-hanh-ke-toan" element={can('viewKeToan') ? <VanHanhKeToan /> : <Navigate to="/" replace />} />
        <Route path="users"      element={can('manageUsers') ? <Users /> : <Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function MobilePrintOverlay() {
  const [tx, setTx] = useState(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    const handler = e => setTx(e.detail);
    window.addEventListener('print-slip-mobile', handler);
    return () => window.removeEventListener('print-slip-mobile', handler);
  }, []);

  if (!tx) return null;

  const GOLD = '#e8c97a';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#1a1a2e', borderBottom: '2px solid #c9a84c', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ color: GOLD, fontWeight: 700, fontSize: '14px', fontFamily: 'sans-serif' }}>Phiếu {tx.code}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => iframeRef.current?.contentWindow?.print()}
            style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg,#b8922e,#e8c97a)', color: '#000', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'sans-serif' }}>
            🖨️ In phiếu
          </button>
          <button onClick={() => setTx(null)}
            style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'sans-serif' }}>
            ✕ Đóng
          </button>
        </div>
      </div>
      <iframe ref={iframeRef} srcDoc={buildSlipHTML(tx, false, null, true)}
        style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }} title="Phiếu in" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StaffGroupsProvider>
        <BrowserRouter>
          <AppRoutes />
          <MobilePrintOverlay />
        </BrowserRouter>
      </StaffGroupsProvider>
    </AuthProvider>
  );
}
