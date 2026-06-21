import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

const CONDITIONS = [
  { value: 'good', label: 'Tốt - Nhập kho', color: 'text-green-700' },
  { value: 'damaged', label: 'Hỏng - Chờ xử lý', color: 'text-red-700' },
  { value: 'maintenance', label: 'Cần sửa', color: 'text-yellow-700' },
  { value: 'lost', label: 'Mất', color: 'text-gray-700' },
];

export default function ReturnForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState('return'); // 'return' | 'fix'
  const [equipment, setEquipment] = useState([]);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ event_id: '', responsible_person: user?.full_name || '', notes: '' });
  const [items, setItems] = useState([{ equipment_id: '', quantity: 1, condition: 'good', notes: '' }]);
  const [submitting, setSubmitting]     = useState(false);
  const [searchTerms, setSearchTerms]   = useState(['']);
  const [loadingEvent, setLoadingEvent] = useState(false);

  useEffect(() => {
    api.getEquipment().then(setEquipment);
    api.getEvents().then(setEvents);
  }, []);

  const setField = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    // Auto-load outstanding equipment when event is selected
    if (k === 'event_id') {
      if (!v) {
        setItems([{ equipment_id: '', quantity: 1, condition: 'good', notes: '' }]);
        setSearchTerms(['']);
        return;
      }
      setLoadingEvent(true);
      api.getOutstanding(v).then(rows => {
        if (rows.length > 0) {
          setItems(rows.map(r => ({ equipment_id: r.equipment_id, quantity: r.qty_pending, condition: 'good', notes: '' })));
          setSearchTerms(rows.map(r => r.eq_name));
        } else {
          setItems([{ equipment_id: '', quantity: 1, condition: 'good', notes: '' }]);
          setSearchTerms(['']);
        }
      }).finally(() => setLoadingEvent(false));
    }
  };
  const addItem = () => { setItems(i => [...i, { equipment_id: '', quantity: 1, condition: 'good', notes: '' }]); setSearchTerms(s => [...s, '']); };
  const removeItem = (idx) => { setItems(i => i.filter((_, j) => j !== idx)); setSearchTerms(s => s.filter((_, j) => j !== idx)); };
  const setItem = (idx, key, val) => setItems(items.map((it, j) => j === idx ? { ...it, [key]: val } : it));

  const filteredEquip = (term) => {
    const pool = mode === 'fix'
      ? equipment.filter(e => e.qty_maintenance > 0)
      : equipment.filter(e => e.qty_in_use > 0);
    if (!term) return pool.slice(0, 20);
    const t = term.toLowerCase();
    return pool.filter(e => e.name.toLowerCase().includes(t) || e.code.toLowerCase().includes(t)).slice(0, 15);
  };

  const submit = async (e) => {
    e.preventDefault();
    const validItems = items.filter(it => it.equipment_id && it.quantity > 0);
    if (validItems.length === 0) { alert('Chưa chọn thiết bị nào'); return; }
    setSubmitting(true);
    try {
      let res;
      if (mode === 'fix') {
        res = await api.createFix({ notes: form.notes, items: validItems });
      } else {
        res = await api.createReturn({ ...form, items: validItems });
      }
      alert(`Nhập kho thành công! Phiếu: ${res.code}`);
      navigate('/transactions');
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Phiếu Nhập Kho</h1>
        <p className="text-gray-500 text-sm">Trả thiết bị từ sự kiện hoặc nhập sau sửa chữa</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          className={`btn ${mode === 'return' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMode('return')}>
          ⬇️ Trả từ sự kiện
        </button>
        <button
          type="button"
          className={`btn ${mode === 'fix' ? 'btn-success' : 'btn-secondary'}`}
          onClick={() => setMode('fix')}>
          🔧 Sửa xong - nhập kho
        </button>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {mode === 'return' && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-700">Thông tin phiếu</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Sự kiện</label>
                <select className="input" value={form.event_id} onChange={e => setField('event_id', e.target.value)}
                  style={{ color: form.event_id ? '#f87171' : 'var(--text-muted)', fontWeight: form.event_id ? 700 : 400 }}>
                  <option value="">-- Chọn sự kiện --</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.code} · {ev.name}</option>)}
                </select>
                {loadingEvent && <p style={{ fontSize:'0.75rem', color:'var(--gold)', marginTop:'4px' }}>Đang tải thiết bị...</p>}
                {!loadingEvent && form.event_id && items.some(i => i.equipment_id) && (
                  <p style={{ fontSize:'0.75rem', color:'#4ade80', marginTop:'4px' }}>✅ Đã load {items.filter(i => i.equipment_id).length} thiết bị chưa trả</p>
                )}
                {!loadingEvent && form.event_id && !items.some(i => i.equipment_id) && (
                  <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'4px' }}>Tất cả thiết bị đã được trả</p>
                )}
              </div>
              <div>
                <label className="label">Người bàn giao</label>
                <input className="input" value={form.responsible_person}
                  onChange={e => setField('responsible_person', e.target.value)}
                  placeholder="Người trả thiết bị" />
              </div>
            </div>
            <div>
              <label className="label">Ghi chú</label>
              <input className="input" value={form.notes} onChange={e => setField('notes', e.target.value)} />
            </div>
          </div>
        )}

        {mode === 'fix' && (
          <div className="card">
            <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">
              🔧 Chỉ hiển thị thiết bị đang trong tình trạng <strong>đang sửa chữa</strong>.
              Nhập kho sẽ chuyển về tình trạng <strong>có sẵn</strong>.
            </p>
          </div>
        )}

        {/* Items */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Danh sách thiết bị nhập</h2>
            <button type="button" className="btn-secondary btn-sm" onClick={addItem}>+ Thêm dòng</button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => {
              const eq = equipment.find(e => String(e.id) === String(item.equipment_id));
              return (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      <input
                        className="input text-sm"
                        placeholder={mode === 'fix' ? 'Tìm thiết bị đang sửa...' : 'Tìm thiết bị đang sử dụng...'}
                        value={searchTerms[idx]}
                        onChange={e => {
                          const t = [...searchTerms]; t[idx] = e.target.value; setSearchTerms(t);
                          setItem(idx, 'equipment_id', '');
                        }}
                      />
                      {searchTerms[idx] && !item.equipment_id && (
                        <div className="border rounded-lg bg-white shadow-sm max-h-40 overflow-y-auto mt-1">
                          {filteredEquip(searchTerms[idx]).map(e => (
                            <button type="button" key={e.id}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0"
                              onClick={() => {
                                setItem(idx, 'equipment_id', e.id);
                                const t = [...searchTerms]; t[idx] = `${e.code} · ${e.name}`; setSearchTerms(t);
                              }}>
                              <span className="font-mono text-xs text-gray-500 mr-2">{e.code}</span>
                              {e.name}
                              <span className="ml-2 text-xs text-blue-600">
                                ({mode === 'fix' ? e.qty_maintenance : e.qty_in_use} {e.unit} {mode === 'fix' ? 'đang sửa' : 'đang dùng'})
                              </span>
                            </button>
                          ))}
                          {filteredEquip(searchTerms[idx]).length === 0 && (
                            <p className="px-3 py-2 text-sm text-gray-400">Không tìm thấy thiết bị phù hợp</p>
                          )}
                        </div>
                      )}
                      {eq && <p className="text-xs text-blue-700 mt-1">✅ {eq.name}</p>}
                    </div>
                    <div className="w-24 flex-shrink-0">
                      <label className="label text-xs">Số lượng</label>
                      <input className="input text-sm" type="number" min="1"
                        value={item.quantity} onChange={e => setItem(idx, 'quantity', +e.target.value)} />
                    </div>
                    <button type="button" className="btn-danger btn-sm mt-5 flex-shrink-0" onClick={() => removeItem(idx)}>✕</button>
                  </div>

                  {mode === 'return' && (
                    <div>
                      <label className="label text-xs">Tình trạng khi nhận lại</label>
                      <div className="flex gap-2 flex-wrap">
                        {CONDITIONS.map(c => (
                          <label key={c.value} className="flex items-center gap-1 text-sm cursor-pointer">
                            <input type="radio" name={`cond-${idx}`} value={c.value}
                              checked={item.condition === c.value}
                              onChange={() => setItem(idx, 'condition', c.value)} />
                            <span className={c.color}>{c.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="btn-success flex-1">
            {submitting ? 'Đang nhập...' : '⬇️ Xác nhận nhập kho'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Hủy</button>
        </div>
      </form>
    </div>
  );
}
