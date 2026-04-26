import { describe, it, expect } from 'vitest';
import simpleCrud from '../fixtures/simple-crud.json';
import { mergeSpecs } from '../src/merge';
import type { OpenAPIDocument, OperationObject } from '../src/types';

const base = simpleCrud as OpenAPIDocument;

describe('mergeSpecs', () => {
  it('produces no conflicts when ours === theirs === base', () => {
    const { conflicts } = mergeSpecs(base, base, base);
    expect(conflicts).toHaveLength(0);
  });

  it('accepts ours changes when only ours changed', () => {
    const ours: OpenAPIDocument = {
      ...base,
      paths: {
        ...base.paths,
        '/items': {
          ...(base.paths?.['/items'] ?? {}),
          get: {
            ...(base.paths?.['/items']?.get ?? {}),
            summary: 'Updated in ours',
          } as OperationObject,
        },
      },
    };
    const { merged, conflicts } = mergeSpecs(base, ours, base);
    expect(conflicts).toHaveLength(0);
    const spec = merged.paths?.['/items']?.get as { summary?: string } | undefined;
    expect(spec?.summary).toBe('Updated in ours');
  });

  it('accepts theirs changes when only theirs changed', () => {
    const theirs: OpenAPIDocument = {
      ...base,
      paths: {
        ...base.paths,
        '/items': {
          ...(base.paths?.['/items'] ?? {}),
          get: {
            ...(base.paths?.['/items']?.get ?? {}),
            summary: 'Updated in theirs',
          } as OperationObject,
        },
      },
    };
    const { merged, conflicts } = mergeSpecs(base, base, theirs);
    expect(conflicts).toHaveLength(0);
    const spec = merged.paths?.['/items']?.get as { summary?: string } | undefined;
    expect(spec?.summary).toBe('Updated in theirs');
  });

  it('records a conflict when both sides changed the same endpoint differently', () => {
    const ours: OpenAPIDocument = {
      ...base,
      paths: {
        ...base.paths,
        '/items': {
          ...(base.paths?.['/items'] ?? {}),
          get: { ...(base.paths?.['/items']?.get ?? {}), summary: 'In ours' } as OperationObject,
        },
      },
    };
    const theirs: OpenAPIDocument = {
      ...base,
      paths: {
        ...base.paths,
        '/items': {
          ...(base.paths?.['/items'] ?? {}),
          get: { ...(base.paths?.['/items']?.get ?? {}), summary: 'In theirs' } as OperationObject,
        },
      },
    };
    const { conflicts } = mergeSpecs(base, ours, theirs);
    expect(conflicts.some((c) => c.key === 'GET:/items')).toBe(true);
  });

  it('accepts same-change from both sides with no conflict', () => {
    const changed: OpenAPIDocument = {
      ...base,
      paths: {
        ...base.paths,
        '/items': {
          ...(base.paths?.['/items'] ?? {}),
          get: { ...(base.paths?.['/items']?.get ?? {}), summary: 'Same change' } as OperationObject,
        },
      },
    };
    const { conflicts } = mergeSpecs(base, changed, changed);
    expect(conflicts).toHaveLength(0);
  });

  it('includes endpoints added only in ours', () => {
    const ours: OpenAPIDocument = {
      ...base,
      paths: {
        ...base.paths,
        '/new': { get: { responses: { '200': { description: 'ok' } } } },
      },
    };
    const { merged, conflicts } = mergeSpecs(base, ours, base);
    expect(conflicts).toHaveLength(0);
    expect(merged.paths).toHaveProperty('/new');
  });

  it('excludes endpoints deleted in ours', () => {
    const { '/items/{id}': _removed, ...restPaths } = base.paths ?? {};
    const ours: OpenAPIDocument = { ...base, paths: restPaths };
    const { merged, conflicts } = mergeSpecs(base, ours, base);
    expect(conflicts).toHaveLength(0);
    expect(merged.paths).not.toHaveProperty('/items/{id}');
  });
});
