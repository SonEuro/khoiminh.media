import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';
import DateInput from '../components/DateInput';
import MultiDatePicker from '../components/MultiDatePicker';
import { useAuth } from '../contexts/AuthContext';

import { fmtD } from '../utils/fmt';

const STATUS_MAP = {
  planned:   { label: 'Lên kế hoạch', cls: 'badge-maintenance' },
  active:    { label: 'Đang diễn ra', cls: 'badge-available' },
  completed: { label: 'Hoàn thành',   cls: 'badge-available' },
  cancelled: { label: 'Đã hủy',       cls: 'badge-lost' },
};

function parseFilmingDates(ev) {
  if (!ev) return [];
  if (ev.filming_dates) { try { return JSON.parse(ev.filming_dates); } catch {} }
  return ev.filming_date ? [ev.filming_date] : [];
}


function EventForm({ initial, onSave, onCancel, allEvents = [], statusOnly = false, creatorName = '' }) {
  const [form, setForm] = useState(() => {
    const base = initial || { name: '', client: '', location: '', start_date: '', end_date: '', status: 'planned', notes: '' };
    return { ...base, filming_dates: parseFilmingDates(initial), show_date: initial?.show_date || '' };
  });
  const [showSuggest, setShowSuggest] = useState(false);
  const [dateError, setDateError]     = useState(false);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (k === 'filming_dates') setDateError(false); };

  const suggestions = form.name.trim().length >= 1
    ? allEvents.filter(ev =>
        (!initial || ev.id !== initial.id) &&
        ev.name.toLowerCase().includes(form.name.toLowerCase())
      ).slice(0, 6)
    : [];

  if (statusOnly) return (
    <form onSubmit={async e => { e.preventDefault(); await onSave(form); }} className="space-y-4">
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Bạn chỉ có quyền cập nhật trạng thái sự kiện.</p>
      <div>
        <label className="label">Trạng thái</label>
        <select className="input" style={{ color:'#f87171', fontWeight:700 }} value={form.status} onChange={e => set('status', e.target.value)}>
          {Object.entries(STATUS_MAP).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1">Cập nhật trạng thái</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Hủy</button>
      </div>
    </form>
  );

  return (
    <form onSubmit={async e => {
      e.preventDefault();
      const datesArr = (form.filming_dates || []).filter(Boolean).sort();
      if (!initial && datesArr.length === 0) { setDateError(true); return; }
      const data = { ...form };
      data.filming_dates = datesArr;
      data.filming_date = datesArr[datesArr.length - 1] || '';
      if (datesArr.length > 0) {
        if (!data.start_date) data.start_date = datesArr[0];
        if (!data.end_date)   data.end_date   = datesArr[datesArr.length - 1];
      }
      await onSave(data);
    }} className="space-y-4">
      <div style={{ position: 'relative' }}>
        <label className="label">Tên sự kiện *</label>
        <input
          className="input eq-search bold-input"
          required
          value={form.name}
          placeholder=""
          onChange={e => { set('name', e.target.value); setShowSuggest(true); }}
          onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
          onFocus={() => setShowSuggest(true)}
          autoComplete="off"
        />
        {showSuggest && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: '#13131d', border: '1px solid rgba(201,168,76,0.3)',
            borderRadius: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            marginTop: '4px', overflow: 'hidden',
          }}>
            <p style={{ padding: '6px 12px', fontSize: '0.7rem', color: '#7878a0', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
              Sự kiện đã có — click để dùng tên này
            </p>
            {suggestions.map(ev => (
              <button
                key={ev.id}
                type="button"
                onMouseDown={() => { set('name', ev.name); setShowSuggest(false); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 12px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid rgba(201,168,76,0.08)',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#7878a0', flexShrink: 0 }}>{ev.code}</span>
                <span style={{ color: '#c9a84c', fontWeight: 600, fontSize: '0.9rem' }}>{ev.name}</span>
                {ev.start_date && <span style={{ fontSize: '0.72rem', color: '#7878a0', marginLeft: 'auto' }}>{fmtD(ev.start_date)}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {!initial && creatorName && (
        <div>
          <label className="label">Người tạo sự kiện</label>
          <input className="input" value={creatorName} readOnly
            style={{ opacity: 0.6, cursor: 'default' }} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Khách hàng</label>
          <input className="input bold-input" value={form.client || ''} onChange={e => set('client', e.target.value)} />
        </div>
        <div>
          <label className="label">Địa điểm</label>
          <input className="input bold-input" value={form.location || ''} onChange={e => set('location', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Ngày bắt đầu</label>
          <DateInput value={form.start_date || ''} onChange={v => set('start_date', v)}
            min={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())}
            style={form.start_date ? { color:'#f87171', fontWeight:700, fontSize:'1.1rem' } : {}} />
        </div>
        <div>
          <label className="label">Ngày kết thúc</label>
          <DateInput value={form.end_date || ''} onChange={v => set('end_date', v)}
            min={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())}
            style={form.end_date ? { color:'#f87171', fontWeight:700, fontSize:'1.1rem' } : {}} />
        </div>
        <div>
          <label className="label">Ngày chạy chương trình</label>
          <DateInput value={form.show_date || ''} onChange={v => set('show_date', v)}
            style={form.show_date ? { color:'#f87171', fontWeight:700, fontSize:'1.1rem' } : {}} />
        </div>
        <div>
          <label className="label">Ngày ghi hình {!initial && <span style={{ color:'#f87171' }}>*</span>}</label>
          <MultiDatePicker value={form.filming_dates || []} onChange={v => set('filming_dates', v)} error={dateError} />
          {dateError && <p style={{ color:'#f87171', fontSize:'0.75rem', marginTop:'4px' }}>Vui lòng chọn ít nhất một ngày ghi hình</p>}
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label className="label">Trạng thái</label>
          <select className="input" style={{ color:'#f87171', fontWeight:700 }} value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(STATUS_MAP).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Ghi chú</label>
        <textarea className="input bold-input" rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1">{initial ? 'Cập nhật' : 'Tạo sự kiện'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Hủy</button>
      </div>
    </form>
  );
}

function EventDetailModal({ eventId, onClose }) {
  const [ev, setEv] = useState(null);
  useEffect(() => { api.getEventById(eventId).then(setEv); }, [eventId]);

  if (!ev) return (
    <Modal title="Sự kiện" onClose={onClose}>
      <div className="text-center py-8 text-gray-400">Đang tải...</div>
    </Modal>
  );

  return (
    <Modal title={`${ev.code} · ${ev.name}`} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Khách hàng: </span><strong>{ev.client || '—'}</strong></div>
          <div><span className="text-gray-500">Địa điểm: </span><strong>{ev.location || '—'}</strong></div>
          <div><span className="text-gray-500">Từ: </span><strong>{fmtD(ev.start_date)}</strong></div>
          <div><span className="text-gray-500">Đến: </span><strong>{fmtD(ev.end_date)}</strong></div>
          {(() => {
            const dates = parseFilmingDates(ev);
            return dates.length > 0 ? (
              <div style={{ gridColumn: dates.length > 1 ? 'span 2' : undefined }}>
                <span className="text-gray-500">Ngày ghi hình: </span>
                {dates.map((d, i) => (
                  <strong key={i} style={{ color:'#a78bfa', marginRight:'10px' }}>🎬 {fmtD(d)}</strong>
                ))}
              </div>
            ) : null;
          })()}
          {ev.show_date && (
            <div>
              <span className="text-gray-500">Ngày chạy CT: </span>
              <strong style={{ color:'#34d399' }}>🎪 {fmtD(ev.show_date)}</strong>
            </div>
          )}
          {ev.created_by && (
            <div><span className="text-gray-500">Người tạo: </span><strong>{ev.created_by}</strong></div>
          )}
        </div>
        {ev.notes && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(201,168,76,0.07) 0%, rgba(201,168,76,0.03) 100%)',
            border: '1px solid rgba(201,168,76,0.3)',
            borderLeft: '3px solid #c9a84c',
            borderRadius: '0 8px 8px 0',
            padding: '14px 16px',
            minHeight: '80px',
            maxHeight: '280px',
            overflowY: 'auto',
            position: 'relative',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              marginBottom: '10px',
              paddingBottom: '8px',
              borderBottom: '1px solid rgba(201,168,76,0.15)',
            }}>
              <span style={{ fontSize: '0.9rem' }}>📋</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#c9a84c', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Ghi chú
              </span>
            </div>
            <p style={{
              fontSize: '0.87rem',
              lineHeight: '1.75',
              color: 'var(--text-main)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
            }}>{ev.notes}</p>
          </div>
        )}

        {/* Thiết bị trong kho */}
        <div>
          <h3 className="font-semibold mb-2" style={{ color: '#e0e0ee' }}>Thiết bị xuất kho</h3>
          {ev.items.length === 0 ? (
            <p className="text-gray-400 text-sm">Chưa có thiết bị nào được xuất</p>
          ) : (
            <div className="table-wrap">
              <table className="w-full text-sm" style={{ minWidth: '360px' }}>
                <thead><tr className="border-b text-gray-500 text-left">
                  <th className="pb-2">Mã</th><th className="pb-2">Thiết bị</th>
                  <th className="pb-2 text-right">Xuất</th><th className="pb-2 text-right">Đã trả</th><th className="pb-2 text-right">Còn nợ</th>
                </tr></thead>
                <tbody>
                  {ev.items.map(it => (
                    <tr key={it.equipment_id} className="border-b last:border-0">
                      <td className="py-1.5 font-mono text-xs text-gray-500">{it.eq_code}</td>
                      <td className="py-1.5">{it.eq_name}</td>
                      <td className="py-1.5 text-right text-red-600 font-medium">{it.qty_out}</td>
                      <td className="py-1.5 text-right text-green-600">{it.qty_returned || 0}</td>
                      <td className={`py-1.5 text-right font-bold ${(it.qty_out - (it.qty_returned || 0)) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                        {it.qty_out - (it.qty_returned || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Thiết bị mượn từ nhà cung cấp */}
        {ev.external_items?.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2" style={{ color: '#e0e0ee' }}>
              Thiết bị thuê từ nhà cung cấp
            </h3>
            <div className="table-wrap">
              <table className="w-full text-sm" style={{ minWidth: '320px' }}>
                <thead><tr className="border-b text-gray-500 text-left">
                  <th className="pb-2">Nhà cung cấp</th>
                  <th className="pb-2">Tên thiết bị</th>
                  <th className="pb-2 text-right">SL</th>
                  <th className="pb-2">Ghi chú</th>
                </tr></thead>
                <tbody>
                  {ev.external_items.map((it, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 font-medium" style={{ color: '#c9a84c' }}>{it.supplier || '—'}</td>
                      <td className="py-1.5" style={{ color: '#e0e0ee' }}>{it.name}</td>
                      <td className="py-1.5 text-right font-bold" style={{ color: '#60a5fa' }}>{it.quantity}</td>
                      <td className="py-1.5 text-gray-500 text-xs">
                        {[it.rental_days > 0 ? `Thuê ${it.rental_days} ngày` : '', it.notes || ''].filter(Boolean).join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function TrashView({ onClose, canPermanentDelete, user }) {
  const [trash, setTrash] = useState([]);
  const load = () => api.getTrashEvents().then(setTrash);
  useEffect(() => { load(); }, []);

  const isFullAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  const canRestoreEvent = (ev) => {
    if (isFullAdmin) return true;
    if (!user?.is_truong_phong) return false;
    if (!ev.created_by_id || !ev.created_by_role) return true;
    return ev.created_by_role === user?.role;
  };

  const handleRestore = async (ev) => {
    if (!confirm(`Khôi phục sự kiện "${ev.name}"?`)) return;
    try { await api.restoreEvent(ev.id); load(); }
    catch (e) { alert(e.message); }
  };

  const handlePermanent = async (ev) => {
    if (!confirm(`Xóa VĨNH VIỄN "${ev.name}"? Không thể khôi phục!`)) return;
    try { await api.permanentDeleteEvent(ev.id); load(); }
    catch (e) { alert(e.message); }
  };

  return (
    <Modal title="🗑 Thùng Rác Sự Kiện" onClose={onClose} size="lg">
      {trash.length === 0 ? (
        <p style={{ textAlign:'center', color:'var(--text-muted)', padding:'32px' }}>Thùng rác trống</p>
      ) : (
        <div className="space-y-3">
          <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:'8px' }}>
            Sự kiện bị xóa sẽ tự động xóa vĩnh viễn sau 30 ngày.
          </p>
          {trash.map(ev => (
            <div key={ev.id} style={{
              background:'var(--bg-card)', border:'1px solid rgba(248,113,113,0.25)',
              borderRadius:'10px', padding:'14px 16px',
              display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px'
            }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                  <span style={{ fontFamily:'monospace', fontSize:'0.72rem', color:'var(--text-muted)' }}>{ev.code}</span>
                  <span style={{
                    fontSize:'0.7rem', fontWeight:700, padding:'2px 8px', borderRadius:'20px',
                    background: ev.days_left <= 5 ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.15)',
                    color: ev.days_left <= 5 ? '#f87171' : '#fbbf24',
                    border: `1px solid ${ev.days_left <= 5 ? 'rgba(248,113,113,0.4)' : 'rgba(251,191,36,0.3)'}`,
                  }}>
                    còn {ev.days_left} ngày
                  </span>
                </div>
                <p style={{ fontWeight:600, color:'var(--text-primary)', marginBottom:'2px' }}>{ev.name}</p>
                <p style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                  Xóa lúc: {ev.deleted_at?.slice(0, 16)}
                </p>
              </div>
              <div style={{ display:'flex', gap:'8px', flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }}>
                {canRestoreEvent(ev) && (
                  <button className="btn-secondary btn-sm" onClick={() => handleRestore(ev)}>↩ Khôi phục</button>
                )}
                {canPermanentDelete && (
                  <button className="btn-danger btn-sm" onClick={() => handlePermanent(ev)}>🗑 Xóa vĩnh viễn</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function Events() {
  const { user } = useAuth();
  const canManage   = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role) || !!user?.is_truong_phong;
  const canFullEdit = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  const isFullAdmin = canFullEdit;

  // TRUONG_PHONG chỉ hủy/khôi phục sự kiện do người cùng phòng tạo
  const canManageEvent = (ev) => {
    if (isFullAdmin) return true;
    if (!user?.is_truong_phong) return false;
    if (!ev.created_by_id || !ev.created_by_role) return true; // sự kiện cũ chưa có created_by_id
    return ev.created_by_role === user?.role;
  };
  const [events, setEvents] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showTrash, setShowTrash] = useState(false);

  const load = useCallback(() => {
    const params = statusFilter ? { status: statusFilter } : {};
    if (showArchived) params.include_archived = 1;
    api.getEvents(params).then(data => {
      if (showArchived) setEvents(data.filter(e => e.archived_at));
      else setEvents(data);
    });
  }, [statusFilter, showArchived]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  const handleSave = async (form) => {
    try {
      if (selected) await api.updateEvent(selected.id, form);
      else await api.createEvent(form);
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const handleCancel = async (ev) => {
    if (!confirm(`Hủy sự kiện "${ev.name}"?`)) return;
    try { await api.cancelEvent(ev.id); load(); }
    catch (e) { alert(e.message); }
  };

  const handleDelete = async (ev) => {
    if (ev.status !== 'cancelled') { alert('Chỉ có thể xóa sự kiện đã hủy.'); return; }
    if (!confirm(`Chuyển "${ev.name}" vào thùng rác?\nSẽ tự động xóa vĩnh viễn sau 30 ngày.`)) return;
    try { await api.deleteEvent(ev.id); load(); }
    catch (e) { alert(e.message); }
  };

  const handleArchive = async (ev) => {
    if (!confirm(`Lưu trữ sự kiện "${ev.name}"?\nSự kiện sẽ biến mất khỏi danh sách sau 24 giờ.`)) return;
    try { await api.archiveEvent(ev.id); load(); }
    catch (e) { alert(e.message); }
  };

  const handleUnarchive = async (ev) => {
    if (!confirm(`Bỏ lưu trữ sự kiện "${ev.name}"?\nSự kiện sẽ xuất hiện lại trong danh sách.`)) return;
    try { await api.unarchiveEvent(ev.id); load(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="p-6">
      {showTrash && <TrashView onClose={() => { setShowTrash(false); load(); }} canPermanentDelete={user?.role === 'SUPER_ADMIN'} user={user} />}
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Sự Kiện / Dự Án</h1>
          <p className="text-gray-500 text-sm">{events.length} sự kiện</p>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {canManage && (
            <button className="btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={() => setShowTrash(true)}>🗑 Thùng Rác</button>
          )}
          {!['ACCOUNTING'].includes(user?.role) && (
            <button className="btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={() => { setSelected(null); setModal('form'); }}>
              + Tạo sự kiện
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {[['', 'Tất cả'], ['planned', 'Lên kế hoạch'], ['active', 'Đang diễn ra'], ['completed', 'Hoàn thành'], ['cancelled', 'Đã hủy']].map(([v, l]) => (
          <button key={v}
            className={`btn btn-sm ${!showArchived && statusFilter === v ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setShowArchived(false); setStatusFilter(v); }}>
            {l}
          </button>
        ))}
        {user?.role === 'SUPER_ADMIN' && (
          <button
            className={`btn btn-sm ${showArchived ? 'btn-primary' : 'btn-secondary'}`}
            style={showArchived ? { background:'#7c3aed', borderColor:'#7c3aed' } : { borderColor:'rgba(167,139,250,0.4)', color:'#a78bfa' }}
            onClick={() => { setShowArchived(v => !v); setStatusFilter(''); }}>
            📦 Đã lưu trữ
          </button>
        )}
      </div>

      <div className="grid gap-4">
        {events.length === 0 && (
          <div className="card text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">🎭</p>
            <p>Chưa có sự kiện nào</p>
          </div>
        )}
        {events.map(ev => {
          const s = STATUS_MAP[ev.status] || { label: ev.status, cls: '' };
          return (
            <div key={ev.id} className="card">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-gray-400">{ev.code}</span>
                  <span className={s.cls}>{s.label}</span>
                  {ev.archived_at && <span style={{ fontSize:'0.7rem', fontWeight:700, color:'#a78bfa', background:'rgba(167,139,250,0.12)', border:'1px solid rgba(167,139,250,0.3)', borderRadius:'9999px', padding:'1px 8px' }}>📦 Lưu trữ</span>}
                </div>
                <span className="text-sm text-gray-400 flex-shrink-0">{ev.tx_count} phiếu</span>
              </div>
              <h3 className="font-semibold text-lg mb-1">{ev.name}</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mb-3">
                {ev.client && <span>👤 {ev.client}</span>}
                {ev.location && <span>📍 {ev.location}</span>}
                {ev.start_date && <span>📅 {fmtD(ev.start_date)}{ev.end_date && ev.end_date !== ev.start_date ? ` → ${fmtD(ev.end_date)}` : ''}</span>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button className="btn-secondary btn-sm" onClick={() => { setSelected(ev); setModal('detail'); }}>
                  Chi tiết
                </button>
                {(ev.status === 'completed' ? user?.role === 'SUPER_ADMIN' : canFullEdit) && (
                  <button className="btn-secondary btn-sm" onClick={() => { setSelected(ev); setModal('form'); }}>
                    ✏️
                  </button>
                )}
                {canManage && ev.status !== 'cancelled' && canManageEvent(ev) && (ev.status !== 'completed' || user?.role === 'SUPER_ADMIN') && (
                  <button className="btn-danger btn-sm" title="Hủy sự kiện" onClick={() => handleCancel(ev)}>🚫 Hủy</button>
                )}
                {user?.role === 'SUPER_ADMIN' && ev.status === 'completed' && !ev.archived_at && (
                  <button className="btn-secondary btn-sm" title="Lưu trữ sự kiện" onClick={() => handleArchive(ev)}>💾 Lưu trữ</button>
                )}
                {user?.role === 'SUPER_ADMIN' && ev.archived_at && (
                  <button className="btn-secondary btn-sm" style={{ borderColor:'rgba(167,139,250,0.4)', color:'#a78bfa' }} onClick={() => handleUnarchive(ev)}>↩ Bỏ lưu trữ</button>
                )}
                {user?.role === 'SUPER_ADMIN' && ev.status === 'cancelled' && (
                  <button className="btn-danger btn-sm" title="Chuyển vào thùng rác" onClick={() => handleDelete(ev)}>🗑</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modal === 'form' && (
        <Modal title={selected ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'} onClose={() => setModal(null)} size="lg">
          <EventForm
            initial={selected}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            allEvents={events}
            statusOnly={!canFullEdit && !!selected}
            creatorName={user?.full_name || ''}
          />
        </Modal>
      )}

      {modal === 'detail' && selected && (
        <EventDetailModal eventId={selected.id} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
