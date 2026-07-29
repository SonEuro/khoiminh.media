import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useStaffGroups } from '../contexts/StaffGroupsContext';
import Modal from '../components/Modal';
import { fmtD } from '../utils/fmt';
import { DEPARTMENTS, KM_STAFF_GROUPS } from '../constants/staff';

const FREELANCER_DEPTS = ['ATAS-LED', 'Sân Khấu', 'Kỹ Thuật', 'Quay Phim', 'Sản Xuất'];

const ROLES = [
  { value: 'DIRECTOR',   label: '🌟 Tổng Giám Đốc' },
  { value: 'SUPER_ADMIN', label: '👑 Giám Đốc Sản Xuất' },
  { value: 'PRODUCTION', label: '🏗️ Bộ Phận Sản Xuất' },
  { value: 'ACCOUNTING', label: '💰 Kế Toán' },
  { value: 'TECHNICAL',  label: '🛠️ Kỹ Thuật' },
  { value: 'ATAS',       label: '💡 ATAS-LED' },
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

const EMPTY = { username: '', password: '', full_name: '', position: '', role: 'ATAS', is_active: true, is_phan_lich: false, is_phan_lich_all: false, is_tra_ncc: false, is_quan_ly_kho: false, is_giam_doc: false, is_van_hanh_ke_toan: false, zalo_uid: '', luong_co_ban: '', luong_ngay_cong: '', luong_ot_h: '', bac_luong: '' };

export default function Users() {
  const { ROLE_LABELS, user: currentUser } = useAuth();
  const { kmGroups, freelancerGroups, refresh: refreshStaff } = useStaffGroups();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(currentUser?.role);
  const [users, setUsers]       = useState([]);
  const [deleteLog, setDeleteLog] = useState([]);
  const [showDeleteLog, setShowDeleteLog] = useState(false);
  const [modal, setModal]       = useState(null);
  const [staffModal, setStaffModal]   = useState(null); // null | 'km' | 'freelancer'
  const [staffDraft,  setStaffDraft]  = useState([]);   // [{dept, members: '...'}]
  const [staffSaving, setStaffSaving] = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [editId, setEditId]     = useState(null);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const [resetInfo, setResetInfo]   = useState(null); // { name, username, password }
  const [deleteModal, setDeleteModal] = useState(false);
  const [eventList, setEventList]     = useState([]);
  const [loadingEv, setLoadingEv]     = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting]       = useState(false);
  const [debugModal, setDebugModal]   = useState(false);
  const [debugData, setDebugData]     = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [restoreModal, setRestoreModal] = useState(false);
  const [dismissedList, setDismissedList] = useState([]);
  const [dismissedLoading, setDismissedLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [vanPhongSet, setVanPhongSet] = useState(new Set());
  const [showVanPhong, setShowVanPhong] = useState(false);
  const [violDeleteLog, setViolDeleteLog] = useState([]);
  const [showViolDeleteLog, setShowViolDeleteLog] = useState(false);

  async function load() {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch {}
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.getStaffFlags().then(d => setVanPhongSet(new Set(d.vanPhong))).catch(() => {});
  }, []);

  async function toggleVanPhong(name) {
    const next = !vanPhongSet.has(name);
    setVanPhongSet(prev => { const s = new Set(prev); next ? s.add(name) : s.delete(name); return s; });
    await api.toggleStaffFlag(name, next).catch(() => {
      api.getStaffFlags().then(d => setVanPhongSet(new Set(d.vanPhong))).catch(() => {});
    });
  }
  useEffect(() => {
    if (isAdmin && showDeleteLog) {
      api.getReportDeleteLog().then(setDeleteLog).catch(() => {});
    }
  }, [isAdmin, showDeleteLog]);
  useEffect(() => {
    if (isAdmin && showViolDeleteLog) {
      api.getViolationDeleteLog().then(setViolDeleteLog).catch(() => {});
    }
  }, [isAdmin, showViolDeleteLog]);

  function openStaffModal(type) {
    const groups = type === 'km' ? kmGroups : freelancerGroups;
    setStaffDraft(groups.map(g => ({ dept: g.dept, members: (g.members || []).join('\n') })));
    setStaffModal(type);
  }

  async function saveStaff() {
    setStaffSaving(true);
    try {
      const payload = staffDraft
        .filter(g => g.dept.trim())
        .map(g => ({
          dept: g.dept.trim(),
          members: g.members.split('\n').map(s => s.trim()).filter(Boolean),
        }));
      await api.updateStaffGroups(staffModal, payload);
      await refreshStaff();
      setStaffModal(null);
    } catch (e) {
      alert('Lỗi: ' + e.message);
    } finally {
      setStaffSaving(false);
    }
  }

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
    setForm({ username: u.username, password: '', full_name: u.full_name, position: u.position || '', role: u.role, is_active: !!u.is_active, is_phan_lich: !!u.is_phan_lich, is_phan_lich_all: !!u.is_phan_lich_all, is_tra_ncc: !!u.is_tra_ncc, is_quan_ly_kho: !!u.is_quan_ly_kho, is_giam_doc: !!u.is_giam_doc, is_van_hanh_ke_toan: !!u.is_van_hanh_ke_toan, zalo_uid: u.zalo_uid || '', luong_co_ban: u.luong_co_ban || '', luong_ngay_cong: u.luong_ngay_cong || '', luong_ot_h: u.luong_ot_h || '', bac_luong: u.bac_luong || '' });
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

  const ROLE_ORDER = ROLES.map(r => r.value);
  const groupedUsers = ROLES.map(r => ({
    role: r.value,
    label: r.label,
    members: users.filter(u => u.role === r.value),
  })).filter(g => g.members.length > 0);
  // Các role không nằm trong ROLES (nếu có)
  const otherUsers = users.filter(u => !ROLE_ORDER.includes(u.role));



  return (
    <div className="p-6">
      {/* Users tab */}
      {<div>
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
                    a.download = `km-media-backup-${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())}.db`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (err) { alert('Lỗi: ' + err.message); }
                }}
                style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'7px 14px', borderRadius:'8px', fontSize:'0.84rem', fontWeight:600, border:'1px solid rgba(74,222,128,0.35)', background:'rgba(74,222,128,0.08)', color:'#4ade80', cursor:'pointer', whiteSpace:'nowrap' }}
              >
                💾 Backup
              </button>

            </>
          )}
          {isSuperAdmin && (
            <button className="btn-primary btn-sm" style={{ whiteSpace:'nowrap' }} onClick={openCreate}>+ Thêm tài khoản</button>
          )}
        </div>
      </div>

      {/* ── Card list (all screens) ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {users.length === 0 && (
          <p style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)' }}>Chưa có tài khoản nào</p>
        )}
        {[...groupedUsers, ...(otherUsers.length ? [{ role: 'OTHER', label: '❓ Khác', members: otherUsers }] : [])].map(group => {
          const rc = ROLE_COLORS[group.role] || ROLE_COLORS.CSVC;
          return (
            <div key={`mgroup-${group.role}`} style={{ marginBottom:'8px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', margin:'12px 0 8px' }}>
                <div style={{ height:'1px', flex:1, background:`linear-gradient(to right, ${rc.color}, transparent)`, opacity:0.45 }} />
                <span style={{ fontSize:'0.78rem', fontWeight:800, color: rc.color, letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                  {group.label} <span style={{ opacity:0.6, fontWeight:600 }}>({group.members.length})</span>
                </span>
                <div style={{ height:'1px', flex:1, background:`linear-gradient(to left, ${rc.color}, transparent)`, opacity:0.45 }} />
              </div>
              {group.members.map(u => (
                <div key={u.id} style={{ background:'var(--bg-card)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'12px 14px', marginBottom:'8px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                    <span style={{ flex:1, fontWeight:700, color:'#c9a84c', fontSize:'0.95rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.full_name}</span>
                    {u.is_active
                      ? <span style={{ color:'#4ade80', fontWeight:700, fontSize:'0.84rem', flexShrink:0 }}>● Hoạt động</span>
                      : <span style={{ color:'#f87171', fontWeight:700, fontSize:'0.84rem', flexShrink:0 }}>● Vô hiệu</span>}
                  </div>
                  <div style={{ fontSize:'0.84rem', color:'var(--text-muted)', marginBottom: (u.position === 'Trưởng phòng' || u.is_phan_lich || u.is_phan_lich_all || u.is_tra_ncc || u.is_quan_ly_kho) ? '6px' : '10px' }}>{u.username}</div>
                  {(u.position === 'Trưởng phòng' || u.is_phan_lich || u.is_phan_lich_all || u.is_tra_ncc || u.is_quan_ly_kho || u.is_giam_doc || u.is_van_hanh_ke_toan) && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'10px' }}>
                      {u.position === 'Trưởng phòng' && <span style={{ fontSize:'0.82rem', fontWeight:700, padding:'2px 7px', borderRadius:'4px', background:'rgba(167,139,250,0.15)', border:'1px solid rgba(167,139,250,0.4)', color:'#a78bfa' }}>Trưởng phòng</span>}
                      {!!u.is_phan_lich_all && <span style={{ fontSize:'0.82rem', fontWeight:700, padding:'2px 7px', borderRadius:'4px', background:'rgba(74,222,128,0.15)', border:'1px solid rgba(74,222,128,0.4)', color:'#4ade80' }}>Phân lịch tất cả</span>}
                      {!!u.is_phan_lich && !u.is_phan_lich_all && <span style={{ fontSize:'0.82rem', fontWeight:700, padding:'2px 7px', borderRadius:'4px', background:'rgba(96,165,250,0.15)', border:'1px solid rgba(96,165,250,0.4)', color:'#60a5fa' }}>Phân lịch</span>}
                      {!!u.is_tra_ncc     && <span style={{ fontSize:'0.82rem', fontWeight:700, padding:'2px 7px', borderRadius:'4px', background:'rgba(251,191,36,0.15)', border:'1px solid rgba(251,191,36,0.4)', color:'#fbbf24' }}>NCC</span>}
                      {!!u.is_quan_ly_kho && <span style={{ fontSize:'0.82rem', fontWeight:700, padding:'2px 7px', borderRadius:'4px', background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.4)', color:'#f87171' }}>Quản lý kho</span>}
                      {!!u.is_giam_doc && <span style={{ fontSize:'0.82rem', fontWeight:700, padding:'2px 7px', borderRadius:'4px', background:'rgba(250,204,21,0.15)', border:'1px solid rgba(250,204,21,0.4)', color:'#facc15' }}>HCNS</span>}
                      {!!u.is_van_hanh_ke_toan && <span style={{ fontSize:'0.82rem', fontWeight:700, padding:'2px 7px', borderRadius:'4px', background:'rgba(201,168,76,0.15)', border:'1px solid rgba(201,168,76,0.4)', color:'#c9a84c' }}>Kế Toán VH</span>}
                    </div>
                  )}
                  {isSuperAdmin && (
                    <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end' }}>
                      <button onClick={() => openEdit(u)}
                        style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 12px', borderRadius:'7px', fontSize:'0.82rem', fontWeight:600, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.06)', color:'#c0c0d8', cursor:'pointer' }}>
                        ✏️ Sửa
                      </button>
                      <button onClick={() => handleReset(u)}
                        style={{ padding:'5px 10px', borderRadius:'7px', fontSize:'0.84rem', border:'1px solid rgba(251,191,36,0.35)', background:'rgba(251,191,36,0.08)', color:'#fbbf24', cursor:'pointer' }}
                        title="Reset mật khẩu">🔑</button>
                      <button onClick={() => handleDelete(u)}
                        style={{ padding:'5px 10px', borderRadius:'7px', fontSize:'0.84rem', border:'1px solid rgba(248,113,113,0.35)', background:'rgba(248,113,113,0.08)', color:'#f87171', cursor:'pointer' }}>🗑</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* ── Quản lý nhân sự (SUPER_ADMIN only) ── */}
      {isSuperAdmin && (
        <div style={{ marginTop: '28px', padding: '20px', borderRadius: '12px', border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.04)' }}>
          <p style={{ color: '#c9a84c', fontWeight: 700, fontSize: '0.84rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
            👥 Quản lý nhân sự
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '14px' }}>
            Cập nhật danh sách nhân sự theo bộ phận — dùng cho lịch làm việc, báo cáo vi phạm.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <button onClick={() => openStaffModal('km')}
              style={{ padding:'9px 20px', borderRadius:'8px', fontSize:'0.85rem', fontWeight:700, border:'1px solid rgba(201,168,76,0.45)', background:'rgba(201,168,76,0.12)', color:'#c9a84c', cursor:'pointer' }}>
              🏢 Nhân sự Khôi Minh
            </button>
            <button onClick={() => openStaffModal('freelancer')}
              style={{ padding:'9px 20px', borderRadius:'8px', fontSize:'0.85rem', fontWeight:700, border:'1px solid rgba(96,165,250,0.45)', background:'rgba(96,165,250,0.1)', color:'#60a5fa', cursor:'pointer' }}>
              🎯 Nhân sự Freelancer
            </button>
          </div>

          <div onClick={() => setShowVanPhong(v => !v)}
            style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', marginBottom: showVanPhong ? '10px' : 0 }}>
            <p style={{ color:'#94a3b8', fontWeight:700, fontSize:'0.82rem', letterSpacing:'0.06em', textTransform:'uppercase', margin:0 }}>
              🏢 Flag văn phòng — không tính Không Lịch trên Dashboard
            </p>
            <span style={{ fontSize:'0.78rem', color:'#7878a0', transition:'transform 0.15s', display:'inline-block', transform: showVanPhong ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
          </div>
          {showVanPhong && <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {KM_STAFF_GROUPS.map(g => (
              <div key={g.dept}>
                <div style={{ fontSize:'0.73rem', fontWeight:700, color:'#7878a0', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'5px' }}>{g.dept}</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                  {g.members.map(name => {
                    const on = vanPhongSet.has(name);
                    return (
                      <button key={name} onClick={() => toggleVanPhong(name)}
                        style={{
                          fontSize:'0.78rem', fontWeight: on ? 700 : 500,
                          padding:'3px 10px', borderRadius:'6px', cursor:'pointer',
                          border: on ? '1px solid rgba(148,163,184,0.5)' : '1px solid rgba(255,255,255,0.1)',
                          background: on ? 'rgba(148,163,184,0.15)' : 'rgba(255,255,255,0.04)',
                          color: on ? '#94a3b8' : '#6b7280',
                        }}>
                        {on ? '🏢 ' : ''}{name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>}
        </div>
      )}

      {/* ── Lịch sử xóa báo cáo (SUPER_ADMIN / DIRECTOR) ── */}
      {isAdmin && (
        <div style={{ marginTop: '32px', padding: '20px', borderRadius: '12px', border: '1px solid rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showDeleteLog ? '16px' : 0 }}>
            <p style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.84rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              🗑 Lịch sử xóa báo cáo
            </p>
            <button
              onClick={() => setShowDeleteLog(v => !v)}
              style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', color: '#fbbf24', padding: '6px 14px', fontSize: '0.82rem', cursor: 'pointer' }}
            >
              {showDeleteLog ? 'Ẩn' : 'Xem'}
            </button>
          </div>
          {showDeleteLog && (
            deleteLog.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Chưa có báo cáo nào bị xóa.</p>
              : <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(251,191,36,0.2)' }}>
                        {['ID BC', 'Sự kiện', 'Ngày BC', 'Người báo cáo', 'Tóm tắt', 'Người xóa', 'Thời gian xóa', ...(isSuperAdmin ? [''] : [])].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#fbbf24', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deleteLog.map(row => (
                        <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: row._restoring ? 0.5 : 1 }}>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>#{row.report_id}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{row.event_label || '—'}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{row.event_date ? fmtD(row.event_date) : '—'}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{row.reporter_name || '—'}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.report_summary || '—'}</td>
                          <td style={{ padding: '8px 10px', color: '#f87171' }}>{row.deleted_by_name || '—'}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{row.deleted_at ? row.deleted_at.slice(0, 16) : '—'}</td>
                          {isSuperAdmin && (
                            <td style={{ padding: '8px 10px' }}>
                              {row.soft_deleted_at ? (
                                <button
                                  disabled={row._restoring}
                                  onClick={async () => {
                                    setDeleteLog(prev => prev.map(r => r.id === row.id ? { ...r, _restoring: true } : r));
                                    try {
                                      await api.restoreEventReport(row.report_id);
                                      setDeleteLog(prev => prev.filter(r => r.id !== row.id));
                                    } catch (e) {
                                      alert(e.message || 'Lỗi khôi phục');
                                      setDeleteLog(prev => prev.map(r => r.id === row.id ? { ...r, _restoring: false } : r));
                                    }
                                  }}
                                  style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '6px', color: '#4ade80', padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  Khôi phục
                                </button>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Đã xóa vĩnh viễn</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
          )}
        </div>
      )}

      {/* ── Lịch Sử Xóa Vi Phạm (Admin only) ── */}
      {isAdmin && (
        <div style={{ marginTop: '32px', padding: '20px', borderRadius: '12px', border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showViolDeleteLog ? '16px' : 0 }}>
            <p style={{ color: '#f87171', fontWeight: 700, fontSize: '0.84rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              🗑 Lịch sử xóa vi phạm
            </p>
            <button
              onClick={() => setShowViolDeleteLog(v => !v)}
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '8px', color: '#f87171', padding: '6px 14px', fontSize: '0.82rem', cursor: 'pointer' }}
            >
              {showViolDeleteLog ? 'Ẩn' : 'Xem'}
            </button>
          </div>
          {showViolDeleteLog && (
            violDeleteLog.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Chưa có vi phạm nào bị xóa.</p>
              : <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(248,113,113,0.2)' }}>
                        {['#VP', 'Người vi phạm', 'Loại vi phạm', 'Mô tả', 'Người xóa', 'Thời gian xóa'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#f87171', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {violDeleteLog.map(row => (
                        <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>#{row.violation_id}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{row.violator || '—'}</td>
                          <td style={{ padding: '8px 10px', color: '#fbbf24', whiteSpace: 'nowrap' }}>{row.violation_type || '—'}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description || '—'}</td>
                          <td style={{ padding: '8px 10px', color: '#f87171', whiteSpace: 'nowrap' }}>{row.deleted_by_name || '—'}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{row.deleted_at ? row.deleted_at.slice(0, 16) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
          )}
        </div>
      )}

      {/* ── Danger Zone (SUPER_ADMIN only) ── */}
      {isSuperAdmin && (
        <div style={{
          marginTop: '32px', padding: '20px', borderRadius: '12px',
          border: '1px solid rgba(248,113,113,0.35)',
          background: 'rgba(248,113,113,0.04)',
        }}>
          <p style={{ color: '#f87171', fontWeight: 700, fontSize: '0.84rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
            ⚠️ Khu vực nguy hiểm
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '14px' }}>
            Xóa sự kiện, phiếu xuất/nhập, báo cáo, vi phạm. Dữ liệu thiết bị và tài khoản được giữ nguyên. <strong style={{ color: '#f87171' }}>Không thể hoàn tác.</strong>
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <button
              onClick={async () => {
                setDebugModal(true);
                setDebugLoading(true);
                try { setDebugData(await api.debugObligations()); } catch(e) { alert('Lỗi: ' + e.message); }
                finally { setDebugLoading(false); }
              }}
              style={{ padding:'9px 20px', borderRadius:'8px', fontSize:'0.85rem', fontWeight:700, border:'1px solid rgba(96,165,250,0.5)', background:'rgba(96,165,250,0.15)', color:'#60a5fa', cursor:'pointer' }}
            >
              🔍 Chọn và Debug Vi Phạm
            </button>
            <button
              onClick={async () => {
                setRestoreModal(true);
                setDismissedLoading(true);
                try { setDismissedList(await api.getDismissedObligations()); } catch(e) { alert('Lỗi: ' + e.message); }
                finally { setDismissedLoading(false); }
              }}
              style={{ padding:'9px 20px', borderRadius:'8px', fontSize:'0.85rem', fontWeight:700, border:'1px solid rgba(251,146,60,0.5)', background:'rgba(251,146,60,0.15)', color:'#fb923c', cursor:'pointer' }}
            >
              🔄 Xem và Khôi Phục Vi Phạm
            </button>
          </div>
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
                  style={{ fontSize: '0.84rem', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  Chọn tất cả
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  style={{ fontSize: '0.84rem', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  Bỏ chọn
                </button>
                <span style={{ fontSize: '0.84rem', color: selectedIds.size > 0 ? '#f87171' : 'var(--text-muted)', marginLeft: 'auto', fontWeight: selectedIds.size > 0 ? 700 : 400 }}>
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
                      <span style={{ fontFamily: "'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace", fontSize: '0.84rem', color: 'var(--text-muted)', flexShrink: 0, minWidth: '80px' }}>
                        {ev.code}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.name}
                      </span>
                      <span style={{
                        fontSize: '0.78rem', fontWeight: 700, padding: '2px 8px', borderRadius: '99px',
                        color: st.color, background: st.color + '22', flexShrink: 0,
                      }}>
                        {st.label}
                      </span>
                      {ev.start_date && (
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {fmtD(ev.start_date)}
                        </span>
                      )}
                      {ev.tx_count > 0 && (
                        <span style={{ fontSize: '0.84rem', color: '#fbbf24', flexShrink: 0 }}>
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
                style={{ fontFamily: "'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace" }}
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
                <span style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>Tài khoản đang hoạt động</span>
              </label>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.is_phan_lich}
                onChange={e => set('is_phan_lich', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#60a5fa' }} />
              <span style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                🗓 Phân lịch làm việc <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>(tạo &amp; sửa lịch nháp bộ phận mình)</span>
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.is_phan_lich_all}
                onChange={e => set('is_phan_lich_all', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#f97316' }} />
              <span style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                📋 Phân lịch tất cả <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>(tạo, sửa, xác nhận tất cả lịch + chọn nhân sự tất cả bộ phận)</span>
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.is_tra_ncc}
                onChange={e => set('is_tra_ncc', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#4ade80' }} />
              <span style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                🏪 NCC <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>(xem form và in phiếu trả thiết bị cho nhà cung cấp)</span>
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.is_quan_ly_kho}
                onChange={e => set('is_quan_ly_kho', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#f87171' }} />
              <span style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                🏭 Quản lý kho <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>(nhận vi phạm nếu sự kiện Kỹ Thuật chưa xuất kho lúc 15h)</span>
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.is_giam_doc}
                onChange={e => set('is_giam_doc', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#facc15' }} />
              <span style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                🏢 HCNS <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>(xem tổng hợp nhân sự hôm nay / ngày mai trên trang chủ)</span>
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.is_van_hanh_ke_toan}
                onChange={e => set('is_van_hanh_ke_toan', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#c9a84c' }} />
              <span style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                🧮 Vận Hành Kế Toán <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>(xem trang chi phí thiết bị Khôi Minh + NCC, xuất Excel)</span>
              </span>
            </label>

            <div>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                Zalo User ID <span style={{ fontSize: '0.78rem', color: '#60a5fa', fontWeight: 400, textTransform: 'none' }}>(để nhận thông báo Zalo)</span>
              </label>
              <input className="input" placeholder="Nhập Zalo User ID..."
                value={form.zalo_uid || ''} onChange={e => set('zalo_uid', e.target.value)}
                style={{ fontSize: '0.88rem' }} />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>
                💰 Thông Tin Lương
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Bậc Lương</label>
                  <input className="input" placeholder="VD: Bậc 3, Senior..."
                    value={form.bac_luong || ''} onChange={e => set('bac_luong', e.target.value)}
                    style={{ fontSize: '0.88rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Lương Cơ Bản</label>
                  <input className="input" type="number" placeholder="VD: 5500000"
                    value={form.luong_co_ban || ''} onChange={e => set('luong_co_ban', e.target.value)}
                    style={{ fontSize: '0.88rem' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Lương Ngày Công</label>
                  <input className="input" type="number" placeholder="VD: 230000"
                    value={form.luong_ngay_cong || ''} onChange={e => set('luong_ngay_cong', e.target.value)}
                    style={{ fontSize: '0.88rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Lương OT/giờ</label>
                  <input className="input" type="number" placeholder="VD: 38000"
                    value={form.luong_ot_h || ''} onChange={e => set('luong_ot_h', e.target.value)}
                    style={{ fontSize: '0.88rem' }} />
                </div>
              </div>
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

      {/* ── Staff management modal ── */}
      {staffModal && (
        <Modal
          title={staffModal === 'km' ? '🏢 Nhân sự Khôi Minh' : '🎯 Nhân sự Freelancer'}
          onClose={() => setStaffModal(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '65vh', overflowY: 'auto' }}>
            {staffDraft.map((g, i) => (
              <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <select
                    className="input"
                    value={g.dept}
                    onChange={e => setStaffDraft(d => d.map((x, j) => j === i ? { ...x, dept: e.target.value } : x))}
                    style={{ flex: 1, fontWeight: 700, fontSize: '0.88rem' }}
                  >
                    <option value="">— Chọn bộ phận —</option>
                    {(staffModal === 'km' ? DEPARTMENTS : FREELANCER_DEPTS).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setStaffDraft(d => d.filter((_, j) => j !== i))}
                    style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.84rem', flexShrink: 0 }}
                  >🗑</button>
                </div>
                <textarea
                  className="input"
                  rows={Math.min(Math.max((g.members.match(/\n/g) || []).length + 2, 3), 10)}
                  placeholder={'Mỗi tên một dòng:\nNguyễn Văn A\nTrần Thị B'}
                  value={g.members}
                  onChange={e => setStaffDraft(d => d.map((x, j) => j === i ? { ...x, members: e.target.value } : x))}
                  style={{ fontSize: '0.84rem', resize: 'vertical', lineHeight: '1.7' }}
                />
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {g.members.split('\n').filter(s => s.trim()).length} nhân sự
                </div>
              </div>
            ))}
            <button
              onClick={() => setStaffDraft(d => [...d, { dept: '', members: '' }])}
              style={{ padding: '10px', borderRadius: '8px', border: '2px dashed rgba(201,168,76,0.35)', background: 'transparent', color: '#c9a84c', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
            >
              + Thêm bộ phận
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
            <button onClick={saveStaff} disabled={staffSaving} className="btn-primary" style={{ flex: 1 }}>
              {staffSaving ? 'Đang lưu...' : '💾 Lưu danh sách'}
            </button>
            <button onClick={() => setStaffModal(null)} className="btn-secondary">Hủy</button>
          </div>
        </Modal>
      )}

      {/* ── Modal Debug Vi Phạm ── */}
      {debugModal && (
        <Modal title="🔍 Debug Vi Phạm" onClose={() => setDebugModal(false)} size="lg">
          {debugLoading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>⏳ Đang tải...</p>
          ) : debugData ? (
            <>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {[
                  { label: 'Tổng obligations', value: debugData.totalObs, color: '#60a5fa' },
                  { label: 'Quá hạn chưa xử lý', value: debugData.overdueObs, color: '#f87171' },
                  { label: 'Đã dismissed', value: debugData.dismissedObs, color: '#fb923c' },
                  { label: 'Tổng vi phạm', value: debugData.totalViols, color: '#c084fc' },
                  { label: 'Vi phạm hệ thống', value: debugData.sysViols, color: '#fbbf24' },
                ].map(s => (
                  <div key={s.label} style={{ flex: '1 1 140px', background: 'var(--surface-2)', borderRadius: '8px', padding: '10px 14px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{s.label}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Chi tiết {debugData.detail.length} obligation quá hạn gần nhất:
              </p>
              <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {debugData.detail.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Không có obligation quá hạn.</p>
                ) : debugData.detail.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.lead_name}</span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: '8px' }}>{r.assigned_date}</span>
                    </div>
                    <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: '4px', background: r.has_report ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)', color: r.has_report ? '#4ade80' : '#f87171' }}>
                      {r.has_report ? '✅ Có BC' : '❌ Chưa BC'}
                    </span>
                    <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: '4px', background: r.dismissed ? 'rgba(251,146,60,0.15)' : 'rgba(148,163,184,0.1)', color: r.dismissed ? '#fb923c' : 'var(--text-muted)' }}>
                      {r.dismissed ? 'Đã bỏ qua' : 'Đang theo dõi'}
                    </span>
                    <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: '4px', background: r.violation_created ? 'rgba(192,132,252,0.15)' : 'rgba(148,163,184,0.1)', color: r.violation_created ? '#c084fc' : 'var(--text-muted)' }}>
                      {r.violation_created ? '⚡ Vi phạm đã tạo' : 'Chưa có vi phạm'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </Modal>
      )}

      {/* ── Modal Khôi Phục Vi Phạm ── */}
      {restoreModal && (
        <Modal title="🔄 Xem và Khôi Phục Vi Phạm" onClose={() => setRestoreModal(false)} size="lg">
          {dismissedLoading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>⏳ Đang tải...</p>
          ) : dismissedList.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>Không có obligation nào đang bị dismissed.</p>
          ) : (
            <>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                {dismissedList.length} obligation bị dismissed. Khôi phục để tạo lại vi phạm.
              </p>
              <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {dismissedList.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.lead_name}</span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: '8px' }}>{r.assigned_date}</span>
                    </div>
                    <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: '4px', background: r.has_report ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)', color: r.has_report ? '#4ade80' : '#f87171' }}>
                      {r.has_report ? '✅ Có BC' : '❌ Chưa BC'}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Hạn: {r.deadline?.slice(0, 10)}</span>
                    <button
                      disabled={restoringId === r.id}
                      onClick={async () => {
                        setRestoringId(r.id);
                        try {
                          await api.resetDismissedObligation(r.id);
                          setDismissedList(prev => prev.filter(x => x.id !== r.id));
                        } catch(e) { alert('Lỗi: ' + e.message); }
                        finally { setRestoringId(null); }
                      }}
                      style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, border: '1px solid rgba(251,146,60,0.5)', background: 'rgba(251,146,60,0.15)', color: '#fb923c', cursor: restoringId === r.id ? 'not-allowed' : 'pointer', opacity: restoringId === r.id ? 0.6 : 1, whiteSpace: 'nowrap' }}
                    >
                      {restoringId === r.id ? '⏳' : '🔄 Khôi phục'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
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
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Thông tin đăng nhập</p>
              <p style={{ color: 'var(--gold)', fontFamily: "'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace", fontSize: '1rem', marginBottom: '4px' }}>
                👤 {resetInfo.username}
              </p>
              <p style={{ color: '#4ade80', fontFamily: "'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace", fontSize: '1.2rem', fontWeight: 700 }}>
                🔒 {resetInfo.password}
              </p>
            </div>
            <p style={{ color: '#fbbf24', fontSize: '0.84rem' }}>⚠️ Vui lòng thông báo cho người dùng đổi mật khẩu sau khi đăng nhập.</p>
            <button onClick={() => setResetInfo(null)} className="btn-primary" style={{ marginTop: '16px', width: '100%' }}>
              Đã hiểu
            </button>
          </div>
        </Modal>
      )}
      </div>} {/* end users tab */}
    </div>
  );
}
