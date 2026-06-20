const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi server');
  return data;
}

export const api = {
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
  createOut: (data) => request('/transactions/out', { method: 'POST', body: data }),
  createReturn: (data) => request('/transactions/return', { method: 'POST', body: data }),
  createFix: (data) => request('/transactions/fix', { method: 'POST', body: data }),

  // Reports
  getSummary: () => request('/reports/summary'),
  getInventoryReport: () => request('/reports/inventory'),
};
