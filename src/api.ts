import type {
  AppNotification,
  AuthResponse,
  CommunityEvent,
  DiscoveryCard,
  LearningPlan,
  MessageThread,
  Messages,
  PublicOverview,
  Session,
  User,
} from './types';

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PRODUCTION_API_BASE = 'https://skills-swap-kappa.vercel.app/api';
const configuredApiBase =
  process.env.EXPO_PUBLIC_API_BASE ||
  Constants.expoConfig?.extra?.apiBase ||
  '';
const isWeb = Platform.OS === 'web';
const API_BASE = isWeb ? '/api' : configuredApiBase || PRODUCTION_API_BASE;
let authToken = '';

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
  bookSession: (cardId: string, time: string) =>
    request<Session>('/sessions/book', {
      method: 'POST',
      body: JSON.stringify({ cardId, time }),
    }),
  updateSessionStatus: (id: string, status: Session['status']) =>
    request<Session>(`/sessions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  events: () => request<CommunityEvent[]>('/events'),
  joinEvent: (id: string) =>
    request<CommunityEvent>(`/events/${id}/join`, { method: 'POST' }),
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
};
