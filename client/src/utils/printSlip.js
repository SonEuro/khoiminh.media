function buildSlipHTML(tx, preview = false) {
  const typeLabel = tx.type === 'OUT' ? 'XUẤT KHO' : tx.type === 'RETURN' ? 'NHẬP KHO' : 'SỬA CHỮA';

  const khoItems  = tx.items || [];
  const extItems  = tx.external_items || [];

  const itemRows = khoItems.map((item, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:left;padding-left:6px">${item.eq_name || ''}</td>
      <td style="text-align:center">${item.eq_code || ''}</td>
      <td style="text-align:center">${item.quantity} ${item.unit || ''}</td>
      <td style="text-align:left;padding-left:6px">${item.notes || ''}</td>
    </tr>
  `).join('');

  const extRows = extItems.length > 0 ? `
    <tr>
      <td colspan="5" style="text-align:left;padding:4px 6px;font-weight:bold;font-style:italic;background:#f9f9f9;border-top:2px solid #000">
        Thiết bị thuê từ nhà cung cấp:
      </td>
    </tr>
    ${extItems.map((item, i) => `
      <tr>
        <td style="text-align:center">${khoItems.length + i + 1}</td>
        <td style="text-align:left;padding-left:6px">${item.name || ''}</td>
        <td style="text-align:center;font-size:9pt;color:#555">${item.supplier || ''}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:left;padding-left:6px">${item.notes || ''}</td>
      </tr>
    `).join('')}
  ` : '';

  const totalCount = khoItems.length + extItems.length;
  const blankCount = Math.max(18 - totalCount, 4);
  const blankRows  = Array(blankCount).fill(
    '<tr><td style="height:22px">&nbsp;</td><td></td><td></td><td></td><td></td></tr>'
  ).join('');

  const txDate = tx.transaction_date ? new Date(tx.transaction_date) : new Date();
  const day    = txDate.getDate();
  const month  = txDate.getMonth() + 1;
  const year   = txDate.getFullYear();
  const hour   = String(txDate.getHours()).padStart(2, '0');
  const min    = String(txDate.getMinutes()).padStart(2, '0');

  const previewBar = preview ? `
  <div class="preview-bar">
    <span>👁 Xem trước phiếu — <strong>${tx.code}</strong></span>
    <button class="btn-print" onclick="window.print()">🖨️ In phiếu</button>
    <button class="btn-close" onclick="window.close()">✕ Đóng</button>
  </div>` : '';

  const previewStyle = preview ? `
  .preview-bar {
    position:fixed; top:0; left:0; right:0;
    background:#1a1a2e; color:#e8c97a;
    padding:10px 20px; display:flex; align-items:center; gap:12px;
    font-family:sans-serif; font-size:13px; z-index:999;
    border-bottom:2px solid #c9a84c;
  }
  .preview-bar button { padding:6px 16px; border-radius:6px; border:none; cursor:pointer; font-size:13px; font-weight:700; }
  .btn-print { background:linear-gradient(135deg,#b8922e,#e8c97a); color:#000; }
  .btn-close { background:rgba(255,255,255,0.1); color:#e8e8f0; border:1px solid rgba(255,255,255,0.2)!important; }
  .content { margin-top:52px; }
  @media print { .preview-bar { display:none!important; } .content { margin-top:0!important; } }` : '';

  const printScript = preview ? '' : `
<script>
  window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
</script>`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>${preview ? 'Xem trước · ' : ''}Phiếu ${tx.code}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 15mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Times New Roman', Times, serif; font-size:12pt; color:#000; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

  /* ── Header ── */
  .slip-header {
    display: flex;
    align-items: center;
    border: 2px solid #000;
    padding: 6px 12px;
    gap: 14px;
  }
.slip-title-block {
    flex: 1;
    text-align: center;
  }
  .slip-company {
    font-size: 16pt;
    font-weight: bold;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #c00 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    margin-bottom: 2px;
  }
  .slip-title {
    font-size: 15pt;
    font-weight: bold;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .badge {
    display: inline-block;
    border: 1.5px solid #000;
    padding: 1px 8px;
    font-size: 10pt;
    margin-left: 8px;
    font-weight: bold;
    vertical-align: middle;
  }

  /* ── Info grid ── */
  .info-grid { width:100%; border-collapse:collapse; border:2px solid #000; border-top:none; }
  .info-grid td { border:1px solid #000; padding:5px 8px; font-size:10pt; font-weight:bold; }
  .info-grid .val { font-size:13pt; font-weight:bold; }

  /* ── Main table ── */
  .main-table { width:100%; border-collapse:collapse; margin-top:-1px; }
  .main-table th { border:1px solid #000; padding:5px 4px; font-size:11pt; font-weight:bold; text-align:center; background:#f0f0f0; }
  .main-table td { border:1px solid #000; padding:3px 4px; font-size:11pt; font-weight:bold; }

  /* ── Footer ── */
  .footer-date { text-align:center; margin-top:16px; margin-bottom:4px; font-size:11pt; }
  .sig-row { display:flex; border:1px solid #000; }
  .sig-cell { flex:1; border-right:1px solid #000; text-align:center; font-weight:bold; font-size:11pt; padding:6px 0 70px; }
  .sig-cell:last-child { border-right:none; }

  ${previewStyle}
</style>
</head>
<body>
${previewBar}
<div class="content">

<!-- HEADER -->
<div class="slip-header">
  <div class="slip-title-block">
    <div class="slip-company">Khôi Minh Media</div>
    <div class="slip-title">Phiếu xuất nhập thiết bị <span class="badge">${typeLabel}</span></div>
  </div>
</div>

<!-- INFO -->
<table class="info-grid">
  <tr>
    <td colspan="2">TÊN CHƯƠNG TRÌNH : &nbsp;<span class="val">${tx.event_name || ''}</span></td>
  </tr>
  <tr>
    <td style="width:55%">NGƯỜI NHẬN : &nbsp;<span class="val">${tx.responsible_person || ''}</span></td>
    <td>SỐ ĐIỆN THOẠI :</td>
  </tr>
  <tr>
    <td>SỐ PHIẾU : &nbsp;<span class="val">${tx.code}</span></td>
    <td></td>
  </tr>
  <tr>
    <td colspan="2">NGÀY GHI HÌNH : &nbsp;<span class="val">${tx.filming_date ? tx.filming_date.slice(8,10)+'/'+tx.filming_date.slice(5,7)+'/'+tx.filming_date.slice(2,4) : ''}</span></td>
  </tr>
</table>

<!-- ITEMS -->
<table class="main-table">
  <thead>
    <tr>
      <th style="width:7%">STT</th>
      <th style="width:42%">TÊN THIẾT BỊ</th>
      <th style="width:16%">MÃ MÁY</th>
      <th style="width:12%">SỐ LƯỢNG</th>
      <th style="width:23%">GHI CHÚ</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
    ${extRows}
    ${blankRows}
  </tbody>
</table>

<!-- FOOTER -->
<div class="footer-date">
  ${hour}:${min} &nbsp; ngày &nbsp;${day}&nbsp; tháng &nbsp;${month}&nbsp; năm &nbsp;${year}
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ký và ghi đầy đủ họ và tên
</div>
<div class="sig-row">
  <div class="sig-cell">Quản lý kho</div>
  <div class="sig-cell">Quản lý phòng ban</div>
  <div class="sig-cell">Tổ bảo vệ</div>
</div>

</div>
${printScript}
</body>
</html>`;
}

export function printSlip(tx) {
  const html = buildSlipHTML(tx, false);
  const win  = window.open('', '_blank', 'width=820,height=700');
  if (!win) { alert('Vui lòng cho phép popup để in phiếu'); return; }
  win.document.write(html);
  win.document.close();
}

export function previewSlip(tx) {
  const html = buildSlipHTML(tx, true);
  const win  = window.open('', '_blank', 'width=820,height=750');
  if (!win) { alert('Vui lòng cho phép popup để xem trước phiếu'); return; }
  win.document.write(html);
  win.document.close();
}
