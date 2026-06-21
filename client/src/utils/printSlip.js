export function printSlip(tx) {
  const typeLabel = tx.type === 'OUT' ? 'XUẤT KHO' : tx.type === 'RETURN' ? 'NHẬP KHO' : 'SỬA CHỮA';

  const itemRows = (tx.items || []).map((item, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:left;padding-left:6px">${item.eq_name || ''}</td>
      <td style="text-align:center">${item.eq_code || ''}</td>
      <td style="text-align:center">${item.quantity} ${item.unit || ''}</td>
      <td style="text-align:left;padding-left:6px">${item.notes || ''}</td>
    </tr>
  `).join('');

  const blankCount = Math.max(18 - (tx.items || []).length, 4);
  const blankRows = Array(blankCount).fill(
    '<tr><td style="height:22px">&nbsp;</td><td></td><td></td><td></td><td></td></tr>'
  ).join('');

  const txDate = tx.transaction_date ? new Date(tx.transaction_date) : new Date();
  const now   = new Date();
  const day   = txDate.getDate();
  const month = txDate.getMonth() + 1;
  const year  = txDate.getFullYear();
  const hour  = String(now.getHours()).padStart(2, '0');
  const min   = String(now.getMinutes()).padStart(2, '0');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Phiếu ${tx.code}</title>
<style>
  @page { size: A4 portrait; margin: 12mm 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    color: #000;
  }
  .header {
    text-align: center;
    font-size: 15pt;
    font-weight: bold;
    border: 2px solid #000;
    padding: 8px 12px;
    letter-spacing: 0.5px;
  }
  .info-grid {
    width: 100%;
    border-collapse: collapse;
    border: 2px solid #000;
    border-top: none;
  }
  .info-grid td {
    border: 1px solid #000;
    padding: 5px 8px;
    font-size: 11pt;
  }
  .info-grid td b { font-weight: bold; }
  .main-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: -1px;
  }
  .main-table th {
    border: 1px solid #000;
    padding: 5px 4px;
    font-size: 11pt;
    font-weight: bold;
    text-align: center;
    background: #f0f0f0;
  }
  .main-table td {
    border: 1px solid #000;
    padding: 3px 4px;
    font-size: 11pt;
  }
  .footer-date {
    text-align: center;
    margin-top: 16px;
    margin-bottom: 4px;
    font-size: 11pt;
  }
  .sig-row {
    display: flex;
    border: 1px solid #000;
  }
  .sig-cell {
    flex: 1;
    border-right: 1px solid #000;
    text-align: center;
    font-weight: bold;
    font-size: 11pt;
    padding: 6px 0 70px;
  }
  .sig-cell:last-child { border-right: none; }
  .badge {
    display: inline-block;
    border: 1px solid #000;
    padding: 1px 6px;
    font-size: 10pt;
    margin-left: 6px;
    font-weight: bold;
  }
</style>
</head>
<body>

<div class="header">PHIẾU XUẤT NHẬP THIẾT BỊ KHÔI MINH &nbsp;<span class="badge">${typeLabel}</span></div>

<table class="info-grid">
  <tr>
    <td colspan="2"><b>TÊN CHƯƠNG TRÌNH :</b> &nbsp;${tx.event_name || ''}</td>
  </tr>
  <tr>
    <td style="width:55%"><b>NGƯỜI NHẬN :</b> &nbsp;${tx.responsible_person || ''}</td>
    <td><b>SỐ ĐIỆN THOẠI :</b></td>
  </tr>
  <tr>
    <td><b>SỐ PHIẾU :</b> &nbsp;${tx.code}</td>
    <td></td>
  </tr>
  <tr>
    <td colspan="2"><b>NGÀY GHI HÌNH :</b> &nbsp;${tx.expected_return_date || ''}</td>
  </tr>
</table>

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
    ${blankRows}
  </tbody>
</table>

<div class="footer-date">
  ${hour}:${min} &nbsp; ngày &nbsp;${day}&nbsp; tháng &nbsp;${month}&nbsp; năm &nbsp;${year} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  ký và ghi đầy đủ họ và tên
</div>
<div class="sig-row">
  <div class="sig-cell">quản lý kho</div>
  <div class="sig-cell">quản lý phòng ban</div>
  <div class="sig-cell">tổ bảo vệ</div>
</div>

<script>
  window.onload = function() {
    window.print();
    window.onafterprint = function() { window.close(); };
  };
</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=820,height=700');
  if (!win) { alert('Vui lòng cho phép popup để in phiếu'); return; }
  win.document.write(html);
  win.document.close();
}

export function previewSlip(tx) {
  // Same as printSlip but without auto-print script
  const typeLabel = tx.type === 'OUT' ? 'XUẤT KHO' : tx.type === 'RETURN' ? 'NHẬP KHO' : 'SỬA CHỮA';

  const itemRows = (tx.items || []).map((item, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:left;padding-left:6px">${item.eq_name || ''}</td>
      <td style="text-align:center">${item.eq_code || ''}</td>
      <td style="text-align:center">${item.quantity} ${item.unit || ''}</td>
      <td style="text-align:left;padding-left:6px">${item.notes || ''}</td>
    </tr>
  `).join('');

  const blankCount = Math.max(18 - (tx.items || []).length, 4);
  const blankRows = Array(blankCount).fill(
    '<tr><td style="height:22px">&nbsp;</td><td></td><td></td><td></td><td></td></tr>'
  ).join('');

  const txDate = tx.transaction_date ? new Date(tx.transaction_date) : new Date();
  const now   = new Date();
  const day   = txDate.getDate();
  const month = txDate.getMonth() + 1;
  const year  = txDate.getFullYear();
  const hour  = String(now.getHours()).padStart(2, '0');
  const min   = String(now.getMinutes()).padStart(2, '0');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Xem trước · ${tx.code}</title>
<style>
  @page { size: A4 portrait; margin: 12mm 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; }
  .preview-bar {
    position: fixed; top: 0; left: 0; right: 0;
    background: #1a1a2e; color: #e8c97a;
    padding: 10px 20px; display: flex; align-items: center; gap: 12px;
    font-family: sans-serif; font-size: 13px; z-index: 999;
    border-bottom: 2px solid #c9a84c;
  }
  .preview-bar button {
    padding: 6px 16px; border-radius: 6px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 700;
  }
  .btn-print { background: linear-gradient(135deg,#b8922e,#e8c97a); color: #000; }
  .btn-close { background: rgba(255,255,255,0.1); color: #e8e8f0; border: 1px solid rgba(255,255,255,0.2) !important; }
  .content { margin-top: 52px; }
  .header { text-align:center; font-size:15pt; font-weight:bold; border:2px solid #000; padding:8px 12px; letter-spacing:0.5px; }
  .info-grid { width:100%; border-collapse:collapse; border:2px solid #000; border-top:none; }
  .info-grid td { border:1px solid #000; padding:5px 8px; font-size:11pt; }
  .main-table { width:100%; border-collapse:collapse; margin-top:-1px; }
  .main-table th { border:1px solid #000; padding:5px 4px; font-size:11pt; font-weight:bold; text-align:center; background:#f0f0f0; }
  .main-table td { border:1px solid #000; padding:3px 4px; font-size:11pt; }
  .footer-date { text-align:center; margin-top:16px; margin-bottom:4px; font-size:11pt; }
  .sig-row { display:flex; border:1px solid #000; }
  .sig-cell { flex:1; border-right:1px solid #000; text-align:center; font-weight:bold; font-size:11pt; padding:6px 0 70px; }
  .sig-cell:last-child { border-right:none; }
  .badge { display:inline-block; border:1px solid #000; padding:1px 6px; font-size:10pt; margin-left:6px; font-weight:bold; }
  @media print { .preview-bar { display: none !important; } .content { margin-top: 0 !important; } }
</style>
</head>
<body>
<div class="preview-bar">
  <span>👁 Xem trước phiếu — <strong>${tx.code}</strong></span>
  <button class="btn-print" onclick="window.print()">🖨️ In phiếu</button>
  <button class="btn-close" onclick="window.close()">✕ Đóng</button>
</div>
<div class="content">
<div class="header">PHIẾU XUẤT NHẬP THIẾT BỊ KHÔI MINH &nbsp;<span class="badge">${typeLabel}</span></div>
<table class="info-grid">
  <tr><td colspan="2"><b>TÊN CHƯƠNG TRÌNH :</b> &nbsp;${tx.event_name || ''}</td></tr>
  <tr>
    <td style="width:55%"><b>NGƯỜI NHẬN :</b> &nbsp;${tx.responsible_person || ''}</td>
    <td><b>SỐ ĐIỆN THOẠI :</b></td>
  </tr>
  <tr>
    <td><b>SỐ PHIẾU :</b> &nbsp;${tx.code}</td>
    <td></td>
  </tr>
  <tr><td colspan="2"><b>NGÀY GHI HÌNH :</b> &nbsp;${tx.expected_return_date || ''}</td></tr>
</table>
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
  <tbody>${itemRows}${blankRows}</tbody>
</table>
<div class="footer-date">
  ${hour}:${min} &nbsp; ngày &nbsp;${day}&nbsp; tháng &nbsp;${month}&nbsp; năm &nbsp;${year} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  ký và ghi đầy đủ họ và tên
</div>
<div class="sig-row">
  <div class="sig-cell">quản lý kho</div>
  <div class="sig-cell">quản lý phòng ban</div>
  <div class="sig-cell">tổ bảo vệ</div>
</div>
</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=820,height=750');
  if (!win) { alert('Vui lòng cho phép popup để xem trước phiếu'); return; }
  win.document.write(html);
  win.document.close();
}
