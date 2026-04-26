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

  getBySlug: async (orgId: string, projectSlug: string): Promise<Project> => {
    const projects = await request<Project[]>(`/orgs/${orgId}/projects`);
    const project = projects.find((p) => p.slug === projectSlug);
    if (!project) throw new ApiClientError({ type: 'not-found', title: 'Project not found', status: 404 }, 404);
    return project;
  },
};

// ─── Endpoints ───────────────────────────────────────────────────────────────

export interface Endpoint {
  id: string;
  branchId: string;
  method: string;
  path: string;
  summary: string | null;
  description: string | null;
  tags: string[];
  parameters: unknown[];
  requestBody: unknown | null;
  responses: Record<string, unknown>;
  security: unknown[] | null;
  deprecated: boolean;
  extensions: Record<string, unknown>;
  order: number;
  updatedAt: string;
}

export const endpointsApi = {
  list: (projectId: string, branch = 'main') =>
    request<Endpoint[]>(`/projects/${projectId}/branches/${branch}/endpoints`),

  get: (projectId: string, branch: string, endpointId: string) =>
    request<Endpoint>(`/projects/${projectId}/branches/${branch}/endpoints/${endpointId}`),

  create: (
    projectId: string,
    branch: string,
    data: {
      method: string;
      path: string;
      summary?: string;
      description?: string;
      tags?: string[];
      parameters?: unknown[];
      requestBody?: unknown;
      responses?: Record<string, unknown>;
      security?: unknown[];
      deprecated?: boolean;
    },
  ) =>
    request<Endpoint>(`/projects/${projectId}/branches/${branch}/endpoints`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (projectId: string, branch: string, endpointId: string, data: Partial<Endpoint>) =>
    request<Endpoint>(`/projects/${projectId}/branches/${branch}/endpoints/${endpointId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (projectId: string, branch: string, endpointId: string) =>
    request<void>(`/projects/${projectId}/branches/${branch}/endpoints/${endpointId}`, {
      method: 'DELETE',
    }),
};

// ─── Schemas ─────────────────────────────────────────────────────────────────

export interface SchemaComponent {
  id: string;
  branchId: string;
  name: string;
  schema: Record<string, unknown>;
}

export const schemasApi = {
  list: (projectId: string, branch = 'main') =>
    request<SchemaComponent[]>(`/projects/${projectId}/branches/${branch}/schemas`),

  get: (projectId: string, branch: string, schemaId: string) =>
    request<SchemaComponent>(`/projects/${projectId}/branches/${branch}/schemas/${schemaId}`),

  create: (projectId: string, branch: string, data: { name: string; schema: Record<string, unknown> }) =>
    request<SchemaComponent>(`/projects/${projectId}/branches/${branch}/schemas`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (projectId: string, branch: string, schemaId: string, data: { name?: string; schema?: Record<string, unknown> }) =>
    request<SchemaComponent>(`/projects/${projectId}/branches/${branch}/schemas/${schemaId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (projectId: string, branch: string, schemaId: string) =>
    request<void>(`/projects/${projectId}/branches/${branch}/schemas/${schemaId}`, {
      method: 'DELETE',
    }),
};

// ─── Spec ─────────────────────────────────────────────────────────────────────

export const specApi = {
  compose: (projectId: string, branch = 'main') =>
    request<Record<string, unknown>>(`/projects/${projectId}/branches/${branch}/spec`),

  importSpec: (projectId: string, branch: string, data: { url?: string; content?: string }) =>
    request<{ imported: number; schemas: number; securitySchemes: number }>(
      `/projects/${projectId}/branches/${branch}/spec/import`,
      { method: 'POST', body: JSON.stringify(data) },
    ),

  exportUrl: (projectId: string, branch: string, format: 'json' | 'yaml' = 'yaml') =>
    `/api/v1/projects/${projectId}/branches/${branch}/spec/export?format=${format}`,
};

// ─── Linter ───────────────────────────────────────────────────────────────────

export interface LintIssue {
  code: string;
  message: string;
  severity: 'error' | 'warn' | 'info' | 'hint';
  path: string[];
}

export interface LintResult {
  issues: LintIssue[];
  errorCount: number;
  warnCount: number;
  passed: boolean;
}

export const linterApi = {
  lintBranch: (projectId: string, branch: string, ruleset?: 'recommended' | 'strict') =>
    request<LintResult>(`/projects/${projectId}/branches/${branch}/lint`, {
      method: 'POST',
      body: JSON.stringify({ ruleset }),
    }),

  lintEndpoint: (projectId: string, branch: string, endpointId: string, ruleset?: 'recommended' | 'strict') =>
    request<LintResult>(`/projects/${projectId}/branches/${branch}/endpoints/${endpointId}/lint`, {
      method: 'POST',
      body: JSON.stringify({ ruleset }),
    }),
};

// ─── Environments ─────────────────────────────────────────────────────────────

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  variables: Record<string, string>;
  isDefault: boolean;
}

export const environmentsApi = {
  list: (projectId: string) => request<Environment[]>(`/projects/${projectId}/environments`),

  create: (projectId: string, data: { name: string; variables?: Record<string, string>; isDefault?: boolean }) =>
    request<Environment>(`/projects/${projectId}/environments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (projectId: string, envId: string, data: Partial<Environment>) =>
    request<Environment>(`/projects/${projectId}/environments/${envId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (projectId: string, envId: string) =>
    request<void>(`/projects/${projectId}/environments/${envId}`, { method: 'DELETE' }),
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

// ─── Branches ────────────────────────────────────────────────────────────────

export interface Branch {
  id: string;
  projectId: string;
  name: string;
  protected: boolean;
  parentId: string | null;
  headCommitId: string | null;
  createdBy: string;
  createdAt: string;
  _count?: { commits: number };
}

export const branchesApi = {
  list: (projectId: string) => request<Branch[]>(`/projects/${projectId}/branches`),

  create: (projectId: string, data: { name: string; fromBranch?: string }) =>
    request<Branch>(`/projects/${projectId}/branches`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (projectId: string, branchName: string) =>
    request<Branch>(`/projects/${projectId}/branches/${branchName}`),

  delete: (projectId: string, branchName: string) =>
    request<void>(`/projects/${projectId}/branches/${branchName}`, { method: 'DELETE' }),

  protect: (projectId: string, branchName: string, protect: boolean) =>
    request<Branch>(`/projects/${projectId}/branches/${branchName}/protect`, {
      method: 'PUT',
      body: JSON.stringify({ protect }),
    }),
};

// ─── Commits ─────────────────────────────────────────────────────────────────

export interface Commit {
  id: string;
  branchId: string;
  parentId: string | null;
  message: string;
  authorId: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null; email: string };
  specSnapshot: { id: string; sha256: string; size: number; format?: string } | null;
}

export interface SpecDiff {
  from: string;
  to: string;
  changes: Array<{
    type: string;
    path: string;
    before?: unknown;
    after?: unknown;
  }>;
}

export const commitsApi = {
  list: (projectId: string, branch: string, limit?: number) =>
    request<Commit[]>(`/projects/${projectId}/branches/${branch}/commits${limit ? `?limit=${limit}` : ''}`),

  create: (projectId: string, branch: string, message: string) =>
    request<Commit>(`/projects/${projectId}/branches/${branch}/commits`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  diff: (projectId: string, branch: string, from: string, to: string) =>
    request<SpecDiff>(`/projects/${projectId}/branches/${branch}/commits/diff?from=${from}&to=${to}`),
};

// ─── Merge Requests ──────────────────────────────────────────────────────────

export interface MergeRequest {
  id: string;
  projectId: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string | null;
  status: 'OPEN' | 'MERGED' | 'CLOSED';
  authorId: string;
  mergedBy: string | null;
  mergedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; avatarUrl: string | null; email: string };
  reviews: Array<{
    id: string;
    mrId: string;
    userId: string;
    approved: boolean;
    user: { id: string; name: string; avatarUrl: string | null };
  }>;
  comments?: Array<{
    id: string;
    body: string;
    path: string | null;
    createdAt: string;
    author: { id: string; name: string; avatarUrl: string | null };
  }>;
  _count?: { comments: number };
}

export const mrsApi = {
  list: (projectId: string, status?: string) =>
    request<MergeRequest[]>(`/projects/${projectId}/merge-requests${status ? `?status=${status}` : ''}`),

  create: (
    projectId: string,
    data: { sourceBranch: string; targetBranch: string; title: string; description?: string },
  ) =>
    request<MergeRequest>(`/projects/${projectId}/merge-requests`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (projectId: string, mrId: string) =>
    request<MergeRequest>(`/projects/${projectId}/merge-requests/${mrId}`),

  diff: (projectId: string, mrId: string) =>
    request<{ mrId: string; sourceBranch: string; targetBranch: string; changes: unknown[] }>(
      `/projects/${projectId}/merge-requests/${mrId}/diff`,
    ),

  approve: (projectId: string, mrId: string) =>
    request<{ id: string; approved: boolean }>(`/projects/${projectId}/merge-requests/${mrId}/approve`, {
      method: 'POST',
    }),

  addComment: (projectId: string, mrId: string, body: string, path?: string) =>
    request<{ id: string; body: string }>(`/projects/${projectId}/merge-requests/${mrId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body, path }),
    }),

  merge: (projectId: string, mrId: string) =>
    request<{ merged: boolean; commitId: string }>(`/projects/${projectId}/merge-requests/${mrId}/merge`, {
      method: 'POST',
    }),

  close: (projectId: string, mrId: string) =>
    request<void>(`/projects/${projectId}/merge-requests/${mrId}/close`, { method: 'POST' }),
};

// ─── Generator ──────────────────────────────────────────────────────────────

export interface GenerationRun {
  id: string;
  language: string;
  mode: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  specHash: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface GenerationResult {
  runId: string;
  language: string;
  mode: string;
  specHash: string;
  bundleBase64: string;
  fileCount: number;
}

export const generatorApi = {
  generate: (
    projectId: string,
    opts: {
      language: string;
      mode: string;
      branchName?: string;
      packageName?: string;
      packageVersion?: string;
    },
  ) =>
    request<GenerationResult>(`/projects/${projectId}/generate`, {
      method: 'POST',
      body: JSON.stringify({ branchName: 'main', ...opts }),
    }),

  listRuns: (projectId: string) =>
    request<GenerationRun[]>(`/projects/${projectId}/generations`),
};

export { ApiClientError };
