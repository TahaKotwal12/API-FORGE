use anyhow::Result;
use forge_bundler::GeneratedFile;
use forge_ir::*;
use forge_templates::TemplateEngine;
use heck::{ToLowerCamelCase, ToPascalCase, ToSnakeCase};
use indexmap::IndexMap;
use serde::Serialize;
use std::collections::BTreeSet;

// ─── Template sources ─────────────────────────────────────────────────────────
const T_PACKAGE_JSON: &str   = include_str!("../../../templates/typescript/package.json.tera");
const T_TSCONFIG: &str       = include_str!("../../../templates/typescript/tsconfig.json.tera");
const T_README: &str         = include_str!("../../../templates/typescript/README.md.tera");
const T_INDEX: &str          = include_str!("../../../templates/typescript/src/index.ts.tera");
const T_CLIENT: &str         = include_str!("../../../templates/typescript/src/client.ts.tera");
const T_CONFIG: &str         = include_str!("../../../templates/typescript/src/config.ts.tera");
const T_ERRORS: &str         = include_str!("../../../templates/typescript/src/errors.ts.tera");
const T_RUNTIME: &str        = include_str!("../../../templates/typescript/src/runtime.ts.tera");
const T_MODEL: &str          = include_str!("../../../templates/typescript/src/models/_model.ts.tera");
const T_API: &str            = include_str!("../../../templates/typescript/src/apis/_api.ts.tera");
const T_MODELS_INDEX: &str   = include_str!("../../../templates/typescript/src/models/index.ts.tera");
const T_APIS_INDEX: &str     = include_str!("../../../templates/typescript/src/apis/index.ts.tera");
const T_SMOKE: &str          = include_str!("../../../templates/typescript/test/smoke.test.ts.tera");

// ─── Context types ────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct ModelCtx {
    name: String,
    description: Option<String>,
    kind: String,             // "interface" | "enum" | "alias" | "one_of" | "all_of"
    fields: Vec<FieldCtx>,
    enum_values: Vec<EnumValueCtx>,
    alias_type: Option<String>,
    one_of_types: Vec<String>,
    all_of_types: Vec<String>,
}

#[derive(Serialize)]
struct FieldCtx {
    name: String,
    ts_type: String,
    required: bool,
    description: Option<String>,
}

#[derive(Serialize)]
struct EnumValueCtx {
    key: String,
    value: String,
}

#[derive(Serialize)]
struct ApiCtx {
    tag: String,
    class_name: String,
    module_name: String,
    imports: Vec<String>,
    operations: Vec<OpCtx>,
}

#[derive(Serialize)]
struct OpCtx {
    id: String,           // camelCase method name
    http_method: String,
    path: String,
    path_template: String,  // template literal: `/users/${id}`
    summary: Option<String>,
    description: Option<String>,
    deprecated: bool,
    all_params: Vec<ParamCtx>,
    path_params: Vec<ParamCtx>,
    query_params: Vec<ParamCtx>,
    has_body: bool,
    body_type: Option<String>,
    return_type: String,
}

#[derive(Serialize)]
struct ParamCtx {
    name: String,
    ts_type: String,
    required: bool,
    description: Option<String>,
}

#[derive(Serialize)]
struct PackageCtx {
    name: String,
    version: String,
    description: Option<String>,
}

#[derive(Serialize)]
struct InfoCtx {
    title: String,
    version: String,
    description: Option<String>,
    package_name: String,
}

// ─── Type conversion ──────────────────────────────────────────────────────────

pub fn type_to_ts(td: &TypeDef) -> String {
    match td {
        TypeDef::Primitive(p) => match p {
            Primitive::String | Primitive::Date | Primitive::DateTime => "string".into(),
            Primitive::Integer | Primitive::Float => "number".into(),
            Primitive::Bool => "boolean".into(),
            Primitive::Uuid => "string".into(),
            Primitive::Binary => "Blob".into(),
        },
        TypeDef::Array(a) => format!("{}[]", type_to_ts(&a.items)),
        TypeDef::Map(m) => format!("Record<string, {}>", type_to_ts(&m.value)),
        TypeDef::Nullable(n) => format!("{} | null", type_to_ts(&n.inner)),
        TypeDef::Ref(r) => r.name.to_pascal_case(),
        TypeDef::Object(o) => {
            if o.name.is_empty() { "Record<string, unknown>".into() } else { o.name.to_pascal_case() }
        }
        TypeDef::Enum(e) => e.name.to_pascal_case(),
        TypeDef::OneOf(o) => {
            if o.variants.is_empty() { return "unknown".into(); }
            o.variants.iter().map(|v| type_to_ts(v)).collect::<Vec<_>>().join(" | ")
        }
        TypeDef::AllOf(a) => {
            if a.parts.is_empty() { return "unknown".into(); }
            a.parts.iter().map(|p| type_to_ts(p)).collect::<Vec<_>>().join(" & ")
        }
        TypeDef::Unknown => "unknown".into(),
    }
}

