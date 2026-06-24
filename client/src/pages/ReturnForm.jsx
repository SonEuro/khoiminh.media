import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

const GOLD = '#c9a84c';

const DEPARTMENTS = [
  'Âm Thanh Ánh Sáng',
  'Sân Khấu',
  'Kỹ Thuật',
  'Cơ Sở Vật Chất',
  'Kế Toán',
  'Kinh Doanh',
];

const KM_STAFF_GROUPS = [
  { dept: 'Cơ Sở Vật Chất', members: ['Đào Chí Hải', 'Ngô Văn Hào'] },
  { dept: 'Âm Thanh Ánh Sáng', members: [
    'Hà Minh Tâm', 'Trần Nhật Duy', 'Lê Trần Hoài Vĩ',
    'Huỳnh Sự', 'Trương Lê Trung Tín', 'Lê Trọng Đức',
  ]},
  { dept: 'Sân Khấu', members: [
    'Trần Duy Hùng', 'Nguyễn Trường Chinh', 'Hứa Khắc Cần',
    'Phạm Đăng Sinh', 'Nguyễn Ngọc Ly', 'Phạm Hữu Phúc Khang',
  ]},
  { dept: 'Kỹ Thuật', members: [
    'Nguyễn Văn Linh', 'Nguyễn Trí Tài', 'Võ Chí Thiện',
    'Lê Anh Kiệt', 'Nguyễn Thanh Sang', 'Phan Khắc Luyện',
    'Vũ Đức Tài', 'Đỗ Quý Vượng', 'Nguyễn Thành Trung',
    'Phan Ngọc Mạnh', 'Trần Đình Cương', 'Hồ Văn Toàn',
    'Hồ Bảo Trường', 'Trần Triệu Vĩ', 'Hoàng Văn Tuân',
  ]},
  { dept: 'Kế Toán', members: [
    'Đào Thái Hiền', 'Vũ Thị Hà', 'Lâm Kiều Duyên',
    'Nguyễn Thị Anh Thư', 'Nguyễn Kim Huệ',
  ]},
  { dept: 'Kinh Doanh', members: ['Nguyễn Thế Sơn', 'Lâm Tấn Nhân', 'Đào Nguyên Sơn'] },
];

const ALL_STAFF = KM_STAFF_GROUPS.flatMap(g => g.members);

const labelStyle = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  color: GOLD, letterSpacing: '0.06em', marginBottom: '5px',
  textTransform: 'uppercase',
};

const sectionStyle = {
  background: '#13131d', border: '1px solid rgba(201,168,76,0.15)',
  borderRadius: '12px', padding: '20px', marginBottom: '14px',
};

