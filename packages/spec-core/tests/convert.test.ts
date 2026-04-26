import { describe, it, expect } from 'vitest';
import simpleCrud from '../fixtures/simple-crud.json';
import { specToInternal, internalToSpec } from '../src/convert';
import type { OpenAPIDocument } from '../src/types';

const doc = simpleCrud as OpenAPIDocument;

describe('specToInternal', () => {
  it('extracts all endpoints from a CRUD spec', () => {
    const { endpoints } = specToInternal(doc);
    expect(endpoints).toHaveLength(5); // GET /items, POST /items, GET /items/{id}, PUT /items/{id}, DELETE /items/{id}
  });

  it('correctly maps HTTP methods', () => {
    const { endpoints } = specToInternal(doc);
    const methods = endpoints.map((e) => e.method).sort();
    expect(methods).toEqual(['DELETE', 'GET', 'GET', 'POST', 'PUT']);
  });

  it('preserves path parameters from path-level parameters', () => {
    const { endpoints } = specToInternal(doc);
    const getById = endpoints.find((e) => e.method === 'GET' && e.path === '/items/{id}');
    expect(getById).toBeDefined();
    expect(getById?.parameters).toHaveLength(1);
    expect(getById?.parameters[0]?.name).toBe('id');
    expect(getById?.parameters[0]?.in).toBe('path');
  });

  it('extracts query parameters on list endpoint', () => {
    const { endpoints } = specToInternal(doc);
    const list = endpoints.find((e) => e.method === 'GET' && e.path === '/items');
    expect(list?.parameters).toHaveLength(2);
    expect(list?.parameters[0]?.name).toBe('limit');
    expect(list?.parameters[1]?.name).toBe('offset');
  });

  it('extracts request body on POST', () => {
    const { endpoints } = specToInternal(doc);
    const create = endpoints.find((e) => e.method === 'POST' && e.path === '/items');
    expect(create?.requestBody).toBeDefined();
    expect(create?.requestBody?.required).toBe(true);
  });

  it('extracts schemas from components', () => {
    const { schemas } = specToInternal(doc);
    expect(schemas.map((s) => s.name).sort()).toEqual(
      ['CreateItemRequest', 'ErrorResponse', 'Item', 'ItemList', 'UpdateItemRequest'],
    );
  });

  it('extracts security schemes', () => {
    const { securitySchemes } = specToInternal(doc);
    expect(securitySchemes).toHaveLength(1);
    expect(securitySchemes[0]?.name).toBe('bearerAuth');
    expect(securitySchemes[0]?.scheme.type).toBe('http');
  });

  it('assigns increasing order values', () => {
    const { endpoints } = specToInternal(doc);
    const orders = endpoints.map((e) => e.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('marks deprecated flag correctly', () => {
    const { endpoints } = specToInternal(doc);
    // none of the simple-crud endpoints are deprecated
    expect(endpoints.every((e) => !e.deprecated)).toBe(true);
  });

  it('handles an empty paths object', () => {
    const emptyDoc: OpenAPIDocument = { openapi: '3.1.0', info: { title: 'T', version: '1' }, paths: {} };
    const { endpoints, schemas, securitySchemes } = specToInternal(emptyDoc);
    expect(endpoints).toHaveLength(0);
    expect(schemas).toHaveLength(0);
    expect(securitySchemes).toHaveLength(0);
  });
});

describe('internalToSpec', () => {
  it('round-trips endpoints through internal → spec', () => {
    const internal = specToInternal(doc);
    const rebuilt = internalToSpec(internal);

    const rebuiltInternal = specToInternal(rebuilt);
    expect(rebuiltInternal.endpoints.length).toBe(internal.endpoints.length);
  });

  it('produces valid openapi version field', () => {
    const internal = specToInternal(doc);
    const rebuilt = internalToSpec(internal);
    expect(rebuilt.openapi).toBe('3.1.0');
  });

  it('puts schemas into components.schemas', () => {
    const internal = specToInternal(doc);
    const rebuilt = internalToSpec(internal);
    const names = Object.keys(rebuilt.components?.schemas ?? {});
    expect(names.sort()).toEqual(['CreateItemRequest', 'ErrorResponse', 'Item', 'ItemList', 'UpdateItemRequest']);
  });

  it('puts security schemes into components.securitySchemes', () => {
    const internal = specToInternal(doc);
    const rebuilt = internalToSpec(internal);
    expect(Object.keys(rebuilt.components?.securitySchemes ?? {})).toContain('bearerAuth');
  });

  it('uses provided info', () => {
    const internal = specToInternal(doc);
    const rebuilt = internalToSpec(internal, { title: 'My API', version: '2.0.0' });
    expect(rebuilt.info.title).toBe('My API');
    expect(rebuilt.info.version).toBe('2.0.0');
  });

  it('omits components if empty', () => {
    const rebuilt = internalToSpec({ endpoints: [], schemas: [], securitySchemes: [] });
    expect(rebuilt.components).toBeUndefined();
  });
});
