import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { api } from '../api';
import Modal from '../components/Modal';

const STATUS_LABELS = { available: 'Có sẵn', in_use: 'Đang dùng', maintenance: 'Sửa chữa', damaged: 'Hỏng', lost: 'Mất' };

function EquipmentForm({ categories, initial, onSave, onCancel }) {
  const [form, setForm] = useState(
    initial || { code: '', name: '', category_id: '', unit: 'Cái', unit_price: 0, qty_total: 0, notes: '' }
  );
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    await onSave(form);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Mã thiết bị *</label>
          <input className="input" value={form.code} onChange={e => set('code', e.target.value)} required disabled={!!initial} />
        </div>
        <div>
          <label className="label">Danh mục</label>
          <select className="input" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
            <option value="">-- Chọn --</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Tên thiết bị *</label>
        <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Đơn vị</label>
          <select className="input" value={form.unit} onChange={e => set('unit', e.target.value)}>
            {['Cái','Bộ','Mét','M2','Gói','Cặp'].map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Đơn giá (đ/ngày)</label>
          <input className="input" type="number" min="0" value={form.unit_price} onChange={e => set('unit_price', +e.target.value)} />
        </div>
        {!initial && (
          <div>
            <label className="label">Số lượng ban đầu</label>
            <input className="input" type="number" min="0" value={form.qty_total} onChange={e => set('qty_total', +e.target.value)} />
          </div>
        )}
      </div>
      <div>
        <label className="label">Ghi chú</label>
        <textarea className="input" rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1">{initial ? 'Cập nhật' : 'Thêm thiết bị'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Hủy</button>
      </div>
    </form>
  );
}

function QRModal({ equipment, onClose }) {
  const [qr, setQr] = useState(null);
  useEffect(() => {
    QRCode.toDataURL(`EQUIP:${equipment.code}:${equipment.id}`, { width: 256 }).then(setQr);
  }, [equipment.id, equipment.code]);

  return (
    <Modal title={`QR Code · ${equipment.code}`} onClose={onClose} size="sm">
      <div className="text-center space-y-3">
        {qr ? <img src={qr} alt="QR" className="mx-auto w-48 h-48" /> : <p className="text-gray-400">Đang tạo...</p>}
        <p className="font-medium">{equipment.name}</p>
        <p className="text-gray-500 text-sm">{equipment.code}</p>
        {qr && (
          <a href={qr} download={`${equipment.code}.png`} className="btn-primary btn-sm">Tải QR Code</a>
        )}
      </div>
    </Modal>
  );
}

