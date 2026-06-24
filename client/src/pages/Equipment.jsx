import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { api } from '../api';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { Clapperboard, Headphones, Spotlight, Tv2, LayoutGrid, Theater, Package, HelpCircle } from 'lucide-react';

const CAT_ICONS = {
  TECH:   Clapperboard,
  AUDIO:  Headphones,
  LIGHT:  Spotlight,
  LED:    Tv2,
  MATRIX: LayoutGrid,
  STAGE:  Theater,
  CSVC:   Package,
};

const CAT_COLORS = {
  TECH:   { color: '#60a5fa', rgb: '96,165,250'  },
  AUDIO:  { color: '#a78bfa', rgb: '167,139,250' },
  LIGHT:  { color: '#fbbf24', rgb: '251,191,36'  },
  LED:    { color: '#22d3ee', rgb: '34,211,238'  },
  MATRIX: { color: '#fb923c', rgb: '251,146,60'  },
  STAGE:  { color: '#f472b6', rgb: '244,114,182' },
  CSVC:   { color: '#94a3b8', rgb: '148,163,184' },
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

const STATUS_LABELS = { available: 'Có sẵn', in_use: 'Đang dùng', maintenance: 'Sửa chữa', damaged: 'Hỏng', lost: 'Mất' };

const CAT_ORDER = ['TECH', 'AUDIO', 'LIGHT', 'LED', 'MATRIX', 'STAGE', 'CSVC'];
const sortCats = (cats) => [...cats].sort((a, b) => {
  const ai = CAT_ORDER.indexOf(a.code), bi = CAT_ORDER.indexOf(b.code);
  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
});

const DEPT_CATS = {
  SUPER_ADMIN: null,
  PRODUCTION:  null,
  ACCOUNTING:  null,
  TECHNICAL:   ['TECH'],
  ATAS:        ['AUDIO', 'LIGHT', 'LED', 'MATRIX'],
  STAGE:       ['STAGE'],
  CSVC:        ['CSVC'],
};

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
  const { user, can } = useAuth();
  const allowedCats = DEPT_CATS[user?.role] ?? null;

  const [equipment, setEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'qr' | 'history'
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topData, setTopData] = useState(null);

  const load = useCallback(() => {
    const params = {};
    if (search) params.search = search;
    if (catFilter) params.category = catFilter;
    api.getEquipment(params).then(setEquipment).finally(() => setLoading(false));
  }, [search, catFilter]);

  useEffect(() => { api.getCategories().then(setCategories); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.getEquipmentTopUsed(5).then(setTopData); }, []);

  // Filter by dept restriction
  const visibleEquipment = allowedCats
    ? equipment.filter(e => allowedCats.includes(e.category_code))
    : equipment;
  const visibleCats = sortCats(
    allowedCats ? categories.filter(c => allowedCats.includes(c.code)) : categories
  );

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

  const handleImportEquipment = async () => {
    if (!window.confirm('⚠️ Thao tác này sẽ XÓA TOÀN BỘ thiết bị và phiếu xuất/nhập hiện tại, sau đó import danh sách mới từ Kho Khôi Minh.\n\nBạn có chắc muốn tiếp tục?')) return;
    try {
      const result = await api.importEquipment();
      alert(result.message || 'Import thành công!');
      load();
      api.getCategories().then(setCategories);
    } catch (e) {
      alert('Import thất bại: ' + e.message);
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

  // ── Real-time inventory summary by category ──────────────────────────────
  const catSummary = visibleCats.map(cat => {
    const items = visibleEquipment.filter(e => e.category_code === cat.code);
    return {
      ...cat,
      total:       items.reduce((s, e) => s + (e.qty_total || 0), 0),
      available:   items.reduce((s, e) => s + (e.qty_available || 0), 0),
      in_use:      items.reduce((s, e) => s + (e.qty_in_use || 0), 0),
      maintenance: items.reduce((s, e) => s + (e.qty_maintenance || 0), 0),
      damaged:     items.reduce((s, e) => s + ((e.qty_damaged || 0) + (e.qty_lost || 0)), 0),
    };
  }).filter(c => c.total > 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tổng Thiết Bị Khôi Minh</h1>
          <p className="text-gray-500 text-sm">{visibleEquipment.length} thiết bị</p>
        </div>
        {user?.role === 'SUPER_ADMIN' && (
          <button
            className="btn-danger btn-sm"
            onClick={async () => {
              if (!confirm('⚠️ Xóa TOÀN BỘ phiếu xuất kho và reset "Đang dùng" về 0?\n\nThao tác này không thể hoàn tác!')) return;
              try {
                const r = await api.resetOutTransactions();
                alert(`✅ Hoàn tất!\n• Thiết bị cập nhật: ${r.equipment_updated}\n• Phiếu xuất đã xóa: ${r.transactions_deleted}`);
                load();
              } catch (e) {
                alert('Lỗi: ' + e.message);
              }
            }}
          >
            🔄 Reset phiếu xuất
          </button>
        )}
      </div>

      {/* ── Tóm tắt toàn kho + Top thiết bị nổi bật ── */}
      {topData && (
        <div style={{ marginBottom: '22px' }}>
          {/* Global stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '18px' }}>
            {[
              { label: 'Tổng thiết bị', value: topData.summary?.total ?? 0,       color: '#e8c97a', rgb: '232,201,122', icon: '📦' },
              { label: 'Có sẵn',        value: topData.summary?.available ?? 0,    color: '#4ade80', rgb: '74,222,128',  icon: '✅' },
              { label: 'Đang dùng',     value: topData.summary?.in_use ?? 0,       color: '#60a5fa', rgb: '96,165,250',  icon: '🔄' },
              { label: 'Bảo trì/Hỏng',  value: (topData.summary?.maintenance ?? 0) + (topData.summary?.damaged ?? 0), color: '#f87171', rgb: '248,113,113', icon: '⚠️' },
            ].map(s => (
              <div key={s.label} style={{
                borderRadius: '12px', overflow: 'hidden',
                border: `1px solid rgba(${s.rgb},0.28)`,
                boxShadow: `0 4px 16px rgba(${s.rgb},0.10)`,
              }}>
                <div style={{
                  padding: '12px 16px',
                  background: `linear-gradient(135deg, rgba(${s.rgb},0.16), rgba(${s.rgb},0.04))`,
                  borderLeft: `4px solid ${s.color}`,
                }}>
                  <p style={{ fontSize: '0.65rem', color: '#7878a0', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.value.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Top 5 nổi bật */}
          <div style={{
            borderRadius: '14px', overflow: 'hidden',
            border: '1px solid rgba(201,168,76,0.28)',
            boxShadow: '0 4px 24px rgba(201,168,76,0.08)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '13px 18px',
              background: 'linear-gradient(135deg, rgba(201,168,76,0.16), rgba(201,168,76,0.04))',
              borderBottom: '1px solid rgba(201,168,76,0.20)',
              borderLeft: '4px solid #c9a84c',
            }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
                background: 'rgba(201,168,76,0.18)', border: '1px solid rgba(201,168,76,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
              }}>⭐</div>
              <span style={{ fontWeight: 800, color: '#c9a84c', fontSize: '0.92rem', flex: 1 }}>Thiết Bị Sử Dụng Nổi Bật</span>
              <span style={{ fontSize: '0.7rem', color: '#7878a0' }}>theo lần dùng gần nhất</span>
            </div>
            <div style={{ background: '#13131d' }}>
              {(topData.topUsed || []).length === 0 ? (
                <p style={{ color: '#7878a0', fontSize: '0.8rem', padding: '14px 20px', margin: 0 }}>Chưa có dữ liệu sử dụng</p>
              ) : (
                topData.topUsed.map((eq, i) => {
                  const CatIcon = CAT_ICONS[eq.category_code] || HelpCircle;
                  const catC = CAT_COLORS[eq.category_code] || { color: '#c9a84c', rgb: '201,168,76' };
                  const lastDate = eq.last_used ? eq.last_used.slice(8,10) + '/' + eq.last_used.slice(5,7) + '/' + eq.last_used.slice(0,4) : '—';
                  return (
                    <div key={eq.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '11px 18px',
                      borderTop: i > 0 ? '1px solid rgba(201,168,76,0.07)' : 'none',
                    }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7878a0', width: '18px', textAlign: 'center', flexShrink: 0 }}>#{i+1}</span>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
                        background: `rgba(${catC.rgb},0.15)`, border: `1px solid rgba(${catC.rgb},0.3)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <CatIcon size={13} strokeWidth={1.75} style={{ color: catC.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, color: '#e0e0ee', fontSize: '0.85rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.name}</p>
                        <p style={{ fontSize: '0.68rem', color: '#7878a0', margin: '2px 0 0' }}>{eq.category_name} · {eq.code}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#60a5fa', margin: 0 }}>{eq.qty_in_use} <span style={{ fontSize: '0.65rem', fontWeight: 400, color: '#7878a0' }}>đang dùng</span></p>
                        <p style={{ fontSize: '0.65rem', color: '#7878a0', margin: '2px 0 0' }}>{lastDate}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Báo cáo tồn kho thời gian thực ── */}
      {catSummary.length > 0 && (
        <div style={{ marginBottom: '22px' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#c9a84c', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
            Báo cáo tồn kho theo thời gian thực
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {catSummary.map(cat => {
              const pct = cat.total > 0 ? Math.round((cat.available / cat.total) * 100) : 0;
              const barColor = pct > 60 ? '#4ade80' : pct > 30 ? '#fbbf24' : '#f87171';
              const { color, rgb } = CAT_COLORS[cat.code] || { color: '#c9a84c', rgb: '201,168,76' };
              const CatIcon = CAT_ICONS[cat.code] || HelpCircle;
              return (
                <div key={cat.code} style={{
                  borderRadius: '14px', overflow: 'hidden',
                  border: `1px solid rgba(${rgb},0.30)`,
                  boxShadow: `0 4px 24px rgba(${rgb},0.10)`,
                }}>
                  {/* Header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '13px 18px',
                    background: `linear-gradient(135deg, rgba(${rgb},0.18) 0%, rgba(${rgb},0.05) 100%)`,
                    borderBottom: `1px solid rgba(${rgb},0.20)`,
                    borderLeft: `4px solid ${color}`,
                  }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
                      background: `rgba(${rgb},0.18)`, border: `1px solid rgba(${rgb},0.35)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CatIcon size={16} strokeWidth={1.75} style={{ color }} />
                    </div>
                    <span style={{ fontWeight: 800, color, fontSize: '0.92rem', flex: 1, letterSpacing: '0.01em' }}>
                      {cat.name}
                    </span>
                    <span style={{
                      fontSize: '0.78rem', fontWeight: 800,
                      color: '#08080e', background: barColor,
                      borderRadius: '9999px', padding: '3px 12px',
                      boxShadow: `0 0 12px rgba(${hexToRgb(barColor)},0.55)`,
                    }}>{pct}%</span>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '12px 14px', background: '#13131d', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Stat row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
                      {[
                        { label: 'Có sẵn',   value: cat.available,   color: '#4ade80', bg: 'rgba(74,222,128,0.08)'  },
                        { label: 'Đang dùng', value: cat.in_use,      color: '#60a5fa', bg: 'rgba(96,165,250,0.08)'  },
                        { label: 'Bảo trì',   value: cat.maintenance, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)'  },
                        { label: 'Hư/Mất',    value: cat.damaged,     color: '#f87171', bg: 'rgba(248,113,113,0.08)' },
                      ].map(s => (
                        <div key={s.label} style={{ background: s.bg, borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                          <p style={{ fontSize: '0.6rem', color: '#7878a0', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                          <p style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Progress bar + total */}
                    <div>
                      <div style={{ width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', height: '5px', marginBottom: '5px' }}>
                        <div style={{ height: '5px', borderRadius: '9999px', width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${barColor})`, boxShadow: `0 0 8px rgba(${rgb},0.5)`, transition: 'width 0.6s ease' }} />
                      </div>
                      <p style={{ fontSize: '0.68rem', color: '#7878a0', margin: 0, textAlign: 'right' }}>
                        Tổng: <strong style={{ color: '#a0a0b8' }}>{cat.total}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
          {visibleCats.map(c => <option key={c.code} value={c.code}>{c.icon} {c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="table-wrap">
        <table className="w-full text-sm" style={{ minWidth:'700px' }}>
          <thead>
            <tr style={{ background: 'rgba(201,168,76,0.08)', borderBottom: '1px solid rgba(201,168,76,0.2)' }}>
              {[
                ['Mã',         'left',   'px-4'],
                ['Tên thiết bị','left',  'px-4'],
                ['Danh mục',   'left',   'px-3'],
                ['Có sẵn',     'center', 'px-3'],
                ['Đang dùng',  'center', 'px-3'],
                ['Cần sửa',    'center', 'px-3'],
                ['Hỏng',       'center', 'px-3'],
                ['Mất',        'center', 'px-3'],
                ['Tổng',       'center', 'px-3'],
              ].map(([label, align, px]) => (
                <th key={label} style={{
                  textAlign: align, padding: '11px 12px',
                  fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em',
                  color: '#c9a84c', textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>{label}</th>
              ))}
              <th style={{ padding: '11px 16px' }}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} className="text-center py-8 text-gray-400">Đang tải...</td></tr>
            )}
            {!loading && visibleEquipment.length === 0 && (
              <tr><td colSpan={10} className="text-center py-8 text-gray-400">Không tìm thấy thiết bị</td></tr>
            )}
            {visibleEquipment.map(eq => (
              <tr key={eq.id} style={{ borderBottom: '1px solid rgba(201,168,76,0.50)' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(201,168,76,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
              >
                <td style={{ padding:'10px 16px', fontFamily:'monospace', fontSize:'0.72rem', fontWeight:700, color:'#c9a84c' }}>{eq.code}</td>
                <td style={{ padding:'10px 16px' }}>
                  <p style={{ fontWeight:600, color:'#e0e0ee', margin:0, fontSize:'0.85rem' }}>{eq.name}</p>
                  {eq.notes && <p style={{ fontSize:'0.7rem', color:'#7878a0', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'200px', whiteSpace:'nowrap' }}>{eq.notes}</p>}
                </td>
                <td style={{ padding:'10px 12px', color:'#a0a0b8', fontSize:'0.8rem' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:'6px' }}>
                    {(() => { const Icon = CAT_ICONS[eq.category_code] || HelpCircle; return <Icon size={13} strokeWidth={1.75} style={{ color:'#c9a84c', flexShrink:0 }} />; })()}
                    {eq.category_name}
                  </span>
                </td>
                <td style={{ padding:'10px 12px', textAlign:'center', fontWeight:700, color: eq.qty_available === 0 ? '#f87171' : eq.qty_available <= 2 ? '#fbbf24' : '#4ade80' }}>
                  {eq.qty_available}
                </td>
                <td style={{ padding:'10px 12px', textAlign:'center', fontWeight:600, color:'#60a5fa' }}>{eq.qty_in_use || 0}</td>
                <td style={{ padding:'10px 12px', textAlign:'center', color: (eq.qty_maintenance||0) > 0 ? '#fbbf24' : '#4a4a60' }}>{eq.qty_maintenance || 0}</td>
                <td style={{ padding:'10px 12px', textAlign:'center', color: (eq.qty_damaged||0) > 0 ? '#f87171' : '#4a4a60' }}>{eq.qty_damaged || 0}</td>
                <td style={{ padding:'10px 12px', textAlign:'center', color: (eq.qty_lost||0) > 0 ? '#f87171' : '#4a4a60' }}>{eq.qty_lost || 0}</td>
                <td style={{ padding:'10px 12px', textAlign:'center', fontWeight:700, color:'#a0a0b8' }}>{eq.qty_total}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button className="btn-secondary btn-sm" title="QR Code"
                      onClick={() => { setSelected(eq); setModal('qr'); }}>QR</button>
                    <button className="btn-secondary btn-sm" title="Lịch sử"
                      onClick={() => { setSelected(eq); setModal('history'); }}>📋</button>
                    {can('editEquipment') && (
                      <button className="btn-secondary btn-sm"
                        onClick={() => { setSelected(eq); setModal('edit'); }}>✏️</button>
                    )}
                    {can('deleteEquipment') && (
                      <button className="btn-danger btn-sm"
                        onClick={() => handleDelete(eq)}>🗑</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
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
