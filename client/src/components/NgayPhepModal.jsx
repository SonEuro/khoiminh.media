import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const GOLD = '#c9a84c';

function fmtN(n) {
  if (!n) return '0';
  return n % 1 === 0 ? String(n) : parseFloat(n.toFixed(1)).toString();
}

function fmtNgay(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function EditPanel({ user, month, onSaved, onClose }) {
  const [phepNam, setPhepNam]   = useState(String(user.phep_nam));
  const [records, setRecords]   = useState([]);
  const [addDate, setAddDate]   = useState('');
  const [addSo, setAddSo]       = useState('1');
  const [addNote, setAddNote]   = useState('');
  const [saving, setSaving]     = useState(false);

  const loadRecords = useCallback(() => {
    api.getNgayPhepRecords(user.id).then(setRecords).catch(() => {});
  }, [user.id]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  async function savePhepNam() {
    setSaving(true);
    try {
      await api.updatePhepNam(user.id, Number(phepNam));
      onSaved();
    } finally { setSaving(false); }
  }

  async function addRecord() {
    if (!addDate) return;
    setSaving(true);
    try {
      await api.addNgayPhepRecord({ user_id: user.id, ngay: addDate, so_ngay: Number(addSo), ghi_chu: addNote });
      setAddDate(''); setAddSo('1'); setAddNote('');
      loadRecords();
      onSaved();
    } finally { setSaving(false); }
  }

  async function delRecord(id) {
    if (!window.confirm('Xoá ngày nghỉ này?')) return;
    await api.deleteNgayPhepRecord(id);
    loadRecords();
    onSaved();
  }

  const inS = { padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#eeeef5', fontSize: '0.82rem', outline: 'none' };
  const btnS = (c) => ({ padding: '4px 10px', borderRadius: '5px', border: `1px solid ${c}44`, background: `${c}18`, color: c, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' });

  return (
    <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', padding: '14px 16px', marginTop: '4px' }}>
      {/* Số phép năm */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <span style={{ fontSize: '0.78rem', color: '#a08040', fontWeight: 600 }}>Số Phép Năm:</span>
        <input type="number" min="0" max="365" value={phepNam} onChange={e => setPhepNam(e.target.value)}
          style={{ ...inS, width: '64px', textAlign: 'center' }} />
        <button onClick={savePhepNam} disabled={saving} style={btnS(GOLD)}>Lưu</button>
        <button onClick={onClose} style={{ ...btnS('#7878a0'), marginLeft: 'auto' }}>✕ Đóng</button>
      </div>

      {/* Thêm ngày nghỉ */}
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7878a0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Thêm Ngày Nghỉ</div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
        <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} style={inS} />
        <select value={addSo} onChange={e => setAddSo(e.target.value)} style={{ ...inS, width: '80px' }}>
          <option value="0.5">0.5 ngày</option>
          <option value="1">1 ngày</option>
        </select>
        <input type="text" placeholder="Ghi chú..." value={addNote} onChange={e => setAddNote(e.target.value)}
          style={{ ...inS, flex: 1, minWidth: '120px' }} />
        <button onClick={addRecord} disabled={saving || !addDate} style={btnS('#4ade80')}>+ Thêm</button>
      </div>

      {/* Danh sách ngày nghỉ */}
      {records.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {['Ngày', 'Số Ngày', 'Ghi Chú', ''].map(h => (
                <th key={h} style={{ padding: '4px 6px', color: '#7878a0', fontWeight: 600, textAlign: 'left', fontSize: '0.70rem' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '5px 6px', color: '#f97316', fontWeight: 700 }}>{fmtNgay(r.ngay)}</td>
                <td style={{ padding: '5px 6px', color: '#eeeef5', textAlign: 'center' }}>{fmtN(r.so_ngay)}</td>
                <td style={{ padding: '5px 6px', color: '#a0a0c0' }}>{r.ghi_chu || '—'}</td>
                <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                  <button onClick={() => delRecord(r.id)} style={{ ...btnS('#f87171'), padding: '2px 7px' }}>Xoá</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ fontSize: '0.80rem', color: '#555570', padding: '4px 0' }}>Chưa có ngày nghỉ nào trong năm.</div>
      )}
    </div>
  );
}

const DEPT_ORDER = ['ATAS-LED', 'Sân Khấu', 'Kỹ Thuật', 'Cơ Sở Vật Chất', 'Kế Toán', 'Kinh Doanh'];

export default function NgayPhepModal({ onClose, month }) {
  const year = month ? month.slice(0, 4) : String(new Date().getFullYear());
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getNgayPhep(year, month);
      setUsers(data);
    } finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  // Sort by dept order then name
  const sorted = [...users].sort((a, b) => {
    const ia = DEPT_ORDER.indexOf(a.dept), ib = DEPT_ORDER.indexOf(b.dept);
    const da = ia < 0 ? 99 : ia, db2 = ib < 0 ? 99 : ib;
    if (da !== db2) return da - db2;
    return a.full_name.localeCompare(b.full_name, 'vi');
  });

  // Re-number after sort
  sorted.forEach((u, i) => { u.stt = i + 1; });

  const thS = { padding: '8px 10px', fontSize: '0.68rem', fontWeight: 700, color: '#7878a0', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap', textAlign: 'center' };
  const tdS = { padding: '8px 10px', fontSize: '0.84rem', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle', textAlign: 'center' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ background: '#13131f', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '12px', width: '100%', maxWidth: '900px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'linear-gradient(135deg,rgba(201,168,76,0.1) 0%,transparent 100%)', borderRadius: '12px 12px 0 0' }}>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: GOLD, letterSpacing: '0.04em', flex: 1 }}>
            📅 NGÀY PHÉP — NĂM {year}
          </span>
          {month && <span style={{ fontSize: '0.80rem', color: '#7878a0' }}>Nghỉ tháng {month.split('-')[1]}/{year}</span>}
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#7878a0', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Đang tải...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ ...thS, textAlign: 'left', width: '36px' }}>STT</th>
                    <th style={{ ...thS, textAlign: 'left' }}>Bộ Phận</th>
                    <th style={{ ...thS, textAlign: 'left' }}>Họ Tên</th>
                    <th style={thS}>Phép Năm</th>
                    <th style={thS}>Đã Nghỉ</th>
                    <th style={thS}>Tháng Này</th>
                    <th style={thS}>Còn Lại</th>
                    <th style={{ ...thS, width: '60px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(u => (
                    <>
                      <tr key={u.id}
                        style={{ background: editingId === u.id ? 'rgba(201,168,76,0.06)' : 'transparent' }}
                        onMouseEnter={e => { if (editingId !== u.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                        onMouseLeave={e => { if (editingId !== u.id) e.currentTarget.style.background = 'transparent'; }}>
                        <td style={{ ...tdS, color: '#555570', fontSize: '0.75rem' }}>{u.stt}</td>
                        <td style={{ ...tdS, textAlign: 'left', fontSize: '0.78rem', color: '#9090b8' }}>{u.dept}</td>
                        <td style={{ ...tdS, textAlign: 'left', fontWeight: 600, color: '#eeeef5' }}>{u.full_name}</td>
                        <td style={{ ...tdS, color: GOLD, fontWeight: 700 }}>{fmtN(u.phep_nam)}</td>
                        <td style={{ ...tdS, color: u.da_nghi > 0 ? '#f87171' : '#555570', fontWeight: u.da_nghi > 0 ? 700 : 400 }}>{fmtN(u.da_nghi)}</td>
                        <td style={{ ...tdS, color: u.nghi_thang > 0 ? '#fb923c' : '#555570', fontWeight: u.nghi_thang > 0 ? 700 : 400 }}>{fmtN(u.nghi_thang)}</td>
                        <td style={{ ...tdS, color: u.con_lai < 0 ? '#f87171' : u.con_lai <= 3 ? '#fb923c' : '#4ade80', fontWeight: 700 }}>{fmtN(u.con_lai)}</td>
                        <td style={{ ...tdS }}>
                          <button
                            onClick={() => setEditingId(editingId === u.id ? null : u.id)}
                            style={{ padding: '4px 10px', borderRadius: '5px', border: `1px solid ${editingId === u.id ? GOLD : 'rgba(255,255,255,0.12)'}44`, background: editingId === u.id ? `${GOLD}18` : 'rgba(255,255,255,0.04)', color: editingId === u.id ? GOLD : '#9090b8', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
                            {editingId === u.id ? 'Xong' : 'Sửa'}
                          </button>
                        </td>
                      </tr>
                      {editingId === u.id && (
                        <tr key={`edit-${u.id}`}>
                          <td colSpan={8} style={{ padding: '4px 10px 12px' }}>
                            <EditPanel user={u} month={month} onSaved={load} onClose={() => setEditingId(null)} />
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
