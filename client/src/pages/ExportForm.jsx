import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { printSlip, previewSlip } from '../utils/printSlip';
import DateInput from '../components/DateInput';

const DEPTS = [
  { value: '',       label: 'Tất cả',     cats: null },
  { value: 'TECH',   label: '🛠️ Kỹ Thuật', cats: ['TECH'] },
  { value: 'ATAS',   label: '💡 ATAS',     cats: ['AUDIO', 'LIGHT', 'LED', 'MATRIX'] },
  { value: 'STAGE',  label: '🎭 Sân Khấu', cats: ['STAGE'] },
  { value: 'CSVC',   label: '🏢 CSVC',     cats: ['CSVC'] },
];

// Map role → default dept value
const ROLE_DEPT = {
  TECHNICAL: 'TECH',
  ATAS:      'ATAS',
  STAGE:     'STAGE',
  CSVC:      'CSVC',
};

// Roles that cannot change the dept selector
const LOCKED_ROLES = ['TECHNICAL', 'ATAS', 'STAGE', 'CSVC'];

const emptyRows = (n = 10) => Array.from({ length: n }, () => ({ equipment_id: '', quantity: 1, notes: '' }));

export default function ExportForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const defaultDept = ROLE_DEPT[user?.role] || '';
  const isLocked = LOCKED_ROLES.includes(user?.role);

  const [equipment, setEquipment] = useState([]);
  const [events, setEvents]       = useState([]);
  const [deptFilter, setDeptFilter] = useState(defaultDept);
  const [form, setForm] = useState({
    event_id: '',
    responsible_person: '',
    expected_return_date: '',
    notes: '',
  });
  const [items, setItems]           = useState(emptyRows(10));
  const [searchTerms, setSearchTerms] = useState(Array(10).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [doneSlip, setDoneSlip]     = useState(null);

  useEffect(() => {
    api.getEquipment().then(setEquipment);
    api.getEvents().then(setEvents);
  }, []);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addItem = () => {
    setItems(i => [...i, ...emptyRows(5)]);
    setSearchTerms(s => [...s, ...Array(5).fill('')]);
  };

  const removeItem = (idx) => {
    setItems(i => i.filter((_, j) => j !== idx));
    setSearchTerms(s => s.filter((_, j) => j !== idx));
  };

  const setItem = (idx, key, val) =>
    setItems(items.map((it, j) => j === idx ? { ...it, [key]: val } : it));

  // Filter equipment by dept + search term
  const deptCats = DEPTS.find(d => d.value === deptFilter)?.cats ?? null;

  const filteredEquip = (term, currentIdx) => {
    const usedIds = new Set(
      items
        .filter((_, j) => j !== currentIdx)
        .map(i => String(i.equipment_id))
        .filter(Boolean)
    );
    let list = deptCats
      ? equipment.filter(e => deptCats.includes(e.category_code))
      : equipment;
    list = list.filter(e => !usedIds.has(String(e.id)));
    if (term) {
      const t = term.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(t) || e.code.toLowerCase().includes(t));
    }
    return list.slice(0, 20);
  };

  const submit = async (e) => {
    e.preventDefault();
    const validItems = items.filter(it => it.equipment_id && it.quantity > 0);
    if (validItems.length === 0) { alert('Chưa chọn thiết bị nào'); return; }
    setSubmitting(true);
    try {
      const res = await api.createOut({ ...form, items: validItems });
      // Load full transaction for printing
      const full = await api.getTransactionById(res.id);
      setDoneSlip(full);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // After success — show confirmation with print option
  if (doneSlip) {
    return (
      <div className="p-6 max-w-lg">
        <div className="card text-center space-y-5">
          <div className="text-5xl">✅</div>
          <h2 style={{ color:'#4ade80', fontSize:'1.2rem', fontWeight:700 }}>Xuất kho thành công!</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>
            Phiếu <strong style={{ color:'var(--gold)', fontFamily:'monospace' }}>{doneSlip.code}</strong> đã được tạo
            với <strong style={{ color:'var(--text-primary)' }}>{doneSlip.items?.length}</strong> loại thiết bị.
          </p>

          {/* Row 1: Preview + Print */}
          <div className="flex gap-3 justify-center">
            <button onClick={() => previewSlip(doneSlip)} className="btn-secondary flex items-center gap-2">
              👁 Xem trước
            </button>
            <button onClick={() => printSlip(doneSlip)} className="btn-primary flex items-center gap-2">
              🖨️ In phiếu
            </button>
          </div>

          {/* Row 2: Back to edit + History */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setDoneSlip(null)}
              style={{
                display:'flex', alignItems:'center', gap:'6px',
                padding:'8px 16px', borderRadius:'8px', fontSize:'0.875rem',
                background:'rgba(201,168,76,0.1)',
                border:'1px solid rgba(201,168,76,0.35)',
                color:'#e8c97a', cursor:'pointer',
              }}>
              ← Quay lại chỉnh sửa
            </button>
            <button onClick={() => navigate('/transactions')} className="btn-secondary">
              Xem lịch sử
            </button>
          </div>

          {/* New slip */}
          <button
            onClick={() => {
              setDoneSlip(null);
              setForm({ event_id: '', responsible_person: '', expected_return_date: '', notes: '' });
              setItems(emptyRows(10));
              setSearchTerms(Array(10).fill(''));
            }}
            style={{ color:'var(--text-muted)', fontSize:'0.8rem', background:'none', border:'none', cursor:'pointer' }}>
            + Tạo phiếu mới
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Phiếu Xuất Kho</h1>
        <p className="text-gray-500 text-sm">Thiết bị đi sự kiện hoặc sử dụng nội bộ</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Header info */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-700">Thông tin phiếu</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Sự kiện / Dự án</label>
              <select className="input" value={form.event_id} onChange={e => setField('event_id', e.target.value)}>
                <option value="">-- Nội bộ (không có sự kiện) --</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.code} · {ev.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Người phụ trách *</label>
              <input className="input" required value={form.responsible_person}
                onChange={e => setField('responsible_person', e.target.value)}
                placeholder="Tên người nhận thiết bị" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Ngày dự kiến trả</label>
              <DateInput value={form.expected_return_date}
                onChange={v => setField('expected_return_date', v)} />
            </div>
            <div>
              <label className="label">Ghi chú</label>
              <input className="input" value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                placeholder="Ghi chú thêm..." />
            </div>
          </div>
        </div>

        {/* Equipment items */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Danh sách thiết bị xuất</h2>
            <button type="button" className="btn-secondary btn-sm" onClick={addItem}>+ Thêm 5 dòng</button>
          </div>

          {/* Department filter */}
          <div>
            <label className="label">Lọc theo bộ phận</label>
            <div className="flex flex-wrap gap-2">
              {DEPTS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  disabled={isLocked && d.value !== deptFilter}
                  onClick={() => {
                    if (!isLocked) {
                      setDeptFilter(d.value);
                      setItems(emptyRows(10));
                      setSearchTerms(Array(10).fill(''));
                    }
                  }}
                  style={{
                    padding: '6px 14px', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600,
                    border: deptFilter === d.value ? '1px solid #c9a84c' : '1px solid rgba(201,168,76,0.25)',
                    background: deptFilter === d.value ? '#c9a84c' : 'transparent',
                    color: deptFilter === d.value ? '#08080e' : '#c9a84c',
                    cursor: (isLocked && d.value !== deptFilter) ? 'not-allowed' : 'pointer',
                    opacity: (isLocked && d.value !== deptFilter) ? 0.3 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {deptCats && (
              <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:'4px' }}>
                Đang hiển thị: <strong style={{ color:'var(--gold)' }}>{deptCats.join(', ')}</strong>
              </p>
            )}
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => {
              const eq = equipment.find(e => String(e.id) === String(item.equipment_id));
              return (
                <div key={idx} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-7 h-8 flex items-center justify-center text-sm font-bold text-gray-400 mt-1">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <input
                      className="input mb-1 eq-search"
                      style={{ color: '#f87171', fontSize: '1.4rem', fontWeight: 700 }}
                      placeholder={deptCats
                        ? `Tìm trong ${DEPTS.find(d=>d.value===deptFilter)?.label}...`
                        : 'Tìm thiết bị theo tên hoặc mã...'}
                      value={searchTerms[idx]}
                      onChange={e => {
                        const newTerms = [...searchTerms];
                        newTerms[idx] = e.target.value;
                        setSearchTerms(newTerms);
                        setItem(idx, 'equipment_id', '');
                      }}
                    />
                    {searchTerms[idx] && !item.equipment_id && (
                      <div className="max-h-48 overflow-y-auto" style={{ background:'#13131d', border:'1px solid rgba(201,168,76,0.3)', borderRadius:'0.5rem', boxShadow:'0 8px 24px rgba(0,0,0,0.6)' }}>
                        {filteredEquip(searchTerms[idx], idx).map(e => (
                          <button type="button" key={e.id}
                            className="w-full text-left px-3 py-2 text-sm border-b last:border-0"
                            style={{ borderColor:'rgba(201,168,76,0.15)' }}
                            onMouseEnter={e2 => e2.currentTarget.style.background='rgba(201,168,76,0.08)'}
                            onMouseLeave={e2 => e2.currentTarget.style.background='transparent'}
                            onClick={() => {
                              setItem(idx, 'equipment_id', e.id);
                              const newTerms = [...searchTerms];
                              newTerms[idx] = e.name;
                              setSearchTerms(newTerms);
                            }}>
                            <span style={{ color:'#c9a84c', fontWeight:600, marginRight:'6px' }}>{e.name}</span>
                            <span style={{ fontFamily:'monospace', fontSize:'0.72rem', color:'#7878a0', marginRight:'4px' }}>{e.code}</span>
                            <span style={{ fontSize:'0.72rem', color:'#7878a0' }}>[{e.category_code}]</span>
                            <span className={`ml-2 text-xs font-semibold ${e.qty_available === 0 ? 'text-red-500' : 'text-green-600'}`}>
                              · {e.qty_available} {e.unit} có sẵn
                            </span>
                          </button>
                        ))}
                        {filteredEquip(searchTerms[idx], idx).length === 0 && (
                          <p className="px-3 py-2 text-sm" style={{ color:'#7878a0' }}>Không tìm thấy</p>
                        )}
                      </div>
                    )}
                    {eq && (
                      <p className="text-xs text-green-700 mt-1">
                        ✅ {eq.name} · <span className="text-gray-500">[{eq.category_code}]</span> · Có sẵn: <strong>{eq.qty_available}</strong> {eq.unit}
                      </p>
                    )}
                  </div>
                  <div className="w-24 flex-shrink-0">
                    <label className="label text-xs">Số lượng</label>
                    <input type="number" min="1"
                      value={item.quantity}
                      onChange={e => setItem(idx, 'quantity', +e.target.value)}
                      style={{
                        width:'100%', padding:'6px 8px',
                        background:'rgba(255,255,255,0.04)',
                        border:'1px solid rgba(201,168,76,0.3)',
                        borderRadius:'0.5rem',
                        color:'#4ade80',
                        fontSize:'1.4rem',
                        fontWeight:700,
                        textAlign:'center',
                        outline:'none',
                      }}
                    />
                  </div>
                  <button type="button" className="btn-danger btn-sm mt-5 flex-shrink-0"
                    onClick={() => removeItem(idx)}>✕</button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Đang xuất...' : '⬆️ Xác nhận xuất kho'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Hủy</button>
        </div>
      </form>
    </div>
  );
}
