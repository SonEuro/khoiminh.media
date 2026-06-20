import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';

const TYPE_CONFIG = {
  OUT:    { label: 'Xuất kho',   icon: '⬆️', cls: 'bg-red-100 text-red-800' },
  RETURN: { label: 'Nhập kho',   icon: '⬇️', cls: 'bg-green-100 text-green-800' },
  FIX:    { label: 'Sửa xong',   icon: '🔧', cls: 'bg-blue-100 text-blue-800' },
};

function TxDetailModal({ txId, onClose }) {
  const [tx, setTx] = useState(null);
  useEffect(() => { api.getTransactionById(txId).then(setTx); }, [txId]);

  if (!tx) return <Modal title="Phiếu" onClose={onClose}><div className="text-center py-8 text-gray-400">Đang tải...</div></Modal>;

  const cfg = TYPE_CONFIG[tx.type] || { label: tx.type, icon: '📋', cls: '' };
  return (
    <Modal title={`${cfg.icon} ${tx.code}`} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Loại: </span><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span></div>
          <div><span className="text-gray-500">Ngày: </span><strong>{tx.transaction_date?.slice(0, 16)}</strong></div>
          <div><span className="text-gray-500">Sự kiện: </span><strong>{tx.event_name || 'Nội bộ'}</strong></div>
          <div><span className="text-gray-500">Phụ trách: </span><strong>{tx.responsible_person || '—'}</strong></div>
          {tx.expected_return_date && <div><span className="text-gray-500">Dự kiến trả: </span><strong>{tx.expected_return_date}</strong></div>}
        </div>
        {tx.notes && <p className="text-sm bg-gray-50 p-3 rounded-lg text-gray-600">{tx.notes}</p>}

        <div>
          <h3 className="font-semibold mb-2">Danh sách thiết bị ({tx.items.length} loại)</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500 text-left">
              <th className="pb-2">Mã</th><th className="pb-2">Thiết bị</th>
              <th className="pb-2">Danh mục</th><th className="pb-2 text-right">SL</th>
              <th className="pb-2">Tình trạng</th>
            </tr></thead>
            <tbody>
              {tx.items.map(it => (
                <tr key={it.id} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs text-gray-500">{it.eq_code}</td>
                  <td className="py-2">{it.eq_name}</td>
                  <td className="py-2 text-gray-400 text-xs">{it.category}</td>
                  <td className="py-2 text-right font-bold">{it.quantity} {it.unit}</td>
                  <td className="py-2">
                    <span className={`badge-${it.condition === 'good' ? 'available' : it.condition === 'damaged' ? 'damaged' : it.condition === 'lost' ? 'lost' : 'maintenance'}`}>
                      {it.condition === 'good' ? 'Tốt' : it.condition === 'damaged' ? 'Hỏng' : it.condition === 'maintenance' ? 'Cần sửa' : 'Mất'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedTx, setSelectedTx] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit: 100 };
    if (typeFilter) params.type = typeFilter;
    api.getTransactions(params).then(setTransactions).finally(() => setLoading(false));
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Lịch Sử Giao Dịch</h1>
          <p className="text-gray-500 text-sm">{transactions.length} phiếu</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {[['', 'Tất cả'], ['OUT', '⬆️ Xuất kho'], ['RETURN', '⬇️ Nhập kho'], ['FIX', '🔧 Sửa xong']].map(([v, l]) => (
          <button key={v}
            className={`btn btn-sm ${typeFilter === v ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTypeFilter(v)}>
            {l}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600">Phiếu</th>
              <th className="text-left px-4 py-3 text-gray-600">Loại</th>
              <th className="text-left px-4 py-3 text-gray-600">Sự kiện</th>
              <th className="text-left px-4 py-3 text-gray-600">Phụ trách</th>
              <th className="text-center px-4 py-3 text-gray-600">Thiết bị</th>
              <th className="text-left px-4 py-3 text-gray-600">Ngày</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Đang tải...</td></tr>}
            {!loading && transactions.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Chưa có phiếu nào</td></tr>
            )}
            {transactions.map(tx => {
              const cfg = TYPE_CONFIG[tx.type] || { label: tx.type, icon: '📋', cls: 'bg-gray-100 text-gray-800' };
              return (
                <tr key={tx.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{tx.code}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{tx.event_name || 'Nội bộ'}</td>
                  <td className="px-4 py-3">{tx.responsible_person || '—'}</td>
                  <td className="px-4 py-3 text-center font-medium">{tx.item_count} loại</td>
                  <td className="px-4 py-3 text-gray-400">{tx.transaction_date?.slice(0, 16)}</td>
                  <td className="px-4 py-3">
                    <button className="btn-secondary btn-sm" onClick={() => setSelectedTx(tx.id)}>Chi tiết</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedTx && <TxDetailModal txId={selectedTx} onClose={() => setSelectedTx(null)} />}
    </div>
  );
}
