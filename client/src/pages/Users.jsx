import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';

const ROLES = [
  { value: 'SUPER_ADMIN', label: '👑 Giám Đốc Sản Xuất' },
  { value: 'PRODUCTION',  label: '🏗️ Bộ Phận Sản Xuất' },
  { value: 'ACCOUNTING',  label: '💰 Kế Toán' },
  { value: 'TECHNICAL',   label: '🛠️ Kỹ Thuật' },
  { value: 'ATAS',        label: '💡 ATAS – LED' },
  { value: 'STAGE',       label: '🎭 Sân Khấu' },
  { value: 'CSVC',        label: '🏢 Cơ Sở Vật Chất' },
];

const ROLE_COLORS = {
  SUPER_ADMIN: { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', border: 'rgba(168,85,247,0.35)' },
  PRODUCTION:  { bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa', border: 'rgba(96,165,250,0.35)' },
  ACCOUNTING:  { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24', border: 'rgba(251,191,36,0.35)' },
  TECHNICAL:   { bg: 'rgba(251,146,60,0.15)',  color: '#fb923c', border: 'rgba(251,146,60,0.35)' },
  ATAS:        { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80', border: 'rgba(74,222,128,0.35)' },
  STAGE:       { bg: 'rgba(244,114,182,0.15)', color: '#f472b6', border: 'rgba(244,114,182,0.35)' },
  CSVC:        { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: 'rgba(148,163,184,0.35)' },
};

const EMPTY = { username: '', password: '', full_name: '', position: '', role: 'ATAS', is_active: true };

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
  const [resetInfo, setResetInfo] = useState(null); // { name, username, password }

  async function load() {
    const data = await api.getUsers();
    setUsers(data);
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(EMPTY); setEditId(null); setError(''); setShowPw(false); setModal('edit');
  }
  function openEdit(u) {
    setForm({ username: u.username, password: '', full_name: u.full_name, position: u.position || '', role: u.role, is_active: !!u.is_active });
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Người Dùng</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{users.length} tài khoản</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
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
                    a.download = `kho-khoiminh-backup-${new Date().toISOString().slice(0,10)}.db`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (err) { alert('Lỗi: ' + err.message); }
                }}
                style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'10px 18px', borderRadius:'10px', fontSize:'0.85rem', fontWeight:600, border:'1px solid rgba(74,222,128,0.35)', background:'rgba(74,222,128,0.08)', color:'#4ade80', cursor:'pointer' }}
              >
                💾 Backup
              </button>

              {/* Google Drive */}
              <button type="button"
                onClick={async (e) => {
                  const btn = e.currentTarget;
                  btn.disabled = true;
                  btn.textContent = '⏳ Đang upload...';
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
                    btn.textContent = '☁️ Google Drive';
                  }
                }}
                style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'10px 18px', borderRadius:'10px', fontSize:'0.85rem', fontWeight:600, border:'1px solid rgba(96,165,250,0.35)', background:'rgba(96,165,250,0.08)', color:'#60a5fa', cursor:'pointer' }}
              >
                ☁️ Google Drive
              </button>
            </>
          )}
          {isSuperAdmin && (
            <button className="btn-primary" onClick={openCreate}>+ Thêm tài khoản</button>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="table-wrap">
          <table className="w-full text-sm" style={{ minWidth: '600px' }}>
            <thead>
              <tr>
                <th className="text-left px-4 py-3">Họ tên</th>
                <th className="text-left px-4 py-3">Chức vụ</th>
                <th className="text-left px-4 py-3">Tên đăng nhập</th>
                <th className="text-left px-4 py-3">Phòng ban</th>
                <th className="text-left px-4 py-3">Trạng thái</th>
                <th className="text-left px-4 py-3">Ngày tạo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const rc = ROLE_COLORS[u.role] || ROLE_COLORS.CSVC;
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3" style={{ fontWeight: 600, color: '#c9a84c' }}>{u.full_name}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{u.position || '—'}</td>
                    <td className="px-4 py-3" style={{ fontFamily: 'monospace', color: 'var(--gold)', fontSize: '0.85rem' }}>{u.username}</td>
                    <td className="px-4 py-3">
                      <span style={{
                        padding: '3px 10px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700,
                        background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`,
                        whiteSpace: 'nowrap', display: 'inline-block',
                      }}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_active
                        ? <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.8rem' }}>● Hoạt động</span>
                        : <span style={{ color: '#f87171', fontWeight: 600, fontSize: '0.8rem' }}>● Vô hiệu</span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{u.created_at?.slice(0, 10)}</td>
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
                    role: pos === 'Giám đốc' ? 'SUPER_ADMIN' : (f.role === 'SUPER_ADMIN' ? 'ATAS' : f.role),
                  }));
                }}
                style={{ color: form.position ? '#f87171' : 'var(--text-muted)', fontWeight: form.position ? 700 : 400 }}>
                <option value="">-- Chọn chức vụ --</option>
                <option value="Giám đốc">👑 Giám đốc</option>
                <option value="Trưởng phòng">Trưởng Phòng</option>
                <option value="Nhân viên">Nhân viên</option>
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

            {form.position === 'Giám đốc' ? (
              <div style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem' }}>
                <span style={{ color: '#c084fc', fontWeight: 700 }}>👑 Giám Đốc Sản Xuất</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '0.78rem' }}>— quyền cao nhất</span>
              </div>
            ) : (
              <div>
                <label className="label">Phòng ban *</label>
                <select className="input" value={form.role} onChange={e => set('role', e.target.value)}
                  style={{ color: '#f87171', fontWeight: 700 }}>
                  {ROLES.filter(r => r.value !== 'SUPER_ADMIN').map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            )}

            {editId && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active}
                  onChange={e => set('is_active', e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--gold)' }} />
                <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Tài khoản đang hoạt động</span>
              </label>
            )}

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
