import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getInventoryReport().then(setData).finally(() => setLoading(false));
  }, []);

  const exportCSV = () => {
    if (!data) return;
    const headers = ['Mã', 'Tên thiết bị', 'Danh mục', 'Đơn vị', 'Tổng', 'Có sẵn', 'Đang dùng', 'Sửa chữa', 'Hỏng', 'Mất'];
    const rows = data.map(r => [r.code, r.name, r.category, r.unit, r.qty_total, r.qty_available, r.qty_in_use, r.qty_maintenance, r.qty_damaged, r.qty_lost]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bao-cao-ton-kho-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400 p-6">Đang tải...</div>;

  const grouped = (data || []).reduce((acc, row) => {
    const cat = row.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(row);
    return acc;
  }, {});

  const totals = (data || []).reduce((acc, r) => ({
    total: acc.total + r.qty_total,
    available: acc.available + r.qty_available,
    in_use: acc.in_use + r.qty_in_use,
    maintenance: acc.maintenance + r.qty_maintenance,
    damaged: acc.damaged + r.qty_damaged,
    lost: acc.lost + r.qty_lost,
  }), { total: 0, available: 0, in_use: 0, maintenance: 0, damaged: 0, lost: 0 });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Báo Cáo Tồn Kho</h1>
          <p className="text-gray-500 text-sm">Cập nhật theo thời gian thực</p>
        </div>
        <button className="btn-secondary" onClick={exportCSV}>📥 Xuất CSV</button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Tổng', val: totals.total, cls: 'bg-gray-50 border-gray-200' },
          { label: 'Có sẵn', val: totals.available, cls: 'bg-green-50 border-green-200 text-green-800' },
          { label: 'Đang dùng', val: totals.in_use, cls: 'bg-blue-50 border-blue-200 text-blue-800' },
          { label: 'Đang sửa', val: totals.maintenance, cls: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
          { label: 'Hỏng', val: totals.damaged, cls: 'bg-red-50 border-red-200 text-red-800' },
          { label: 'Mất', val: totals.lost, cls: 'bg-gray-50 border-gray-300' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.cls}`}>
            <p className="text-xs opacity-70 uppercase tracking-wider font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      {/* Grouped table */}
      {Object.entries(grouped).map(([cat, items]) => {
        const catTotal = items.reduce((a, r) => ({
          qty_total: a.qty_total + r.qty_total,
          qty_available: a.qty_available + r.qty_available,
          qty_in_use: a.qty_in_use + r.qty_in_use,
          qty_maintenance: a.qty_maintenance + r.qty_maintenance,
          qty_damaged: a.qty_damaged + r.qty_damaged,
          qty_lost: a.qty_lost + r.qty_lost,
        }), { qty_total: 0, qty_available: 0, qty_in_use: 0, qty_maintenance: 0, qty_damaged: 0, qty_lost: 0 });

        return (
          <div key={cat} className="card p-0 overflow-hidden">
            <div className="px-4 py-3 bg-gray-800 text-white flex items-center justify-between">
              <h2 className="font-semibold">{items[0]?.icon || ''} {cat}</h2>
              <span className="text-sm text-gray-300">{items.length} loại · tổng {catTotal.qty_total}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500">Mã</th>
                  <th className="text-left px-4 py-2 text-gray-500">Tên thiết bị</th>
                  <th className="text-left px-4 py-2 text-gray-500">ĐVT</th>
                  <th className="text-right px-4 py-2 text-gray-500">Tổng</th>
                  <th className="text-right px-4 py-2 text-green-600">Có sẵn</th>
                  <th className="text-right px-4 py-2 text-blue-600">Đang dùng</th>
                  <th className="text-right px-4 py-2 text-yellow-600">Sửa chữa</th>
                  <th className="text-right px-4 py-2 text-red-600">Hỏng</th>
                  <th className="text-right px-4 py-2 text-gray-400">Mất</th>
                </tr>
              </thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.code} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{r.code}</td>
                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{r.unit}</td>
                    <td className="px-4 py-2.5 text-right font-bold">{r.qty_total}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${r.qty_available === 0 ? 'text-red-600' : 'text-green-600'}`}>{r.qty_available}</td>
                    <td className="px-4 py-2.5 text-right text-blue-600">{r.qty_in_use || 0}</td>
                    <td className="px-4 py-2.5 text-right text-yellow-600">{r.qty_maintenance || 0}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">{r.qty_damaged || 0}</td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{r.qty_lost || 0}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 border-t-2 font-semibold text-sm">
                  <td colSpan={3} className="px-4 py-2 text-gray-700">Tổng cộng</td>
                  <td className="px-4 py-2 text-right">{catTotal.qty_total}</td>
                  <td className="px-4 py-2 text-right text-green-600">{catTotal.qty_available}</td>
                  <td className="px-4 py-2 text-right text-blue-600">{catTotal.qty_in_use}</td>
                  <td className="px-4 py-2 text-right text-yellow-600">{catTotal.qty_maintenance}</td>
                  <td className="px-4 py-2 text-right text-red-600">{catTotal.qty_damaged}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{catTotal.qty_lost}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
