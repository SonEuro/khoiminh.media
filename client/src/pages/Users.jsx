import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import { fmtD } from '../utils/fmt';

const ROLES = [
  { value: 'DIRECTOR',   label: '🌟 Tổng Giám Đốc' },
  { value: 'SUPER_ADMIN', label: '👑 Giám Đốc Sản Xuất' },
  { value: 'PRODUCTION', label: '🏗️ Bộ Phận Sản Xuất' },
  { value: 'ACCOUNTING', label: '💰 Kế Toán' },
  { value: 'TECHNICAL',  label: '🛠️ Kỹ Thuật' },
  { value: 'ATAS',       label: '💡 ATAS – LED' },
  { value: 'STAGE',      label: '🎭 Sân Khấu' },
  { value: 'CSVC',       label: '🏢 Cơ Sở Vật Chất' },
];

const ROLE_COLORS = {
  DIRECTOR:    { bg: 'rgba(201,168,76,0.18)',  color: '#e8c97a', border: 'rgba(201,168,76,0.5)'  },
  SUPER_ADMIN: { bg: 'rgba(168,85,247,0.15)',  color: '#c084fc', border: 'rgba(168,85,247,0.35)' },
  PRODUCTION:  { bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa', border: 'rgba(96,165,250,0.35)' },
  ACCOUNTING:  { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24', border: 'rgba(251,191,36,0.35)' },
  TECHNICAL:   { bg: 'rgba(251,146,60,0.15)',  color: '#fb923c', border: 'rgba(251,146,60,0.35)' },
  ATAS:        { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80', border: 'rgba(74,222,128,0.35)' },
  STAGE:       { bg: 'rgba(244,114,182,0.15)', color: '#f472b6', border: 'rgba(244,114,182,0.35)' },
  CSVC:        { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: 'rgba(148,163,184,0.35)' },
};

const EMPTY = { username: '', password: '', full_name: '', position: '', role: 'ATAS', is_active: true, is_truong_phong: false, is_phan_lich: false, is_phan_lich_all: false, zalo_uid: '' };

export default function Users() {
  const { ROLE_LABELS, user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const [users, setUsers]       = useState([]);
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [editId, setEditId]     = useState(null);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const [resetInfo, setResetInfo]   = useState(null); // { name, username, password }
  const [clearing, setClearing]     = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [eventList, setEventList]     = useState([]);
  const [loadingEv, setLoadingEv]     = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting]       = useState(false);

  async function load() {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function openDeleteModal() {
    setDeleteModal(true);
    setSelectedIds(new Set());
    setLoadingEv(true);
    try {
      const [active, trash] = await Promise.all([api.getEvents({ include_archived: 1 }), api.getTrashEvents()]);
      setEventList([
        ...(active || []),
        ...(trash || []).map(e => ({ ...e, _inTrash: true })),
      ]);
    } catch (err) {
      alert('❌ ' + err.message);
      setDeleteModal(false);
    } finally {
      setLoadingEv(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`⚠️ Xóa ${selectedIds.size} sự kiện đã chọn?\n\nPhiếu xuất/nhập, báo cáo, vi phạm liên quan cũng bị xóa.\nTồn kho sẽ được hoàn trả.\n\nKHÔNG THỂ HOÀN TÁC.`)) return;
    if (!confirm(`⛔ XÁC NHẬN LẦN 2 — xóa vĩnh viễn ${selectedIds.size} sự kiện?`)) return;
    setDeleting(true);
    try {
      const data = await api.deleteEvents([...selectedIds]);
      alert('✅ ' + data.message);
      setDeleteModal(false);
    } catch (err) {
      alert('❌ Lỗi: ' + err.message);
    } finally {
      setDeleting(false);
    }
  }

  function openCreate() {
    setForm(EMPTY); setEditId(null); setError(''); setShowPw(false); setModal('edit');
  }
  function openEdit(u) {
    setForm({ username: u.username, password: '', full_name: u.full_name, position: u.position || '', role: u.role, is_active: !!u.is_active, is_truong_phong: !!u.is_truong_phong, is_phan_lich: !!u.is_phan_lich, is_phan_lich_all: !!u.is_phan_lich_all, zalo_uid: u.zalo_uid || '' });
    setEditId(u.id); setError(''); setShowPw(false); setModal('edit');
  }

  async function handleSave() {
    setError(''); setSaving(true);
    try {
      if (editId) {
        await api.updateUser(editId, form);
      } else {
        if (!form.username) { setError('Vui lòng nhập tên đăng nhập'); setSaving(false); return; }
        if (!form.password) { setError('Vui lòng nhập mật khẩu');      setSaving(false); return; }
        if (!form.full_name){ setError('Vui lòng nhập họ tên');         setSaving(false); return; }
        await api.createUser(form);
      }
      setModal(null); load();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  async function handleDelete(u) {
    if (!confirm(`Xóa tài khoản "${u.full_name}" (${u.username})?`)) return;
    try { await api.deleteUser(u.id); load(); }
    catch (err) { alert(err.message); }
  }

  async function handleReset(u) {
    if (!confirm(`Reset mật khẩu "${u.full_name}" về mặc định?`)) return;
    try {
      const res = await api.resetUserPassword(u.id);
      setResetInfo({ name: u.full_name, username: u.username, password: res.default_password });
    } catch (err) { alert(err.message); }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Người Dùng</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{users.length} tài khoản</p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'flex-end', flexShrink:0 }}>
          {isSuperAdmin && (
            <>
              {/* Download local */}
              <button type="button"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('km_token');
                    const res = await fetch('/api/backup', { headers: { Authorization: `Bearer ${token}` } });
                    if (!res.ok) { alert('Backup thất bại: ' + (await res.json()).error); return; }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `kho-khoiminh-backup-${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())}.db`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (err) { alert('Lỗi: ' + err.message); }
                }}
                style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'7px 14px', borderRadius:'8px', fontSize:'0.78rem', fontWeight:600, border:'1px solid rgba(74,222,128,0.35)', background:'rgba(74,222,128,0.08)', color:'#4ade80', cursor:'pointer', whiteSpace:'nowrap' }}
              >
                💾 Backup
              </button>

              {/* Google Drive */}
              <button type="button"
                onClick={async (e) => {
                  const btn = e.currentTarget;
                  btn.disabled = true;
                  btn.textContent = '⏳ Uploading...';
                  try {
                    const token = localStorage.getItem('km_token');
                    const res = await fetch('/api/backup/gdrive', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    if (confirm(`✅ Backup thành công!\n\nFile: ${data.name}\n\nMở Google Drive?`)) {
                      window.open(data.link, '_blank');
                    }
                  } catch (err) {
                    alert('❌ ' + err.message);
                  } finally {
                    btn.disabled = false;
                    btn.textContent = '☁️ Drive';
                  }
                }}
                style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'7px 14px', borderRadius:'8px', fontSize:'0.78rem', fontWeight:600, border:'1px solid rgba(96,165,250,0.35)', background:'rgba(96,165,250,0.08)', color:'#60a5fa', cursor:'pointer', whiteSpace:'nowrap' }}
              >
                ☁️ Drive
              </button>
            </>
          )}
          {isSuperAdmin && (
            <button className="btn-primary btn-sm" style={{ whiteSpace:'nowrap' }} onClick={openCreate}>+ Thêm tài khoản</button>
          )}
        </div>
      </div>

      {/* ── Desktop: Table ── */}
      <div className="card p-0 overflow-hidden hide-mobile">
        <div className="table-wrap">
          <table className="w-full text-sm" style={{ minWidth: '600px' }}>
            <thead>
              <tr>
                <th className="text-center px-4 py-3">Họ tên</th>
                <th className="text-center px-4 py-3">Chức vụ</th>
                <th className="text-center px-4 py-3">Tên đăng nhập</th>
                <th className="text-center px-4 py-3">Phòng ban</th>
                <th className="text-center px-4 py-3">Trạng thái</th>
                <th className="text-center px-4 py-3">Ngày tạo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const rc = ROLE_COLORS[u.role] || ROLE_COLORS.CSVC;
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3 text-center" style={{ fontWeight: 600, color: '#c9a84c' }}>{u.full_name}</td>
                    <td className="px-4 py-3 text-center" style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{u.position || '—'}</td>
                    <td className="px-4 py-3 text-center" style={{ fontFamily: 'monospace', color: 'var(--gold)', fontSize: '0.85rem' }}>{u.username}</td>
                    <td className="px-4 py-3 text-center">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700,
                          background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`,
                          whiteSpace: 'nowrap', display: 'inline-block',
                        }}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                        {u.is_truong_phong ? (
                          <span style={{ fontSize: '0.65rem', color: '#2dd4bf', fontWeight: 600 }}>🏅 Trưởng phòng</span>
                        ) : null}
                        {u.is_phan_lich ? (
                          <span style={{ fontSize: '0.65rem', color: '#60a5fa', fontWeight: 600 }}>🗓 Phân lịch</span>
                        ) : null}
                        {u.is_phan_lich_all ? (
                          <span style={{ fontSize: '0.65rem', color: '#f97316', fontWeight: 600 }}>📋 Phân lịch tất cả</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.is_active
                        ? <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.8rem' }}>● Hoạt động</span>
                        : <span style={{ color: '#f87171', fontWeight: 600, fontSize: '0.8rem' }}>● Vô hiệu</span>}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{fmtD(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end" style={{ minWidth: '80px' }}>
                        <button className="btn-secondary btn-sm" onClick={() => openEdit(u)}>✏️ Sửa</button>
                        {isSuperAdmin && (
                          <button className="btn-sm" onClick={() => handleReset(u)}
                            style={{ padding:'7px 12px', borderRadius:'7px', fontSize:'0.78rem', fontWeight:600, border:'1px solid rgba(251,191,36,0.4)', background:'rgba(251,191,36,0.1)', color:'#fbbf24', cursor:'pointer' }}
                            title="Reset mật khẩu về mặc định">
                            🔑
                          </button>
                        )}
                        <button className="btn-danger btn-sm" onClick={() => handleDelete(u)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Chưa có tài khoản nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile: Card list ── */}
      <div className="show-mobile" style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {users.length === 0 && (
          <p style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)' }}>Chưa có tài khoản nào</p>
        )}
        {users.map(u => {
          const rc = ROLE_COLORS[u.role] || ROLE_COLORS.CSVC;
          return (
            <div key={u.id} style={{ background:'var(--bg-card)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'14px' }}>
              {/* Dòng 1: Tên + Trạng thái */}
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' }}>
                <span style={{ flex:1, fontWeight:700, color:'#c9a84c', fontSize:'0.95rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.full_name}</span>
                {u.is_active
                  ? <span style={{ color:'#4ade80', fontWeight:700, fontSize:'0.72rem', flexShrink:0 }}>● Hoạt động</span>
                  : <span style={{ color:'#f87171', fontWeight:700, fontSize:'0.72rem', flexShrink:0 }}>● Vô hiệu</span>}
              </div>
              {/* Dòng 2: Username + Badge */}
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
                <span style={{ fontFamily:'monospace', fontSize:'0.82rem', color:'var(--gold)' }}>{u.username}</span>
                <span style={{ padding:'2px 10px', borderRadius:'9999px', fontSize:'0.68rem', fontWeight:700, background:rc.bg, color:rc.color, border:`1px solid ${rc.border}`, whiteSpace:'nowrap' }}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>
                {u.is_truong_phong && <span style={{ fontSize:'0.65rem', color:'#2dd4bf', fontWeight:600 }}>🏅</span>}
                {u.is_phan_lich && <span style={{ fontSize:'0.65rem', color:'#60a5fa', fontWeight:600 }}>🗓</span>}
              </div>
              {/* Dòng 3: Chức vụ (nếu có) */}
              {u.position && <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'10px' }}>{u.position}</p>}
              {/* Dòng 4: Actions */}
              <div style={{ display:'flex', gap:'8px' }}>
                <button className="btn-secondary btn-sm" style={{ flex:1 }} onClick={() => openEdit(u)}>✏️ Sửa</button>
                {isSuperAdmin && (
                  <button onClick={() => handleReset(u)}
                    style={{ padding:'8px 14px', borderRadius:'8px', fontSize:'0.78rem', fontWeight:600, border:'1px solid rgba(251,191,36,0.4)', background:'rgba(251,191,36,0.1)', color:'#fbbf24', cursor:'pointer' }}
                    title="Reset mật khẩu">
                    🔑
                  </button>
                )}
                <button className="btn-danger btn-sm" style={{ padding:'8px 14px' }} onClick={() => handleDelete(u)}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Danger Zone (SUPER_ADMIN only) ── */}
      {isSuperAdmin && (
        <div style={{
          marginTop: '32px', padding: '20px', borderRadius: '12px',
          border: '1px solid rgba(248,113,113,0.35)',
          background: 'rgba(248,113,113,0.04)',
        }}>
          <p style={{ color: '#f87171', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
            ⚠️ Khu vực nguy hiểm
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '14px' }}>
            Xóa sự kiện, phiếu xuất/nhập, báo cáo, vi phạm. Dữ liệu thiết bị và tài khoản được giữ nguyên. <strong style={{ color: '#f87171' }}>Không thể hoàn tác.</strong>
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={openDeleteModal}
              style={{
                padding: '9px 20px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700,
                border: '1px solid rgba(248,113,113,0.5)',
                background: 'rgba(248,113,113,0.15)',
                color: '#f87171', cursor: 'pointer',
              }}
            >
              📋 Chọn sự kiện để xóa
            </button>
            <button
              disabled={clearing}
              onClick={async () => {
                const first = confirm('⚠️ XÓA TOÀN BỘ SỰ KIỆN?\n\nSẽ xóa:\n• Tất cả sự kiện\n• Phiếu xuất / nhập kho\n• Báo cáo sự kiện\n• Vi phạm nội quy\n• Reset tồn kho về ban đầu\n\nNhấn OK để xác nhận lần 1...');
                if (!first) return;
                const second = confirm('⛔ XÁC NHẬN LẦN 2\n\nThao tác này KHÔNG THỂ HOÀN TÁC.\n\nBạn có chắc chắn muốn xóa tất cả không?');
                if (!second) return;
                setClearing(true);
                try {
                  const data = await api.clearAllEvents();
                  alert('✅ ' + data.message);
                } catch (err) {
                  alert('❌ Lỗi: ' + err.message);
                } finally {
                  setClearing(false);
                }
              }}
              style={{
                padding: '9px 20px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700,
                border: '1px solid rgba(248,113,113,0.5)',
                background: clearing ? 'rgba(248,113,113,0.1)' : 'rgba(248,113,113,0.15)',
                color: '#f87171', cursor: clearing ? 'not-allowed' : 'pointer',
                opacity: clearing ? 0.6 : 1,
              }}
            >
              {clearing ? '⏳ Đang xóa...' : '🗑 Xóa sạch toàn bộ sự kiện'}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal chọn sự kiện để xóa ── */}
      {deleteModal && (
        <Modal title="Chọn Sự Kiện Để Xóa" onClose={() => !deleting && setDeleteModal(false)} size="lg">
          {loadingEv ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>⏳ Đang tải...</p>
          ) : eventList.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>Không có sự kiện nào.</p>
          ) : (
            <>
              {/* Quick select */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'center' }}>
                <button
                  onClick={() => setSelectedIds(new Set(eventList.map(e => e.id)))}
                  style={{ fontSize: '0.78rem', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  Chọn tất cả
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  style={{ fontSize: '0.78rem', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  Bỏ chọn
                </button>
                <span style={{ fontSize: '0.8rem', color: selectedIds.size > 0 ? '#f87171' : 'var(--text-muted)', marginLeft: 'auto', fontWeight: selectedIds.size > 0 ? 700 : 400 }}>
                  {selectedIds.size > 0 ? `Đã chọn ${selectedIds.size} sự kiện` : `${eventList.length} sự kiện`}
                </span>
              </div>

              {/* Event list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'auto' }}>
                {eventList.map(ev => {
                  const checked = selectedIds.has(ev.id);
                  const STATUS = {
                    planned:   { label: 'Kế hoạch',   color: '#60a5fa' },
                    active:    { label: 'Đang diễn',  color: '#4ade80' },
                    completed: { label: 'Hoàn thành', color: '#94a3b8' },
                    cancelled: { label: 'Đã hủy',     color: '#f87171' },
                  };
                  const st = ev._inTrash
                    ? { label: '🗑 Thùng rác', color: '#f97316' }
                    : ev.archived_at
                      ? { label: '📦 Lưu trữ', color: '#a78bfa' }
                      : (STATUS[ev.status] || { label: ev.status, color: '#94a3b8' });
                  return (
                    <label
                      key={ev.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                        borderRadius: '8px', cursor: 'pointer',
                        border: `1px solid ${checked ? 'rgba(248,113,113,0.5)' : 'var(--border)'}`,
                        background: checked ? 'rgba(248,113,113,0.07)' : 'var(--surface-2)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(ev.id)) next.delete(ev.id);
                          else next.add(ev.id);
                          return next;
                        })}
                        style={{ width: '15px', height: '15px', accentColor: '#f87171', flexShrink: 0 }}
                      />
                      <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0, minWidth: '80px' }}>
                        {ev.code}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.name}
                      </span>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '99px',
                        color: st.color, background: st.color + '22', flexShrink: 0,
                      }}>
                        {st.label}
                      </span>
                      {ev.start_date && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {fmtD(ev.start_date)}
                        </span>
                      )}
                      {ev.tx_count > 0 && (
                        <span style={{ fontSize: '0.72rem', color: '#fbbf24', flexShrink: 0 }}>
                          {ev.tx_count} phiếu
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                <button
                  disabled={selectedIds.size === 0 || deleting}
                  onClick={handleDeleteSelected}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', fontWeight: 700, fontSize: '0.88rem',
                    border: '1px solid rgba(248,113,113,0.5)',
                    background: selectedIds.size === 0 ? 'rgba(248,113,113,0.05)' : 'rgba(248,113,113,0.2)',
                    color: '#f87171',
                    cursor: selectedIds.size === 0 || deleting ? 'not-allowed' : 'pointer',
                    opacity: selectedIds.size === 0 || deleting ? 0.5 : 1,
                  }}
                >
                  {deleting ? '⏳ Đang xóa...' : `🗑 Xóa ${selectedIds.size > 0 ? selectedIds.size + ' ' : ''}sự kiện đã chọn`}
                </button>
                <button
                  onClick={() => setDeleteModal(false)}
                  disabled={deleting}
                  style={{
                    padding: '10px 20px', borderRadius: '8px', fontSize: '0.88rem',
                    border: '1px solid var(--border)', background: 'var(--surface-2)',
                    color: 'var(--text-muted)', cursor: deleting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Đóng
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {modal === 'edit' && (
        <Modal title={editId ? 'Chỉnh Sửa Tài Khoản' : 'Thêm Tài Khoản'} onClose={() => setModal(null)}>
          <div className="space-y-4">

            <div>
              <label className="label">Họ và tên *</label>
              <input className="input bold-input" value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
                placeholder="Nguyễn Văn A" />
            </div>

            <div>
              <label className="label">Chức vụ</label>
              <select className="input" value={form.position}
                onChange={e => {
                  const pos = e.target.value;
                  setForm(f => ({
                    ...f,
                    position: pos,
                    role: pos === 'Super Man' ? 'SUPER_ADMIN' : f.role,
                  }));
                }}
                style={{ color: form.position ? '#f87171' : 'var(--text-muted)', fontWeight: form.position ? 700 : 400 }}>
                <option value="">-- Chọn chức vụ --</option>
                <option value="Tổng Giám đốc">🌟 Tổng Giám đốc</option>
                <option value="Giám đốc">👑 Giám đốc</option>
                <option value="Trưởng phòng">Trưởng Phòng</option>
                <option value="Nhân viên">Nhân viên</option>
                <option value="Super Man">🦸 Super Man</option>
              </select>
            </div>

            <div>
              <label className="label">Tên đăng nhập *</label>
              <input className="input bold-input" value={form.username}
                onChange={e => set('username', e.target.value)}
                placeholder="username"
                style={{ fontFamily: 'monospace' }}
                autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            </div>

            <div>
              <label className="label">
                Mật khẩu {editId ? <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(bỏ trống = giữ nguyên)</span> : '*'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input bold-input"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="••••••••"
                  autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  style={{ paddingRight: '44px' }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: '1rem',
                  }}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Phòng ban / Vai trò *</label>
              <select className="input" value={form.role} onChange={e => set('role', e.target.value)}
                style={{ color: '#f87171', fontWeight: 700 }}>
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {editId && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active}
                  onChange={e => set('is_active', e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--gold)' }} />
                <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Tài khoản đang hoạt động</span>
              </label>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.is_truong_phong}
                onChange={e => set('is_truong_phong', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#2dd4bf' }} />
              <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                🏅 Trưởng phòng <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(có quyền hủy sự kiện &amp; xem thùng rác)</span>
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.is_phan_lich}
                onChange={e => set('is_phan_lich', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#60a5fa' }} />
              <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                🗓 Phân lịch làm việc <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(tạo &amp; sửa lịch nháp bộ phận mình)</span>
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.is_phan_lich_all}
                onChange={e => set('is_phan_lich_all', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#f97316' }} />
              <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                📋 Phân lịch tất cả <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(tạo, sửa, xác nhận tất cả lịch + chọn nhân sự tất cả bộ phận)</span>
              </span>
            </label>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                Zalo User ID <span style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 400, textTransform: 'none' }}>(để nhận thông báo Zalo)</span>
              </label>
              <input className="input" placeholder="Nhập Zalo User ID..."
                value={form.zalo_uid || ''} onChange={e => set('zalo_uid', e.target.value)}
                style={{ fontSize: '0.88rem' }} />
            </div>

            {error && (
              <p style={{ color: '#f87171', fontSize: '0.85rem', background: 'rgba(248,113,113,0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)' }}>
                ⚠️ {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Đang lưu...' : (editId ? '💾 Cập nhật' : '+ Tạo tài khoản')}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary">Hủy</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset password result modal */}
      {resetInfo && (
        <Modal title="Reset mật khẩu thành công" onClose={() => setResetInfo(null)} size="sm">
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔑</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Mật khẩu của <strong style={{ color: 'var(--text-primary)' }}>{resetInfo.name}</strong> đã được reset về mặc định.
            </p>
            <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid var(--gold-dim)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Thông tin đăng nhập</p>
              <p style={{ color: 'var(--gold)', fontFamily: 'monospace', fontSize: '1rem', marginBottom: '4px' }}>
                👤 {resetInfo.username}
              </p>
              <p style={{ color: '#4ade80', fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 700 }}>
                🔒 {resetInfo.password}
              </p>
            </div>
            <p style={{ color: '#fbbf24', fontSize: '0.78rem' }}>⚠️ Vui lòng thông báo cho người dùng đổi mật khẩu sau khi đăng nhập.</p>
            <button onClick={() => setResetInfo(null)} className="btn-primary" style={{ marginTop: '16px', width: '100%' }}>
              Đã hiểu
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
