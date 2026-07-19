import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { KM_STAFF_GROUPS, FREELANCER_GROUPS } from '../constants/staff';

const StaffGroupsContext = createContext(null);

export function StaffGroupsProvider({ children }) {
  const [kmGroupsRaw,      setKmGroupsRaw]      = useState(KM_STAFF_GROUPS);
  const [freelancerGroups, setFreelancerGroups] = useState(FREELANCER_GROUPS);
  const [vanPhongSet,      setVanPhongSet]      = useState(new Set());

  const refresh = useCallback(() => {
    if (!localStorage.getItem('km_token')) return;
    api.getStaffGroups('km').then(setKmGroupsRaw).catch(() => {});
    api.getStaffGroups('freelancer').then(setFreelancerGroups).catch(() => {});
    api.getStaffFlags().then(d => setVanPhongSet(new Set(d.vanPhong))).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const kmGroups = kmGroupsRaw
    .map(g => ({ ...g, members: g.members.filter(n => !vanPhongSet.has(n)) }))
    .filter(g => g.members.length > 0);

  return (
    <StaffGroupsContext.Provider value={{ kmGroups, freelancerGroups, refresh }}>
      {children}
    </StaffGroupsContext.Provider>
  );
}

export function useStaffGroups() {
  return useContext(StaffGroupsContext);
}
