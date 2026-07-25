import { useState, useEffect, useCallback } from 'react';
import { KM_STAFF_GROUPS } from '../constants/staff';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import AdminDashboard from '../components/dashboard/AdminDashboard';
import CongDashWidget from '../components/dashboard/CongDashWidget';

export default function Dashboard() {
  const { user } = useAuth();
  const [dash, setDash]             = useState(null);
  const [events, setEvents]         = useState([]);
  const [violations, setViolations] = useState([]);
  const [lockedObs, setLockedObs]   = useState([]);
  const [myObs, setMyObs]           = useState([]);
  const [loading, setLoading]       = useState(true);

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
      const yesterdayVN = (() => {
        const d = new Date(Date.now() + 7 * 3600 * 1000);
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().slice(0, 10);
      })();
      setMyObs(obs.filter(o => !o.submitted && !o.locked && o.assigned_date === yesterdayVN));
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
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e8c97a', margin: 0 }}>Trang Chủ</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Đang tải...</div>
      ) : !dash ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#f87171' }}>Không thể tải dữ liệu. Vui lòng thử lại.</div>
      ) : (
        <AdminDashboard dash={dash} events={events} violations={violations} lockedObs={lockedObs} myObs={myObs} onConfirmed={load} userName={user?.full_name || ''} user={user} />
      )}
      <CongDashWidget user={user} kmStaffGroups={KM_STAFF_GROUPS} />
    </div>
  );
}
