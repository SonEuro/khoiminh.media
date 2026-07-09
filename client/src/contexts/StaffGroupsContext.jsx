import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { KM_STAFF_GROUPS, FREELANCER_GROUPS } from '../constants/staff';

const StaffGroupsContext = createContext(null);

export function StaffGroupsProvider({ children }) {
  const [kmGroups,         setKmGroups]         = useState(KM_STAFF_GROUPS);
  const [freelancerGroups, setFreelancerGroups] = useState(FREELANCER_GROUPS);

  const refresh = useCallback(() => {
    api.getStaffGroups('km').then(setKmGroups).catch(() => {});
    api.getStaffGroups('freelancer').then(setFreelancerGroups).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <StaffGroupsContext.Provider value={{ kmGroups, freelancerGroups, refresh }}>
      {children}
    </StaffGroupsContext.Provider>
  );
}

export function useStaffGroups() {
  return useContext(StaffGroupsContext);
}
