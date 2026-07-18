import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';

const GOLD = '#c9a84c';
const DEPT_OPTIONS = [
  { value: 'TECH',  label: 'Kỹ Thuật' },
  { value: 'ATAS',  label: 'ATAS' },
  { value: 'STAGE', label: 'Sân Khấu' },
  { value: '',      label: 'Khác / Tất cả' },
];
const DEPT_LABEL = { TECH: 'Kỹ Thuật', ATAS: 'ATAS', STAGE: 'Sân Khấu' };
const DEPT_COLOR = { TECH: '#60a5fa', ATAS: '#a78bfa', STAGE: '#34d399' };

function Badge({ dept }) {
  if (!dept) return null;
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', borderRadius: '20px',
      background: `${DEPT_COLOR[dept]}22`, color: DEPT_COLOR[dept],
      border: `1px solid ${DEPT_COLOR[dept]}44`,
    }}>
      {DEPT_LABEL[dept] || dept}
    </span>
  );
}

function SupplierModal({ supplier, onClose, onSaved }) {
  const [name, setName] = useState(supplier?.name || '');
  const [dept, setDept] = useState(supplier?.dept || 'TECH');
  const [isActive, setIsActive] = useState(supplier ? !!supplier.is_active : true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSave() {
    if (!name.trim()) { setErr('Tên NCC không được trống'); return; }
    setSaving(true);
    try {
      if (supplier) {
        await api.updateNccSupplier(supplier.id, { name: name.trim(), dept, is_active: isActive });
      } else {
        await api.createNccSupplier({ name: name.trim(), dept });
      }
      onSaved();
    } catch (e) {
      setErr(e.message || 'Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={supplier ? 'Sửa NCC' : 'Thêm NCC mới'} onClose={onClose} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#7878a0', fontWeight: 700, display: 'block', marginBottom: '6px' }}>Tên NCC</label>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(255,255,255,0.04)', color: '#e0e0ee', outline: 'none', fontSize: '0.9rem' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#7878a0', fontWeight: 700, display: 'block', marginBottom: '6px' }}>Bộ phận</label>
          <select value={dept} onChange={e => setDept(e.target.value)}
            style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(255,255,255,0.04)', color: '#e0e0ee', outline: 'none', fontSize: '0.9rem' }}>
            {DEPT_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        {supplier && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: '#e0e0ee', cursor: 'pointer' }}>
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} style={{ accentColor: GOLD }} />
            Đang hoạt động
          </label>
        )}
        {err && <p style={{ color: '#f87171', fontSize: '0.82rem', margin: 0 }}>{err}</p>}
        <button onClick={handleSave} disabled={saving}
          style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${GOLD}`, background: 'rgba(201,168,76,0.1)', color: '#e8c97a', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Đang lưu...' : 'Lưu'}
        </button>
      </div>
    </Modal>
  );
}

function EqRow({ eq, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(eq.name);
  const [unit, setUnit] = useState(eq.unit || 'Cái');
  const [qty, setQty] = useState(eq.qty || 1);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(eq.id, { name, unit, qty });
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ flex: 1, fontSize: '0.85rem', color: '#d0d0e8' }}>{eq.name}</span>
        <span style={{ fontSize: '0.78rem', color: '#7878a0', minWidth: '50px', textAlign: 'right' }}>{eq.qty} {eq.unit}</span>
        <button onClick={() => setEditing(true)} style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: '5px', border: '1px solid rgba(201,168,76,0.3)', background: 'transparent', color: GOLD, cursor: 'pointer' }}>Sửa</button>
        <button onClick={() => { if (confirm(`Xóa "${eq.name}"?`)) onDelete(eq.id); }}
          style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: '5px', border: '1px solid rgba(248,113,113,0.3)', background: 'transparent', color: '#f87171', cursor: 'pointer' }}>Xóa</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 8px', borderRadius: '6px', background: 'rgba(201,168,76,0.04)', border: `1px solid rgba(201,168,76,0.2)` }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên thiết bị" autoFocus
        style={{ flex: 2, padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(255,255,255,0.04)', color: '#e0e0ee', fontSize: '0.84rem', outline: 'none' }} />
      <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Đơn vị"
        style={{ width: '70px', padding: '5px 6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e0e0ee', fontSize: '0.84rem', outline: 'none', textAlign: 'center' }} />
      <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
        style={{ width: '60px', padding: '5px 6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e0e0ee', fontSize: '0.84rem', outline: 'none', textAlign: 'center' }} />
      <button onClick={save} disabled={saving}
        style={{ padding: '4px 10px', borderRadius: '6px', border: `1px solid ${GOLD}`, background: 'rgba(201,168,76,0.1)', color: '#e8c97a', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700 }}>
        {saving ? '...' : 'Lưu'}
      </button>
      <button onClick={() => setEditing(false)}
        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7878a0', fontSize: '0.8rem', cursor: 'pointer' }}>
        Hủy
      </button>
    </div>
  );
}

function AddEqRow({ supplierId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('Cái');
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createNccEquipment(supplierId, { name: name.trim(), unit, qty });
      setName(''); setUnit('Cái'); setQty(1); setOpen(false);
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ alignSelf: 'flex-start', padding: '5px 14px', borderRadius: '6px', border: `1px dashed rgba(201,168,76,0.4)`, background: 'transparent', color: '#c9a84c', fontSize: '0.82rem', cursor: 'pointer', marginTop: '2px' }}>
        + Thêm thiết bị
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 8px', borderRadius: '6px', background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.2)' }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên thiết bị" autoFocus
        onKeyDown={e => e.key === 'Enter' && save()}
        style={{ flex: 2, padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(255,255,255,0.04)', color: '#e0e0ee', fontSize: '0.84rem', outline: 'none' }} />
      <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Đơn vị"
        style={{ width: '70px', padding: '5px 6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e0e0ee', fontSize: '0.84rem', outline: 'none', textAlign: 'center' }} />
      <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
        style={{ width: '60px', padding: '5px 6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e0e0ee', fontSize: '0.84rem', outline: 'none', textAlign: 'center' }} />
      <button onClick={save} disabled={saving || !name.trim()}
        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(74,222,128,0.5)', background: 'rgba(74,222,128,0.08)', color: '#4ade80', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700 }}>
        {saving ? '...' : 'Thêm'}
      </button>
      <button onClick={() => setOpen(false)}
        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#7878a0', fontSize: '0.8rem', cursor: 'pointer' }}>
        Hủy
      </button>
    </div>
  );
}

export default function NccAdmin() {
  const [suppliers, setSuppliers] = useState([]);
  const [openId, setOpenId]       = useState(null);
  const [detail, setDetail]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [supModal, setSupModal]   = useState(null); // null | 'new' | supplier object
  const [search, setSearch]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.getNccSuppliers();
    setSuppliers(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadDetail(id) {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id);
    const d = await api.getNccSupplier(id);
    setDetail(d);
  }

  async function handleDeleteSupplier(sup) {
    if (!confirm(`Xóa NCC "${sup.name}" và toàn bộ ${sup.eq_count} thiết bị?\nHành động này không thể hoàn tác.`)) return;
    await api.deleteNccSupplier(sup.id);
    if (openId === sup.id) { setOpenId(null); setDetail(null); }
    load();
  }

  async function handleSaveEq(eqId, data) {
    await api.updateNccEquipment(eqId, data);
    const d = await api.getNccSupplier(openId);
    setDetail(d);
  }

  async function handleDeleteEq(eqId) {
    await api.deleteNccEquipment(eqId);
    const d = await api.getNccSupplier(openId);
    setDetail(d);
    load();
  }

  const filtered = suppliers.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#e0e0ee' }}>🏪 Quản Lý NCC</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#7878a0' }}>
            {suppliers.length} nhà cung cấp · {suppliers.reduce((s, x) => s + (x.eq_count || 0), 0)} loại thiết bị
          </p>
        </div>
        <button onClick={() => setSupModal('new')}
          style={{ padding: '9px 18px', borderRadius: '8px', border: `1px solid ${GOLD}`, background: 'rgba(201,168,76,0.1)', color: '#e8c97a', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
          + Thêm NCC
        </button>
      </div>

      {/* Search */}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Tìm nhà cung cấp..."
        style={{ width: '100%', padding: '9px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e0e0ee', outline: 'none', fontSize: '0.88rem', marginBottom: '14px', boxSizing: 'border-box' }}
      />

      {loading && <p style={{ color: '#7878a0', textAlign: 'center' }}>Đang tải...</p>}

      {/* Supplier list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map(sup => (
          <div key={sup.id} style={{ borderRadius: '10px', border: `1px solid ${openId === sup.id ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.07)'}`, background: openId === sup.id ? 'rgba(201,168,76,0.03)' : 'rgba(255,255,255,0.02)', overflow: 'hidden', transition: 'border-color 0.15s' }}>

            {/* Supplier row */}
            <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 16px', gap: '6px', cursor: 'pointer' }}
              onClick={() => loadDetail(sup.id)}>
              {/* Hàng 1: tên */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ flex: 1, fontWeight: 700, fontSize: '0.95rem', color: sup.is_active ? '#e0e0ee' : '#5a5a7a' }}>
                  {sup.name}
                  {!sup.is_active && <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: '#7878a0' }}>(ẩn)</span>}
                </span>
              </div>
              {/* Hàng 2: số thiết bị + badge + nút */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: '#7878a0' }}>
                  {sup.eq_count} thiết bị
                </span>
                <Badge dept={sup.dept} />
                <span style={{ flex: 1 }} />
                <button onClick={e => { e.stopPropagation(); setSupModal(sup); }}
                  style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(201,168,76,0.3)', background: 'transparent', color: GOLD, fontSize: '0.78rem', cursor: 'pointer' }}>
                  Sửa
                </button>
                <button onClick={e => { e.stopPropagation(); handleDeleteSupplier(sup); }}
                  style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(248,113,113,0.3)', background: 'transparent', color: '#f87171', fontSize: '0.78rem', cursor: 'pointer' }}>
                  Xóa
                </button>
                <span style={{ fontSize: '0.75rem', color: '#555570' }}>{openId === sup.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Equipment panel */}
            {openId === sup.id && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {!detail ? (
                  <p style={{ color: '#7878a0', fontSize: '0.84rem', margin: 0 }}>Đang tải...</p>
                ) : detail.equipment.length === 0 ? (
                  <p style={{ color: '#7878a0', fontSize: '0.84rem', margin: 0 }}>Chưa có thiết bị nào.</p>
                ) : (
                  detail.equipment.map(eq => (
                    <EqRow key={eq.id} eq={eq}
                      onSave={handleSaveEq}
                      onDelete={handleDeleteEq} />
                  ))
                )}
                <AddEqRow supplierId={sup.id} onAdded={async () => {
                  const d = await api.getNccSupplier(sup.id);
                  setDetail(d);
                  load();
                }} />
              </div>
            )}
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <p style={{ color: '#7878a0', textAlign: 'center', marginTop: '40px' }}>Không tìm thấy NCC nào.</p>
        )}
      </div>

      {/* Supplier modal */}
      {supModal && (
        <SupplierModal
          supplier={supModal === 'new' ? null : supModal}
          onClose={() => setSupModal(null)}
          onSaved={() => { setSupModal(null); load(); if (openId && supModal !== 'new') { api.getNccSupplier(openId).then(setDetail); } }}
        />
      )}
    </div>
  );
}
