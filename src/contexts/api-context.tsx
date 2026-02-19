import { createContext, useContext, type ReactNode } from 'react';
import axios from 'axios';
import type { AxiosInstance } from 'axios';

const ApiContext = createContext<{ api: AxiosInstance } | undefined>(undefined);

export function ApiProvider({ children }: { children: ReactNode }) {
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE ?? 'https://api.bedbase.org/v1',
  });

  return (
    <ApiContext.Provider value={{ api }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used within an ApiProvider');
  return ctx;
}