function HistoryModal({ equipment, onClose }) {
  const [history, setHistory] = useState([]);
  useEffect(() => { api.getEquipmentHistory(equipment.id).then(setHistory); }, [equipment.id]);

  const typeColors = { OUT: 'text-red-600', RETURN: 'text-green-600', FIX: 'text-blue-600' };
  const typeLabels = { OUT: 'Xuất', RETURN: 'Nhập', FIX: 'Sửa xong' };

  return (
    <Modal title={`Lịch sử · ${equipment.name}`} onClose={onClose} size="lg">
      {history.length === 0 ? (
        <p className="text-gray-400 text-center py-8">Chưa có lịch sử</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="border-b text-gray-500 text-left">
            <th className="pb-2">Loại</th><th className="pb-2">Phiếu</th>
            <th className="pb-2">Sự kiện</th><th className="pb-2">SL</th>
            <th className="pb-2">Người phụ trách</th><th className="pb-2">Ngày</th>
          </tr></thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                <td className={`py-2 font-medium ${typeColors[h.type] || ''}`}>{typeLabels[h.type] || h.type}</td>
                <td className="py-2 font-mono text-xs">{h.tx_code}</td>
                <td className="py-2">{h.event_name || '—'}</td>
                <td className="py-2 font-bold">{h.quantity}</td>
                <td className="py-2">{h.responsible_person || '—'}</td>
                <td className="py-2 text-gray-400">{h.transaction_date?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

export default function Equipment() {
  const [equipment, setEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'qr' | 'history'
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const params = {};
    if (search) params.search = search;
    if (catFilter) params.category = catFilter;
    api.getEquipment(params).then(setEquipment).finally(() => setLoading(false));
  }, [search, catFilter]);

  useEffect(() => { api.getCategories().then(setCategories); }, []);
  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    try {
      if (selected) {
        await api.updateEquipment(selected.id, form);
      } else {
        await api.createEquipment(form);
      }
      setModal(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDelete = async (eq) => {
    if (!confirm(`Xóa "${eq.name}"?`)) return;
    try {
      await api.deleteEquipment(eq.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Thiết Bị</h1>
          <p className="text-gray-500 text-sm">{equipment.length} thiết bị</p>
        </div>
        <button className="btn-primary" onClick={() => { setSelected(null); setModal('add'); }}>
          + Thêm thiết bị
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          className="input max-w-xs"
          placeholder="Tìm theo tên, mã..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input max-w-xs" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">Tất cả danh mục</option>
          {categories.map(c => <option key={c.code} value={c.code}>{c.icon} {c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Mã</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Tên thiết bị</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Danh mục</th>
              <th className="text-center px-3 py-3 text-gray-600 font-medium">Có sẵn</th>
              <th className="text-center px-3 py-3 text-gray-600 font-medium">Đang dùng</th>
              <th className="text-center px-3 py-3 text-gray-600 font-medium">Sửa</th>
              <th className="text-center px-3 py-3 text-gray-600 font-medium">Hỏng</th>
              <th className="text-center px-3 py-3 text-gray-600 font-medium">Tổng</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">Đang tải...</td></tr>
            )}
            {!loading && equipment.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">Không tìm thấy thiết bị</td></tr>
            )}
            {equipment.map(eq => (
              <tr key={eq.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">{eq.code}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{eq.name}</p>
                  {eq.notes && <p className="text-xs text-gray-400 truncate max-w-[200px]">{eq.notes}</p>}
                </td>
                <td className="px-4 py-3 text-gray-500">{eq.category_icon} {eq.category_name}</td>
                <td className="px-3 py-3 text-center">
                  <span className={`font-bold ${eq.qty_available === 0 ? 'text-red-600' : eq.qty_available <= 2 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {eq.qty_available}
                  </span>
                </td>
                <td className="px-3 py-3 text-center text-blue-600 font-medium">{eq.qty_in_use || 0}</td>
                <td className="px-3 py-3 text-center text-yellow-600">{eq.qty_maintenance || 0}</td>
                <td className="px-3 py-3 text-center text-red-600">{(eq.qty_damaged || 0) + (eq.qty_lost || 0)}</td>
                <td className="px-3 py-3 text-center font-medium">{eq.qty_total}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button className="btn-secondary btn-sm" title="QR Code"
                      onClick={() => { setSelected(eq); setModal('qr'); }}>QR</button>
                    <button className="btn-secondary btn-sm" title="Lịch sử"
                      onClick={() => { setSelected(eq); setModal('history'); }}>📋</button>
                    <button className="btn-secondary btn-sm"
                      onClick={() => { setSelected(eq); setModal('edit'); }}>✏️</button>
                    <button className="btn-danger btn-sm"
                      onClick={() => handleDelete(eq)}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal === 'add' ? 'Thêm thiết bị mới' : 'Chỉnh sửa thiết bị'} onClose={() => setModal(null)} size="lg">
          <EquipmentForm
            categories={categories}
            initial={modal === 'edit' ? selected : null}
            onSave={handleSave}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {modal === 'qr' && selected && (
        <QRModal equipment={selected} onClose={() => setModal(null)} />
      )}

      {modal === 'history' && selected && (
        <HistoryModal equipment={selected} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
