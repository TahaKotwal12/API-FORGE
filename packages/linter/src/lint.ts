import { Spectral, Document } from '@stoplight/spectral-core';
import { Json as JsonParser } from '@stoplight/spectral-parsers';
import * as yaml from 'js-yaml';
import type { LintResult, LintIssue, IssueSeverity, RulesetName } from './types';
import { recommended } from './rulesets/recommended';
import { strict } from './rulesets/strict';
import type { RulesetDefinition } from '@stoplight/spectral-core';

function severityFromNumber(n: 0 | 1 | 2 | 3): IssueSeverity {
  switch (n) {
    case 0: return 'error';
    case 1: return 'warn';
    case 2: return 'info';
    case 3: return 'hint';
  }
}

function getRuleset(name: RulesetName): RulesetDefinition {
  switch (name) {
    case 'strict': return strict;
    default: return recommended;
  }
}

// Lint an OpenAPI document (object, JSON string, or YAML string).
// Returns structured issues, never throws.
export async function lint(
  doc: unknown,
  options: { ruleset?: RulesetName; source?: string } = {},
): Promise<LintResult> {
  try {
    let content: string;
    let parsed: unknown;

    if (typeof doc === 'string') {
      content = doc;
      try {
        parsed = JSON.parse(doc);
      } catch {
        parsed = yaml.load(doc);
        // If still string, it's invalid
        if (typeof parsed === 'string') {
          return { issues: [{ code: 'PARSE_ERROR', message: 'Document is not valid JSON or YAML', severity: 'error', path: [] }], errorCount: 1, warnCount: 0, passed: false };
        }
      }
    } else {
      content = JSON.stringify(doc, null, 2);
      parsed = doc;
    }

    void parsed; // used for validation pass-through; Spectral parses from string

    const spectral = new Spectral();
    const rulesetDef = getRuleset(options.ruleset ?? 'recommended');
    spectral.setRuleset(rulesetDef);

    const spectralDoc = new Document(
      content,
      JsonParser,
      options.source ?? 'spec.json',
    );

    const rawResults = await spectral.run(spectralDoc);

    const issues: LintIssue[] = rawResults.map((r) => ({
      code: String(r.code),
      message: r.message,
      severity: severityFromNumber(r.severity as 0 | 1 | 2 | 3),
      path: r.path.map(String),
      range: r.range,
    }));

    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warnCount = issues.filter((i) => i.severity === 'warn').length;

    return { issues, errorCount, warnCount, passed: errorCount === 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      issues: [{ code: 'LINT_ERROR', message: `Lint failed: ${message}`, severity: 'error', path: [] }],
      errorCount: 1,
      warnCount: 0,
      passed: false,
    };
  }
}

// Parse YAML or JSON string to object
export function parseSpec(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return yaml.load(input);
  }
}
