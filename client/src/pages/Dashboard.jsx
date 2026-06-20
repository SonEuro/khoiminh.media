import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import StatCard from '../components/StatCard';

const TYPE_LABELS = { OUT: 'Xuất kho', RETURN: 'Nhập kho', FIX: 'Sửa xong' };
const TYPE_COLORS = { OUT: 'text-red-600', RETURN: 'text-green-600', FIX: 'text-blue-600' };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSummary().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Đang tải...</div>;
  if (!data) return null;

  const { totals, by_category, active_events, low_stock, damaged_list, recent_tx } = data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 text-sm">Tổng quan kho thiết bị Khôi Minh</p>
        </div>
        <div className="flex gap-3">
          <Link to="/export" className="btn-primary btn-sm">⬆️ Xuất kho</Link>
          <Link to="/return" className="btn-success btn-sm">⬇️ Nhập kho</Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon="📦" label="Tổng tồn kho" value={totals.total_items} color="blue" />
        <StatCard icon="✅" label="Có sẵn"        value={totals.available}   color="green" />
        <StatCard icon="🚀" label="Đang dùng"     value={totals.in_use}      color="blue" />
        <StatCard icon="🔧" label="Đang sửa"      value={totals.maintenance} color="yellow" />
        <StatCard icon="❌" label="Hư / Mất"      value={(totals.damaged || 0) + (totals.lost || 0)} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By Category */}
        <div className="card lg:col-span-2">
          <h2 className="font-semibold mb-4">Tồn kho theo danh mục</h2>
          <div className="space-y-3">
            {by_category.map(cat => {
              const pct = cat.total > 0 ? Math.round((cat.available / cat.total) * 100) : 0;
              return (
                <div key={cat.code}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{cat.icon} {cat.name}</span>
                    <span className="text-gray-500">{cat.available}/{cat.total}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <h2 className="font-semibold mb-4">Giao dịch gần đây</h2>
          <div className="space-y-3">
            {recent_tx.length === 0 && <p className="text-sm text-gray-400">Chưa có giao dịch</p>}
            {recent_tx.map(tx => (
              <div key={tx.code} className="flex items-start justify-between text-sm">
                <div>
                  <p className={`font-medium ${TYPE_COLORS[tx.type] || 'text-gray-700'}`}>
                    {TYPE_LABELS[tx.type] || tx.type} · {tx.code}
                  </p>
                  <p className="text-gray-500 text-xs">{tx.event_name || 'Nội bộ'} · {tx.item_count} loại</p>
                </div>
                <span className="text-gray-400 text-xs whitespace-nowrap">
                  {tx.transaction_date?.slice(0, 10)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Events */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Sự kiện đang hoạt động</h2>
            <Link to="/events" className="text-blue-600 text-sm hover:underline">Xem tất cả</Link>
          </div>
          {active_events.length === 0 && <p className="text-sm text-gray-400">Không có sự kiện nào</p>}
          <div className="space-y-3">
            {active_events.slice(0, 5).map(ev => (
              <div key={ev.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                <div>
                  <p className="font-medium">{ev.name}</p>
                  <p className="text-gray-500 text-xs">{ev.client} · {ev.start_date}</p>
                </div>
                <div className="text-right">
                  <p className="text-blue-600 font-medium">{ev.qty_out || 0} xuất</p>
                  <p className="text-green-600 text-xs">{ev.qty_returned || 0} đã về</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="space-y-4">
          {low_stock.length > 0 && (
            <div className="card border-yellow-200 bg-yellow-50">
              <h2 className="font-semibold text-yellow-800 mb-3">⚠️ Tồn kho thấp</h2>
              <div className="space-y-1">
                {low_stock.map(eq => (
                  <div key={eq.code} className="flex justify-between text-sm text-yellow-700">
                    <span>{eq.code} · {eq.name}</span>
                    <span className="font-bold">{eq.qty_available} {eq.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {damaged_list.length > 0 && (
            <div className="card border-red-200 bg-red-50">
              <h2 className="font-semibold text-red-800 mb-3">❌ Thiết bị hư / mất</h2>
              <div className="space-y-1">
                {damaged_list.map(eq => (
                  <div key={eq.code} className="flex justify-between text-sm text-red-700">
                    <span>{eq.code} · {eq.name}</span>
                    <span>
                      {eq.qty_damaged > 0 && <span className="font-bold">{eq.qty_damaged} hư </span>}
                      {eq.qty_lost > 0 && <span className="font-bold text-gray-700">{eq.qty_lost} mất</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
