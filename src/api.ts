import type {
  AdminDashboard,
  AppNotification,
  AuthResponse,
  CommunityEvent,
  DiscoveryCard,
  LearningPlan,
  MessageThread,
  Messages,
  PortfolioAsset,
  PublicOverview,
  RoomDiscussionMessage,
  Session,
  User,
} from './types';

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PRODUCTION_API_BASE = 'https://skills-swap-kappa.vercel.app/api';
const constantsWithHost = Constants as typeof Constants & {
  expoConfig?: {
    hostUri?: string;
    extra?: {
      apiBase?: string;
    };
  };
  expoGoConfig?: {
    debuggerHost?: string;
    hostUri?: string;
  };
  manifest?: {
    debuggerHost?: string;
  };
  manifest2?: {
    extra?: {
      expoClient?: {
        hostUri?: string;
      };
    };
  };
};
const configuredApiBase =
  process.env.EXPO_PUBLIC_API_BASE ||
  Constants.expoConfig?.extra?.apiBase ||
  '';
const runtimeLocation =
  typeof window !== 'undefined' && window?.location ? window.location : null;
const runtimeHost =
  runtimeLocation?.hostname || '';
const devHostCandidate =
  constantsWithHost.expoConfig?.hostUri ||
  constantsWithHost.expoGoConfig?.hostUri ||
  constantsWithHost.expoGoConfig?.debuggerHost ||
  constantsWithHost.manifest?.debuggerHost ||
  constantsWithHost.manifest2?.extra?.expoClient?.hostUri ||
  '';
const devHost = devHostCandidate.split(':')[0];
const localApiBase =
  runtimeHost === '127.0.0.1' || runtimeHost === 'localhost'
    ? 'http://localhost:4000/api'
    : '';
const shouldPreferDevBackend =
  Platform.OS !== 'web' &&
  Boolean(devHost) &&
  (!configuredApiBase || configuredApiBase === PRODUCTION_API_BASE);
const devApiBase = shouldPreferDevBackend ? `http://${devHost}:4000/api` : '';
const API_BASE = localApiBase || devApiBase || configuredApiBase || PRODUCTION_API_BASE;
let authToken = '';

export const getApiBase = () => API_BASE;

export const setAuthToken = (token: string) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) {
        message = data.error;
      }
    } catch {
      // Keep the default message when the response body is not JSON.
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ ok: boolean }>('/health'),
  publicOverview: () => request<PublicOverview>('/public-overview'),
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: User }>('/auth/me'),
  profile: () => request<User>('/profile'),
  saveProfile: (payload: Partial<User>) =>
    request<User>('/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  categories: () => request<string[]>('/categories'),
  discovery: (query: string, category: string, persona: string) =>
    request<DiscoveryCard[]>(
      `/discovery?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&persona=${encodeURIComponent(persona)}`
    ),
  toggleConnect: (id: string) =>
    request<DiscoveryCard>(`/discovery/${id}/connect`, { method: 'POST' }),
  toggleFavorite: (id: string) =>
    request<DiscoveryCard>(`/discovery/${id}/favorite`, { method: 'POST' }),
  sessions: () => request<Session[]>('/sessions'),
  bookSession: (
    cardId: string,
    time: string,
    details?: {
      format?: Session['format'];
      goal?: string;
      note?: string;
    }
  ) =>
    request<Session>('/sessions/book', {
      method: 'POST',
      body: JSON.stringify({ cardId, time, ...details }),
    }),
  updateSession: (
    id: string,
    payload: Partial<
      Pick<Session, 'status' | 'time' | 'format' | 'goal' | 'note' | 'reminderSet'>
    >
  ) =>
    request<Session>(`/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  updateSessionStatus: (id: string, status: Session['status']) =>
    request<Session>(`/sessions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  events: () => request<CommunityEvent[]>('/events'),
  joinEvent: (id: string) =>
    request<CommunityEvent>(`/events/${id}/join`, { method: 'POST' }),
  toggleEventReminder: (id: string) =>
    request<CommunityEvent>(`/events/${id}/reminder`, { method: 'POST' }),
  learningPlan: () => request<LearningPlan>('/learning-plan'),
  saveLearningPlan: (payload: Partial<LearningPlan>) =>
    request<LearningPlan>('/learning-plan', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  messages: () => request<Messages>('/messages'),
  markMessagesRead: () =>
    request<Messages>('/messages/read', { method: 'POST' }),
  notifications: () => request<AppNotification[]>('/notifications'),
  markNotificationsRead: () =>
    request<AppNotification[]>('/notifications/read', { method: 'POST' }),
  messageThreads: () => request<MessageThread[]>('/messages/threads'),
  replyThread: (id: string, message: string) =>
    request<MessageThread>(`/messages/threads/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  adminDashboard: () => request<AdminDashboard>('/admin/dashboard'),
  featureMentor: (id: string, featured: boolean) =>
    request<DiscoveryCard>(`/admin/mentors/${id}/feature`, {
      method: 'POST',
      body: JSON.stringify({ featured }),
    }),
  resolveReport: (id: string) =>
    request<AdminDashboard>(`/admin/reports/${id}/resolve`, {
      method: 'POST',
    }),
  updateAdminEvent: (
    id: string,
    payload: {
      recap?: string;
    }
  ) =>
    request<CommunityEvent>(`/admin/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  portfolioAssets: () => request<PortfolioAsset[]>('/portfolio/assets'),
  addPortfolioAsset: (payload: Pick<PortfolioAsset, 'title' | 'url' | 'kind'>) =>
    request<PortfolioAsset>('/portfolio/assets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  removePortfolioAsset: (id: string) =>
    request<{ ok: boolean }>(`/portfolio/assets/${id}`, {
      method: 'DELETE',
    }),
  eventDiscussion: (id: string) =>
    request<RoomDiscussionMessage[]>(`/events/${id}/discussion`),
  postEventDiscussion: (id: string, message: string) =>
    request<RoomDiscussionMessage>(`/events/${id}/discussion`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};
