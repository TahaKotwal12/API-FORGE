use forge_ir::Api;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub severity: Severity,
    pub code: String,
    pub message: String,
    pub path: Option<String>,
}

pub struct LintResult {
    pub diagnostics: Vec<Diagnostic>,
}

impl LintResult {
    pub fn has_errors(&self) -> bool {
        self.diagnostics.iter().any(|d| d.severity == Severity::Error)
    }
}

pub fn lint(api: &Api) -> LintResult {
    let mut diagnostics = Vec::new();

    if api.info.title.is_empty() {
        diagnostics.push(Diagnostic {
            severity: Severity::Warning,
            code: "L001".into(),
            message: "API title is empty".into(),
            path: Some("/info/title".into()),
        });
    }

    for op in &api.operations {
        if op.id.is_empty() {
            diagnostics.push(Diagnostic {
                severity: Severity::Warning,
                code: "L002".into(),
                message: format!("Operation {} {} has no operationId", op.method.as_str(), op.path),
                path: Some(op.path.clone()),
            });
        }
        if op.summary.is_none() && op.description.is_none() {
            diagnostics.push(Diagnostic {
                severity: Severity::Info,
                code: "L003".into(),
                message: format!("Operation '{}' has no summary or description", op.id),
                path: Some(op.path.clone()),
            });
        }
        // Require at least one 2xx response defined
        let has_success = op.responses.keys().any(|k| k.starts_with('2') || k == "default");
        if !has_success {
            diagnostics.push(Diagnostic {
                severity: Severity::Warning,
                code: "L004".into(),
                message: format!("Operation '{}' has no 2xx or default response", op.id),
                path: Some(op.path.clone()),
            });
        }
    }

    for (name, _schema) in &api.schemas {
        if name.is_empty() {
            diagnostics.push(Diagnostic {
                severity: Severity::Error,
                code: "L010".into(),
                message: "Schema has an empty name".into(),
                path: Some("/components/schemas".into()),
            });
        }
    }

    LintResult { diagnostics }
}
