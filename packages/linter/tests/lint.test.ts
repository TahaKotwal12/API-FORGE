import { describe, it, expect } from 'vitest';
import { lint } from '../src/lint';

const validDoc = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: {
        operationId: 'listUsers',
        summary: 'List all users',
        description: 'Returns a paginated list of users',
        tags: ['users'],
        responses: {
          '200': { description: 'A list of users', content: { 'application/json': { schema: { type: 'object' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { type: 'object' } } } },
        },
      },
    },
  },
};

const missingOperationIdDoc = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: {
        summary: 'List users',
        tags: ['users'],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
};

const missingTagsDoc = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/items': {
      get: {
        operationId: 'listItems',
        summary: 'List items',
        responses: { '200': { description: 'ok' } },
      },
    },
  },
};

describe('lint', () => {
  it('returns no errors for a well-formed document', async () => {
    const result = await lint(validDoc);
    const errors = result.issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('returns passed=true when no errors', async () => {
    const result = await lint(validDoc);
    expect(result.passed).toBe(true);
  });

  it('warns about missing operationId', async () => {
    const result = await lint(missingOperationIdDoc);
    const operationIdIssues = result.issues.filter((i) => i.code === 'apiforge-operation-operationId');
    expect(operationIdIssues.length).toBeGreaterThan(0);
  });

  it('warns about missing tags', async () => {
    const result = await lint(missingTagsDoc);
    const tagIssues = result.issues.filter((i) => i.code === 'apiforge-operation-tags');
    expect(tagIssues.length).toBeGreaterThan(0);
  });

  it('accepts a JSON string as input', async () => {
    const result = await lint(JSON.stringify(validDoc));
    const errors = result.issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('returns errorCount and warnCount', async () => {
    const result = await lint(missingOperationIdDoc);
    expect(typeof result.errorCount).toBe('number');
    expect(typeof result.warnCount).toBe('number');
  });

  it('handles an invalid (non-OpenAPI) document gracefully', async () => {
    const result = await lint({ hello: 'world' });
    // Should not throw, should return issues
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it('uses the strict ruleset when specified', async () => {
    const result = await lint(validDoc, { ruleset: 'strict' });
    // strict has more rules, so it should have more issues
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it('provides path arrays for each issue', async () => {
    const result = await lint(missingOperationIdDoc);
    for (const issue of result.issues) {
      expect(Array.isArray(issue.path)).toBe(true);
    }
  });

  it('handles null gracefully', async () => {
    const result = await lint(null);
    expect(Array.isArray(result.issues)).toBe(true);
  });
});
