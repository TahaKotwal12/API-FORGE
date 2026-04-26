use anyhow::Result;
use forge_bundler::GeneratedFile;
use forge_ir::*;
use forge_templates::TemplateEngine;
use heck::{ToPascalCase, ToSnakeCase};
use indexmap::IndexMap;
use serde::Serialize;

const T_GO_MOD: &str   = include_str!("../../../templates/go/go.mod.tera");
const T_MODEL: &str    = include_str!("../../../templates/go/models/model.go.tera");
const T_API: &str      = include_str!("../../../templates/go/api.go.tera");
const T_CLIENT: &str   = include_str!("../../../templates/go/client.go.tera");
const T_ERRORS: &str   = include_str!("../../../templates/go/errors.go.tera");
const T_RUNTIME: &str  = include_str!("../../../templates/go/runtime.go.tera");
const T_SMOKE: &str    = include_str!("../../../templates/go/smoke_test.go.tera");

#[derive(Serialize)]
struct GoModelCtx {
    pkg: String,
    name: String,
    description: Option<String>,
    kind: String,
    fields: Vec<GoFieldCtx>,
    enum_values: Vec<GoEnumValueCtx>,
    enum_type: String,
}

#[derive(Serialize)]
struct GoFieldCtx {
    name: String,
    go_type: String,
    json_tag: String,
    description: Option<String>,
    optional: bool,
}

#[derive(Serialize)]
struct GoEnumValueCtx {
    const_name: String,
    type_name: String,
    value: String,
}

#[derive(Serialize)]
struct GoApiCtx {
    pkg: String,
    ops: Vec<GoOpCtx>,
}

#[derive(Serialize)]
struct GoOpCtx {
    func_name: String,
    http_method: String,
    path: String,
    path_fmt: String,
    return_type: String,
    path_params: Vec<GoParamCtx>,
    query_params: Vec<GoParamCtx>,
    has_body: bool,
    body_type: Option<String>,
    comment: Option<String>,
}

#[derive(Serialize)]
struct GoParamCtx {
    name: String,
    go_type: String,
}

fn ir_to_go(td: &TypeDef, optional: bool) -> String {
    let base = match td {
        TypeDef::Primitive(p) => match p {
            Primitive::String => "string".into(),
            Primitive::Date | Primitive::DateTime => "time.Time".into(),
            Primitive::Integer => "int64".into(),
            Primitive::Float => "float64".into(),
            Primitive::Bool => "bool".into(),
            Primitive::Uuid => "string".into(),
            Primitive::Binary => "[]byte".into(),
        },
        TypeDef::Array(a) => format!("[]{}", ir_to_go(&a.items, false)),
        TypeDef::Map(m) => format!("map[string]{}", ir_to_go(&m.value, false)),
        TypeDef::Nullable(n) => return format!("*{}", ir_to_go(&n.inner, false)),
        TypeDef::Ref(r) => r.name.to_pascal_case(),
        TypeDef::Object(o) => if o.name.is_empty() { "interface{}".into() } else { o.name.to_pascal_case() },
        TypeDef::Enum(e) => e.name.to_pascal_case(),
        TypeDef::OneOf(_) | TypeDef::AllOf(_) | TypeDef::Unknown => "interface{}".into(),
    };
    if optional { format!("*{}", base) } else { base }
}

fn go_path_fmt(path: &str) -> (String, Vec<String>) {
    let mut fmt = path.to_string();
    let mut params = Vec::new();
    for part in path.split('/') {
        if part.starts_with('{') && part.ends_with('}') {
            let name = &part[1..part.len() - 1];
            fmt = fmt.replace(part, "%s");
            params.push(name.to_snake_case());
        }
    }
    (fmt, params)
}

fn success_go_type(op: &Operation) -> String {
    for code in &["200", "201", "202"] {
        if let Some(resp) = op.responses.get(*code) {
            if let Some(s) = &resp.schema { return ir_to_go(s, false); }
        }
    }
    "".into()
}

