import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0a14', color:'#c9a84c', gap:'16px', padding:'20px', textAlign:'center' }}>
        <img src="/logo.png" alt="Khôi Minh" style={{ width:'120px', opacity:0.8 }} />
        <p style={{ color:'#fff', fontSize:'0.9rem', margin:0 }}>Đã xảy ra lỗi. Vui lòng tải lại trang.</p>
        <button onClick={() => window.location.reload()} style={{ padding:'10px 24px', borderRadius:'8px', border:'none', background:'#c9a84c', color:'#000', fontWeight:700, fontSize:'0.9rem', cursor:'pointer' }}>Tải lại</button>
        <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.7rem', margin:0 }}>{this.state.error?.message}</p>
      </div>
    );
  }
}
import { StaffGroupsProvider } from './contexts/StaffGroupsContext';
import { subscribePush } from './utils/pushSubscribe';
import { buildSlipHTML } from './utils/printSlip';
import Layout from './components/Layout';
import Login from './pages/Login';

const Dashboard      = lazy(() => import('./pages/Dashboard'));
const Equipment      = lazy(() => import('./pages/Equipment'));
const ExportForm     = lazy(() => import('./pages/ExportForm'));
const ReturnForm     = lazy(() => import('./pages/ReturnForm'));
const EventReturn    = lazy(() => import('./pages/EventReturn'));
const Events         = lazy(() => import('./pages/Events'));
const Transactions   = lazy(() => import('./pages/Transactions'));
const Reports        = lazy(() => import('./pages/Reports'));
const Users          = lazy(() => import('./pages/Users'));
const ViolationReport = lazy(() => import('./pages/ViolationReport'));
const EventReport    = lazy(() => import('./pages/EventReport'));
const WorkSchedule   = lazy(() => import('./pages/WorkSchedule'));
const VanHanhKeToan  = lazy(() => import('./pages/VanHanhKeToan'));
const Chat           = lazy(() => import('./pages/Chat'));
const XacNhanCong    = lazy(() => import('./pages/XacNhanCong'));

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user, can } = useAuth();
  useEffect(() => { if (user) subscribePush(); }, [user]);
  return (
    <ErrorBoundary>
    <Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#c9a84c', fontSize:'0.9rem' }}>Đang tải...</div>}>
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
          <Route path="work-schedule" element={can('viewWorkSchedule') ? <WorkSchedule /> : <Navigate to="/" replace />} />
          <Route path="van-hanh-ke-toan" element={can('viewKeToan') ? <VanHanhKeToan /> : <Navigate to="/" replace />} />
          <Route path="xac-nhan-cong" element={can('viewXacNhanCong') ? <XacNhanCong /> : <Navigate to="/" replace />} />
          <Route path="chat"       element={<Chat />} />
          <Route path="users"      element={can('manageUsers') ? <Users /> : <Navigate to="/" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
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
