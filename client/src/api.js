const BASE = '/api';

function getToken() {
  return localStorage.getItem('km_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json();

  if (res.status === 401) {
    // Auth endpoints return 401 for wrong credentials — show actual error, don't redirect
    if (path.startsWith('/auth/')) {
      throw new Error(data.error || 'Sai tên đăng nhập hoặc mật khẩu');
    }
    // All other 401s = session expired
    localStorage.removeItem('km_token');
    localStorage.removeItem('km_user');
    window.location.href = '/login';
    throw new Error('Phiên đăng nhập hết hạn');
  }

  if (!res.ok) throw new Error(data.error || 'Lỗi server');
  return data;
}

export const api = {
  // Auth
  login: (data) => request('/auth/login', { method: 'POST', body: data }),
  getMe: () => request('/auth/me'),
  changePassword: (data) => request('/auth/change-password', { method: 'POST', body: data }),

  // Users (SUPER_ADMIN only)
  getUsers: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: data }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: data }),
  resetUserPassword: (id) => request(`/users/${id}/reset-password`, { method: 'POST' }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  // Categories
  getCategories: () => request('/categories'),

  // Equipment
  getEquipment: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/equipment${q ? '?' + q : ''}`);
  },
  getEquipmentById: (id) => request(`/equipment/${id}`),
  getEquipmentHistory: (id) => request(`/equipment/${id}/history`),
  getEquipmentQR: (id) => request(`/equipment/${id}/qr`),
  createEquipment: (data) => request('/equipment', { method: 'POST', body: data }),
  updateEquipment: (id, data) => request(`/equipment/${id}`, { method: 'PUT', body: data }),
  deleteEquipment: (id) => request(`/equipment/${id}`, { method: 'DELETE' }),

  // Events
  getEvents: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/events${q ? '?' + q : ''}`);
  },
  getEventById: (id) => request(`/events/${id}`),
  createEvent: (data) => request('/events', { method: 'POST', body: data }),
  updateEvent: (id, data) => request(`/events/${id}`, { method: 'PUT', body: data }),
  deleteEvent: (id) => request(`/events/${id}`, { method: 'DELETE' }),

  // Transactions
  getTransactions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/transactions${q ? '?' + q : ''}`);
  },
  getTransactionById: (id) => request(`/transactions/${id}`),
  getOutstanding: (event_id) => request(`/transactions/outstanding?event_id=${event_id}`),
  createOut: (data) => request('/transactions/out', { method: 'POST', body: data }),
  createReturn: (data) => request('/transactions/return', { method: 'POST', body: data }),
  createFix: (data) => request('/transactions/fix', { method: 'POST', body: data }),
  createIntake: (data) => request('/transactions/intake', { method: 'POST', body: data }),

  // Reports
  getSummary: () => request('/reports/summary'),
  getInventoryReport: () => request('/reports/inventory'),

  // Violations
  getViolations: () => request('/violations'),
  createViolation: (data) => request('/violations', { method: 'POST', body: data }),
  deleteViolation: (id) => request(`/violations/${id}`, { method: 'DELETE' }),
  importEquipment: () => request('/admin/import-equipment', { method: 'POST' }),

  // Event Reports
  getEventReports: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/event-reports${q ? '?' + q : ''}`);
  },
  createEventReport: (data) => request('/event-reports', { method: 'POST', body: data }),
  deleteEventReport: (id) => request(`/event-reports/${id}`, { method: 'DELETE' }),
  getTrashEvents: () => request('/events/trash'),
  restoreEvent: (id) => request(`/events/${id}/restore`, { method: 'POST' }),
  permanentDeleteEvent: (id) => request(`/events/${id}/permanent`, { method: 'DELETE' }),
};
