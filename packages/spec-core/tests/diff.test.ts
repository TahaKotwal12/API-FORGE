import { describe, it, expect } from 'vitest';
import simpleCrud from '../fixtures/simple-crud.json';
import { diffSpecs } from '../src/diff';
import type { OpenAPIDocument, OperationObject } from '../src/types';

const base = simpleCrud as OpenAPIDocument;

function withNewEndpoint(doc: OpenAPIDocument): OpenAPIDocument {
  return {
    ...doc,
    paths: {
      ...doc.paths,
      '/tags': {
        get: {
          operationId: 'listTags',
          tags: ['tags'],
          responses: { '200': { description: 'ok' } },
        },
      },
    },
  };
}

function withDeletedEndpoint(doc: OpenAPIDocument): OpenAPIDocument {
  const { '/items/{id}': _removed, ...rest } = doc.paths ?? {};
  return { ...doc, paths: rest };
}

function withChangedSummary(doc: OpenAPIDocument): OpenAPIDocument {
  return {
    ...doc,
    paths: {
      ...doc.paths,
      '/items': {
        ...(doc.paths?.['/items'] ?? {}),
        get: {
          ...(doc.paths?.['/items']?.get ?? {}),
          summary: 'Fetch all items (updated)',
        } as OperationObject,
      },
    },
  };
}

describe('diffSpecs', () => {
  it('returns no changes when documents are identical', () => {
    const diff = diffSpecs(base, base);
    expect(diff.endpoints).toHaveLength(0);
    expect(diff.schemas).toHaveLength(0);
    expect(diff.hasBreakingChanges).toBe(false);
    expect(diff.summary).toEqual({ added: 0, deleted: 0, changed: 0 });
  });

  it('detects an added endpoint', () => {
    const after = withNewEndpoint(base);
    const diff = diffSpecs(base, after);
    const added = diff.endpoints.filter((e) => e.type === 'added');
    expect(added).toHaveLength(1);
    expect(added[0]?.path).toBe('/tags');
    expect(added[0]?.breaking).toBe(false);
  });

  it('detects a deleted endpoint as breaking', () => {
    const after = withDeletedEndpoint(base);
    const diff = diffSpecs(base, after);
    const deleted = diff.endpoints.filter((e) => e.type === 'deleted');
    // 3 endpoints under /items/{id} (GET, PUT, DELETE)
    expect(deleted.length).toBe(3);
    expect(deleted.every((d) => d.breaking)).toBe(true);
    expect(diff.hasBreakingChanges).toBe(true);
  });

  it('detects a changed endpoint summary (non-breaking)', () => {
    const after = withChangedSummary(base);
    const diff = diffSpecs(base, after);
    const changed = diff.endpoints.filter((e) => e.type === 'changed');
    expect(changed).toHaveLength(1);
    expect(changed[0]?.path).toBe('/items');
    expect(changed[0]?.method).toBe('GET');
    expect(changed[0]?.changedFields).toContain('summary');
  });

  it('detects an added schema', () => {
    const after: OpenAPIDocument = {
      ...base,
      components: {
        ...base.components,
        schemas: {
          ...(base.components?.schemas ?? {}),
          NewSchema: { type: 'object', properties: { id: { type: 'string' } } },
        },
      },
    };
    const diff = diffSpecs(base, after);
    const addedSchemas = diff.schemas.filter((s) => s.type === 'added');
    expect(addedSchemas).toHaveLength(1);
    expect(addedSchemas[0]?.name).toBe('NewSchema');
  });

  it('detects a deleted schema as breaking', () => {
    const after: OpenAPIDocument = {
      ...base,
      components: {
        ...base.components,
        schemas: { Item: base.components!.schemas!['Item'] },
      },
    };
    const diff = diffSpecs(base, after);
    const deleted = diff.schemas.filter((s) => s.type === 'deleted');
    expect(deleted.length).toBeGreaterThan(0);
    expect(deleted.every((d) => d.breaking)).toBe(true);
  });

  it('provides correct summary counts', () => {
    const after = withNewEndpoint(withDeletedEndpoint(base));
    const diff = diffSpecs(base, after);
    expect(diff.summary.added).toBe(1);
    expect(diff.summary.deleted).toBe(3);
    expect(diff.summary.changed).toBe(0);
  });
});
