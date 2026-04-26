import { describe, it, expect } from 'vitest';
import simpleCrud from '../fixtures/simple-crud.json';
import { validateSpec } from '../src/validate';
import type { OpenAPIDocument } from '../src/types';

describe('validateSpec', () => {
  it('validates a correct OpenAPI 3.1 document as valid', () => {
    const result = validateSpec(simpleCrud);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects null', () => {
    const result = validateSpec(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('INVALID_TYPE');
  });

  it('rejects an array', () => {
    const result = validateSpec([]);
    expect(result.valid).toBe(false);
  });

  it('rejects a missing openapi field', () => {
    const doc = { info: { title: 'T', version: '1' }, paths: {} };
    const result = validateSpec(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'openapi')).toBe(true);
  });

  it('rejects an unsupported openapi version', () => {
    const doc = { openapi: '2.0', info: { title: 'T', version: '1' }, paths: {} };
    const result = validateSpec(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'UNSUPPORTED_VERSION')).toBe(true);
  });

  it('rejects missing info', () => {
    const doc = { openapi: '3.1.0' };
    const result = validateSpec(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'info')).toBe(true);
  });

  it('rejects missing info.title', () => {
    const doc = { openapi: '3.1.0', info: { version: '1' } };
    const result = validateSpec(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'info.title')).toBe(true);
  });

  it('rejects missing info.version', () => {
    const doc = { openapi: '3.1.0', info: { title: 'T' } };
    const result = validateSpec(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'info.version')).toBe(true);
  });

  it('rejects a path that does not start with /', () => {
    const doc: OpenAPIDocument = {
      openapi: '3.1.0',
      info: { title: 'T', version: '1' },
      paths: {
        'items': {
          get: { responses: { '200': { description: 'ok' } } },
        },
      },
    };
    const result = validateSpec(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'INVALID_PATH')).toBe(true);
  });

  it('rejects an operation with no responses', () => {
    const doc = {
      openapi: '3.1.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/items': {
          get: { operationId: 'list', responses: {} },
        },
      },
    };
    const result = validateSpec(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'EMPTY_RESPONSES')).toBe(true);
  });

  it('rejects duplicate operationIds', () => {
    const doc = {
      openapi: '3.1.0',
      info: { title: 'T', version: '1' },
      paths: {
        '/a': { get: { operationId: 'same', responses: { '200': { description: 'ok' } } } },
        '/b': { get: { operationId: 'same', responses: { '200': { description: 'ok' } } } },
      },
    };
    const result = validateSpec(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'DUPLICATE_OPERATION_ID')).toBe(true);
  });

  it('accepts openapi 3.0.x documents', () => {
    const doc = {
      openapi: '3.0.3',
      info: { title: 'T', version: '1' },
      paths: { '/items': { get: { responses: { '200': { description: 'ok' } } } } },
    };
    const result = validateSpec(doc);
    expect(result.valid).toBe(true);
  });
});
