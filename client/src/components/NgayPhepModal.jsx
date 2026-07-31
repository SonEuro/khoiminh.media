import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const GOLD = '#c9a84c';

function fmtN(n) {
  if (!n && n !== 0) return '0';
  return n % 1 === 0 ? String(n) : parseFloat(n.toFixed(1)).toString();
}

function fmtNgay(d) {
  if (!d) return '';
  const [, m, day] = d.split('-');
  return `${day}/${m}`;
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return `Tháng ${parseInt(m, 10)}/${y}`;
}

// phep tích lũy đến đầu tháng M: mỗi tháng hoàn thành được phep_nam/12
// T7 → 6 tháng đã qua (T1-T6) → 6 ngày (với phep_nam=12)
function tichLuy(phep_nam, ym) {
  const monthNum = parseInt(ym.split('-')[1], 10);
  return Math.floor(phep_nam * (monthNum - 1) / 12);
}

function EditPanel({ user, onSaved, onClose }) {
  const [phepNam, setPhepNam] = useState(String(user.phep_nam));
  const [records, setRecords] = useState([]);
  const [addDate, setAddDate] = useState('');
  const [addSo, setAddSo]     = useState('1');
  const [addNote, setAddNote] = useState('');
  const [saving, setSaving]   = useState(false);

  const loadRecords = useCallback(() => {
    api.getNgayPhepRecords(user.id).then(setRecords).catch(() => {});
  }, [user.id]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  async function savePhepNam() {
    setSaving(true);
    try { await api.updatePhepNam(user.id, Number(phepNam)); onSaved(); }
    finally { setSaving(false); }
  }

  async function addRecord() {
    if (!addDate) return;
    setSaving(true);
    try {
      await api.addNgayPhepRecord({ user_id: user.id, ngay: addDate, so_ngay: Number(addSo), ghi_chu: addNote });
      setAddDate(''); setAddSo('1'); setAddNote('');
      loadRecords(); onSaved();
    } finally { setSaving(false); }
  }

  async function delRecord(id) {
    if (!window.confirm('Xoá ngày nghỉ này?')) return;
    await api.deleteNgayPhepRecord(id);
    loadRecords(); onSaved();
  }

  const inS = { padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#eeeef5', fontSize: '0.82rem', outline: 'none' };
  const btnS = (c) => ({ padding: '4px 10px', borderRadius: '5px', border: `1px solid ${c}44`, background: `${c}18`, color: c, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' });

  return (
    <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', padding: '14px 16px', marginTop: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <span style={{ fontSize: '0.78rem', color: '#a08040', fontWeight: 600 }}>Phép Năm (quota):</span>
        <input type="number" min="0" max="365" value={phepNam} onChange={e => setPhepNam(e.target.value)}
          style={{ ...inS, width: '64px', textAlign: 'center' }} />
        <button onClick={savePhepNam} disabled={saving} style={btnS(GOLD)}>Lưu</button>
        <button onClick={onClose} style={{ ...btnS('#7878a0'), marginLeft: 'auto' }}>✕ Đóng</button>
      </div>

      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7878a0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Thêm Ngày Nghỉ</div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
        <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} style={inS} />
        <select value={addSo} onChange={e => setAddSo(e.target.value)} style={{ ...inS, width: '88px' }}>
          <option value="0.5">0.5 ngày</option>
          <option value="1">1 ngày</option>
        </select>
        <input type="text" placeholder="Ghi chú..." value={addNote} onChange={e => setAddNote(e.target.value)}
          style={{ ...inS, flex: 1, minWidth: '120px' }} />
        <button onClick={addRecord} disabled={saving || !addDate} style={btnS('#4ade80')}>+ Thêm</button>
      </div>

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
                <td style={{ padding: '5px 6px', color: '#f97316', fontWeight: 700 }}>{fmtNgay(r.ngay)}/{r.ngay.slice(0,4)}</td>
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
        <div style={{ fontSize: '0.80rem', color: '#555570', padding: '4px 0' }}>Chưa có ngày nghỉ nào.</div>
      )}
    </div>
  );
}

const DEPT_ORDER = ['ATAS-LED', 'Sân Khấu', 'Kỹ Thuật', 'Cơ Sở Vật Chất', 'Kế Toán', 'Kinh Doanh'];

export default function NgayPhepModal({ onClose, month: initMonth }) {
  const todayYM = new Date().toISOString().slice(0, 7);
  const [month, setMonth]     = useState(initMonth || todayYM);
  const year = month.slice(0, 4);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getNgayPhep(year, month);
      setUsers(data);
    } finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const sorted = [...users].sort((a, b) => {
    const ia = DEPT_ORDER.indexOf(a.dept), ib = DEPT_ORDER.indexOf(b.dept);
    const da = ia < 0 ? 99 : ia, db2 = ib < 0 ? 99 : ib;
    if (da !== db2) return da - db2;
    return a.full_name.localeCompare(b.full_name, 'vi');
  });
  sorted.forEach((u, i) => { u.stt = i + 1; });

  const thS = { padding: '8px 8px', fontSize: '0.67rem', fontWeight: 700, color: '#7878a0', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap', textAlign: 'center' };
  const tdS = { padding: '8px 8px', fontSize: '0.83rem', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle', textAlign: 'center' };

  const monthNum = parseInt(month.split('-')[1], 10);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ background: '#13131f', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '12px', width: '100%', maxWidth: '980px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'linear-gradient(135deg,rgba(201,168,76,0.1) 0%,transparent 100%)', borderRadius: '12px 12px 0 0' }}>
          <span style={{ fontWeight: 800, color: GOLD, fontSize: '0.95rem', letterSpacing: '0.04em' }}>📅 NGÀY PHÉP</span>

          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
            <button onClick={() => setMonth(m => shiftMonth(m, -1))}
              style={{ background: 'transparent', border: 'none', color: '#c8c8e0', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, padding: '2px 8px', borderRadius: '5px' }}>‹</button>
            <span style={{ fontWeight: 700, color: '#e8c97a', fontSize: '0.88rem', minWidth: '110px', textAlign: 'center' }}>{monthLabel(month)}</span>
            <button onClick={() => setMonth(m => shiftMonth(m, 1))} disabled={month >= todayYM}
              style={{ background: 'transparent', border: 'none', color: month >= todayYM ? '#3a3a5a' : '#c8c8e0', cursor: month >= todayYM ? 'default' : 'pointer', fontSize: '1rem', fontWeight: 700, padding: '2px 8px', borderRadius: '5px' }}>›</button>
          </div>

          <span style={{ fontSize: '0.75rem', color: '#555570', marginLeft: 'auto' }}>
            Phép tích lũy = 1 ngày/tháng (tháng trước)
          </span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#7878a0', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px' }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Đang tải...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ ...thS, textAlign: 'left', width: '32px' }}>STT</th>
                    <th style={{ ...thS, textAlign: 'left' }}>Bộ Phận</th>
                    <th style={{ ...thS, textAlign: 'left' }}>Họ Tên</th>
                    <th style={{ ...thS }} title="Phép tích lũy đến đầu tháng này">Tích Lũy T{monthNum}</th>
                    <th style={thS}>Đã Nghỉ</th>
                    <th style={thS}>T{monthNum}</th>
                    <th style={thS}>Còn Lại</th>
                    <th style={{ ...thS, textAlign: 'left', minWidth: '140px' }}>Ngày Nghỉ T{monthNum}</th>
                    <th style={{ ...thS, width: '56px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(u => {
                    const tl = tichLuy(u.phep_nam, month);
                    const conLai = tl - u.da_nghi_to_month;
                    return (
                      <>
                        <tr key={u.id}
                          style={{ background: editingId === u.id ? 'rgba(201,168,76,0.06)' : 'transparent' }}
                          onMouseEnter={e => { if (editingId !== u.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                          onMouseLeave={e => { if (editingId !== u.id) e.currentTarget.style.background = 'transparent'; }}>
                          <td style={{ ...tdS, color: '#555570', fontSize: '0.74rem' }}>{u.stt}</td>
                          <td style={{ ...tdS, textAlign: 'left', fontSize: '0.77rem', color: '#8888b0' }}>{u.dept}</td>
                          <td style={{ ...tdS, textAlign: 'left', fontWeight: 600, color: '#eeeef5' }}>{u.full_name}</td>
                          <td style={{ ...tdS, color: GOLD, fontWeight: 700 }}>{tl}</td>
                          <td style={{ ...tdS, color: u.da_nghi_to_month > 0 ? '#f87171' : '#555570', fontWeight: u.da_nghi_to_month > 0 ? 700 : 400 }}>{fmtN(u.da_nghi_to_month)}</td>
                          <td style={{ ...tdS, color: u.nghi_thang > 0 ? '#fb923c' : '#555570', fontWeight: u.nghi_thang > 0 ? 700 : 400 }}>{fmtN(u.nghi_thang)}</td>
                          <td style={{ ...tdS, color: conLai < 0 ? '#f87171' : conLai <= 2 ? '#fb923c' : '#4ade80', fontWeight: 700 }}>{fmtN(conLai)}</td>
                          <td style={{ ...tdS, textAlign: 'left' }}>
                            {(u.nghi_thang_dates || []).length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                {(u.nghi_thang_dates || []).map((d, i) => (
                                  <span key={i} style={{ fontSize: '0.72rem', color: '#f97316', fontWeight: 600, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '4px', padding: '1px 5px', whiteSpace: 'nowrap' }}>
                                    {fmtNgay(d.ngay)}{d.so_ngay < 1 ? ` (${d.so_ngay})` : ''}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#3a3a5a', fontSize: '0.75rem' }}>—</span>
                            )}
                          </td>
                          <td style={tdS}>
                            <button
                              onClick={() => setEditingId(editingId === u.id ? null : u.id)}
                              style={{ padding: '4px 10px', borderRadius: '5px', border: `1px solid ${editingId === u.id ? GOLD : 'rgba(255,255,255,0.1)'}44`, background: editingId === u.id ? `${GOLD}18` : 'rgba(255,255,255,0.03)', color: editingId === u.id ? GOLD : '#8888b0', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
                              {editingId === u.id ? 'Xong' : 'Sửa'}
                            </button>
                          </td>
                        </tr>
                        {editingId === u.id && (
                          <tr key={`edit-${u.id}`}>
                            <td colSpan={9} style={{ padding: '4px 10px 12px' }}>
                              <EditPanel user={u} onSaved={load} onClose={() => setEditingId(null)} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
