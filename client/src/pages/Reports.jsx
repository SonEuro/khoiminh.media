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

      {/* Summary row — 3 cols on mobile, 6 on desktop */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px',
      }}
        className="sm-grid-6"
      >
        {[
          { label: 'Tổng',      val: totals.total,       labelColor: '#c9a84c', valColor: '#eeeef5',  border: 'rgba(201,168,76,0.3)' },
          { label: 'Có sẵn',   val: totals.available,   labelColor: '#4ade80', valColor: '#4ade80',  border: 'rgba(74,222,128,0.3)' },
          { label: 'Đang dùng',val: totals.in_use,      labelColor: '#60a5fa', valColor: '#60a5fa',  border: 'rgba(96,165,250,0.3)' },
          { label: 'Đang sửa', val: totals.maintenance, labelColor: '#fbbf24', valColor: '#fbbf24',  border: 'rgba(251,191,36,0.3)' },
          { label: 'Hỏng',     val: totals.damaged,     labelColor: '#f87171', valColor: '#f87171',  border: 'rgba(248,113,113,0.3)' },
          { label: 'Mất',      val: totals.lost,        labelColor: '#a78bfa', valColor: '#a78bfa',  border: 'rgba(167,139,250,0.3)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-card)',
            border: `1px solid ${s.border}`,
            borderRadius: '12px',
            padding: '12px',
          }}>
            <p style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color: s.labelColor, opacity:0.85, margin:0, whiteSpace:'nowrap' }}>{s.label}</p>
            <p style={{ fontSize:'1.5rem', fontWeight:800, color: s.valColor, margin:'4px 0 0', lineHeight:1 }}>{s.val}</p>
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
