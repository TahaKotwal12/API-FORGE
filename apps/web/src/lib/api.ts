/**
 * Thin fetch wrapper for APIForge backend.
 * Phase 1: auth endpoints only. Auto-generated SDK comes in Phase 4.
 */

const BASE = '/api/v1';

interface ApiError {
  type: string;
  title: string;
  status: number;
  detail?: string;
  violations?: Array<{ field: string; code: string; message: string }>;
}

class ApiClientError extends Error {
  constructor(
    public readonly problem: ApiError,
    public readonly status: number,
  ) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const problem: ApiError = await res.json().catch(() => ({
      type: 'https://forge.dev/errors/unknown',
      title: 'Unknown error',
      status: res.status,
    }));
    throw new ApiClientError(problem, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export const authApi = {
  register: (data: { email: string; name: string; password: string }) =>
    request<UserProfile>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<AuthTokens>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: (refreshToken: string) =>
    request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  refresh: (refreshToken: string) =>
    request<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  me: () => request<UserProfile>('/auth/me'),

  verifyEmail: (token: string) => request<{ message: string }>(`/auth/verify-email?token=${token}`),

  requestPasswordReset: (email: string) =>
    request<{ message: string }>('/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  confirmPasswordReset: (token: string, password: string) =>
    request<{ message: string }>('/auth/password/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
};

// ─── Orgs ────────────────────────────────────────────────────────────────────

export interface Org {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
  role?: string;
}

export const orgsApi = {
  list: () => request<Org[]>('/orgs'),

  create: (data: { name: string }) =>
    request<Org>('/orgs', { method: 'POST', body: JSON.stringify(data) }),

  getBySlug: async (slug: string) => {
    const orgs = await request<Org[]>('/orgs');
    const org = orgs.find((o) => o.slug === slug);
    if (!org) throw new ApiClientError({ type: 'not-found', title: 'Org not found', status: 404 }, 404);
    return org;
  },

  getMembers: (orgId: string) =>
    request<Array<{ id: string; role: string; user: UserProfile }>>(`/orgs/${orgId}/members`),

  invite: (orgId: string, data: { email: string; role: string }) =>
    request(`/orgs/${orgId}/members/invite`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Projects ────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
}

export const projectsApi = {
  listByOrg: (orgId: string) => request<Project[]>(`/orgs/${orgId}/projects`),

  create: (orgId: string, data: { name: string; description?: string; visibility?: string }) =>
    request<Project>(`/orgs/${orgId}/projects`, { method: 'POST', body: JSON.stringify(data) }),

  getById: (orgId: string, projectId: string) =>
    request<Project>(`/orgs/${orgId}/projects/${projectId}`),
};

// ─── Invites ─────────────────────────────────────────────────────────────────

export const invitesApi = {
  getByToken: (token: string) =>
    request<{ token: string; email: string; role: string; org: { name: string; slug: string } }>(
      `/invites/${token}`,
    ),

  accept: (token: string) =>
    request<{ orgId: string; role: string }>(`/invites/${token}/accept`, { method: 'POST' }),
};

export { ApiClientError };
