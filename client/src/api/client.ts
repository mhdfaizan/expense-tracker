import type { Expense, AuthStatus } from '../types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  getAuthUrl: () => request<{ url: string }>('/auth/url'),

  getAuthStatus: () => request<AuthStatus>('/auth/status'),

  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  getExpenses: (date?: string) => {
    const params = date ? `?date=${date}` : '';
    return request<Expense[]>(`/expenses${params}`);
  },

  addExpense: (data: { item: string; cost: number; category: string; date?: string }) =>
    request<Expense>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteExpense: (id: string) =>
    request<{ success: boolean }>(`/expenses/${id}`, { method: 'DELETE' }),

  getCategories: () => request<string[]>('/categories'),

  addCategory: (name: string) =>
    request<{ name: string }>('/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  deleteCategory: (name: string) =>
    request<{ success: boolean }>(`/categories/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};
