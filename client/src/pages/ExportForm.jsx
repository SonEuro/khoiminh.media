import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function ExportForm() {
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState([]);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({
    event_id: '',
    responsible_person: '',
    expected_return_date: '',
    notes: '',
  });
  const [items, setItems] = useState([{ equipment_id: '', quantity: 1, notes: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerms, setSearchTerms] = useState(['']);

  useEffect(() => {
    api.getEquipment().then(setEquipment);
    api.getEvents().then(setEvents);
  }, []);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addItem = () => {
    setItems(i => [...i, { equipment_id: '', quantity: 1, notes: '' }]);
    setSearchTerms(s => [...s, '']);
  };

  const removeItem = (idx) => {
    setItems(i => i.filter((_, j) => j !== idx));
    setSearchTerms(s => s.filter((_, j) => j !== idx));
  };

  const setItem = (idx, key, val) =>
    setItems(items.map((it, j) => j === idx ? { ...it, [key]: val } : it));

  const filteredEquip = (term) => {
    if (!term) return equipment.slice(0, 20);
    const t = term.toLowerCase();
    return equipment.filter(e => e.name.toLowerCase().includes(t) || e.code.toLowerCase().includes(t)).slice(0, 15);
  };

  const submit = async (e) => {
    e.preventDefault();
    const validItems = items.filter(it => it.equipment_id && it.quantity > 0);
    if (validItems.length === 0) { alert('Chưa chọn thiết bị nào'); return; }
    setSubmitting(true);
    try {
      const res = await api.createOut({ ...form, items: validItems });
      alert(`Xuất kho thành công! Phiếu: ${res.code}`);
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
              <input className="input" type="date" value={form.expected_return_date}
                onChange={e => setField('expected_return_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Ghi chú</label>
              <input className="input" value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                placeholder="Ghi chú thêm..." />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Danh sách thiết bị xuất</h2>
            <button type="button" className="btn-secondary btn-sm" onClick={addItem}>+ Thêm dòng</button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => {
              const eq = equipment.find(e => String(e.id) === String(item.equipment_id));
              return (
                <div key={idx} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <input
                      className="input mb-1 text-sm"
                      placeholder="Tìm thiết bị theo tên hoặc mã..."
                      value={searchTerms[idx]}
                      onChange={e => {
                        const newTerms = [...searchTerms];
                        newTerms[idx] = e.target.value;
                        setSearchTerms(newTerms);
                        setItem(idx, 'equipment_id', '');
                      }}
                    />
                    {searchTerms[idx] && !item.equipment_id && (
                      <div className="border rounded-lg bg-white shadow-sm max-h-40 overflow-y-auto">
                        {filteredEquip(searchTerms[idx]).map(e => (
                          <button type="button" key={e.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0"
                            onClick={() => {
                              setItem(idx, 'equipment_id', e.id);
                              const newTerms = [...searchTerms];
                              newTerms[idx] = `${e.code} · ${e.name}`;
                              setSearchTerms(newTerms);
                            }}>
                            <span className="font-mono text-xs text-gray-500 mr-2">{e.code}</span>
                            {e.name}
                            <span className={`ml-2 text-xs font-medium ${e.qty_available === 0 ? 'text-red-600' : 'text-green-600'}`}>
                              ({e.qty_available} {e.unit} có sẵn)
                            </span>
                          </button>
                        ))}
                        {filteredEquip(searchTerms[idx]).length === 0 && (
                          <p className="px-3 py-2 text-sm text-gray-400">Không tìm thấy</p>
                        )}
                      </div>
                    )}
                    {eq && (
                      <p className="text-xs text-green-700 mt-1">
                        ✅ {eq.name} · Có sẵn: <strong>{eq.qty_available}</strong> {eq.unit}
                      </p>
                    )}
                  </div>
                  <div className="w-24 flex-shrink-0">
                    <label className="label text-xs">Số lượng</label>
                    <input className="input text-sm" type="number" min="1"
                      value={item.quantity}
                      onChange={e => setItem(idx, 'quantity', +e.target.value)} />
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
