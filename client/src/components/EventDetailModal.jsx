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

export default function EventDetailModal({ eventId, onClose }) {
  const [ev, setEv]   = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => { api.getEventById(eventId).then(setEv).catch(() => setErr(true)); }, [eventId]);

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

  return (
    <Modal title={`${ev.name} · ${ev.code}`} onClose={onClose} size="lg">
      <div className="space-y-4">
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
            position: 'relative',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'10px', paddingBottom:'8px', borderBottom:'1px solid rgba(201,168,76,0.15)' }}>
              <span style={{ fontSize:'0.92rem' }}>📋</span>
              <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#c9a84c', textTransform:'uppercase', letterSpacing:'0.08em' }}>Ghi chú</span>
            </div>
            <p style={{ fontSize:'0.87rem', lineHeight:'1.75', color:'var(--text-main)', whiteSpace:'pre-wrap', wordBreak:'break-word', margin:0 }}>{ev.notes}</p>
          </div>
        )}

        <div>
          <h3 className="font-semibold mb-2" style={{ color:'#e0e0ee' }}>Thiết bị xuất kho</h3>
          {ev.items.length === 0 ? (
            <p className="text-gray-400 text-sm">Chưa có thiết bị nào được xuất</p>
          ) : (
            <div className="table-wrap">
              <table className="w-full text-sm" style={{ minWidth:'360px' }}>
                <thead><tr className="border-b text-gray-500 text-left">
                  <th className="pb-2">Mã</th><th className="pb-2">Thiết bị</th>
                  <th className="pb-2 text-right">Xuất</th><th className="pb-2 text-right">Đã trả</th><th className="pb-2 text-right">Còn nợ</th>
                </tr></thead>
                <tbody>
                  {(() => {
                    const CAT_COLORS = { TECH:'#fb923c', AUDIO:'#60a5fa', LIGHT:'#fbbf24', LED:'#4ade80', STAGE:'#f472b6', CSVC:'#94a3b8', MATRIX:'#c084fc' };
                    const rows = [];
                    let lastCat = null;
                    const sorted = [...ev.items].sort((a, b) => (a.eq_code || '').localeCompare(b.eq_code || ''));
                    sorted.forEach(it => {
                      const cat = (it.eq_code || '').split('-')[0];
                      if (cat !== lastCat) {
                        const color = CAT_COLORS[cat] || '#c9a84c';
                        rows.push(
                          <tr key={`cat-${cat}`}>
                            <td colSpan={5} style={{ padding:'8px 0 4px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                <div style={{ height:'1px', flex:1, background:`linear-gradient(to right, ${color}, transparent)`, opacity:0.5 }} />
                                <span style={{ fontSize:'0.80rem', fontWeight:800, color, letterSpacing:'0.1em', whiteSpace:'nowrap' }}>{cat}</span>
                                <div style={{ height:'1px', flex:1, background:`linear-gradient(to left, ${color}, transparent)`, opacity:0.5 }} />
                              </div>
                            </td>
                          </tr>
                        );
                        lastCat = cat;
                      }
                      rows.push(
                        <tr key={it.equipment_id} className="border-b last:border-0">
                          <td className="py-1.5 font-mono text-xs text-gray-500">{it.eq_code}</td>
                          <td className="py-1.5" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' }}>
                            <span>{it.eq_name}</span>
                            {it.combo && <span style={{ flexShrink:0, fontSize:'0.68rem', fontWeight:800, padding:'1px 5px', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'3px', color:'rgba(255,255,255,0.45)', letterSpacing:'0.04em' }}>FREE - {it.combo}</span>}
                          </td>
                          <td className="py-1.5 text-right text-red-600 font-medium">{it.qty_out}</td>
                          <td className="py-1.5 text-right text-green-600">{it.qty_returned || 0}</td>
                          <td className={`py-1.5 text-right font-bold ${(it.qty_out - (it.qty_returned || 0)) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                            {it.qty_out - (it.qty_returned || 0)}
                          </td>
                        </tr>
                      );
                    });
                    return rows;
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {ev.external_items?.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2" style={{ color:'#e0e0ee' }}>Thiết bị thuê từ nhà cung cấp</h3>
            <div className="table-wrap">
              <table className="w-full text-sm" style={{ minWidth:'320px' }}>
                <thead><tr className="border-b text-gray-500 text-left">
                  <th className="pb-2">Nhà cung cấp</th><th className="pb-2">Tên thiết bị</th>
                  <th className="pb-2 text-right">SL</th><th className="pb-2">Ghi chú</th>
                </tr></thead>
                <tbody>
                  {ev.external_items.map((it, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 font-medium" style={{ color:'#c9a84c' }}>{it.supplier || '—'}</td>
                      <td className="py-1.5" style={{ color:'#e0e0ee' }}>{it.name}</td>
                      <td className="py-1.5 text-right font-bold" style={{ color:'#60a5fa' }}>{it.quantity}</td>
                      <td className="py-1.5 text-gray-500 text-xs">
                        {[it.rental_days > 0 ? `Thuê ${it.rental_days} ngày` : '', it.notes || ''].filter(Boolean).join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
