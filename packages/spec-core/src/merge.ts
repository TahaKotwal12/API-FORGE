import { specToInternal, internalToSpec } from './convert';
import type { OpenAPIDocument, InternalEndpoint, InternalSchema, InternalSecurityScheme } from './types';

export interface MergeConflict {
  type: 'endpoint' | 'schema' | 'securityScheme';
  key: string;
  ours: unknown;
  theirs: unknown;
}

export interface MergeResult {
  merged: OpenAPIDocument;
  conflicts: MergeConflict[];
}

function endpointKey(ep: InternalEndpoint): string {
  return `${ep.method}:${ep.path}`;
}

// Three-way merge of OpenAPI documents.
// Strategy: if ours and theirs both changed a key (vs base), it's a conflict.
// Otherwise accept whichever side changed it.
export function mergeSpecs(
  base: OpenAPIDocument,
  ours: OpenAPIDocument,
  theirs: OpenAPIDocument,
): MergeResult {
  const baseInternal = specToInternal(base);
  const oursInternal = specToInternal(ours);
  const theirsInternal = specToInternal(theirs);

  const conflicts: MergeConflict[] = [];

  // ─── Merge endpoints ────────────────────────────────────────────────────────

  const baseEpMap = new Map<string, InternalEndpoint>(
    baseInternal.endpoints.map((ep) => [endpointKey(ep), ep]),
  );
  const oursEpMap = new Map<string, InternalEndpoint>(
    oursInternal.endpoints.map((ep) => [endpointKey(ep), ep]),
  );
  const theirsEpMap = new Map<string, InternalEndpoint>(
    theirsInternal.endpoints.map((ep) => [endpointKey(ep), ep]),
  );

  const mergedEpMap = new Map<string, InternalEndpoint>();

  const allKeys = new Set([...baseEpMap.keys(), ...oursEpMap.keys(), ...theirsEpMap.keys()]);
  for (const key of allKeys) {
    const b = baseEpMap.get(key);
    const o = oursEpMap.get(key);
    const t = theirsEpMap.get(key);

    const baseStr = JSON.stringify(b);
    const oursStr = JSON.stringify(o);
    const theirsStr = JSON.stringify(t);

    const oursChanged = oursStr !== baseStr;
    const theirsChanged = theirsStr !== baseStr;

    if (!oursChanged && !theirsChanged) {
      // Neither changed (or both removed)
      if (o) mergedEpMap.set(key, o);
    } else if (oursChanged && !theirsChanged) {
      // Only ours changed
      if (o) mergedEpMap.set(key, o);
      // If o is undefined, endpoint was deleted in ours — skip it
    } else if (!oursChanged && theirsChanged) {
      // Only theirs changed
      if (t) mergedEpMap.set(key, t);
    } else {
      // Both changed
      if (oursStr === theirsStr) {
        // Same change — no conflict
        if (o) mergedEpMap.set(key, o);
      } else {
        // True conflict — keep ours, record conflict
        conflicts.push({ type: 'endpoint', key, ours: o, theirs: t });
        if (o) mergedEpMap.set(key, o);
      }
    }
  }

  const mergedEndpoints = [...mergedEpMap.values()].sort((a, b) => a.order - b.order);

  // ─── Merge schemas ──────────────────────────────────────────────────────────

  const mergedSchemas = mergeNamedItems<InternalSchema>(
    baseInternal.schemas,
    oursInternal.schemas,
    theirsInternal.schemas,
    'schema',
    conflicts,
  );

  // ─── Merge security schemes ──────────────────────────────────────────────────

  const mergedSecuritySchemes = mergeNamedItems<InternalSecurityScheme>(
    baseInternal.securitySchemes,
    oursInternal.securitySchemes,
    theirsInternal.securitySchemes,
    'securityScheme',
    conflicts,
  );

  const merged = internalToSpec(
    {
      endpoints: mergedEndpoints,
      schemas: mergedSchemas,
      securitySchemes: mergedSecuritySchemes,
    },
    (ours.info as { title?: string; version?: string }) ?? {},
  );

  return { merged, conflicts };
}

function mergeNamedItems<T extends { name: string }>(
  base: T[],
  ours: T[],
  theirs: T[],
  type: MergeConflict['type'],
  conflicts: MergeConflict[],
): T[] {
  const baseMap = new Map<string, T>(base.map((x) => [x.name, x]));
  const oursMap = new Map<string, T>(ours.map((x) => [x.name, x]));
  const theirsMap = new Map<string, T>(theirs.map((x) => [x.name, x]));

  const result = new Map<string, T>();
  const allNames = new Set([...baseMap.keys(), ...oursMap.keys(), ...theirsMap.keys()]);

  for (const name of allNames) {
    const b = baseMap.get(name);
    const o = oursMap.get(name);
    const t = theirsMap.get(name);

    const oursChanged = JSON.stringify(o) !== JSON.stringify(b);
    const theirsChanged = JSON.stringify(t) !== JSON.stringify(b);

    if (!oursChanged && !theirsChanged) {
      if (o) result.set(name, o);
    } else if (oursChanged && !theirsChanged) {
      if (o) result.set(name, o);
    } else if (!oursChanged && theirsChanged) {
      if (t) result.set(name, t);
    } else {
      if (JSON.stringify(o) === JSON.stringify(t)) {
        if (o) result.set(name, o);
      } else {
        conflicts.push({ type, key: name, ours: o, theirs: t });
        if (o) result.set(name, o);
      }
    }
  }

  return [...result.values()];
}