// ── Equipment search row ──────────────────────────────────────────────────────
function EqRow({ equipment, row, onChange, onRemove, filterFn, placeholder }) {
  const [search, setSearch] = useState('');
  const [show, setShow] = useState(false);

  const suggestions = show
    ? equipment
        .filter(e => filterFn ? filterFn(e) : true)
        .filter(e => !search.trim() || e.name.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 8)
    : [];

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '10px', padding: '12px', position: 'relative',
    }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        {/* Equipment search */}
        <div style={{ flex: 1, position: 'relative', zIndex: 10 }}>
          <input
            className="input"
            placeholder={placeholder || 'Tìm thiết bị...'}
            value={row.equipment_id ? (equipment.find(e => e.id === row.equipment_id)?.name || search) : search}
            autoComplete="off"
            onChange={e => { setSearch(e.target.value); onChange({ ...row, equipment_id: '' }); setShow(true); }}
            onFocus={() => setShow(true)}
            onBlur={() => setTimeout(() => setShow(false), 150)}
            style={{ fontSize: '0.85rem' }}
          />
          {row.equipment_id && (
            <p style={{ fontSize: '0.7rem', color: '#4ade80', marginTop: '3px' }}>
              ✅ {equipment.find(e => e.id === row.equipment_id)?.code}
              {filterFn && ` · Đang bảo trì: ${equipment.find(e => e.id === row.equipment_id)?.qty_maintenance ?? 0}`}
            </p>
          )}
          {show && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, marginTop: '3px',
              background: '#13131d', border: '1px solid rgba(201,168,76,0.3)',
              borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', maxHeight: '200px', overflowY: 'auto',
            }}>
              {suggestions.map(eq => (
                <button key={eq.id} type="button"
                  onMouseDown={() => { onChange({ ...row, equipment_id: eq.id }); setSearch(eq.name); setShow(false); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 12px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    borderBottom: '1px solid rgba(201,168,76,0.07)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ color: '#e8c97a', fontSize: '0.82rem', fontWeight: 600 }}>{eq.name}</span>
                  <span style={{ color: '#7878a0', fontSize: '0.7rem' }}>{eq.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quantity */}
        <div style={{ width: '80px' }}>
          <input type="number" min="1" className="input"
            placeholder="SL"
            value={row.quantity}
            onChange={e => onChange({ ...row, quantity: Math.max(1, +e.target.value) })}
            style={{ textAlign: 'center', fontWeight: 700, color: '#4ade80', fontSize: '1rem' }}
          />
        </div>

        {/* Remove */}
        <button type="button" onClick={onRemove}
          style={{
            padding: '8px 10px', background: 'rgba(248,113,113,0.1)',
            border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px',
            color: '#f87171', cursor: 'pointer', fontSize: '0.85rem', marginTop: '1px',
          }}>×</button>
      </div>
    </div>
  );
}

// ── Tab 1: Sửa xong ───────────────────────────────────────────────────────────
function FixTab({ equipment }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const [department, setDepartment] = useState('');
  const [person, setPerson] = useState('');
  const [date, setDate] = useState(today);
  const [items, setItems] = useState([{ equipment_id: '', quantity: 1 }]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  const maintenanceEq = equipment.filter(e => e.qty_maintenance > 0);

  function addRow() { setItems(p => [...p, { equipment_id: '', quantity: 1 }]); }
  function updateRow(i, v) { setItems(p => p.map((r, j) => j === i ? v : r)); }
  function removeRow(i) { setItems(p => p.filter((_, j) => j !== i)); }

  async function submit(e) {
    e.preventDefault();
    const validItems = items.filter(r => r.equipment_id && r.quantity > 0);
    if (!validItems.length) return alert('Chưa chọn thiết bị nào');
    if (!person) return alert('Chưa chọn người nhận');
    setSubmitting(true);
    try {
      const res = await api.createFix({ responsible_person: person, notes: `[${department}] Ngày: ${date}`, items: validItems });
      setDone(res);
    } catch (err) { alert(err.message); }
    finally { setSubmitting(false); }
  }

  if (done) return (
    <div className="card text-center space-y-4" style={{ marginTop: '20px' }}>
      <div style={{ fontSize: '3rem' }}>✅</div>
      <p style={{ color: '#4ade80', fontWeight: 700, fontSize: '1.1rem' }}>Cập nhật thành công!</p>
      <p style={{ color: '#7878a0', fontSize: '0.85rem' }}>Phiếu <strong style={{ color: GOLD }}>{done.code}</strong></p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button onClick={() => { setDone(null); setItems([{ equipment_id: '', quantity: 1 }]); }} className="btn-primary">Nhập tiếp</button>
        <button onClick={() => navigate('/transactions')} className="btn-secondary">Xem lịch sử</button>
      </div>
    </div>
  );

  return (
    <form onSubmit={submit}>
      <div style={sectionStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label style={labelStyle}>Bộ phận</label>
            <select className="input" value={department} onChange={e => setDepartment(e.target.value)}>
              <option value="">-- Chọn bộ phận --</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Ngày nhập</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Người nhận thiết bị đã sửa</label>
          <select className="input" value={person} onChange={e => setPerson(e.target.value)} required>
            <option value="">-- Chọn nhân viên --</option>
            {KM_STAFF_GROUPS.map(g => (
              <optgroup key={g.dept} label={g.dept}>
                {g.members.map(m => <option key={m} value={m}>{m}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontWeight: 700, color: GOLD, fontSize: '0.85rem' }}>
            Danh sách thiết bị đã sửa
          </span>
          <button type="button" onClick={addRow}
            style={{ padding: '5px 12px', borderRadius: '7px', fontSize: '0.78rem', fontWeight: 700,
              background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', color: GOLD, cursor: 'pointer' }}>
            + Thêm
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((row, i) => (
            <EqRow key={i} equipment={equipment} row={row}
              onChange={v => updateRow(i, v)}
              onRemove={() => removeRow(i)}
              filterFn={e => e.qty_maintenance > 0}
              placeholder="Tìm thiết bị đang bảo trì..."
            />
          ))}
        </div>
        {maintenanceEq.length === 0 && (
          <p style={{ color: '#7878a0', fontSize: '0.78rem', marginTop: '10px' }}>
            Hiện không có thiết bị nào đang bảo trì
          </p>
        )}
      </div>

      <button type="submit" disabled={submitting} className="btn-primary"
        style={{ width: '100%', padding: '13px', fontSize: '1rem' }}>
        {submitting ? 'Đang xử lý...' : '✅ Xác nhận cập nhật tình trạng'}
      </button>
    </form>
  );
}

// ── Tab 2: Nhập mới ───────────────────────────────────────────────────────────
function IntakeTab({ equipment }) {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const [department, setDepartment] = useState('');
  const [person, setPerson] = useState('');
  const [date, setDate] = useState(today);
  const [items, setItems] = useState([{ equipment_id: '', quantity: 1 }]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  function addRow() { setItems(p => [...p, { equipment_id: '', quantity: 1 }]); }
  function updateRow(i, v) { setItems(p => p.map((r, j) => j === i ? v : r)); }
  function removeRow(i) { setItems(p => p.filter((_, j) => j !== i)); }

  async function submit(e) {
    e.preventDefault();
    const validItems = items.filter(r => r.equipment_id && r.quantity > 0);
    if (!validItems.length) return alert('Chưa chọn thiết bị nào');
    if (!person) return alert('Chưa chọn người nhập');
    setSubmitting(true);
    try {
      const res = await api.createIntake({ responsible_person: person, department, intake_date: date, items: validItems });
      setDone(res);
    } catch (err) { alert(err.message); }
    finally { setSubmitting(false); }
  }

  if (done) return (
    <div className="card text-center space-y-4" style={{ marginTop: '20px' }}>
      <div style={{ fontSize: '3rem' }}>📦</div>
      <p style={{ color: '#4ade80', fontWeight: 700, fontSize: '1.1rem' }}>Nhập kho thành công!</p>
      <p style={{ color: '#7878a0', fontSize: '0.85rem' }}>Phiếu <strong style={{ color: GOLD }}>{done.code}</strong></p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button onClick={() => { setDone(null); setItems([{ equipment_id: '', quantity: 1 }]); }} className="btn-primary">Nhập tiếp</button>
        <button onClick={() => navigate('/transactions')} className="btn-secondary">Xem lịch sử</button>
      </div>
    </div>
  );

  return (
    <form onSubmit={submit}>
      <div style={sectionStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label style={labelStyle}>Bộ phận</label>
            <select className="input" value={department} onChange={e => setDepartment(e.target.value)}>
              <option value="">-- Chọn bộ phận --</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Ngày nhập</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Người nhập thiết bị mới</label>
          <select className="input" value={person} onChange={e => setPerson(e.target.value)} required>
            <option value="">-- Chọn nhân viên --</option>
            {KM_STAFF_GROUPS.map(g => (
              <optgroup key={g.dept} label={g.dept}>
                {g.members.map(m => <option key={m} value={m}>{m}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontWeight: 700, color: GOLD, fontSize: '0.85rem' }}>Tên thiết bị mới</span>
          <button type="button" onClick={addRow}
            style={{ padding: '5px 12px', borderRadius: '7px', fontSize: '0.78rem', fontWeight: 700,
              background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', color: GOLD, cursor: 'pointer' }}>
            + Thêm
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((row, i) => (
            <EqRow key={i} equipment={equipment} row={row}
              onChange={v => updateRow(i, v)}
              onRemove={() => removeRow(i)}
              placeholder="Tìm tên thiết bị..."
            />
          ))}
        </div>
      </div>

      <button type="submit" disabled={submitting} className="btn-primary"
        style={{ width: '100%', padding: '13px', fontSize: '1rem' }}>
        {submitting ? 'Đang xử lý...' : '📦 Xác nhận nhập kho thiết bị mới'}
      </button>
    </form>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ReturnForm() {
  const { user } = useAuth();
  const canFix = user?.role === 'SUPER_ADMIN' || user?.position?.includes('Trưởng Phòng');

  const [tab, setTab] = useState(() => canFix ? 'fix' : 'intake');
  const [equipment, setEquipment] = useState([]);

  useEffect(() => { api.getEquipment({ limit: 9999 }).then(d => setEquipment(d.items || d)); }, []);

  const tabs = [
    ...(canFix ? [{ key: 'fix', label: '🔧 Sửa xong – Cập nhật tình trạng' }] : []),
    { key: 'intake', label: '📦 Nhập mới thiết bị' },
  ];

  return (
    <div className="p-6 max-w-2xl">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e8c97a', margin: 0 }}>Nhập Kho Thiết Bị</h1>
        <p style={{ color: '#7878a0', fontSize: '0.82rem', margin: '4px 0 0' }}>Cập nhật tình trạng sửa chữa hoặc nhập thiết bị mới</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {tabs.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '11px 14px', borderRadius: '10px', fontWeight: 700,
              fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s',
              border: tab === t.key ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.1)',
              background: tab === t.key ? GOLD : 'rgba(255,255,255,0.03)',
              color: tab === t.key ? '#08080e' : '#a0a0b8',
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'fix'    && <FixTab    equipment={equipment} />}
      {tab === 'intake' && <IntakeTab equipment={equipment} />}
    </div>
  );
}