pub fn emit(api: &Api, opts: &EmitOptions) -> Result<Vec<GeneratedFile>> {
    let engine = TemplateEngine::from_strings(&[
        ("go.mod.tera", T_GO_MOD),
        ("model.go.tera", T_MODEL),
        ("api.go.tera", T_API),
        ("client.go.tera", T_CLIENT),
        ("errors.go.tera", T_ERRORS),
        ("runtime.go.tera", T_RUNTIME),
        ("smoke_test.go.tera", T_SMOKE),
    ])?;

    let module_path = opts.package_name.clone().unwrap_or_else(|| {
        format!("github.com/example/{}", api.info.title.to_snake_case().replace(' ', "-"))
    });
    let pkg = "client";

    let mut files: Vec<GeneratedFile> = Vec::new();

    files.push(GeneratedFile { path: "go.mod".into(), content: engine.render("go.mod.tera", &serde_json::json!({ "module": module_path }))?, exec_bit: false });
    files.push(GeneratedFile { path: "client.go".into(), content: engine.render("client.go.tera", &serde_json::json!({ "pkg": pkg }))?, exec_bit: false });
    files.push(GeneratedFile { path: "errors.go".into(), content: engine.render("errors.go.tera", &serde_json::json!({ "pkg": pkg }))?, exec_bit: false });
    files.push(GeneratedFile { path: "runtime.go".into(), content: engine.render("runtime.go.tera", &serde_json::json!({ "pkg": pkg }))?, exec_bit: false });

    for (name, td) in &api.schemas {
        let ctx = build_go_model(name, td, pkg);
        let content = engine.render("model.go.tera", &serde_json::json!({ "model": ctx }))?;
        files.push(GeneratedFile { path: format!("models/{}.go", name.to_snake_case()), content, exec_bit: false });
    }

    let mut tag_ops: IndexMap<String, Vec<&Operation>> = IndexMap::new();
    for op in &api.operations {
        let tag = op.tags.first().cloned().unwrap_or_else(|| "default".into());
        tag_ops.entry(tag).or_default().push(op);
    }
    for (tag, ops) in &tag_ops {
        let ctx = build_go_api(tag, ops, pkg);
        let content = engine.render("api.go.tera", &serde_json::json!({ "api": ctx }))?;
        files.push(GeneratedFile { path: format!("{}_api.go", tag.to_snake_case()), content, exec_bit: false });
    }

    files.push(GeneratedFile { path: "smoke_test.go".into(), content: engine.render("smoke_test.go.tera", &serde_json::json!({ "pkg": pkg }))?, exec_bit: false });

    Ok(files)
}

fn build_go_model(name: &str, td: &TypeDef, pkg: &str) -> GoModelCtx {
    match td {
        TypeDef::Object(obj) => GoModelCtx {
            pkg: pkg.to_string(),
            name: name.to_pascal_case(),
            description: obj.description.clone(),
            kind: "struct".into(),
            fields: obj.properties.iter().map(|p| {
                let optional = !p.required;
                GoFieldCtx {
                    name: p.name.to_pascal_case(),
                    go_type: ir_to_go(&p.schema, optional),
                    json_tag: if optional { format!("{},omitempty", p.name) } else { p.name.clone() },
                    description: p.description.clone(),
                    optional,
                }
            }).collect(),
            enum_values: vec![],
            enum_type: "string".into(),
        },
        TypeDef::Enum(e) => GoModelCtx {
            pkg: pkg.to_string(),
            name: name.to_pascal_case(),
            description: e.description.clone(),
            kind: "enum".into(),
            fields: vec![],
            enum_values: e.variants.iter().map(|v| GoEnumValueCtx {
                const_name: format!("{}{}", name.to_pascal_case(), v.display.to_pascal_case()),
                type_name: name.to_pascal_case(),
                value: v.value.clone(),
            }).collect(),
            enum_type: "string".into(),
        },
        _ => GoModelCtx {
            pkg: pkg.to_string(),
            name: name.to_pascal_case(),
            description: None,
            kind: "alias".into(),
            fields: vec![],
            enum_values: vec![],
            enum_type: "interface{}".into(),
        },
    }
}

fn build_go_api(tag: &str, ops: &[&Operation], pkg: &str) -> GoApiCtx {
    GoApiCtx {
        pkg: pkg.to_string(),
        ops: ops.iter().map(|op| {
            let (path_fmt, _) = go_path_fmt(&op.path);
            GoOpCtx {
                func_name: op.id.to_pascal_case(),
                http_method: op.method.as_str().to_string(),
                path: op.path.clone(),
                path_fmt,
                return_type: success_go_type(op),
                path_params: op.path_params.iter().map(|p| GoParamCtx {
                    name: p.name.to_snake_case(),
                    go_type: ir_to_go(&p.schema, false),
                }).collect(),
                query_params: op.query_params.iter().map(|p| GoParamCtx {
                    name: p.name.to_snake_case(),
                    go_type: ir_to_go(&p.schema, true),
                }).collect(),
                has_body: op.request_body.is_some(),
                body_type: op.request_body.as_ref().map(|rb| ir_to_go(&rb.schema, false)),
                comment: op.summary.clone(),
            }
        }).collect(),
    }
}
