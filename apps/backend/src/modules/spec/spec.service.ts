import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@apiforge/db';
import { AuditService } from '../audit/audit.service';
import * as yaml from 'js-yaml';

@Injectable()
export class SpecService {
  constructor(private audit: AuditService) {}

  private async resolveBranch(projectId: string, branchName: string) {
    const branch = await prisma.branch.findUnique({
      where: { projectId_name: { projectId, name: branchName } },
      include: { project: { select: { orgId: true, name: true } } },
    });
    if (!branch) throw new NotFoundException(`Branch "${branchName}" not found`);
    return branch;
  }

  private async checkMembership(userId: string, orgId: string) {
    const m = await prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
    if (!m) throw new ForbiddenException('Not a member of this org');
    return m;
  }

  // Build a composed OpenAPI 3.1 document from endpoints + schemas + security schemes
  async compose(userId: string, projectId: string, branchName: string): Promise<object> {
    const branch = await this.resolveBranch(projectId, branchName);
    await this.checkMembership(userId, branch.project.orgId);

    const [endpoints, schemas, securitySchemes] = await Promise.all([
      prisma.endpoint.findMany({
        where: { branchId: branch.id, deletedAt: null },
        orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
      }),
      prisma.schemaComponent.findMany({ where: { branchId: branch.id } }),
      prisma.securityScheme.findMany({ where: { branchId: branch.id } }),
    ]);

    const paths: Record<string, Record<string, unknown>> = {};
    for (const ep of endpoints) {
      if (!paths[ep.path]) paths[ep.path] = {};
      paths[ep.path][ep.method.toLowerCase()] = {
        ...(ep.tags.length > 0 && { tags: ep.tags }),
        ...(ep.summary && { summary: ep.summary }),
        ...(ep.description && { description: ep.description }),
        parameters: ep.parameters,
        ...(ep.requestBody && { requestBody: ep.requestBody }),
        responses: ep.responses,
        ...(ep.security && { security: ep.security }),
        ...(ep.deprecated && { deprecated: true }),
        ...(ep.extensions && Object.keys(ep.extensions as object).length > 0 ? ep.extensions as Record<string, unknown> : {}),
      };
    }

    const schemasObj: Record<string, unknown> = {};
    for (const s of schemas) schemasObj[s.name] = s.schema;

    const securityObj: Record<string, unknown> = {};
    for (const ss of securitySchemes) securityObj[ss.name] = ss.scheme;

    return {
      openapi: '3.1.0',
      info: { title: branch.project.name, version: '0.1.0' },
      paths,
      ...(Object.keys(schemasObj).length > 0 || Object.keys(securityObj).length > 0
        ? {
            components: {
              ...(Object.keys(schemasObj).length > 0 && { schemas: schemasObj }),
              ...(Object.keys(securityObj).length > 0 && { securitySchemes: securityObj }),
            },
          }
        : {}),
    };
  }

