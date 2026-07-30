import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import AdminDashboard from '../components/dashboard/AdminDashboard';
import CongDashWidget from '../components/dashboard/CongDashWidget';
import StaffTodayWidget from '../components/dashboard/StaffTodayWidget';

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 16px',
      borderRadius: '6px 6px 0 0',
      border: 'none',
      borderBottom: active ? '2px solid #c9a84c' : '2px solid transparent',
      cursor: 'pointer',
      fontWeight: active ? 700 : 500,
      fontSize: '0.83rem',
      background: active ? 'rgba(201,168,76,0.10)' : 'transparent',
      color: active ? '#c9a84c' : '#7878a0',
      transition: 'all 0.15s',
    }}>
      {children}
    </button>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [dash, setDash]             = useState(null);
  const [events, setEvents]         = useState([]);
  const [violations, setViolations] = useState([]);
  const [lockedObs, setLockedObs]   = useState([]);
  const [myObs, setMyObs]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState('overview');

  const load = useCallback(async () => {
    try {
      const [d, evs] = await Promise.all([api.getDashboard(), api.getEvents()]);
      setDash(d);
      setEvents(evs);
    } catch { /* dash stays null, handled in render */ } finally {
      setLoading(false);
    }
    api.getViolations().then(vs => setViolations(vs)).catch(() => {});
    api.getLeadObligations().then(obs => {
      setLockedObs(obs.filter(o => o.locked && !o.submitted));
      const todayVN = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
      setMyObs(obs.filter(o => !o.submitted && o.assigned_date <= todayVN));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e8c97a', margin: '0 0 10px' }}>Trang Chủ</h1>
        <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Tổng Quan</TabBtn>
          <TabBtn active={tab === 'nhansu'} onClick={() => setTab('nhansu')}>Nhân Sự Hôm Nay & Ngày Mai</TabBtn>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Đang tải...</div>
      ) : !dash ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#f87171' }}>Không thể tải dữ liệu. Vui lòng thử lại.</div>
      ) : tab === 'overview' ? (
        <>
          <AdminDashboard dash={dash} events={events} violations={violations} lockedObs={lockedObs} myObs={myObs} onConfirmed={load} userName={user?.full_name || ''} user={user} />
          <CongDashWidget user={user} />
        </>
      ) : (
        <StaffTodayWidget dash={dash} />
      )}
    </div>
  );
}
