import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const DEPT_CATS = {
  SUPER_ADMIN: null,
  PRODUCTION:  null,
  ACCOUNTING:  null,
  TECHNICAL:   ['TECH'],
  ATAS:        ['AUDIO', 'LIGHT', 'LED', 'MATRIX'],
  STAGE:       ['STAGE'],
  CSVC:        null,
};

const ROLE_LABELS = {
  SUPER_ADMIN: 'Giám Đốc Sản Xuất',
  PRODUCTION:  'Bộ Phận Sản Xuất',
  ACCOUNTING:  'Kế Toán',
  TECHNICAL:   'Kỹ Thuật',
  ATAS:        'ATAS – LED',
  STAGE:       'Sân Khấu',
  CSVC:        'Cơ Sở Vật Chất',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('km_user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('km_token'));

  function login(tokenVal, userData) {
    localStorage.setItem('km_token', tokenVal);
    localStorage.setItem('km_user', JSON.stringify(userData));
    setToken(tokenVal);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('km_token');
    localStorage.removeItem('km_user');
    setToken(null);
    setUser(null);
  }

  // Check permissions
  function can(action) {
    if (!user) return false;
    const role = user.role;
    switch (action) {
      case 'manageUsers':    return role === 'SUPER_ADMIN';
      case 'editEquipment':  return ['SUPER_ADMIN', 'PRODUCTION'].includes(role);
      case 'deleteEquipment':return role === 'SUPER_ADMIN';
      case 'transact':       return ['SUPER_ADMIN', 'TECHNICAL', 'ATAS', 'STAGE', 'CSVC'].includes(role);
      case 'createEvent':    return role !== 'ACCOUNTING';
      case 'deleteEvent':    return role === 'SUPER_ADMIN';
      case 'exportReport':   return ['SUPER_ADMIN', 'ACCOUNTING'].includes(role);
      default: return true;
    }
  }

  function canTransactCat(catCode) {
    if (!user) return false;
    const cats = DEPT_CATS[user.role];
    if (!cats) return true;
    return cats.includes(catCode);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, can, canTransactCat, ROLE_LABELS }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
