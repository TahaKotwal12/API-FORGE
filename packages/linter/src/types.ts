export type IssueSeverity = 'error' | 'warn' | 'info' | 'hint';

export interface LintIssue {
  code: string;
  message: string;
  severity: IssueSeverity;
  path: string[];
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface LintResult {
  issues: LintIssue[];
  errorCount: number;
  warnCount: number;
  passed: boolean;
}

export type RulesetName = 'recommended' | 'strict';
