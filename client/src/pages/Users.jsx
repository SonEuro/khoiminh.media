import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';

const ROLES = [
  { value: 'SUPER_ADMIN', label: '👑 Giám Đốc Sản Xuất' },
  { value: 'PRODUCTION',  label: '🏗️ Bộ Phận Sản Xuất' },
  { value: 'ACCOUNTING',  label: '💰 Kế Toán' },
  { value: 'TECHNICAL',   label: '🛠️ Kỹ Thuật' },
  { value: 'ATAS',        label: '💡 ATAS – LED' },
  { value: 'STAGE',       label: '🎭 Sân Khấu' },
  { value: 'CSVC',        label: '🏢 Cơ Sở Vật Chất' },
];

const EMPTY = { username: '', password: '', full_name: '', role: 'ATAS', is_active: true };

export default function Users() {
  const { ROLE_LABELS } = useAuth();
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null); // null | 'create' | 'edit'
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await api.getUsers();
    setUsers(data);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(EMPTY);
    setEditId(null);
    setError('');
    setModal('edit');
  }

  function openEdit(u) {
    setForm({ username: u.username, password: '', full_name: u.full_name, role: u.role, is_active: !!u.is_active });
    setEditId(u.id);
    setError('');
    setModal('edit');
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      if (editId) {
        await api.updateUser(editId, form);
      } else {
        if (!form.password) { setError('Mật khẩu là bắt buộc'); setSaving(false); return; }
        await api.createUser(form);
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u) {
    if (!confirm(`Xóa tài khoản "${u.full_name}" (${u.username})?`)) return;
    try {
      await api.deleteUser(u.id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  const roleBadge = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-700',
    PRODUCTION:  'bg-blue-100 text-blue-700',
    ACCOUNTING:  'bg-yellow-100 text-yellow-700',
    TECHNICAL:   'bg-orange-100 text-orange-700',
    ATAS:        'bg-green-100 text-green-700',
    STAGE:       'bg-pink-100 text-pink-700',
    CSVC:        'bg-gray-100 text-gray-700',
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản Lý Người Dùng</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} tài khoản</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Thêm Người Dùng
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Họ Tên</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Tên Đăng Nhập</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Vai Trò</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Trạng Thái</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Ngày Tạo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                <td className="px-4 py-3 text-gray-600 font-mono">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleBadge[u.role] || 'bg-gray-100'}`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.is_active
                    ? <span className="text-green-600 font-medium">Hoạt động</span>
                    : <span className="text-red-500">Vô hiệu</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">{u.created_at?.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(u)} className="text-blue-600 hover:underline text-xs">Sửa</button>
                    <button onClick={() => handleDelete(u)} className="text-red-500 hover:underline text-xs">Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Chưa có người dùng nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal === 'edit' && (
        <Modal title={editId ? 'Chỉnh Sửa Người Dùng' : 'Thêm Người Dùng'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên *</label>
              <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nguyễn Văn A" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập *</label>
              <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="username" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mật khẩu {editId ? '(bỏ trống = giữ nguyên)' : '*'}
              </label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò *</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {editId && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <span>Tài khoản hoạt động</span>
              </label>
            )}
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2 rounded-lg text-sm font-medium">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
              <button onClick={() => setModal(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">
                Hủy
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
