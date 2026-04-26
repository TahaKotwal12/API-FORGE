import type {
  OpenAPIDocument,
  PathItemObject,
  OperationObject,
  HttpMethod,
  InternalEndpoint,
  InternalSchema,
  InternalSecurityScheme,
  InternalSpec,
  SchemaObject,
  SecuritySchemeObject,
  ReferenceObject,
  InfoObject,
} from './types';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function isRef(obj: unknown): obj is ReferenceObject {
  return typeof obj === 'object' && obj !== null && '$ref' in obj;
}

function extractExtensions(op: OperationObject): Record<string, unknown> {
  const exts: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(op)) {
    if (key.startsWith('x-')) {
      exts[key] = value;
    }
  }
  return exts;
}

// Convert a full OpenAPI 3.x document into our internal flat representation.
export function specToInternal(doc: OpenAPIDocument): InternalSpec {
  const endpoints: InternalEndpoint[] = [];
  const schemas: InternalSchema[] = [];
  const securitySchemes: InternalSecurityScheme[] = [];

  let order = 0;

  // Extract endpoints from paths
  const paths = doc.paths ?? {};
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || isRef(pathItem)) continue;
    const item = pathItem as PathItemObject;

    for (const method of HTTP_METHODS) {
      const op = item[method.toLowerCase() as keyof PathItemObject] as OperationObject | undefined;
      if (!op) continue;

      // Merge path-level and operation-level parameters
      const pathParams = item.parameters ?? [];
      const opParams = op.parameters ?? [];
      // Operation params override path params with the same name+in
      const merged = [...pathParams];
      for (const p of opParams) {
        if (isRef(p)) continue;
        const idx = merged.findIndex(
          (x) => !isRef(x) && x.name === p.name && x.in === p.in,
        );
        if (idx >= 0) merged[idx] = p;
        else merged.push(p);
      }

      const endpoint: InternalEndpoint = {
        method,
        path,
        summary: op.summary,
        description: op.description,
        tags: op.tags ?? [],
        parameters: merged.filter((p) => !isRef(p)) as InternalEndpoint['parameters'],
        requestBody: op.requestBody && !isRef(op.requestBody) ? op.requestBody : undefined,
        responses: op.responses ?? {},
        security: op.security,
        deprecated: op.deprecated ?? false,
        extensions: extractExtensions(op),
        order: order++,
      };

      endpoints.push(endpoint);
    }
  }

  // Extract schemas from components
  const componentSchemas = doc.components?.schemas ?? {};
  for (const [name, schema] of Object.entries(componentSchemas)) {
    if (isRef(schema)) continue;
    schemas.push({ name, schema: schema as SchemaObject });
  }

  // Extract security schemes from components
  const componentSecurity = doc.components?.securitySchemes ?? {};
  for (const [name, scheme] of Object.entries(componentSecurity)) {
    if (isRef(scheme)) continue;
    securitySchemes.push({ name, scheme: scheme as SecuritySchemeObject });
  }

  return { endpoints, schemas, securitySchemes };
}

// Convert internal representation back to an OpenAPI 3.1 document.
export function internalToSpec(
  spec: InternalSpec,
  info: Partial<InfoObject> = {},
): OpenAPIDocument {
  const paths: Record<string, Record<string, unknown>> = {};
  const sortedEndpoints = [...spec.endpoints].sort((a, b) => a.order - b.order);

  for (const ep of sortedEndpoints) {
    if (!paths[ep.path]) paths[ep.path] = {};
    const method = ep.method.toLowerCase();

    const op: Record<string, unknown> = {
      tags: ep.tags,
      summary: ep.summary,
      description: ep.description,
      parameters: ep.parameters,
      responses: ep.responses,
      deprecated: ep.deprecated || undefined,
      security: ep.security,
      ...ep.extensions,
    };

    // Strip undefined values
    for (const key of Object.keys(op)) {
      if (op[key] === undefined) delete op[key];
    }

    if (ep.requestBody) op.requestBody = ep.requestBody;

    paths[ep.path][method] = op;
  }

  const schemas: Record<string, SchemaObject> = {};
  for (const s of spec.schemas) {
    schemas[s.name] = s.schema;
  }

  const securitySchemes: Record<string, SecuritySchemeObject> = {};
  for (const ss of spec.securitySchemes) {
    securitySchemes[ss.name] = ss.scheme;
  }

  const doc: OpenAPIDocument = {
    openapi: '3.1.0',
    info: {
      title: info.title ?? 'Untitled API',
      version: info.version ?? '0.1.0',
      description: info.description,
    },
    paths,
    components: {
      ...(Object.keys(schemas).length > 0 && { schemas }),
      ...(Object.keys(securitySchemes).length > 0 && { securitySchemes }),
    },
  };

  // Remove empty components
  if (doc.components && Object.keys(doc.components).length === 0) {
    delete doc.components;
  }

  return doc;
}