  // Import a spec from a raw string (JSON or YAML) or a URL
  async importSpec(
    userId: string,
    projectId: string,
    branchName: string,
    input: { content?: string; url?: string; format?: 'json' | 'yaml' | 'auto' },
  ) {
    const branch = await this.resolveBranch(projectId, branchName);
    const m = await this.checkMembership(userId, branch.project.orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') throw new ForbiddenException('Insufficient permissions');

    let rawContent: string;

    if (input.url) {
      const response = await fetch(input.url).catch(() => {
        throw new BadRequestException('Failed to fetch spec from URL');
      });
      if (!response.ok) throw new BadRequestException(`URL returned ${response.status}`);
      rawContent = await response.text();
    } else if (input.content) {
      rawContent = input.content;
    } else {
      throw new BadRequestException('Either content or url must be provided');
    }

    const parsed = this.parseSpec(rawContent);

    // Handle Swagger 2.0 → OpenAPI 3.x conversion
    const doc = await this.normalizeToOpenAPI31(parsed);

    // Import endpoints
    const paths = (doc.paths as Record<string, Record<string, unknown>>) ?? {};
    const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

    let order = 0;
    const endpointResults: string[] = [];

    for (const [path, pathItem] of Object.entries(paths)) {
      for (const method of HTTP_METHODS) {
        const op = pathItem[method] as Record<string, unknown> | undefined;
        if (!op) continue;

        // Merge path-level parameters
        const pathParams = (pathItem.parameters ?? []) as unknown[];
        const opParams = (op.parameters ?? []) as unknown[];
        const merged = [...pathParams, ...opParams];

        const httpMethod = method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

        // Upsert: update if exists, create if not
        const existing = await prisma.endpoint.findFirst({
          where: { branchId: branch.id, method: httpMethod, path },
        });

        if (existing) {
          await prisma.endpoint.update({
            where: { id: existing.id },
            data: {
              summary: op.summary as string | undefined,
              description: op.description as string | undefined,
              tags: (op.tags as string[]) ?? [],
              parameters: merged as object,
              requestBody: op.requestBody as object | undefined,
              responses: (op.responses as object) ?? { '200': { description: 'Success' } },
              security: op.security as object | undefined,
              deprecated: (op.deprecated as boolean) ?? false,
              deletedAt: null,
            },
          });
          endpointResults.push(`updated:${httpMethod}:${path}`);
        } else {
          await prisma.endpoint.create({
            data: {
              branchId: branch.id,
              method: httpMethod,
              path,
              summary: op.summary as string | undefined,
              description: op.description as string | undefined,
              tags: (op.tags as string[]) ?? [],
              parameters: merged as object,
              requestBody: op.requestBody as object | undefined,
              responses: (op.responses as object) ?? { '200': { description: 'Success' } },
              security: op.security as object | undefined,
              deprecated: (op.deprecated as boolean) ?? false,
              extensions: {},
              order: order++,
            },
          });
          endpointResults.push(`created:${httpMethod}:${path}`);
        }
      }
    }

    // Import schemas
    const componentSchemas = ((doc.components as Record<string, unknown> | undefined)?.schemas ?? {}) as Record<string, unknown>;
    for (const [name, schema] of Object.entries(componentSchemas)) {
      const existing = await prisma.schemaComponent.findUnique({
        where: { branchId_name: { branchId: branch.id, name } },
      });
      if (existing) {
        await prisma.schemaComponent.update({ where: { id: existing.id }, data: { schema: schema as object } });
      } else {
        await prisma.schemaComponent.create({ data: { branchId: branch.id, name, schema: schema as object } });
      }
    }

    // Import security schemes
    const componentSecurity = ((doc.components as Record<string, unknown> | undefined)?.securitySchemes ?? {}) as Record<string, unknown>;
    for (const [name, scheme] of Object.entries(componentSecurity)) {
      const existing = await prisma.securityScheme.findUnique({
        where: { branchId_name: { branchId: branch.id, name } },
      });
      if (existing) {
        await prisma.securityScheme.update({ where: { id: existing.id }, data: { scheme: scheme as object } });
      } else {
        await prisma.securityScheme.create({ data: { branchId: branch.id, name, scheme: scheme as object } });
      }
    }

    await this.audit.log({
      orgId: branch.project.orgId,
      actorId: userId,
      action: 'spec.import',
      resource: 'branch',
      resourceId: branch.id,
      after: { endpointResults: endpointResults.length, source: input.url ?? 'inline' },
    });

    return {
      imported: endpointResults.length,
      schemas: Object.keys(componentSchemas).length,
      securitySchemes: Object.keys(componentSecurity).length,
    };
  }

  private parseSpec(content: string): Record<string, unknown> {
    // Try JSON first, then YAML
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      try {
        const parsed = yaml.load(content);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
        throw new BadRequestException('Parsed YAML is not an object');
      } catch {
        throw new BadRequestException('Content is not valid JSON or YAML');
      }
    }
  }