fn success_return_type(op: &Operation) -> String {
    for code in &["200", "201", "202", "204"] {
        if let Some(resp) = op.responses.get(*code) {
            return resp.schema.as_ref().map(|s| type_to_ts(s)).unwrap_or_else(|| "void".into());
        }
    }
    if let Some(resp) = op.responses.get("default") {
        return resp.schema.as_ref().map(|s| type_to_ts(s)).unwrap_or_else(|| "void".into());
    }
    "void".into()
}

fn path_to_template(path: &str) -> String {
    path.replace('{', "${").replace('}', "}")
}

fn collect_imports(ops: &[&Operation]) -> Vec<String> {
    let mut names: BTreeSet<String> = BTreeSet::new();
    for op in ops {
        for resp in op.responses.values() {
            if let Some(s) = &resp.schema {
                collect_refs(s, &mut names);
            }
        }
        if let Some(rb) = &op.request_body {
            collect_refs(&rb.schema, &mut names);
        }
        for p in op.path_params.iter().chain(&op.query_params).chain(&op.header_params) {
            collect_refs(&p.schema, &mut names);
        }
    }
    names.into_iter().collect()
}

fn collect_refs(td: &TypeDef, out: &mut BTreeSet<String>) {
    match td {
        TypeDef::Ref(r) => { out.insert(r.name.to_pascal_case()); }
        TypeDef::Array(a) => collect_refs(&a.items, out),
        TypeDef::Map(m) => collect_refs(&m.value, out),
        TypeDef::Nullable(n) => collect_refs(&n.inner, out),
        TypeDef::Object(o) => { if !o.name.is_empty() { out.insert(o.name.to_pascal_case()); } }
        TypeDef::Enum(e) => { out.insert(e.name.to_pascal_case()); }
        TypeDef::OneOf(o) => o.variants.iter().for_each(|v| collect_refs(v, out)),
        TypeDef::AllOf(a) => a.parts.iter().for_each(|p| collect_refs(p, out)),
        _ => {}
    }
}

// ─── Build contexts ───────────────────────────────────────────────────────────

fn build_model_ctx(name: &str, td: &TypeDef) -> ModelCtx {
    match td {
        TypeDef::Object(obj) => ModelCtx {
            name: name.to_pascal_case(),
            description: obj.description.clone(),
            kind: "interface".into(),
            fields: obj.properties.iter().map(|p| FieldCtx {
                name: p.name.clone(),
                ts_type: type_to_ts(&p.schema),
                required: p.required,
                description: p.description.clone(),
            }).collect(),
            enum_values: vec![],
            alias_type: None,
            one_of_types: vec![],
            all_of_types: vec![],
        },
        TypeDef::Enum(e) => ModelCtx {
            name: name.to_pascal_case(),
            description: e.description.clone(),
            kind: "enum".into(),
            fields: vec![],
            enum_values: e.variants.iter().map(|v| EnumValueCtx {
                key: v.display.clone(),
                value: v.value.clone(),
            }).collect(),
            alias_type: None,
            one_of_types: vec![],
            all_of_types: vec![],
        },
        TypeDef::OneOf(o) => ModelCtx {
            name: name.to_pascal_case(),
            description: None,
            kind: "one_of".into(),
            fields: vec![],
            enum_values: vec![],
            alias_type: None,
            one_of_types: o.variants.iter().map(|v| type_to_ts(v)).collect(),
            all_of_types: vec![],
        },
        TypeDef::AllOf(a) => ModelCtx {
            name: name.to_pascal_case(),
            description: None,
            kind: "all_of".into(),
            fields: vec![],
            enum_values: vec![],
            alias_type: None,
            one_of_types: vec![],
            all_of_types: a.parts.iter().map(|p| type_to_ts(p)).collect(),
        },
        other => ModelCtx {
            name: name.to_pascal_case(),
            description: None,
            kind: "alias".into(),
            fields: vec![],
            enum_values: vec![],
            alias_type: Some(type_to_ts(other)),
            one_of_types: vec![],
            all_of_types: vec![],
        },
    }
}

fn build_api_ctx(tag: &str, ops: &[&Operation]) -> ApiCtx {
    let class_name = format!("{}Api", tag.to_pascal_case());
    let module_name = format!("{}-api", tag.to_snake_case().replace('_', "-"));
    let imports = collect_imports(ops);
    let operations = ops.iter().map(|op| {
        let return_type = success_return_type(op);
        let all_params: Vec<ParamCtx> = op.path_params.iter()
            .chain(&op.query_params)
            .map(|p| ParamCtx {
                name: p.name.to_lower_camel_case(),
                ts_type: type_to_ts(&p.schema),
                required: p.required,
                description: p.description.clone(),
            })
            .collect();

        OpCtx {
            id: op.id.to_lower_camel_case(),
            http_method: op.method.as_str().to_string(),
            path: op.path.clone(),
            path_template: path_to_template(&op.path),
            summary: op.summary.clone(),
            description: op.description.clone(),
            deprecated: op.deprecated,
            path_params: op.path_params.iter().map(|p| ParamCtx {
                name: p.name.to_lower_camel_case(),
                ts_type: type_to_ts(&p.schema),
                required: p.required,
                description: p.description.clone(),
            }).collect(),
            query_params: op.query_params.iter().map(|p| ParamCtx {
                name: p.name.to_lower_camel_case(),
                ts_type: type_to_ts(&p.schema),
                required: p.required,
                description: p.description.clone(),
            }).collect(),
            has_body: op.request_body.is_some(),
            body_type: op.request_body.as_ref().map(|rb| type_to_ts(&rb.schema)),
            return_type,
            all_params,
        }
    }).collect();

    ApiCtx { tag: tag.to_string(), class_name, module_name, imports, operations }
}

