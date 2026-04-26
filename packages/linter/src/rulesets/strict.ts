import { truthy, pattern, length } from '@stoplight/spectral-functions';
import type { RulesetDefinition } from '@stoplight/spectral-core';
import { recommended } from './recommended';

// APIForge strict ruleset — extends recommended with additional rules.
export const strict: RulesetDefinition = {
  extends: [[recommended, 'all']],
  rules: {
    // Info fields
    'apiforge-strict-info-contact': {
      description: 'API info should include contact details',
      message: '{{description}}',
      severity: 'warn',
      given: '$.info',
      then: { field: 'contact', function: truthy },
    },

    'apiforge-strict-info-license': {
      description: 'API info should include license information',
      message: '{{description}}',
      severity: 'warn',
      given: '$.info',
      then: { field: 'license', function: truthy },
    },

    // Every schema must have a description
    'apiforge-strict-schema-description': {
      description: 'Schema components should have descriptions',
      message: '{{description}} — missing on {{path}}',
      severity: 'warn',
      given: '$.components.schemas[*]',
      then: { field: 'description', function: truthy },
    },

    // Every property must have a type
    'apiforge-strict-property-type': {
      description: 'Schema properties should have explicit types',
      message: 'Property at {{path}} is missing a type',
      severity: 'warn',
      given: '$.components.schemas[*].properties[*]',
      then: { field: 'type', function: truthy },
    },

    // Path params must be required: true
    'apiforge-strict-path-param-required': {
      description: 'Path parameters must have required: true',
      message: 'Path parameter at {{path}} must have required: true',
      severity: 'error',
      given: '$.paths[*].parameters[?(@.in === "path")]',
      then: {
        function: (param: unknown) => {
          const p = param as Record<string, unknown>;
          if (p.required !== true) {
            return [{ message: `Path parameter "${p.name as string}" must have required: true` }];
          }
          return undefined;
        },
      },
    },

    // Response descriptions must be meaningful (not just "ok")
    'apiforge-strict-response-description': {
      description: 'Response descriptions should be meaningful',
      message: 'Response description at {{path}} is too short',
      severity: 'hint',
      given: '$.paths[*][*].responses[*]',
      then: {
        field: 'description',
        function: length,
        functionOptions: { min: 3 },
      },
    },

    // Tags must have descriptions
    'apiforge-strict-tag-description': {
      description: 'Tags defined in the top-level tags array should have descriptions',
      message: '{{description}} — missing on {{path}}',
      severity: 'hint',
      given: '$.tags[*]',
      then: { field: 'description', function: truthy },
    },

    // Servers must be defined
    'apiforge-strict-servers-defined': {
      description: 'At least one server should be defined',
      message: '{{description}}',
      severity: 'warn',
      given: '$',
      then: { field: 'servers', function: truthy },
    },

    // operationId must follow a verb-noun pattern
    'apiforge-strict-operationId-format': {
      description: 'operationId should follow verbNoun camelCase pattern',
      message: 'operationId "{{value}}" should follow verbNoun pattern (e.g. getUser, createOrder)',
      severity: 'hint',
      given: '$.paths[*][get,post,put,patch,delete,head,options].operationId',
      then: {
        function: pattern,
        functionOptions: {
          match: '^(get|list|create|update|delete|patch|search|check|send|validate|generate|run|trigger|export|import|start|stop|cancel|approve|reject|enable|disable)[A-Z][a-zA-Z0-9]*$',
        },
      },
    },

    // No x- extensions in responses (clutters the spec)
    'apiforge-strict-no-extensions-in-response': {
      description: 'Avoid x- extensions directly in response objects',
      message: 'Extension {{property}} in response at {{path}} — prefer extensions in operation level',
      severity: 'hint',
      given: '$.paths[*][*].responses[*]',
      then: {
        function: (resp: unknown) => {
          const r = resp as Record<string, unknown>;
          const exts = Object.keys(r).filter((k) => k.startsWith('x-'));
          if (exts.length > 0) {
            return exts.map((ext) => ({ message: `Extension ${ext} in response` }));
          }
          return undefined;
        },
      },
    },

    // All request bodies should have a description
    'apiforge-strict-requestBody-description': {
      description: 'Request bodies should have a description',
      message: '{{description}}',
      severity: 'hint',
      given: '$.paths[*][*].requestBody',
      then: { field: 'description', function: truthy },
    },

    // Require 2xx, 4xx, and 5xx response codes
    'apiforge-strict-response-codes': {
      description: 'Operations should define 2xx, 4xx, and 5xx response codes',
      message: 'Operation at {{path}} should define 2xx, 4xx, and 5xx responses',
      severity: 'hint',
      given: '$.paths[*][get,post,put,patch,delete]',
      then: {
        function: (op: unknown) => {
          const operation = op as Record<string, unknown>;
          const responses = operation.responses as Record<string, unknown> | undefined;
          if (!responses) return [{ message: 'No responses defined' }];
          const codes = Object.keys(responses);
          const has2xx = codes.some((c) => c.startsWith('2') || c === 'default');
          const has4xx = codes.some((c) => c.startsWith('4'));
          const has5xx = codes.some((c) => c.startsWith('5'));
          const missing: string[] = [];
          if (!has2xx) missing.push('2xx');
          if (!has4xx) missing.push('4xx');
          if (!has5xx) missing.push('5xx');
          if (missing.length > 0) {
            return [{ message: `Missing response codes: ${missing.join(', ')}` }];
          }
          return undefined;
        },
      },
    },

    // Enum values should be SCREAMING_SNAKE_CASE or lowercase — not mixed case
    'apiforge-strict-enum-values': {
      description: 'Enum values should follow consistent casing',
      message: 'Enum at {{path}} has inconsistently-cased values',
      severity: 'hint',
      given: '$..enum',
      then: {
        function: (values: unknown) => {
          if (!Array.isArray(values)) return;
          const strings = (values as unknown[]).filter((v): v is string => typeof v === 'string');
          if (strings.length === 0) return;
          const allLower = strings.every((s) => s === s.toLowerCase());
          const allUpper = strings.every((s) => s === s.toUpperCase());
          const allCamel = strings.every((s) => /^[a-z][a-zA-Z0-9]*$/.test(s));
          if (!allLower && !allUpper && !allCamel) {
            return [{ message: 'Enum values should consistently use lowercase, SCREAMING_SNAKE_CASE, or camelCase' }];
          }
          return undefined;
        },
      },
    },

    // Schemas must not have both allOf and anyOf
    'apiforge-strict-no-mixed-composition': {
      description: 'Avoid mixing allOf and anyOf in the same schema',
      message: 'Schema at {{path}} uses both allOf and anyOf — prefer one or the other',
      severity: 'hint',
      given: '$.components.schemas[*]',
      then: {
        function: (schema: unknown) => {
          const s = schema as Record<string, unknown>;
          if (s.allOf && s.anyOf) {
            return [{ message: 'Schema mixes allOf and anyOf' }];
          }
          return undefined;
        },
      },
    },

    // Must include a version in info
    'apiforge-strict-semver-version': {
      description: 'API version should follow semver format',
      message: 'info.version "{{value}}" should follow semver (e.g. 1.0.0)',
      severity: 'warn',
      given: '$.info.version',
      then: {
        function: pattern,
        functionOptions: { match: '^\\d+\\.\\d+(\\.\\d+)?$' },
      },
    },
  },
};
