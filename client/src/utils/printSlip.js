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
  const day   = txDate.getDate();
  const month = txDate.getMonth() + 1;
  const year  = txDate.getFullYear();
  const hour  = String(txDate.getHours()).padStart(2, '0');
  const min   = String(txDate.getMinutes()).padStart(2, '0');

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
