use anyhow::Result;
use forge_bundler::GeneratedFile;
use forge_ir::*;
use forge_templates::TemplateEngine;
use heck::{ToPascalCase, ToSnakeCase};
use indexmap::IndexMap;
use serde::Serialize;

const T_CARGO: &str    = include_str!("../../../templates/rust/Cargo.toml.tera");
const T_LIB: &str      = include_str!("../../../templates/rust/src/lib.rs.tera");
const T_CLIENT: &str   = include_str!("../../../templates/rust/src/client.rs.tera");
const T_ERROR: &str    = include_str!("../../../templates/rust/src/error.rs.tera");
const T_MODEL: &str    = include_str!("../../../templates/rust/src/models/_model.rs.tera");
const T_MOD: &str      = include_str!("../../../templates/rust/src/models/mod.rs.tera");
const T_API: &str      = include_str!("../../../templates/rust/src/apis/_api.rs.tera");
const T_API_MOD: &str  = include_str!("../../../templates/rust/src/apis/mod.rs.tera");
const T_SMOKE: &str    = include_str!("../../../templates/rust/tests/smoke.rs.tera");

#[derive(Serialize)]
struct RustModelCtx {
    name: String,
    description: Option<String>,
    kind: String,
    fields: Vec<RustFieldCtx>,
    enum_variants: Vec<RustEnumVariantCtx>,
}

#[derive(Serialize)]
struct RustFieldCtx {
    name: String,
    rust_type: String,
    serde_rename: Option<String>,
    description: Option<String>,
    optional: bool,
}

#[derive(Serialize)]
struct RustEnumVariantCtx {
    name: String,
    value: String,
}

#[derive(Serialize)]
struct RustApiCtx {
    mod_name: String,
    struct_name: String,
    crate_name: String,
    operations: Vec<RustOpCtx>,
}

#[derive(Serialize)]
struct RustOpCtx {
    fn_name: String,
    http_method: String,
    path: String,
    return_type: String,
    path_params: Vec<RustParamCtx>,
    query_params: Vec<RustParamCtx>,
    has_body: bool,
    body_type: Option<String>,
    summary: Option<String>,
}

#[derive(Serialize)]
struct RustParamCtx {
    name: String,
    rust_type: String,
}

fn ir_to_rust(td: &TypeDef) -> String {
    match td {
        TypeDef::Primitive(p) => match p {
            Primitive::String => "String".into(),
            Primitive::Date | Primitive::DateTime => "chrono::DateTime<chrono::Utc>".into(),
            Primitive::Integer => "i64".into(),
            Primitive::Float => "f64".into(),
            Primitive::Bool => "bool".into(),
            Primitive::Uuid => "uuid::Uuid".into(),
            Primitive::Binary => "Vec<u8>".into(),
        },
        TypeDef::Array(a) => format!("Vec<{}>", ir_to_rust(&a.items)),
        TypeDef::Map(m) => format!("std::collections::HashMap<String, {}>", ir_to_rust(&m.value)),
        TypeDef::Nullable(n) => format!("Option<{}>", ir_to_rust(&n.inner)),
        TypeDef::Ref(r) => format!("crate::models::{}", r.name.to_pascal_case()),
        TypeDef::Object(o) => if o.name.is_empty() { "serde_json::Value".into() } else { format!("crate::models::{}", o.name.to_pascal_case()) },
        TypeDef::Enum(e) => format!("crate::models::{}", e.name.to_pascal_case()),
        TypeDef::OneOf(_) | TypeDef::AllOf(_) | TypeDef::Unknown => "serde_json::Value".into(),
    }
}

fn success_rust_type(op: &Operation) -> String {
    for code in &["200", "201", "202"] {
        if let Some(resp) = op.responses.get(*code) {
            if let Some(s) = &resp.schema { return ir_to_rust(s); }
        }
    }
    "()".into()
}

