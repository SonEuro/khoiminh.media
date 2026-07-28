const BASE = '/api';

function getToken() {
  return localStorage.getItem('km_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    cache: 'no-store',
    headers,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Lỗi server (${res.status})`);
  }

  if (res.status === 401) {
    // Auth endpoints return 401 for wrong credentials — show actual error, don't redirect
    if (path.startsWith('/auth/')) {
      throw new Error(data.error || 'Sai tên đăng nhập hoặc mật khẩu');
    }
    // All other 401s = session expired
    localStorage.removeItem('km_token');
    localStorage.removeItem('km_user');
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
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
  getDashboard: () => request('/dashboard'),

  getCategories: () => request('/categories'),

  // Equipment
  getEquipment: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/equipment${q ? '?' + q : ''}`);
  },
  getEquipmentTopUsed: (limit = 5) => request(`/equipment/top-used?limit=${limit}`),
  getEquipmentInUseEvents: () => request('/equipment/in-use-events'),
  getEquipmentReservedEvents: () => request('/equipment/reserved-events'),
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
  cancelEvent: (id) => request(`/events/${id}/cancel`, { method: 'POST' }),

  // Transactions
  getTransactions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/transactions${q ? '?' + q : ''}`);
  },
  getTransactionById: (id) => request(`/transactions/${id}`),
  getOutstanding: (event_id) => request(`/transactions/outstanding?event_id=${event_id}`),
  getOutstandingExt: (event_id) => request(`/transactions/outstanding-ext?event_id=${event_id}`),
  getPendingReturns: () => request('/transactions/pending-returns'),
  createOut: (data) => request('/transactions/out', { method: 'POST', body: data }),
  confirmPending: (id) => request(`/transactions/confirm/${id}`, { method: 'POST' }),
  createReturn: (data) => request('/transactions/return', { method: 'POST', body: data }),
  createTraNcc: (data) => request('/transactions/tra-ncc', { method: 'POST', body: data }),
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
  resetOutTransactions: () => request('/admin/reset-out-transactions', { method: 'POST' }),
  getOutTransactions: () => request('/admin/out-transactions'),
  resetOutTransactionsSelective: (tx_ids) => request('/admin/reset-out-transactions/selective', { method: 'POST', body: { tx_ids } }),
  clearAllEvents: () => request('/admin/clear-all-events', { method: 'POST' }),
  deleteEvents: (ids) => request('/admin/delete-events', { method: 'POST', body: { ids } }),
  debugObligations: () => request('/admin/debug-obligations'),
  resetDismissedObligations: () => request('/admin/reset-dismissed-obligations', { method: 'POST' }),
  getDismissedObligations: () => request('/admin/dismissed-obligations'),
  resetDismissedObligation: (id) => request(`/admin/reset-dismissed-obligation/${id}`, { method: 'POST' }),
  transferEquipment: (data) => request('/transactions/transfer', { method: 'POST', body: data }),
  deleteTransaction: (id, reason) => request(`/transactions/${id}`, { method: 'DELETE', body: reason ? { reason } : undefined }),
  getTransactionTrash: () => request('/transactions/trash'),
  permanentDeleteTransaction: (id) => request(`/transactions/trash/${id}`, { method: 'DELETE' }),
  updatePendingItems: (id, data) => request(`/transactions/${id}/items`, { method: 'PUT', body: data }),
  editCompletedItems: (id, data) => request(`/transactions/${id}/edit-completed`, { method: 'PUT', body: data }),

  // Event Reports
  getEventReports: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/event-reports${q ? '?' + q : ''}`);
  },
  getEventReport: (id) => request(`/event-reports/${id}`),
  createEventReport: (data) => request('/event-reports', { method: 'POST', body: data }),
  deleteEventReport: (id) => request(`/event-reports/${id}`, { method: 'DELETE' }),
  updateEventReport: (id, data) => request(`/event-reports/${id}`, { method: 'PUT', body: data }),
  confirmEventReport: (id) => request(`/event-reports/${id}/confirm`, { method: 'PATCH' }),
  getReportDeleteLog: () => request('/event-reports/admin/delete-log'),
  getXacNhanCong: (month) => request(`/xac-nhan-cong?month=${month}`),
  setReportHoliday: (id, is_holiday) => request(`/xac-nhan-cong/${id}/holiday`, { method: 'PATCH', body: { is_holiday } }),
  getTrashEvents: () => request('/events/trash'),
  restoreEvent: (id) => request(`/events/${id}/restore`, { method: 'POST' }),
  permanentDeleteEvent: (id) => request(`/events/${id}/permanent`, { method: 'DELETE' }),
  archiveEvent:          (id) => request(`/events/${id}/archive`,           { method: 'POST' }),
  unarchiveEvent:        (id) => request(`/events/${id}/unarchive`,         { method: 'POST' }),
  deleteArchivedEvent:   (id) => request(`/events/${id}/archive-permanent`, { method: 'DELETE' }),
  toggleEventExempt:     (id) => request(`/events/${id}/exempt`,            { method: 'POST' }),

  // Work Schedules (Lịch làm việc)
  getWorkSchedules: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/work-schedules${q ? '?' + q : ''}`);
  },
  getWorkScheduleById: (id) => request(`/work-schedules/${id}`),
  createWorkSchedule: (data) => request('/work-schedules', { method: 'POST', body: data }),
  updateWorkSchedule: (id, data) => request(`/work-schedules/${id}`, { method: 'PUT', body: data }),
  confirmWorkSchedule: (id) => request(`/work-schedules/${id}/confirm`, { method: 'POST' }),
  deleteWorkSchedule: (id) => request(`/work-schedules/${id}`, { method: 'DELETE' }),
  getWorkScheduleHistory: (id) => request(`/work-schedules/${id}/history`),
  getTrashWorkSchedules: () => request('/work-schedules/trash'),
  restoreWorkSchedule: (id) => request(`/work-schedules/${id}/restore`, { method: 'POST' }),
  permanentDeleteWorkSchedule: (id) => request(`/work-schedules/${id}/permanent`, { method: 'DELETE' }),

  // Lead obligations (nghĩa vụ báo cáo của nhóm trưởng)
  getLeadObligations: () => request('/lead-obligations'),
  dismissLeadObligation: (id) => request(`/lead-obligations/${id}`, { method: 'DELETE' }),

  // Staff groups (danh sách nhân sự theo bộ phận)
  getStaffGroups: (type) => request(`/staff-groups?type=${type}`),
  updateStaffGroups: (type, groups) => request(`/staff-groups/${type}`, { method: 'PUT', body: groups }),
  getStaffFlags: () => request('/staff-flags'),
  toggleStaffFlag: (name, vanPhong) => request('/staff-flags/toggle', { method: 'POST', body: { name, vanPhong } }),

  // Vận Hành Kế Toán
  getKeToanKhoiMinh: () => request('/van-hanh-ke-toan/khoi-minh'),
  getKeToanNcc: () => request('/van-hanh-ke-toan/ncc'),

  // NCC catalog
  getNccCatalog: () => request('/ncc/catalog'),
  getNccSuppliers: () => request('/ncc'),
  getNccSupplier: (id) => request(`/ncc/${id}`),
  createNccSupplier: (data) => request('/ncc', { method: 'POST', body: data }),
  updateNccSupplier: (id, data) => request(`/ncc/${id}`, { method: 'PUT', body: data }),
  deleteNccSupplier: (id) => request(`/ncc/${id}`, { method: 'DELETE' }),
  createNccEquipment: (supplierId, data) => request(`/ncc/${supplierId}/equipment`, { method: 'POST', body: data }),
  updateNccEquipment: (id, data) => request(`/ncc/equipment/${id}`, { method: 'PUT', body: data }),
  deleteNccEquipment: (id) => request(`/ncc/equipment/${id}`, { method: 'DELETE' }),
};