  private async normalizeToOpenAPI31(doc: Record<string, unknown>): Promise<Record<string, unknown>> {
    const version = (doc.openapi as string | undefined) ?? (doc.swagger as string | undefined) ?? '';

    if (version.startsWith('2.')) {
      // Swagger 2.0 — basic conversion
      return this.convertSwagger2ToOpenAPI3(doc);
    }

    if (version.startsWith('3.0')) {
      // OpenAPI 3.0 → 3.1 — minor adjustments
      return { ...doc, openapi: '3.1.0' };
    }

    if (version.startsWith('3.1')) {
      return doc;
    }

    throw new BadRequestException(`Unsupported spec version: ${version}`);
  }

  private convertSwagger2ToOpenAPI3(swagger: Record<string, unknown>): Record<string, unknown> {
    // Basic Swagger 2.0 → OpenAPI 3.1 conversion
    // Handles common cases; complex features (body params, formData) are approximated
    const info = swagger.info as Record<string, unknown>;
    const basePath = (swagger.basePath as string) ?? '/';
    const host = (swagger.host as string) ?? 'localhost';
    const schemes = (swagger.schemes as string[]) ?? ['https'];
    const serverUrl = `${schemes[0]}://${host}${basePath}`;

    const convertSchema = (schema: Record<string, unknown>): Record<string, unknown> => {
      if (!schema) return schema;
      const out = { ...schema };
      // In OpenAPI 3.1, nullable is replaced by type array
      if (out.nullable === true) {
        const existingType = out.type;
        if (typeof existingType === 'string') {
          out.type = [existingType, 'null'];
        }
        delete out.nullable;
      }
      return out;
    };

    const convertPaths = (paths: Record<string, unknown>): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      for (const [path, pathItem] of Object.entries(paths)) {
        const pi = pathItem as Record<string, unknown>;
        const newPi: Record<string, unknown> = {};
        const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
        for (const method of methods) {
          const op = pi[method] as Record<string, unknown> | undefined;
          if (!op) continue;
          const params = ((op.parameters ?? []) as Record<string, unknown>[]).filter((p) => p.in !== 'body');
          const bodyParam = ((op.parameters ?? []) as Record<string, unknown>[]).find((p) => p.in === 'body');
          const newOp: Record<string, unknown> = {
            ...op,
            parameters: params,
          };
          if (bodyParam?.schema) {
            newOp.requestBody = {
              required: true,
              content: { 'application/json': { schema: convertSchema(bodyParam.schema as Record<string, unknown>) } },
            };
          }
          // Convert responses
          const responses = op.responses as Record<string, Record<string, unknown>> | undefined;
          if (responses) {
            const newResponses: Record<string, unknown> = {};
            for (const [code, resp] of Object.entries(responses)) {
              const newResp: Record<string, unknown> = { description: resp.description ?? 'Response' };
              if (resp.schema) {
                newResp.content = { 'application/json': { schema: convertSchema(resp.schema as Record<string, unknown>) } };
              }
              newResponses[code] = newResp;
            }
            newOp.responses = newResponses;
          }
          delete newOp.produces;
          delete newOp.consumes;
          newPi[method] = newOp;
        }
        out[path] = newPi;
      }
      return out;
    };

    const definitions = swagger.definitions as Record<string, unknown> | undefined;
    const schemas: Record<string, unknown> = {};
    if (definitions) {
      for (const [name, def] of Object.entries(definitions)) {
        schemas[name] = convertSchema(def as Record<string, unknown>);
      }
    }

    return {
      openapi: '3.1.0',
      info,
      servers: [{ url: serverUrl }],
      paths: convertPaths((swagger.paths ?? {}) as Record<string, unknown>),
      ...(Object.keys(schemas).length > 0 && { components: { schemas } }),
    };
  }
}