pub fn emit(api: &Api, opts: &EmitOptions) -> Result<Vec<GeneratedFile>> {
    let engine = TemplateEngine::from_strings(&[
        ("Cargo.toml.tera", T_CARGO),
        ("lib.rs.tera", T_LIB),
        ("client.rs.tera", T_CLIENT),
        ("error.rs.tera", T_ERROR),
        ("model.rs.tera", T_MODEL),
        ("models_mod.rs.tera", T_MOD),
        ("api.rs.tera", T_API),
        ("apis_mod.rs.tera", T_API_MOD),
        ("smoke.rs.tera", T_SMOKE),
    ])?;

    let crate_name = opts.package_name.clone().unwrap_or_else(|| {
        api.info.title.to_snake_case().replace(' ', "-")
    });
    let version = opts.package_version.clone().unwrap_or_else(|| api.info.version.clone());

    let mut files: Vec<GeneratedFile> = Vec::new();
    files.push(GeneratedFile { path: "Cargo.toml".into(), content: engine.render("Cargo.toml.tera", &serde_json::json!({ "name": crate_name, "version": version }))?, exec_bit: false });
    files.push(GeneratedFile { path: "src/lib.rs".into(), content: engine.render("lib.rs.tera", &serde_json::json!({}))?, exec_bit: false });
    files.push(GeneratedFile { path: "src/client.rs".into(), content: engine.render("client.rs.tera", &serde_json::json!({}))?, exec_bit: false });
    files.push(GeneratedFile { path: "src/error.rs".into(), content: engine.render("error.rs.tera", &serde_json::json!({}))?, exec_bit: false });

    let mut model_names: Vec<String> = Vec::new();
    for (name, td) in &api.schemas {
        let ctx = build_rust_model(name, td);
        let mod_name = name.to_snake_case();
        let content = engine.render("model.rs.tera", &serde_json::json!({ "model": ctx }))?;
        files.push(GeneratedFile { path: format!("src/models/{}.rs", mod_name), content, exec_bit: false });
        model_names.push(mod_name);
    }
    files.push(GeneratedFile {
        path: "src/models/mod.rs".into(),
        content: engine.render("models_mod.rs.tera", &serde_json::json!({ "models": model_names }))?,
        exec_bit: false,
    });

    let mut tag_ops: IndexMap<String, Vec<&Operation>> = IndexMap::new();
    for op in &api.operations {
        let tag = op.tags.first().cloned().unwrap_or_else(|| "default".into());
        tag_ops.entry(tag).or_default().push(op);
    }
    let mut api_mods: Vec<String> = Vec::new();
    for (tag, ops) in &tag_ops {
        let ctx = build_rust_api(tag, ops, &crate_name);
        let mod_name = format!("{}_api", tag.to_snake_case());
        let content = engine.render("api.rs.tera", &serde_json::json!({ "api": ctx }))?;
        files.push(GeneratedFile { path: format!("src/apis/{}.rs", mod_name), content, exec_bit: false });
        api_mods.push(mod_name);
    }
    files.push(GeneratedFile {
        path: "src/apis/mod.rs".into(),
        content: engine.render("apis_mod.rs.tera", &serde_json::json!({ "apis": api_mods }))?,
        exec_bit: false,
    });
    files.push(GeneratedFile { path: "tests/smoke.rs".into(), content: engine.render("smoke.rs.tera", &serde_json::json!({ "crate_name": crate_name }))?, exec_bit: false });

    Ok(files)
}

fn build_rust_model(name: &str, td: &TypeDef) -> RustModelCtx {
    match td {
        TypeDef::Object(obj) => RustModelCtx {
            name: name.to_pascal_case(),
            description: obj.description.clone(),
            kind: "struct".into(),
            fields: obj.properties.iter().map(|p| {
                let field_name = p.name.to_snake_case();
                let serde_rename = if field_name != p.name { Some(p.name.clone()) } else { None };
                let optional = !p.required;
                let rust_type = if optional {
                    format!("Option<{}>", ir_to_rust(&p.schema))
                } else {
                    ir_to_rust(&p.schema)
                };
                RustFieldCtx {
                    name: field_name,
                    rust_type,
                    serde_rename,
                    description: p.description.clone(),
                    optional,
                }
            }).collect(),
            enum_variants: vec![],
        },
        TypeDef::Enum(e) => RustModelCtx {
            name: name.to_pascal_case(),
            description: e.description.clone(),
            kind: "enum".into(),
            fields: vec![],
            enum_variants: e.variants.iter().map(|v| RustEnumVariantCtx {
                name: v.display.to_pascal_case(),
                value: v.value.clone(),
            }).collect(),
        },
        _ => RustModelCtx {
            name: name.to_pascal_case(),
            description: None,
            kind: "alias".into(),
            fields: vec![],
            enum_variants: vec![],
        },
    }
}

fn build_rust_api(tag: &str, ops: &[&Operation], crate_name: &str) -> RustApiCtx {
    RustApiCtx {
        mod_name: format!("{}_api", tag.to_snake_case()),
        struct_name: format!("{}Api", tag.to_pascal_case()),
        crate_name: crate_name.to_string(),
        operations: ops.iter().map(|op| RustOpCtx {
            fn_name: op.id.to_snake_case(),
            http_method: op.method.as_str().to_string(),
            path: op.path.clone(),
            return_type: success_rust_type(op),
            path_params: op.path_params.iter().map(|p| RustParamCtx {
                name: p.name.to_snake_case(),
                rust_type: ir_to_rust(&p.schema),
            }).collect(),
            query_params: op.query_params.iter().map(|p| RustParamCtx {
                name: p.name.to_snake_case(),
                rust_type: ir_to_rust(&p.schema),
            }).collect(),
            has_body: op.request_body.is_some(),
            body_type: op.request_body.as_ref().map(|rb| ir_to_rust(&rb.schema)),
            summary: op.summary.clone(),
        }).collect(),
    }
}
