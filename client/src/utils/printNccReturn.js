export function printNccReturn(items, info = {}) {
  const now    = new Date();
  const day    = now.getDate();
  const month  = now.getMonth() + 1;
  const year   = now.getFullYear();
  const hour   = String(now.getHours()).padStart(2, '0');
  const min    = String(now.getMinutes()).padStart(2, '0');

  const itemRows = items.map((item, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:left;padding-left:6px">${item.name || ''}</td>
      <td style="text-align:center;font-weight:700">${item.supplier || ''}</td>
      <td style="text-align:center">
        <div style="display:inline-flex;align-items:baseline;justify-content:center;gap:3px">
          <span style="font-size:14pt;font-weight:bold">${item.quantity || 1}</span>
          <span style="font-size:9pt;font-weight:normal">${item.unit || 'Cái'}</span>
        </div>
      </td>
      <td style="text-align:left;padding-left:6px">${item.notes || ''}</td>
    </tr>`).join('');

  const blankCount = items.length > 16 ? 0 : Math.max(14 - items.length, 4);
  const blankRows  = Array(blankCount).fill(
    '<tr><td style="height:22px">&nbsp;</td><td></td><td></td><td></td><td></td></tr>'
  ).join('');

  const totalPages = items.length <= 18 ? 1 : 1 + Math.ceil((items.length - 18) / 22);

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Phiếu Trả NCC · ${info.code || ''}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 15mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Times New Roman', Times, serif; font-size:12pt; color:#000; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

  .slip-header { display:flex; align-items:center; border:2px solid #000; padding:6px 12px; gap:14px; }
  .slip-title-block { flex:1; text-align:center; }
  .slip-company { font-size:16pt; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase; color:#c00 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; margin-bottom:2px; }
  .slip-title { font-size:15pt; font-weight:bold; letter-spacing:0.5px; text-transform:uppercase; }
  .badge { display:inline-block; border:1.5px solid #000; padding:1px 8px; font-size:10pt; margin-left:8px; font-weight:bold; vertical-align:middle; }

  .info-grid { width:100%; border-collapse:collapse; border:2px solid #000; border-top:none; }
  .info-grid td { border:1px solid #000; padding:5px 8px; font-size:9pt; font-weight:bold; }
  .info-grid .val { font-size:15pt; font-weight:bold; }

  .main-table { width:100%; border-collapse:collapse; margin-top:-1px; }
  .main-table th { border:1px solid #000; padding:5px 4px; font-size:11pt; font-weight:bold; text-align:center; background:#f0f0f0; }
  .main-table td { border:1px solid #000; padding:3px 4px; font-size:11pt; font-weight:bold; }

  .page-counter-cell::after { content: counter(page) " / ${totalPages}"; }

  .footer-td { border:none !important; padding:0 !important; border-top:2px solid #000 !important; }
  .footer-wrap { text-align:center; margin-top:8px; margin-bottom:3px; }
  .footer-date { font-size:16pt; font-weight:bold; display:block; margin-bottom:2px; }
  .footer-note { font-size:9pt; font-weight:bold; display:block; }
  .sig-row { display:flex; border:2px solid #000; }
  .sig-cell { flex:1; border-right:1px solid #000; text-align:center; font-weight:bold; font-size:10pt; padding:5px 0 40px; }
  .sig-cell:last-child { border-right:none; }
</style>
</head>
<body>

<!-- HEADER -->
<div class="slip-header">
  <div class="slip-title-block">
    <div class="slip-company">Khôi Minh Media</div>
    <div class="slip-title">Phiếu trả thiết bị nhà cung cấp <span class="badge">TRẢ NCC</span></div>
  </div>
</div>

<!-- INFO -->
<table class="info-grid">
  <tr>
    <td colspan="2">TÊN CHƯƠNG TRÌNH : &nbsp;<span class="val">${info.event_name || ''}</span></td>
  </tr>
  <tr>
    <td style="width:55%">PHIẾU GỐC : &nbsp;<span class="val">${info.code || ''}</span></td>
    <td>NGÀY TRẢ : &nbsp;<span class="val">${hour}:${min} ngày ${day}/${month}/${year}</span></td>
  </tr>
  <tr>
    <td>NGƯỜI PHỤ TRÁCH : &nbsp;<span class="val">${info.responsible_person || ''}</span></td>
    <td>ĐỊA ĐIỂM : &nbsp;<span class="val">${info.event_location || ''}</span></td>
  </tr>
</table>

<!-- ITEMS -->
<table class="main-table">
  <thead>
    <tr>
      <td colspan="2" style="border:1px solid #999;padding:4px 8px;border-bottom:2px solid #000">
        <span style="display:block;font-size:7pt;color:#555;text-transform:uppercase;font-weight:bold">Sự kiện</span>
        <span style="display:block;font-size:10pt;font-weight:bold">${info.event_name || ''}</span>
      </td>
      <td colspan="2" style="border:1px solid #999;padding:4px 8px;border-bottom:2px solid #000">
        <span style="display:block;font-size:7pt;color:#555;text-transform:uppercase;font-weight:bold">Số phiếu gốc</span>
        <span style="display:block;font-size:10pt;font-weight:bold">${info.code || ''}</span>
      </td>
      <td style="border:1px solid #999;padding:4px 8px;border-bottom:2px solid #000">
        <span style="display:block;font-size:7pt;color:#555;text-transform:uppercase;font-weight:bold">Số thứ tự tờ</span>
        <span style="display:block;font-size:10pt;font-weight:bold" class="page-counter-cell"></span>
      </td>
    </tr>
    <tr>
      <th style="width:7%">STT</th>
      <th style="width:35%">TÊN THIẾT BỊ</th>
      <th style="width:22%">NHÀ CUNG CẤP</th>
      <th style="width:12%">SỐ LƯỢNG</th>
      <th style="width:24%">GHI CHÚ</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
    ${blankRows}
    <tr style="break-inside:avoid;page-break-inside:avoid">
      <td colspan="5" class="footer-td">
        <div class="footer-wrap">
          <span class="footer-date">${hour}:${min} &nbsp; ngày &nbsp;${day}&nbsp; tháng &nbsp;${month}&nbsp; năm &nbsp;${year}</span>
          <span class="footer-note">ký và ghi đầy đủ họ và tên</span>
        </div>
        <div class="sig-row">
          <div class="sig-cell">Người giao (Khôi Minh)</div>
          <div class="sig-cell">Người nhận (NCC)</div>
          <div class="sig-cell">Xác nhận</div>
        </div>
      </td>
    </tr>
  </tbody>
</table>

</body>
</html>`;

  const win = window.open('', '_blank', 'width=820,height=700');
  if (!win) { alert('Vui lòng cho phép popup để in phiếu'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.print(); win.onafterprint = () => win.close(); };
}
