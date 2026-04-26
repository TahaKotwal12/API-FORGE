import { truthy, pattern, undefined as spectralUndefined, length } from '@stoplight/spectral-functions';
import type { RulesetDefinition } from '@stoplight/spectral-core';

// APIForge recommended ruleset.
// Applied on top of the Spectral OAS recommended ruleset.
export const recommended: RulesetDefinition = {
  rules: {
    // operationId is required on every operation
    'apiforge-operation-operationId': {
      description: 'Operations must have an operationId',
      message: '{{description}} — missing on {{path}}',
      severity: 'warn',
      given: '$.paths[*][get,post,put,patch,delete,head,options]',
      then: { field: 'operationId', function: truthy },
    },

    // operationId must be unique (checked via pattern uniqueness)
    'apiforge-operation-operationId-pattern': {
      description: 'operationId should be camelCase',
      message: 'operationId "{{value}}" should be camelCase',
      severity: 'hint',
      given: '$.paths[*][get,post,put,patch,delete,head,options].operationId',
      then: { function: pattern, functionOptions: { match: '^[a-z][a-zA-Z0-9]*$' } },
    },

    // Tags required
    'apiforge-operation-tags': {
      description: 'Operations must have at least one tag',
      message: '{{description}}',
      severity: 'warn',
      given: '$.paths[*][get,post,put,patch,delete,head,options]',
      then: { field: 'tags', function: truthy },
    },

    // Description required
    'apiforge-operation-description': {
      description: 'Operations should have a description',
      message: '{{description}}',
      severity: 'hint',
      given: '$.paths[*][get,post,put,patch,delete,head,options]',
      then: { field: 'description', function: truthy },
    },

    // Path params must be defined in parameters
    'apiforge-path-params-defined': {
      description: 'Path parameters must be defined in the parameters list',
      message: '{{description}}',
      severity: 'error',
      given: '$.paths',
      then: {
        function: (paths: unknown) => {
          if (!paths || typeof paths !== 'object') return;
          const results: Array<{ message: string; path: string[] }> = [];
          for (const [path, pathItem] of Object.entries(paths as Record<string, unknown>)) {
            const paramNames = ((pathItem as Record<string, unknown>).parameters as Array<{ in: string; name: string }> | undefined)?.filter((p) => p.in === 'path').map((p) => p.name) ?? [];
            const pathParams = (path.match(/\{([^}]+)\}/g) ?? []).map((p) => p.slice(1, -1));
            for (const pp of pathParams) {
              if (!paramNames.includes(pp)) {
                // Check operation-level params too
                const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
                const item = pathItem as Record<string, unknown>;
                const foundInOp = methods.some((m) => {
                  const op = item[m] as Record<string, unknown> | undefined;
                  return (op?.parameters as Array<{ in: string; name: string }> | undefined)
                    ?.some((p) => p.in === 'path' && p.name === pp);
                });
                if (!foundInOp) {
                  results.push({ message: `Path param {${pp}} in "${path}" not defined in parameters`, path: [path] });
                }
              }
            }
          }
          return results.length > 0 ? results : undefined;
        },
      },
    },

    // camelCase for schema property names
    'apiforge-schema-properties-camelCase': {
      description: 'Schema property names should be camelCase',
      message: 'Property "{{property}}" should be camelCase',
      severity: 'warn',
      given: '$.components.schemas[*].properties',
      then: {
        function: pattern,
        functionOptions: { notMatch: '^[A-Z]|[_-]' },
      },
    },

    // 4xx responses must have a schema
    'apiforge-4xx-must-have-schema': {
      description: '4xx responses should have a response schema',
      message: '4xx response at {{path}} should define a content schema',
      severity: 'warn',
      given: '$.paths[*][get,post,put,patch,delete][responses][4*]',
      then: { field: 'content', function: truthy },
    },

    // Summary required (shorter form than description)
    'apiforge-operation-summary': {
      description: 'Operations should have a summary',
      message: '{{description}}',
      severity: 'hint',
      given: '$.paths[*][get,post,put,patch,delete,head,options]',
      then: { field: 'summary', function: truthy },
    },

    // No empty tags array
    'apiforge-operation-tags-not-empty': {
      description: 'Operations must have at least one non-empty tag',
      message: 'tags array must not be empty',
      severity: 'warn',
      given: '$.paths[*][get,post,put,patch,delete,head,options].tags',
      then: { function: length, functionOptions: { min: 1 } },
    },

    // Security must be defined at operation or global level
    'apiforge-security-defined': {
      description: 'Every operation should define security or inherit global security',
      message: '{{description}}',
      severity: 'hint',
      given: '$.paths[*][get,post,put,patch,delete]',
      then: {
        function: (op: unknown, _opts: unknown, ctx: { document: { data: unknown } }) => {
          const operation = op as Record<string, unknown>;
          const doc = ctx.document.data as Record<string, unknown>;
          if (operation.security !== undefined) return;
          if ((doc.security as unknown[] | undefined)?.length) return;
          return [{ message: 'No security defined at operation or global level' }];
        },
      },
    },

    // No inline enums with > 20 values
    'apiforge-no-large-inline-enums': {
      description: 'Inline enums with more than 20 values should be extracted to a $ref',
      message: 'Enum at {{path}} has {{value.length}} values — consider extracting to a reusable schema',
      severity: 'warn',
      given: '$.paths[*][*]..[?(@.enum)]',
      then: {
        function: (schema: unknown) => {
          const s = schema as Record<string, unknown>;
          const enumValues = s.enum as unknown[] | undefined;
          if (enumValues && enumValues.length > 20) {
            return [{ message: `Enum has ${enumValues.length} values — extract to a reusable schema` }];
          }
          return undefined;
        },
      },
    },

    // No $ref siblings (not valid in JSON Schema Draft 4/OpenAPI 3.0; warn in 3.1)
    'apiforge-no-ref-siblings': {
      description: 'Avoid placing sibling properties alongside $ref in OpenAPI 3.0',
      message: 'Sibling properties alongside $ref may be ignored by some parsers: {{path}}',
      severity: 'hint',
      given: '$..[?(@.$ref)]',
      then: {
        function: (obj: unknown) => {
          const o = obj as Record<string, unknown>;
          const keys = Object.keys(o).filter((k) => k !== '$ref' && k !== 'summary' && k !== 'description');
          if (keys.length > 0) {
            return [{ message: `Sibling keys alongside $ref: ${keys.join(', ')}` }];
          }
          return undefined;
        },
      },
    },

    // Examples must be present for documented properties
    'apiforge-examples-provided': {
      description: 'Schema properties should have examples',
      message: 'Consider adding an example to {{path}}',
      severity: 'hint',
      given: '$.components.schemas[*]',
      then: { field: 'example', function: spectralUndefined },
    },
  },
};
