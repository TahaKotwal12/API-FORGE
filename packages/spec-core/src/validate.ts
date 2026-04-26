export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

function err(path: string, message: string, code: string): ValidationError {
  return { path, message, code };
}

// Validates the structural integrity of an OpenAPI 3.x document.
// Returns structured errors rather than throwing.
export function validateSpec(doc: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return { valid: false, errors: [err('', 'Document must be a non-null object', 'INVALID_TYPE')] };
  }

  const d = doc as Record<string, unknown>;

  // openapi field
  if (typeof d.openapi !== 'string') {
    errors.push(err('openapi', 'Must be a string (e.g. "3.1.0")', 'MISSING_FIELD'));
  } else if (!/^3\.[01]\./.test(d.openapi)) {
    errors.push(err('openapi', `Unsupported OpenAPI version: ${d.openapi}. Must be 3.0.x or 3.1.x`, 'UNSUPPORTED_VERSION'));
  }

  // info
  if (typeof d.info !== 'object' || d.info === null) {
    errors.push(err('info', 'info object is required', 'MISSING_FIELD'));
  } else {
    const info = d.info as Record<string, unknown>;
    if (typeof info.title !== 'string' || info.title.trim() === '') {
      errors.push(err('info.title', 'info.title is required', 'MISSING_FIELD'));
    }
    if (typeof info.version !== 'string') {
      errors.push(err('info.version', 'info.version is required', 'MISSING_FIELD'));
    }
  }

  // paths (optional, but if present must be an object)
  if (d.paths !== undefined) {
    if (typeof d.paths !== 'object' || Array.isArray(d.paths)) {
      errors.push(err('paths', 'paths must be an object', 'INVALID_TYPE'));
    } else {
      validatePaths(d.paths as Record<string, unknown>, errors);
    }
  }

  // components (optional)
  if (d.components !== undefined) {
    if (typeof d.components !== 'object' || Array.isArray(d.components)) {
      errors.push(err('components', 'components must be an object', 'INVALID_TYPE'));
    }
  }

  return { valid: errors.length === 0, errors };
}

function validatePaths(paths: Record<string, unknown>, errors: ValidationError[]): void {
  const seenOperationIds = new Set<string>();

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!path.startsWith('/')) {
      errors.push(err(`paths.${path}`, 'Path must start with /', 'INVALID_PATH'));
    }

    if (typeof pathItem !== 'object' || pathItem === null) {
      errors.push(err(`paths.${path}`, 'Path item must be an object', 'INVALID_TYPE'));
      continue;
    }

    const item = pathItem as Record<string, unknown>;
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

    for (const method of methods) {
      const op = item[method];
      if (!op) continue;

      if (typeof op !== 'object' || Array.isArray(op)) {
        errors.push(err(`paths.${path}.${method}`, 'Operation must be an object', 'INVALID_TYPE'));
        continue;
      }

      validateOperation(path, method, op as Record<string, unknown>, seenOperationIds, errors);
    }
  }
}

function validateOperation(
  path: string,
  method: string,
  op: Record<string, unknown>,
  seenOperationIds: Set<string>,
  errors: ValidationError[],
): void {
  const prefix = `paths.${path}.${method}`;

  // operationId must be unique
  if (typeof op.operationId === 'string') {
    if (seenOperationIds.has(op.operationId)) {
      errors.push(err(`${prefix}.operationId`, `operationId "${op.operationId}" is not unique`, 'DUPLICATE_OPERATION_ID'));
    }
    seenOperationIds.add(op.operationId);
  }

  // responses is required and must be an object
  if (typeof op.responses !== 'object' || op.responses === null || Array.isArray(op.responses)) {
    errors.push(err(`${prefix}.responses`, 'responses is required and must be an object', 'MISSING_FIELD'));
  } else {
    const responses = op.responses as Record<string, unknown>;
    if (Object.keys(responses).length === 0) {
      errors.push(err(`${prefix}.responses`, 'responses must define at least one response', 'EMPTY_RESPONSES'));
    }
    for (const [code, resp] of Object.entries(responses)) {
      if (!/^\d{3}$/.test(code) && code !== 'default') {
        errors.push(err(`${prefix}.responses.${code}`, 'Response key must be a 3-digit HTTP status code or "default"', 'INVALID_STATUS_CODE'));
      }
      if (resp && typeof resp === 'object' && !('$ref' in resp)) {
        const r = resp as Record<string, unknown>;
        if (typeof r.description !== 'string') {
          errors.push(err(`${prefix}.responses.${code}`, 'Response description is required', 'MISSING_FIELD'));
        }
      }
    }
  }

  // parameters must be an array
  if (op.parameters !== undefined) {
    if (!Array.isArray(op.parameters)) {
      errors.push(err(`${prefix}.parameters`, 'parameters must be an array', 'INVALID_TYPE'));
    }
  }
}
