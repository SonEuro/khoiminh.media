import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import Modal from './Modal';
import { api } from '../api';
import { fmtD } from '../utils/fmt';

function buildPrintHtml(ev, parseFilmingDates, parseDatesField) {
  const CAT_COLORS = { TECH:'#e07b2a', AUDIO:'#3a7bd5', LIGHT:'#d4a017', LED:'#1a8a4a', STAGE:'#9b3a6e', CSVC:'#4a6a8a', MATRIX:'#6a3a9b' };
  const sorted = [...ev.items].sort((a, b) => (a.eq_code || '').localeCompare(b.eq_code || ''));

  let itemRows = '';
  let lastCat = null;
  sorted.forEach(it => {
    const cat = (it.eq_code || '').split('-')[0];
    if (cat !== lastCat) {
      const color = CAT_COLORS[cat] || '#8a7a3a';
      itemRows += `<tr class="cat-row"><td colspan="5" style="padding:8px 0 4px;"><span class="cat-label" style="color:${color};border-color:${color}">${cat}</span></td></tr>`;
      lastCat = cat;
    }
    const rem = it.qty_out - (it.qty_returned || 0);
    itemRows += `<tr>
      <td class="code">${it.eq_code || ''}</td>
      <td>${it.eq_name || ''}${it.combo ? ` <span class="combo">FREE-${it.combo}</span>` : ''}</td>
      <td class="num red">${it.qty_out}</td>
      <td class="num green">${it.qty_returned || 0}</td>
      <td class="num ${rem > 0 ? 'orange bold' : 'gray'}">${rem}</td>
    </tr>`;
  });

  let externalRows = '';
  if (ev.external_items?.length > 0) {
    ev.external_items.forEach(it => {
      const note = [it.rental_days > 0 ? `Thuê ${it.rental_days} ngày` : '', it.notes || ''].filter(Boolean).join(' · ');
      externalRows += `<tr><td class="sup">${it.supplier || '—'}</td><td>${it.name || ''}</td><td class="num blue bold">${it.quantity}</td><td class="note">${note}</td></tr>`;
    });
  }

  const startDates = parseDatesField(ev, 'start_dates', 'start_date');
  const showDates = parseDatesField(ev, 'show_dates', 'show_date');
  const filmingDates = parseFilmingDates(ev);
  const endDates = parseDatesField(ev, 'end_dates', 'end_date');

  const dateRow = (label, dates, colorClass) => dates.length === 0 ? '' :
    `<div class="meta-row"><span class="meta-label">${label}</span><span class="${colorClass}">${dates.map(d => fmtD(d)).join(', ')}</span></div>`;

  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8">
<title>${ev.name} - Đã Xuất</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a2e; padding: 20px 28px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1a1a2e; padding-bottom:10px; margin-bottom:12px; }
  .company { font-size:11px; color:#555; line-height:1.6; }
  .company strong { font-size:14px; color:#1a1a2e; display:block; }
  .event-title { text-align:right; }
  .event-title h1 { font-size:17px; font-weight:800; color:#1a1a2e; }
  .event-code { font-size:11px; color:#888; margin-top:2px; }
  .meta { display:flex; flex-direction:column; gap:4px; margin-bottom:14px; background:#f7f7fa; border-radius:6px; padding:10px 14px; }
  .meta-row { display:flex; gap:8px; }
  .meta-label { color:#666; min-width:120px; font-size:12px; }
  .green2 { color:#1a7a3a; font-weight:600; }
  .orange2 { color:#c75a00; font-weight:700; }
  .red2 { color:#c0392b; font-weight:600; }
  .gray2 { color:#555; }
  .notes-box { border-left:3px solid #c9a84c; background:#fdfbf4; padding:8px 12px; margin-bottom:14px; font-size:12px; color:#333; line-height:1.7; white-space:pre-wrap; }
  .notes-box .notes-label { font-weight:700; color:#8a6a00; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px; }
  h3 { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#333; margin-bottom:6px; border-bottom:1px solid #ddd; padding-bottom:4px; }
  table { width:100%; border-collapse:collapse; margin-bottom:14px; }
  th { font-size:11px; color:#666; font-weight:600; padding:4px 6px; text-align:left; border-bottom:1px solid #ccc; }
  td { padding:4px 6px; border-bottom:1px solid #eee; vertical-align:middle; }
  .code { font-family:monospace; font-size:11px; color:#777; }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  .red { color:#c0392b; font-weight:600; }
  .green { color:#1a7a3a; }
  .orange { color:#c75a00; }
  .bold { font-weight:700; }
  .gray { color:#aaa; }
  .blue { color:#2563aa; }
  .sup { color:#8a6a00; font-weight:600; }
  .note { color:#888; font-size:11px; }
  .combo { font-size:10px; font-weight:700; border:1px solid #bbb; border-radius:3px; padding:0 4px; color:#777; }
  .cat-row td { padding:8px 0 2px; }
  .cat-label { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; border-top:1px solid; border-bottom:1px solid; padding:1px 8px; }
  .footer { margin-top:20px; display:flex; justify-content:space-around; text-align:center; font-size:11px; color:#444; }
  .footer .sig-name { font-weight:700; margin-top:40px; }
  .print-date { font-size:10px; color:#aaa; text-align:right; margin-bottom:6px; }
  @media print { body { padding:10mm 14mm; } }
</style></head><body>
<div class="print-date">In ngày: ${new Date().toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
<div class="header">
  <div class="company"><strong>KHÔI MINH MEDIA</strong>Phiếu Xuất Kho Thiết Bị Sự Kiện</div>
  <div class="event-title"><h1>${ev.name}</h1><div class="event-code">${ev.code}</div></div>
</div>
<div class="meta">
  <div class="meta-row"><span class="meta-label">Khách hàng:</span><strong>${ev.client || '—'}</strong></div>
  <div class="meta-row"><span class="meta-label">Địa điểm:</span><span>${ev.location || '—'}</span></div>
  ${dateRow('Ngày bắt đầu:', startDates, 'red2')}
  ${dateRow('Ngày Rehearsal:', showDates, 'green2')}
  ${dateRow('Ngày ghi hình:', filmingDates, 'orange2')}
  ${dateRow('Ngày kết thúc:', endDates, 'gray2')}
  ${ev.created_by ? `<div class="meta-row"><span class="meta-label">Người tạo:</span><span>${ev.created_by}</span></div>` : ''}
</div>
${ev.notes ? `<div class="notes-box"><div class="notes-label">Ghi chú</div>${ev.notes}</div>` : ''}
${ev.items.length > 0 ? `
<h3>Thiết bị xuất kho</h3>
<table>
  <thead><tr><th>Mã</th><th>Thiết bị</th><th style="text-align:right">Xuất</th><th style="text-align:right">Đã trả</th><th style="text-align:right">Còn nợ</th></tr></thead>
  <tbody>${itemRows}</tbody>
</table>` : ''}
${externalRows ? `
<h3>Thiết bị thuê NCC</h3>
<table>
  <thead><tr><th>Nhà cung cấp</th><th>Tên thiết bị</th><th style="text-align:right">SL</th><th>Ghi chú</th></tr></thead>
  <tbody>${externalRows}</tbody>
</table>` : ''}
<div class="footer">
  <div><div>Người lập phiếu</div><div class="sig-name">&nbsp;</div></div>
  <div><div>Thủ kho</div><div class="sig-name">&nbsp;</div></div>
  <div><div>Người nhận</div><div class="sig-name">&nbsp;</div></div>
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;
}

function buildExcelWorkbook(ev, parseFilmingDatesFn, parseDatesFieldFn) {
  const startDates = parseDatesFieldFn(ev,'start_dates','start_date').map(fmtD).join(', ');
  const showDates  = parseDatesFieldFn(ev,'show_dates', 'show_date').map(fmtD).join(', ');
  const filmDates  = parseFilmingDatesFn(ev).map(fmtD).join(', ');
  const endDates   = parseDatesFieldFn(ev,'end_dates',  'end_date').map(fmtD).join(', ');

  const rows = [];
  rows.push([ev.name, '', '', '', ev.code]);
  rows.push([]);
  if (ev.client)      rows.push(['Khách hàng', ev.client]);
  if (ev.location)    rows.push(['Địa điểm', ev.location]);
  if (startDates)     rows.push(['Ngày bắt đầu', startDates]);
  if (showDates)      rows.push(['Ngày Rehearsal', showDates]);
  if (filmDates)      rows.push(['Ngày ghi hình', filmDates]);
  if (endDates)       rows.push(['Ngày kết thúc', endDates]);
  if (ev.created_by)  rows.push(['Người tạo', ev.created_by]);
  if (ev.notes)       rows.push(['Ghi chú', ev.notes]);
  rows.push([]);
  rows.push(['THIẾT BỊ XUẤT KHO']);
  rows.push(['Mã', 'Thiết bị', 'Xuất', 'Đã trả', 'Còn nợ']);

  const sorted = [...ev.items].sort((a,b) => (a.eq_code||'').localeCompare(b.eq_code||''));
  let lastCat = null;
  sorted.forEach(it => {
    const cat = (it.eq_code||'').split('-')[0];
    if (cat !== lastCat) { rows.push([`── ${cat} ──`]); lastCat = cat; }
    const rem = it.qty_out - (it.qty_returned||0);
    rows.push([it.eq_code||'', it.eq_name||'', it.qty_out, it.qty_returned||0, rem]);
  });

  if (ev.external_items?.length > 0) {
    rows.push([]);
    rows.push(['THIẾT BỊ THUÊ NCC']);
    rows.push(['Nhà cung cấp', 'Tên thiết bị', 'Số lượng', 'Ghi chú']);
    ev.external_items.forEach(it => {
      const note = [it.rental_days>0?`Thuê ${it.rental_days} ngày`:'', it.notes||''].filter(Boolean).join(' · ');
      rows.push([it.supplier||'', it.name||'', it.quantity, note]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 36 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];

  // Add thin border to all non-empty cells
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const thin = { style: 'thin' };
  const border = { top: thin, bottom: thin, left: thin, right: thin };
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell || cell.v === undefined || cell.v === '') continue;
      cell.s = { ...(cell.s || {}), border };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (ev.code || 'Phieu Xuat Kho').slice(0, 31));
  return wb;
}

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
  useEffect(() => {
    const fetch = () => api.getEventById(eventId).then(setEv).catch(() => setErr(true));
    fetch();
    const onVisible = () => { if (!document.hidden) fetch(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [eventId]);

  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(buildPrintHtml(ev, parseFilmingDates, parseDatesField));
    w.document.close();
  };

  const handleExcel = () => {
    const wb = buildExcelWorkbook(ev, parseFilmingDates, parseDatesField);
    XLSX.writeFile(wb, `${ev.name} - Đã Xuất.xlsx`);
  };

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

  const btnStyle = {
    background:'none', border:'1px solid rgba(201,168,76,0.35)', borderRadius:'6px',
    cursor:'pointer', color:'#c9a84c', fontSize:'0.78rem', fontWeight:600,
    padding:'3px 9px', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap',
  };
  const printBtn = ev ? (
    <div style={{ display:'flex', gap:'6px' }}>
      <button onClick={handlePrint} title="In / lưu PDF" style={btnStyle}>🖨️ PDF</button>
      <button onClick={handleExcel} title="Tải file Excel" style={{ ...btnStyle, borderColor:'rgba(74,222,128,0.35)', color:'#4ade80' }}>📊 Excel</button>
    </div>
  ) : null;

  return (
    <Modal title={`${ev.name} · ${ev.code}`} onClose={onClose} size="lg" extra={printBtn}>
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
