import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';

const STATUS_MAP = {
  planned:   { label: 'Lên kế hoạch', cls: 'badge-maintenance' },
  active:    { label: 'Đang diễn ra', cls: 'badge-in_use' },
  completed: { label: 'Hoàn thành',   cls: 'badge-available' },
  cancelled: { label: 'Đã hủy',       cls: 'badge-lost' },
};

function EventForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    name: '', client: '', location: '', start_date: '', end_date: '', status: 'planned', notes: ''
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={async e => { e.preventDefault(); await onSave(form); }} className="space-y-4">
      <div>
        <label className="label">Tên sự kiện *</label>
        <input className="input" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="VD: Gala Dinner Công Ty ABC 2025" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Khách hàng</label>
          <input className="input" value={form.client || ''} onChange={e => set('client', e.target.value)} />
        </div>
        <div>
          <label className="label">Địa điểm</label>
          <input className="input" value={form.location || ''} onChange={e => set('location', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Ngày bắt đầu</label>
          <input className="input" type="date" value={form.start_date || ''} onChange={e => set('start_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Ngày kết thúc</label>
          <input className="input" type="date" value={form.end_date || ''} onChange={e => set('end_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Trạng thái</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(STATUS_MAP).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Ghi chú</label>
        <textarea className="input" rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
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
          <div><span className="text-gray-500">Từ: </span><strong>{ev.start_date || '—'}</strong></div>
          <div><span className="text-gray-500">Đến: </span><strong>{ev.end_date || '—'}</strong></div>
        </div>
        {ev.notes && <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{ev.notes}</p>}

        <div>
          <h3 className="font-semibold mb-2">Thiết bị xuất cho sự kiện này</h3>
          {ev.items.length === 0 ? (
            <p className="text-gray-400 text-sm">Chưa có thiết bị nào được xuất</p>
          ) : (
            <table className="w-full text-sm">
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
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function Events() {
  const [events, setEvents] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    const params = statusFilter ? { status: statusFilter } : {};
    api.getEvents(params).then(setEvents);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    try {
      if (selected) await api.updateEvent(selected.id, form);
      else await api.createEvent(form);
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (ev) => {
    if (!confirm(`Xóa sự kiện "${ev.name}"?`)) return;
    try { await api.deleteEvent(ev.id); load(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sự Kiện / Dự Án</h1>
          <p className="text-gray-500 text-sm">{events.length} sự kiện</p>
        </div>
        <button className="btn-primary" onClick={() => { setSelected(null); setModal('form'); }}>
          + Tạo sự kiện
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {[['', 'Tất cả'], ['planned', 'Lên kế hoạch'], ['active', 'Đang diễn ra'], ['completed', 'Hoàn thành'], ['cancelled', 'Đã hủy']].map(([v, l]) => (
          <button key={v}
            className={`btn btn-sm ${statusFilter === v ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter(v)}>
            {l}
          </button>
        ))}
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
            <div key={ev.id} className="card flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-xs text-gray-400">{ev.code}</span>
                  <span className={s.cls}>{s.label}</span>
                </div>
                <h3 className="font-semibold text-lg">{ev.name}</h3>
                <div className="flex gap-4 text-sm text-gray-500 mt-1">
                  {ev.client && <span>👤 {ev.client}</span>}
                  {ev.location && <span>📍 {ev.location}</span>}
                  {ev.start_date && <span>📅 {ev.start_date}{ev.end_date ? ` → ${ev.end_date}` : ''}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm text-gray-400 mb-2">{ev.tx_count} phiếu</p>
                <div className="flex gap-2">
                  <button className="btn-secondary btn-sm" onClick={() => { setSelected(ev); setModal('detail'); }}>
                    Chi tiết
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => { setSelected(ev); setModal('form'); }}>
                    ✏️
                  </button>
                  <button className="btn-danger btn-sm" onClick={() => handleDelete(ev)}>🗑</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal === 'form' && (
        <Modal title={selected ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'} onClose={() => setModal(null)} size="lg">
          <EventForm initial={selected} onSave={handleSave} onCancel={() => setModal(null)} />
        </Modal>
      )}

      {modal === 'detail' && selected && (
        <EventDetailModal eventId={selected.id} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
