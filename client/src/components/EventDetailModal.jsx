import { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../api';
import { fmtD } from '../utils/fmt';

function parseFilmingDates(ev) {
  if (!ev) return [];
  if (ev.filming_dates) { try { return JSON.parse(ev.filming_dates); } catch {} }
  return ev.filming_date ? [ev.filming_date] : [];
}
function parseDatesField(ev, multiKey, singleKey) {
  if (!ev) return [];
  if (ev[multiKey]) { try { const p = JSON.parse(ev[multiKey]); if (Array.isArray(p)) return p; } catch {} }
  return ev[singleKey] ? [ev[singleKey]] : [];
}

const CAT_COLORS = { TECH:'#fb923c', AUDIO:'#60a5fa', LIGHT:'#fbbf24', LED:'#4ade80', STAGE:'#f472b6', CSVC:'#94a3b8', MATRIX:'#c084fc' };

function fmtDateTime(str) {
  if (!str) return '';
  const d = new Date(str);
  const pad = n => String(n).padStart(2,'0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Group tx_rows into transactions, each with their items
function groupTxRows(txRows) {
  const map = new Map();
  for (const row of (txRows || [])) {
    if (!map.has(row.tx_id)) {
      map.set(row.tx_id, {
        id: row.tx_id, code: row.tx_code, type: row.tx_type,
        created_at: row.created_at, responsible_person: row.responsible_person,
        notes: row.tx_notes, items: [],
      });
    }
    map.get(row.tx_id).items.push({
      equipment_id: row.equipment_id, eq_code: row.eq_code, eq_name: row.eq_name,
      unit: row.unit, quantity: row.quantity, combo: row.combo,
    });
  }
  return Array.from(map.values());
}

function groupExtTxRows(extTxRows) {
  const map = new Map();
  for (const row of (extTxRows || [])) {
    if (!map.has(row.tx_id)) {
      map.set(row.tx_id, {
        id: row.tx_id, code: row.tx_code, type: row.tx_type,
        created_at: row.created_at, responsible_person: row.responsible_person,
        items: [],
      });
    }
    map.get(row.tx_id).items.push({
      supplier: row.supplier, name: row.name, quantity: row.quantity,
      unit: row.unit, notes: row.notes, rental_days: row.rental_days,
    });
  }
  return Array.from(map.values());
}

function TxSlip({ tx, isReturn }) {
  const color = isReturn ? '#4ade80' : '#fb923c';
  const label = isReturn ? 'PHIẾU TRẢ' : 'PHIẾU XUẤT';

  let lastCat = null;
  const rows = [];
  const sorted = [...tx.items].sort((a, b) => (a.eq_code || '').localeCompare(b.eq_code || ''));
  sorted.forEach(it => {
    const cat = (it.eq_code || '').split('-')[0];
    if (cat !== lastCat) {
      const c = CAT_COLORS[cat] || '#c9a84c';
      rows.push(
        <tr key={`cat-${cat}`}>
          <td colSpan={3} style={{ padding:'6px 0 3px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <div style={{ height:'1px', flex:1, background:`linear-gradient(to right, ${c}, transparent)`, opacity:0.45 }} />
              <span style={{ fontSize:'0.75rem', fontWeight:800, color:c, letterSpacing:'0.1em' }}>{cat}</span>
              <div style={{ height:'1px', flex:1, background:`linear-gradient(to left, ${c}, transparent)`, opacity:0.45 }} />
            </div>
          </td>
        </tr>
      );
      lastCat = cat;
    }
    rows.push(
      <tr key={it.equipment_id} className="border-b last:border-0">
        <td className="py-1 font-mono text-xs" style={{ color:'#555570' }}>{it.eq_code}</td>
        <td className="py-1" style={{ color:'#e0e0ee' }}>
          <span>{it.eq_name}</span>
          {it.combo && <span style={{ marginLeft:'6px', fontSize:'0.68rem', fontWeight:800, padding:'1px 5px', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'3px', color:'rgba(255,255,255,0.45)', letterSpacing:'0.04em' }}>FREE-{it.combo}</span>}
        </td>
        <td className="py-1 text-right font-bold" style={{ color }}>{it.quantity}</td>
      </tr>
    );
  });

  return (
    <div style={{ border:`1px solid ${color}28`, borderLeft:`3px solid ${color}`, borderRadius:'0 8px 8px 0', marginBottom:'10px', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 12px', background:`${color}0d`, borderBottom:`1px solid ${color}1a` }}>
        <span style={{ fontSize:'0.72rem', fontWeight:800, color, letterSpacing:'0.08em' }}>{label}</span>
        <span style={{ fontFamily:"'ui-monospace','SFMono-Regular',Menlo,monospace", fontSize:'0.80rem', color:'#a0a0c0' }}>{tx.code}</span>
        <span style={{ marginLeft:'auto', fontSize:'0.78rem', color:'#7878a0' }}>{fmtDateTime(tx.created_at)}</span>
        {tx.responsible_person && <span style={{ fontSize:'0.78rem', color:'#a0a0c0' }}>· {tx.responsible_person}</span>}
      </div>
      <div style={{ padding:'6px 12px 10px' }}>
        <table className="w-full text-sm" style={{ minWidth:'280px' }}>
          <thead>
            <tr className="border-b" style={{ borderColor:'rgba(255,255,255,0.06)' }}>
              <th className="pb-1 text-left" style={{ color:'#555570', fontSize:'0.75rem', fontWeight:600 }}>Mã</th>
              <th className="pb-1 text-left" style={{ color:'#555570', fontSize:'0.75rem', fontWeight:600 }}>Thiết bị</th>
              <th className="pb-1 text-right" style={{ color:'#555570', fontSize:'0.75rem', fontWeight:600 }}>SL</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
}

export default function EventDetailModal({ eventId, onClose }) {
  const [ev, setEv]   = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    const fetch = () => api.getEventById(eventId).then(setEv).catch(() => setErr(true));
    fetch();
    const onVisible = () => { if (!document.hidden) fetch(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [eventId]);

  if (err) return (
    <Modal title="Sự kiện" onClose={onClose}>
      <div className="text-center py-8" style={{ color:'#f87171' }}>Không thể tải sự kiện.</div>
    </Modal>
  );
  if (!ev) return (
    <Modal title="Sự kiện" onClose={onClose}>
      <div className="text-center py-8 text-gray-400">Đang tải...</div>
    </Modal>
  );

  const outTxs    = groupTxRows((ev.tx_rows || []).filter(r => r.tx_type === 'OUT'));
  const returnTxs = groupTxRows((ev.tx_rows || []).filter(r => r.tx_type === 'RETURN'));
  const extOutTxs = groupExtTxRows((ev.ext_tx_rows || []).filter(r => r.tx_type === 'OUT'));

  return (
    <Modal title={`${ev.name} · ${ev.code}`} onClose={onClose} size="lg">
      <div className="space-y-4">
        {/* Event info */}
        <div style={{ display:'flex', flexDirection:'column', gap:'6px', fontSize:'0.88rem' }}>
          <div style={{ display:'flex', gap:'6px', alignItems:'baseline' }}><span style={{ color:'#7878a0', flexShrink:0, whiteSpace:'nowrap' }}>Khách hàng:</span><strong>{ev.client || '—'}</strong></div>
          <div style={{ display:'flex', gap:'6px', alignItems:'baseline' }}><span style={{ color:'#7878a0', flexShrink:0, whiteSpace:'nowrap' }}>Địa điểm:</span><strong>{ev.location || '—'}</strong></div>
          {(() => {
            const startDates = parseDatesField(ev, 'start_dates', 'start_date');
            return startDates.length > 0 ? (
              <div style={{ display:'flex', gap:'6px', alignItems:'baseline', flexWrap:'wrap' }}>
                <span style={{ color:'#7878a0', flexShrink:0, whiteSpace:'nowrap' }}>Ngày bắt đầu:</span>
                <span>{startDates.map((d, i) => <strong key={i} style={{ color:'#f87171', marginRight:'8px' }}>📅 {fmtD(d)}</strong>)}</span>
              </div>
            ) : null;
          })()}
          {(() => {
            const showDates = parseDatesField(ev, 'show_dates', 'show_date');
            return showDates.length > 0 ? (
              <div style={{ display:'flex', gap:'6px', alignItems:'baseline', flexWrap:'wrap' }}>
                <span style={{ color:'#7878a0', flexShrink:0, whiteSpace:'nowrap' }}>Ngày Rehearsal:</span>
                <span>{showDates.map((d, i) => <strong key={i} style={{ color:'#34d399', marginRight:'8px' }}>🎪 {fmtD(d)}</strong>)}</span>
              </div>
            ) : null;
          })()}
          {(() => {
            const dates = parseFilmingDates(ev);
            return dates.length > 0 ? (
              <div style={{ display:'flex', gap:'6px', alignItems:'baseline', flexWrap:'wrap' }}>
                <span style={{ color:'#fb923c', fontWeight:700, flexShrink:0, whiteSpace:'nowrap' }}>🎬 Ngày ghi hình:</span>
                <span>{dates.map((d, i) => <strong key={i} style={{ color:'#fb923c', marginRight:'8px' }}>{fmtD(d)}</strong>)}</span>
              </div>
            ) : null;
          })()}
          {(() => {
            const endDates = parseDatesField(ev, 'end_dates', 'end_date');
            return endDates.length > 0 ? (
              <div style={{ display:'flex', gap:'6px', alignItems:'baseline', flexWrap:'wrap' }}>
                <span style={{ color:'#7878a0', flexShrink:0, whiteSpace:'nowrap' }}>Ngày kết thúc:</span>
                <span>{endDates.map((d, i) => <strong key={i} style={{ color:'#fb923c', marginRight:'8px' }}>🏁 {fmtD(d)}</strong>)}</span>
              </div>
            ) : null;
          })()}
          {ev.created_by && (
            <div style={{ display:'flex', gap:'6px', alignItems:'baseline' }}>
              <span style={{ color:'#7878a0', flexShrink:0, whiteSpace:'nowrap' }}>Người tạo:</span>
              <strong>{ev.created_by}</strong>
            </div>
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
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'10px', paddingBottom:'8px', borderBottom:'1px solid rgba(201,168,76,0.15)' }}>
              <span style={{ fontSize:'0.92rem' }}>📋</span>
              <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#c9a84c', textTransform:'uppercase', letterSpacing:'0.08em' }}>Ghi chú</span>
            </div>
            <p style={{ fontSize:'0.87rem', lineHeight:'1.75', color:'var(--text-main)', whiteSpace:'pre-wrap', wordBreak:'break-word', margin:0 }}>{ev.notes}</p>
          </div>
        )}

        {/* OUT slips */}
        <div>
          <h3 className="font-semibold mb-2" style={{ color:'#e0e0ee' }}>
            Thiết bị xuất kho
            {outTxs.length > 0 && <span style={{ marginLeft:'8px', fontSize:'0.78rem', color:'#7878a0', fontWeight:400 }}>{outTxs.length} phiếu</span>}
          </h3>
          {outTxs.length === 0 ? (
            <p className="text-gray-400 text-sm">Chưa có thiết bị nào được xuất</p>
          ) : (
            <div className="table-wrap" style={{ overflowX:'auto' }}>
              {outTxs.map(tx => <TxSlip key={tx.id} tx={tx} isReturn={false} />)}
            </div>
          )}
        </div>

        {/* RETURN slips */}
        {returnTxs.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2" style={{ color:'#e0e0ee' }}>
              Thiết bị đã trả
              <span style={{ marginLeft:'8px', fontSize:'0.78rem', color:'#7878a0', fontWeight:400 }}>{returnTxs.length} phiếu</span>
            </h3>
            <div className="table-wrap" style={{ overflowX:'auto' }}>
              {returnTxs.map(tx => <TxSlip key={tx.id} tx={tx} isReturn={true} />)}
            </div>
          </div>
        )}

        {/* External items from OUT slips */}
        {extOutTxs.length > 0 && extOutTxs.some(tx => tx.items.length > 0) && (
          <div>
            <h3 className="font-semibold mb-2" style={{ color:'#e0e0ee' }}>Thiết bị thuê từ nhà cung cấp</h3>
            {extOutTxs.map(tx => (
              <div key={tx.id} style={{ border:'1px solid rgba(201,168,76,0.2)', borderLeft:'3px solid #c9a84c', borderRadius:'0 8px 8px 0', marginBottom:'10px', overflow:'hidden' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 12px', background:'rgba(201,168,76,0.06)', borderBottom:'1px solid rgba(201,168,76,0.1)' }}>
                  <span style={{ fontFamily:"'ui-monospace','SFMono-Regular',Menlo,monospace", fontSize:'0.80rem', color:'#a0a0c0' }}>{tx.code}</span>
                  <span style={{ marginLeft:'auto', fontSize:'0.78rem', color:'#7878a0' }}>{fmtDateTime(tx.created_at)}</span>
                </div>
                <div style={{ padding:'6px 12px 10px' }}>
                  <table className="w-full text-sm" style={{ minWidth:'280px' }}>
                    <thead>
                      <tr className="border-b" style={{ borderColor:'rgba(255,255,255,0.06)' }}>
                        <th className="pb-1 text-left" style={{ color:'#555570', fontSize:'0.75rem', fontWeight:600 }}>Nhà cung cấp</th>
                        <th className="pb-1 text-left" style={{ color:'#555570', fontSize:'0.75rem', fontWeight:600 }}>Tên thiết bị</th>
                        <th className="pb-1 text-right" style={{ color:'#555570', fontSize:'0.75rem', fontWeight:600 }}>SL</th>
                        <th className="pb-1 text-left" style={{ color:'#555570', fontSize:'0.75rem', fontWeight:600 }}>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tx.items.map((it, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 font-medium" style={{ color:'#c9a84c' }}>{it.supplier || '—'}</td>
                          <td className="py-1" style={{ color:'#e0e0ee' }}>{it.name}</td>
                          <td className="py-1 text-right font-bold" style={{ color:'#60a5fa' }}>{it.quantity}</td>
                          <td className="py-1 text-gray-500 text-xs">
                            {[it.rental_days > 0 ? `Thuê ${it.rental_days} ngày` : '', it.notes || ''].filter(Boolean).join(' · ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
