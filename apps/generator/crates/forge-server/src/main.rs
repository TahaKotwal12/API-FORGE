use anyhow::Result;
use axum::{extract::State, http::StatusCode, response::IntoResponse, routing::{get, post}, Json, Router};
use forge_bundler::{spec_hash, Bundle};
use forge_linter::lint;
use forge_parser::parse;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{net::SocketAddr, sync::Arc};
use tokio::net::TcpListener;
use tracing::{info, warn};

mod grpc;

// ─── HTTP API ─────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct GenerateReq {
    spec: String,
    language: String,
    #[serde(default = "default_mode")]
    mode: String,
    package_name: Option<String>,
    package_version: Option<String>,
    #[serde(default)]
    options: std::collections::HashMap<String, String>,
}

fn default_mode() -> String { "sdk".into() }

#[derive(Serialize)]
struct GenerateResp {
    language: String,
    mode: String,
    spec_hash: String,
    bundle_base64: String,
    diagnostics: Vec<DiagnosticDto>,
}

#[derive(Serialize)]
struct DiagnosticDto {
    severity: String,
    code: String,
    message: String,
    path: Option<String>,
}

#[derive(Serialize)]
struct ValidateResp {
    diagnostics: Vec<DiagnosticDto>,
}

#[derive(Serialize)]
struct HealthResp { status: &'static str }

#[derive(Clone)]
struct AppState;

async fn health() -> Json<HealthResp> {
    Json(HealthResp { status: "ok" })
}

async fn languages() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "languages": [
            { "id": "typescript", "name": "TypeScript", "modes": ["dto-only", "sdk", "server", "hooks"] },
            { "id": "java",       "name": "Java",       "modes": ["dto-only", "sdk", "server"] },
            { "id": "python",     "name": "Python",     "modes": ["dto-only", "sdk", "server"] },
            { "id": "go",         "name": "Go",         "modes": ["dto-only", "sdk", "server"] },
            { "id": "rust",       "name": "Rust",       "modes": ["dto-only", "sdk", "server"] },
        ]
    }))
}

async fn validate(Json(req): Json<serde_json::Value>) -> impl IntoResponse {
    let spec = match req.get("spec").and_then(|s| s.as_str()) {
        Some(s) => s.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "spec required" }))).into_response(),
    };
    let api = match parse(&spec) {
        Ok(a) => a,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": e.to_string() }))).into_response(),
    };
    let result = lint(&api);
    let diagnostics: Vec<DiagnosticDto> = result.diagnostics.into_iter().map(|d| DiagnosticDto {
        severity: format!("{:?}", d.severity).to_lowercase(),
        code: d.code,
        message: d.message,
        path: d.path,
    }).collect();
    Json(serde_json::json!({ "diagnostics": diagnostics })).into_response()
}

async fn generate(Json(req): Json<GenerateReq>) -> impl IntoResponse {
    let hash = spec_hash(&req.spec);

    let api = match parse(&req.spec) {
        Ok(a) => a,
        Err(e) => {
            warn!("parse error: {}", e);
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": e.to_string() }))).into_response();
        }
    };

    let lint_result = lint(&api);
    let diagnostics: Vec<DiagnosticDto> = lint_result.diagnostics.iter().map(|d| DiagnosticDto {
        severity: format!("{:?}", d.severity).to_lowercase(),
        code: d.code.clone(),
        message: d.message.clone(),
        path: d.path.clone(),
    }).collect();

    let opts = forge_ir::EmitOptions {
        mode: match req.mode.as_str() {
            "dto-only" => forge_ir::GeneratorMode::DtoOnly,
            "server"   => forge_ir::GeneratorMode::Server,
            "hooks"    => forge_ir::GeneratorMode::Hooks,
            _          => forge_ir::GeneratorMode::Sdk,
        },
        package_name: req.package_name,
        package_version: req.package_version,
        extra: req.options.into_iter().collect(),
    };

    let files = match req.language.as_str() {
        "typescript" | "ts" => emitter_typescript::emit(&api, &opts),
        "java"              => emitter_java::emit(&api, &opts),
        "python" | "py"     => emitter_python::emit(&api, &opts),
        "go"                => emitter_go::emit(&api, &opts),
        "rust" | "rs"       => emitter_rust::emit(&api, &opts),
        lang => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": format!("unsupported language: {}", lang) }))).into_response();
        }
    };

    let files = match files {
        Ok(f) => f,
        Err(e) => {
            warn!("emit error: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))).into_response();
        }
    };

    let bundle = Bundle::new(files, &hash, &req.language, &req.mode);
    let zip_bytes = match bundle.to_zip() {
        Ok(z) => z,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))).into_response(),
    };

    let bundle_base64 = base64_encode(&zip_bytes);
    info!("generated {} {} bundle ({} bytes zipped)", req.language, req.mode, zip_bytes.len());

    Json(GenerateResp {
        language: req.language,
        mode: req.mode,
        spec_hash: hash,
        bundle_base64,
        diagnostics,
    }).into_response()
}

fn base64_encode(data: &[u8]) -> String {
    use std::fmt::Write as _;
    let mut out = String::with_capacity((data.len() * 4).div_ceil(3) + 4);
    let chars = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut i = 0;
    while i + 2 < data.len() {
        let b0 = data[i] as usize; let b1 = data[i+1] as usize; let b2 = data[i+2] as usize;
        out.push(chars[b0 >> 2] as char);
        out.push(chars[((b0 & 3) << 4) | (b1 >> 4)] as char);
        out.push(chars[((b1 & 0xf) << 2) | (b2 >> 6)] as char);
        out.push(chars[b2 & 0x3f] as char);
        i += 3;
    }
    let rem = data.len() - i;
    if rem == 1 {
        let b0 = data[i] as usize;
        out.push(chars[b0 >> 2] as char);
        out.push(chars[(b0 & 3) << 4] as char);
        out.push('='); out.push('=');
    } else if rem == 2 {
        let b0 = data[i] as usize; let b1 = data[i+1] as usize;
        out.push(chars[b0 >> 2] as char);
        out.push(chars[((b0 & 3) << 4) | (b1 >> 4)] as char);
        out.push(chars[(b1 & 0xf) << 2] as char);
        out.push('=');
    }
    out
}

// ─── Main ─────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(7070);

    let app = Router::new()
        .route("/healthz",   get(health))
        .route("/version",   get(|| async { Json(serde_json::json!({ "version": env!("CARGO_PKG_VERSION") })) }))
        .route("/languages", get(languages))
        .route("/validate",  post(validate))
        .route("/generate",  post(generate));

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("forge-server listening on {}", addr);
    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
