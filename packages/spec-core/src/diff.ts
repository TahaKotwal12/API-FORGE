import { specToInternal } from './convert';
import type { OpenAPIDocument, InternalEndpoint, InternalSchema } from './types';

export type ChangeType = 'added' | 'deleted' | 'changed';

export interface EndpointChange {
  type: ChangeType;
  method: string;
  path: string;
  before?: InternalEndpoint;
  after?: InternalEndpoint;
  changedFields?: string[];
  breaking: boolean;
}

export interface SchemaChange {
  type: ChangeType;
  name: string;
  before?: InternalSchema;
  after?: InternalSchema;
  breaking: boolean;
}

export interface SpecDiff {
  endpoints: EndpointChange[];
  schemas: SchemaChange[];
  hasBreakingChanges: boolean;
  summary: { added: number; deleted: number; changed: number };
}

function endpointKey(ep: InternalEndpoint): string {
  return `${ep.method}:${ep.path}`;
}

// Fields that are breaking to remove/change
const BREAKING_ENDPOINT_FIELDS = new Set([
  'method',
  'path',
  'parameters',
  'requestBody',
  'security',
]);

function changedFields(before: InternalEndpoint, after: InternalEndpoint): string[] {
  const fields: string[] = [];
  const check = (key: keyof InternalEndpoint) => {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      fields.push(key as string);
    }
  };
  for (const key of Object.keys(before) as Array<keyof InternalEndpoint>) {
    check(key);
  }
  for (const key of Object.keys(after) as Array<keyof InternalEndpoint>) {
    if (!(key in before)) fields.push(key as string);
  }
  return [...new Set(fields)];
}

function isBreakingEndpointChange(changed: string[]): boolean {
  return changed.some((f) => BREAKING_ENDPOINT_FIELDS.has(f));
}

// Compute a structural diff between two OpenAPI documents.
export function diffSpecs(before: OpenAPIDocument, after: OpenAPIDocument): SpecDiff {
  const beforeInternal = specToInternal(before);
  const afterInternal = specToInternal(after);

  const endpointChanges: EndpointChange[] = [];
  const schemaChanges: SchemaChange[] = [];

  // Endpoint diff
  const beforeEpMap = new Map<string, InternalEndpoint>(
    beforeInternal.endpoints.map((ep) => [endpointKey(ep), ep]),
  );
  const afterEpMap = new Map<string, InternalEndpoint>(
    afterInternal.endpoints.map((ep) => [endpointKey(ep), ep]),
  );

  for (const [key, beforeEp] of beforeEpMap) {
    const afterEp = afterEpMap.get(key);
    if (!afterEp) {
      endpointChanges.push({
        type: 'deleted',
        method: beforeEp.method,
        path: beforeEp.path,
        before: beforeEp,
        breaking: true,
      });
    } else {
      const fields = changedFields(beforeEp, afterEp);
      if (fields.length > 0) {
        endpointChanges.push({
          type: 'changed',
          method: beforeEp.method,
          path: beforeEp.path,
          before: beforeEp,
          after: afterEp,
          changedFields: fields,
          breaking: isBreakingEndpointChange(fields),
        });
      }
    }
  }

  for (const [key, afterEp] of afterEpMap) {
    if (!beforeEpMap.has(key)) {
      endpointChanges.push({
        type: 'added',
        method: afterEp.method,
        path: afterEp.path,
        after: afterEp,
        breaking: false,
      });
    }
  }

  // Schema diff
  const beforeSchemaMap = new Map(beforeInternal.schemas.map((s) => [s.name, s]));
  const afterSchemaMap = new Map(afterInternal.schemas.map((s) => [s.name, s]));

  for (const [name, beforeSchema] of beforeSchemaMap) {
    const afterSchema = afterSchemaMap.get(name);
    if (!afterSchema) {
      schemaChanges.push({ type: 'deleted', name, before: beforeSchema, breaking: true });
    } else if (JSON.stringify(beforeSchema.schema) !== JSON.stringify(afterSchema.schema)) {
      schemaChanges.push({ type: 'changed', name, before: beforeSchema, after: afterSchema, breaking: true });
    }
  }

  for (const [name, afterSchema] of afterSchemaMap) {
    if (!beforeSchemaMap.has(name)) {
      schemaChanges.push({ type: 'added', name, after: afterSchema, breaking: false });
    }
  }

  const allChanges = [...endpointChanges, ...schemaChanges];
  const hasBreakingChanges = allChanges.some((c) => c.breaking);

  const counts = { added: 0, deleted: 0, changed: 0 };
  for (const c of allChanges) counts[c.type]++;

  return {
    endpoints: endpointChanges,
    schemas: schemaChanges,
    hasBreakingChanges,
    summary: counts,
  };
}
