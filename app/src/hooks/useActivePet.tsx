import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRepoData } from './useRepoData';
import { notifyDataChanged } from '../db/notify';
import type { Pet } from '../db/types';

const KEY_ACTIVE_PET = 'pawly.activePet';

interface ActivePetContextValue {
  pets: Pet[];
  activePet: Pet | null;
  setActivePetId: (id: string) => void;
  loading: boolean;
}

const ActivePetContext = createContext<ActivePetContextValue>({
  pets: [],
  activePet: null,
  setActivePetId: () => {},
  loading: true,
});

export function ActivePetProvider({ children }: { children: ReactNode }) {
  const { data: pets } = useRepoData((r) => r.allPets());
  const [activeId, setActiveId] = useState<string | null>(null);

  // Default to the first pet until the user picks one; the choice persists.
  // Any change here must notify the data hooks: their selectors depend on
  // the active pet id, and they only loaded with petId === null on mount.
  useEffect(() => {
    if (!pets || pets.length === 0) {
      setActiveId(null);
      return;
    }
    void AsyncStorage.getItem(KEY_ACTIVE_PET).then((stored) => {
      const stillExists = pets.some((p) => p.id === stored);
      const next = stored && stillExists ? stored : pets[0].id;
      setActiveId(next);
      notifyDataChanged();
    });
  }, [pets]);

  const setActivePetId = useCallback((id: string) => {
    setActiveId(id);
    void AsyncStorage.setItem(KEY_ACTIVE_PET, id);
    notifyDataChanged();
  }, []);

  const value = useMemo<ActivePetContextValue>(
    () => ({
      pets: pets ?? [],
      activePet: pets?.find((p) => p.id === activeId) ?? null,
      setActivePetId,
      loading: pets === null,
    }),
    [pets, activeId, setActivePetId]
  );

  return <ActivePetContext.Provider value={value}>{children}</ActivePetContext.Provider>;
}

export function useActivePet(): ActivePetContextValue {
  return useContext(ActivePetContext);
}
