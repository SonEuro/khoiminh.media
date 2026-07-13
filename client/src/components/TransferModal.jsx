import { useState } from 'react';
import Modal from './Modal';
import { api } from '../api';

const GOLD = '#c9a84c';

export default function TransferModal({ tx, events, onClose, onDone }) {
  const [targetEventId, setTargetEventId] = useState('');
  const [items, setItems] = useState(
    (tx.items || []).map(it => ({ ...it, selected: true, transferQty: it.quantity }))
  );
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);

  const availableEvents = events.filter(e => String(e.id) !== String(tx.event_id));
  const selectedItems   = items.filter(it => it.selected && parseInt(it.transferQty) > 0);
  const canSubmit       = targetEventId && selectedItems.length > 0 && !loading;

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await api.transferEquipment({
        source_tx_id:    tx.id,
        target_event_id: targetEventId,
        items: selectedItems.map(it => ({
          equipment_id: it.equipment_id,
          quantity:     parseInt(it.transferQty) || 1,
          notes:        it.notes || null,
          combo:        it.combo || null,
        })),
      });
      setResult(res);
      onDone?.();
    } catch (e) {
      alert(e.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  }

  /* ── Kết quả ── */
  if (result) {
    const isCase1 = result.case === 1;
    return (
      <Modal title="Chuyển thiết bị — Hoàn tất" onClose={onClose}>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ background:'rgba(74,222,128,0.07)', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'8px', padding:'14px 16px' }}>
            <p style={{ color:'#4ade80', fontWeight:700, margin:'0 0 10px', fontSize:'0.95rem' }}>✅ Chuyển thiết bị thành công</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'5px', fontSize:'0.84rem' }}>
              <p style={{ margin:0, color:'#a0a0b8' }}>
                Phiếu đích:&nbsp;
                <span style={{ color:'#e8c97a', fontWeight:700 }}>{result.target_tx_code}</span>
                <span style={{ marginLeft:'6px', fontSize:'0.76rem', color: isCase1 ? '#60a5fa' : '#a78bfa' }}>
                  {isCase1 ? '(phiếu xuất tạm mới)' : '(cập nhật)'}
                </span>
              </p>
              <p style={{ margin:0, color:'#a0a0b8' }}>
                Phiếu nguồn:&nbsp;
                <span style={{ color:'#e8c97a', fontWeight:700 }}>{result.source_tx_code}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose}
            style={{ padding:'10px', borderRadius:'8px', cursor:'pointer', border:`1px solid ${GOLD}`, background:'transparent', color:GOLD, fontWeight:700 }}>
            Đóng
          </button>
        </div>
      </Modal>
    );
  }

  /* ── Form ── */
  return (
    <Modal title={`Chuyển thiết bị — ${tx.code}`} onClose={onClose} size="md">
      <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

        {/* Danh sách thiết bị */}
        <div>
          <p style={{ fontSize:'0.75rem', fontWeight:700, color:'#7878a0', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 8px' }}>
            Danh sách thiết bị
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            {items.length === 0 && (
              <p style={{ fontSize:'0.84rem', color:'#7878a0', margin:0 }}>Không có thiết bị nào trong phiếu này</p>
            )}
            {items.map((it, idx) => (
              <div key={it.equipment_id} style={{
                display:'flex', alignItems:'center', gap:'10px',
                padding:'8px 12px',
                background: it.selected ? 'rgba(201,168,76,0.05)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${it.selected ? 'rgba(201,168,76,0.22)' : 'rgba(255,255,255,0.05)'}`,
                borderRadius:'7px', transition:'background 0.12s',
              }}>
                <input type="checkbox" checked={it.selected}
                  onChange={e => updateItem(idx, 'selected', e.target.checked)}
                  style={{ accentColor: GOLD, width:'15px', height:'15px', flexShrink:0, cursor:'pointer' }} />
                <span style={{ flex:1, fontSize:'0.87rem', color: it.selected ? '#e0e0ee' : '#7878a0', minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {it.eq_name}
                  {it.combo && (
                    <span style={{ marginLeft:'5px', fontSize:'0.68rem', border:'1px solid rgba(167,139,250,0.4)', borderRadius:'3px', padding:'0 4px', color:'#a78bfa' }}>FREE</span>
                  )}
                </span>
                <span style={{ fontSize:'0.74rem', color:'#555570', fontFamily:'monospace', flexShrink:0 }}>{it.eq_code}</span>
                <input type="number" min="1" max={it.quantity}
                  disabled={!it.selected}
                  value={it.transferQty}
                  onChange={e => updateItem(idx, 'transferQty', e.target.value)}
                  style={{
                    width:'50px', height:'30px', textAlign:'center', borderRadius:'6px',
                    border: `1px solid ${it.selected ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.07)'}`,
                    background: it.selected ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.02)',
                    color: it.selected ? '#4ade80' : '#555570',
                    fontWeight:800, fontSize:'0.95rem', outline:'none',
                  }} />
                <span style={{ fontSize:'0.74rem', color:'#7878a0', flexShrink:0 }}>/{it.quantity} {it.unit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sự kiện đích */}
        <div>
          <p style={{ fontSize:'0.75rem', fontWeight:700, color:'#7878a0', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 8px' }}>
            Thiết bị đến sự kiện
          </p>
          <select
            value={targetEventId}
            onChange={e => setTargetEventId(e.target.value)}
            style={{
              width:'100%', height:'42px', padding:'0 10px',
              background:'rgba(255,255,255,0.04)', border:'1px solid rgba(201,168,76,0.3)',
              borderRadius:'8px', color: targetEventId ? '#e0e0ee' : '#7878a0',
              fontSize:'0.90rem', outline:'none',
            }}>
            <option value="">— Chọn sự kiện —</option>
            {availableEvents.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.name}{ev.code ? ` · ${ev.code}` : ''}</option>
            ))}
          </select>
        </div>

        {/* Submit */}
        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          style={{
            padding:'11px', borderRadius:'8px',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            border: `1px solid ${canSubmit ? GOLD : 'rgba(201,168,76,0.18)'}`,
            background: canSubmit ? 'rgba(201,168,76,0.10)' : 'transparent',
            color: canSubmit ? '#e8c97a' : '#4a4a6a',
            fontWeight:700, fontSize:'0.92rem',
          }}>
          {loading ? 'Đang xử lý...' : '🔄 Cập nhật'}
        </button>
      </div>
    </Modal>
  );
}