// ─── Emitter entry point ──────────────────────────────────────────────────────

pub fn emit(api: &Api, opts: &EmitOptions) -> Result<Vec<GeneratedFile>> {
    let engine = TemplateEngine::from_strings(&[
        ("package.json.tera", T_PACKAGE_JSON),
        ("tsconfig.json.tera", T_TSCONFIG),
        ("README.md.tera", T_README),
        ("src/index.ts.tera", T_INDEX),
        ("src/client.ts.tera", T_CLIENT),
        ("src/config.ts.tera", T_CONFIG),
        ("src/errors.ts.tera", T_ERRORS),
        ("src/runtime.ts.tera", T_RUNTIME),
        ("src/models/_model.ts.tera", T_MODEL),
        ("src/apis/_api.ts.tera", T_API),
        ("src/models/index.ts.tera", T_MODELS_INDEX),
        ("src/apis/index.ts.tera", T_APIS_INDEX),
        ("test/smoke.test.ts.tera", T_SMOKE),
    ])?;

    let package_name = opts.package_name.clone().unwrap_or_else(|| {
        format!("{}-client", api.info.title.to_snake_case().replace('_', "-"))
    });
    let pkg = PackageCtx {
        name: package_name.clone(),
        version: opts.package_version.clone().unwrap_or_else(|| api.info.version.clone()),
        description: api.info.description.clone(),
    };
    let info = InfoCtx {
        title: api.info.title.clone(),
        version: api.info.version.clone(),
        description: api.info.description.clone(),
        package_name: package_name.clone(),
    };

    let mut files: Vec<GeneratedFile> = Vec::new();

    files.push(GeneratedFile { path: "package.json".into(), content: engine.render("package.json.tera", &pkg)?, exec_bit: false });
    files.push(GeneratedFile { path: "tsconfig.json".into(), content: engine.render("tsconfig.json.tera", &serde_json::json!({}))?, exec_bit: false });
    files.push(GeneratedFile { path: "README.md".into(), content: engine.render("README.md.tera", &info)?, exec_bit: false });
    files.push(GeneratedFile { path: "src/index.ts".into(), content: engine.render("src/index.ts.tera", &info)?, exec_bit: false });
    files.push(GeneratedFile { path: "src/client.ts".into(), content: engine.render("src/client.ts.tera", &info)?, exec_bit: false });
    files.push(GeneratedFile { path: "src/config.ts".into(), content: engine.render("src/config.ts.tera", &serde_json::json!({}))?, exec_bit: false });
    files.push(GeneratedFile { path: "src/errors.ts".into(), content: engine.render("src/errors.ts.tera", &serde_json::json!({}))?, exec_bit: false });
    files.push(GeneratedFile { path: "src/runtime.ts".into(), content: engine.render("src/runtime.ts.tera", &serde_json::json!({}))?, exec_bit: false });

    // Models
    let mut model_names: Vec<String> = Vec::new();
    for (name, td) in &api.schemas {
        let ctx = build_model_ctx(name, td);
        let file_name = name.to_snake_case();
        let content = engine.render("src/models/_model.ts.tera", &serde_json::json!({ "schema": ctx }))?;
        files.push(GeneratedFile { path: format!("src/models/{}.ts", file_name), content, exec_bit: false });
        model_names.push(file_name);
    }
    files.push(GeneratedFile {
        path: "src/models/index.ts".into(),
        content: engine.render("src/models/index.ts.tera", &serde_json::json!({ "models": model_names }))?,
        exec_bit: false,
    });

    // APIs grouped by tag
    let mut tag_ops: IndexMap<String, Vec<&Operation>> = IndexMap::new();
    for op in &api.operations {
        let tag = op.tags.first().cloned().unwrap_or_else(|| "default".into());
        tag_ops.entry(tag).or_default().push(op);
    }
    let mut api_module_names: Vec<String> = Vec::new();
    for (tag, ops) in &tag_ops {
        let ctx = build_api_ctx(tag, ops);
        let module_name = ctx.module_name.clone();
        let content = engine.render("src/apis/_api.ts.tera", &serde_json::json!({ "api": ctx }))?;
        files.push(GeneratedFile { path: format!("src/apis/{}.ts", module_name), content, exec_bit: false });
        api_module_names.push(module_name);
    }
    files.push(GeneratedFile {
        path: "src/apis/index.ts".into(),
        content: engine.render("src/apis/index.ts.tera", &serde_json::json!({ "apis": api_module_names }))?,
        exec_bit: false,
    });

    files.push(GeneratedFile { path: "test/smoke.test.ts".into(), content: engine.render("test/smoke.test.ts.tera", &pkg)?, exec_bit: false });

    Ok(files)
}
