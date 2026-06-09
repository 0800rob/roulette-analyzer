import axios from 'axios';

// Backend base URL — read from Vite env var so production builds (Vercel)
// can point to the deployed Fly.io URL while dev keeps using localhost.
// Define VITE_API_URL in a `.env.local` (dev) or in the Vercel project
// settings (prod). Fallback is the local backend.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Auth: token persisted in localStorage and attached to every request
const TOKEN_KEY = 'roulette_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// When the backend says "401 unauthorized" or "402 license expired", we want
// the app to react accordingly. We dispatch a custom event so App.tsx can
// listen and refresh the user state.
api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    if (err?.response?.status === 401) {
      setToken(null);
      window.dispatchEvent(new CustomEvent('auth-required'));
    } else if (err?.response?.status === 402) {
      window.dispatchEvent(new CustomEvent('license-expired'));
    }
    return Promise.reject(err);
  },
);

// Auth API
export interface AuthUser {
  id: number;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  expires_at: string | null;
  created_at: string;
}

export const authRegister = (email: string, password: string) =>
  api.post<{ access_token: string; token_type: string }>('/auth/register', { email, password });

export const authLogin = (email: string, password: string) =>
  api.post<{ access_token: string; token_type: string }>('/auth/login', { email, password });

export const authMe = () => api.get<AuthUser>('/auth/me');

// Admin API
export interface AdminUser {
  id: number;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  expires_at: string | null;
  created_at: string;
  session_count: number;
}

export const adminListUsers = () => api.get<AdminUser[]>('/admin/users');
export const adminGrantDays = (userId: number, days: number) =>
  api.post<AdminUser>(`/admin/users/${userId}/grant`, { days });
export const adminSetActive = (userId: number, isActive: boolean) =>
  api.post<AdminUser>(`/admin/users/${userId}/active?is_active=${isActive}`);

export interface Session {
  id: number;
  name: string;
  casino: string | null;
  created_at: string;
  spin_count: number;
  live_table?: string | null;
}

export interface Spin {
  id: number;
  session_id: number;
  number: number;
  color: string;
  created_at: string;
}

export interface NumberFrequency {
  number: number;
  color: string;
  count: number;
  percentage: number;
}

export interface SessionStats {
  total_spins: number;
  frequencies: NumberFrequency[];
  colors: { red: number; black: number; green: number; red_pct: number; black_pct: number; green_pct: number };
  parity: { even: number; odd: number; zero: number; even_pct: number; odd_pct: number };
  dozens: { first: number; second: number; third: number; zero: number };
  hot_cold: { hot: NumberFrequency[]; cold: NumberFrequency[] };
  last_10: Spin[];
  longest_streak: { type: string; value: string; length: number };
}

// Sessions
export const getSessions = () => api.get<Session[]>('/sessions');
export const createSession = (name: string, casino?: string) =>
  api.post<Session>('/sessions', { name, casino });
export const deleteSession = (id: number) => api.delete(`/sessions/${id}`);

// Spins
export const getSpins = (sessionId: number) =>
  api.get<Spin[]>(`/sessions/${sessionId}/spins`);
export const addSpin = (sessionId: number, number: number) =>
  api.post<Spin>(`/sessions/${sessionId}/spins`, { number });
export const undoLastSpin = (sessionId: number) =>
  api.delete(`/sessions/${sessionId}/spins/last`);

// Stats
export const getStats = (sessionId: number) =>
  api.get<SessionStats>(`/sessions/${sessionId}/stats`);

// Predictions
export interface Prediction {
  number: number;
  color: string;
  confidence_score: number;
  reasons: string[];
}

export interface PredictionResponse {
  predictions: Prediction[];
  analysis_window: number;
  min_spins_required: number;
  total_spins: number;
}

export const getPredictions = (sessionId: number) =>
  api.get<PredictionResponse>(`/sessions/${sessionId}/predictions`);


// Group Strategy
export interface GroupStrategyResponse {
  triggered: boolean;
  group?: number | null;
  group_label?: string | null;
  triple: number[];
  digital_roots: number[];
  sum?: number | null;
  hit_numbers: number[];
  neighbours: Record<string, number[]>;
  all_marked: number[];
  window: number;
}

export const getGroupStrategy = (
  sessionId: number,
  window = 7,
  neighbours = 1,
) =>
  api.get<GroupStrategyResponse>(
    `/sessions/${sessionId}/group-strategy?window=${window}&neighbours=${neighbours}`,
  );


// Live tables / scraper integration
export interface LiveTableInfo {
  key: string;
  label: string;
}

export const listLiveTables = () =>
  api.get<LiveTableInfo[]>('/live/tables');

export const setSessionLive = (sessionId: number, table: string | null) =>
  api.post<Session>(`/sessions/${sessionId}/live`, { table });

// Strategy alerts (history of triggers)
export interface StrategyAlert {
  id: number;
  strategy: 'str1';
  created_at: string;
  spin_id: number | null;
  spin_number: number | null;
  payload: Record<string, unknown>;
}

export const listAlerts = (sessionId: number, limit = 50) =>
  api.get<StrategyAlert[]>(`/sessions/${sessionId}/alerts?limit=${limit}`);


// Chase tracker (1 active trigger per strategy)
export type ChaseState = 'idle' | 'active' | 'resolved';

export interface ChaseStatus {
  strategy: 'str1';
  status: ChaseState;
  started_at: string | null;
  resolved_at: string | null;
  spins_followed: number;
  started_spin_number: number | null;
  resolved_spin_number: number | null;
  marked_numbers: number[];
  hit_numbers: number[];
  snapshot: Record<string, unknown>;
}

export interface ChaseStatusResponse {
  str1: ChaseStatus;
}

export const getChaseStatus = (sessionId: number) =>
  api.get<ChaseStatusResponse>(`/sessions/${sessionId}/chase`);


// Chase history (resolved triggers log)
export interface ChaseHistoryItem {
  id: number;
  strategy: 'str1';
  status: 'active' | 'resolved';
  started_at: string | null;
  resolved_at: string | null;
  spins_followed: number;
  started_spin_number: number | null;
  resolved_spin_number: number | null;
  marked_numbers: number[];
  hit_numbers: number[];
}

export interface ChaseHistoryResponse {
  items: ChaseHistoryItem[];
  summary: Record<string, { greens: number; avg_spins_to_green: number }>;
}

export const getChaseHistory = (sessionId: number, limit = 30) =>
  api.get<ChaseHistoryResponse>(`/sessions/${sessionId}/chase/history?limit=${limit}`);
