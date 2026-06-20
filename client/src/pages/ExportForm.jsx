import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { printSlip } from '../utils/printSlip';

const DEPTS = [
  { value: '',       label: 'Tất cả bộ phận',          cats: null },
  { value: 'TECH',   label: '🛠️ Kỹ Thuật',             cats: ['TECH'] },
  { value: 'ATAS',   label: '💡 ATAS – Âm Thanh / Ánh Sáng / LED', cats: ['AUDIO', 'LIGHT', 'LED', 'MATRIX'] },
  { value: 'STAGE',  label: '🎭 Sân Khấu',              cats: ['STAGE'] },
  { value: 'CSVC',   label: '🏢 Cơ Sở Vật Chất',       cats: ['CSVC'] },
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
    setItems(i => [...i, { equipment_id: '', quantity: 1, notes: '' }]);
    setSearchTerms(s => [...s, '']);
  };

  const removeItem = (idx) => {
    setItems(i => i.filter((_, j) => j !== idx));
    setSearchTerms(s => s.filter((_, j) => j !== idx));
  };

  const setItem = (idx, key, val) =>
    setItems(items.map((it, j) => j === idx ? { ...it, [key]: val } : it));

  // Filter equipment by dept + search term
  const deptCats = DEPTS.find(d => d.value === deptFilter)?.cats ?? null;

  const filteredEquip = (term) => {
    let list = deptCats
      ? equipment.filter(e => deptCats.includes(e.category_code))
      : equipment;
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
        <div className="card text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold text-green-700">Xuất kho thành công!</h2>
          <p className="text-gray-600">
            Phiếu <strong className="font-mono">{doneSlip.code}</strong> đã được tạo
            với <strong>{doneSlip.items?.length}</strong> loại thiết bị.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => printSlip(doneSlip)}
              className="btn-primary flex items-center gap-2">
              🖨️ In Phiếu Xuất Kho
            </button>
            <button
              onClick={() => navigate('/transactions')}
              className="btn-secondary">
              Xem lịch sử
            </button>
          </div>
          <button
            onClick={() => {
              setDoneSlip(null);
              setForm({ event_id: '', responsible_person: '', expected_return_date: '', notes: '' });
              setItems(emptyRows(10));
              setSearchTerms(Array(10).fill(''));
            }}
            className="text-sm text-blue-600 hover:underline">
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

        {/* Equipment items */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Danh sách thiết bị xuất</h2>
            <button type="button" className="btn-secondary btn-sm" onClick={addItem}>+ Thêm dòng</button>
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
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                    ${deptFilter === d.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'}
                    ${isLocked && d.value !== deptFilter ? 'opacity-30 cursor-not-allowed' : ''}
                  `}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {deptCats && (
              <p className="text-xs text-blue-600 mt-1">
                Đang hiển thị thiết bị: <strong>{deptCats.join(', ')}</strong>
              </p>
            )}
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => {
              const eq = equipment.find(e => String(e.id) === String(item.equipment_id));
              return (
                <div key={idx} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <input
                      className="input mb-1 text-sm"
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
                      <div className="border rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto">
                        {filteredEquip(searchTerms[idx]).map(e => (
                          <button type="button" key={e.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0"
                            onClick={() => {
                              setItem(idx, 'equipment_id', e.id);
                              const newTerms = [...searchTerms];
                              newTerms[idx] = `${e.code} · ${e.name}`;
                              setSearchTerms(newTerms);
                            }}>
                            <span className="font-mono text-xs text-gray-400 mr-1">{e.code}</span>
                            <span className="mr-1">{e.name}</span>
                            <span className="text-xs text-gray-400">[{e.category_code}]</span>
                            <span className={`ml-2 text-xs font-semibold ${e.qty_available === 0 ? 'text-red-500' : 'text-green-600'}`}>
                              · {e.qty_available} {e.unit} có sẵn
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
                        ✅ {eq.name} · <span className="text-gray-500">[{eq.category_code}]</span> · Có sẵn: <strong>{eq.qty_available}</strong> {eq.unit}
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
