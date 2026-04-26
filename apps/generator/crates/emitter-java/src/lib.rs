use anyhow::Result;
use forge_bundler::GeneratedFile;
use forge_ir::*;
use forge_templates::TemplateEngine;
use heck::{ToLowerCamelCase, ToPascalCase};
use indexmap::IndexMap;
use serde::Serialize;

const T_POM: &str        = include_str!("../../../templates/java/pom.xml.tera");
const T_MODEL: &str      = include_str!("../../../templates/java/src/main/java/model/_model.java.tera");
const T_API: &str        = include_str!("../../../templates/java/src/main/java/api/_api.java.tera");
const T_CLIENT: &str     = include_str!("../../../templates/java/src/main/java/ApiClient.java.tera");
const T_EXCEPTION: &str  = include_str!("../../../templates/java/src/main/java/ApiException.java.tera");
const T_CONFIG: &str     = include_str!("../../../templates/java/src/main/java/Configuration.java.tera");
const T_SMOKE: &str      = include_str!("../../../templates/java/src/test/java/SmokeTest.java.tera");

#[derive(Serialize)]
struct PomCtx {
    group_id: String,
    artifact_id: String,
    version: String,
    description: Option<String>,
}

#[derive(Serialize)]
struct JavaModelCtx {
    package: String,
    name: String,
    description: Option<String>,
    kind: String,
    fields: Vec<JavaFieldCtx>,
    enum_values: Vec<JavaEnumValueCtx>,
}

#[derive(Serialize)]
struct JavaFieldCtx {
    name: String,
    java_type: String,
    json_property: String,
    required: bool,
    description: Option<String>,
}

#[derive(Serialize)]
struct JavaEnumValueCtx {
    constant: String,
    value: String,
}

#[derive(Serialize)]
struct JavaApiCtx {
    package: String,
    name: String,
    operations: Vec<JavaOpCtx>,
    imports: Vec<String>,
}

#[derive(Serialize)]
struct JavaOpCtx {
    name: String,
    http_method: String,
    path: String,
    return_type: String,
    params: Vec<JavaParamCtx>,
    has_body: bool,
    body_type: Option<String>,
    summary: Option<String>,
}

#[derive(Serialize)]
struct JavaParamCtx {
    name: String,
    java_type: String,
    kind: String,
}

fn ir_to_java(td: &TypeDef) -> String {
    match td {
        TypeDef::Primitive(p) => match p {
            Primitive::String | Primitive::Date | Primitive::DateTime => "String".into(),
            Primitive::Integer => "Long".into(),
            Primitive::Float => "Double".into(),
            Primitive::Bool => "Boolean".into(),
            Primitive::Uuid => "UUID".into(),
            Primitive::Binary => "byte[]".into(),
        },
        TypeDef::Array(a) => format!("List<{}>", ir_to_java(&a.items)),
        TypeDef::Map(m) => format!("Map<String, {}>", ir_to_java(&m.value)),
        TypeDef::Nullable(n) => ir_to_java(&n.inner),
        TypeDef::Ref(r) => r.name.to_pascal_case(),
        TypeDef::Object(o) => if o.name.is_empty() { "Object".into() } else { o.name.to_pascal_case() },
        TypeDef::Enum(e) => e.name.to_pascal_case(),
        TypeDef::OneOf(o) => if o.variants.is_empty() { "Object".into() } else { ir_to_java(&o.variants[0]) },
        TypeDef::AllOf(_) => "Object".into(),
        TypeDef::Unknown => "Object".into(),
    }
}

fn success_java_type(op: &Operation) -> String {
    for code in &["200", "201", "202"] {
        if let Some(resp) = op.responses.get(*code) {
            if let Some(s) = &resp.schema { return ir_to_java(s); }
        }
    }
    "Void".into()
}

pub fn emit(api: &Api, opts: &EmitOptions) -> Result<Vec<GeneratedFile>> {
    let engine = TemplateEngine::from_strings(&[
        ("pom.xml.tera", T_POM),
        ("model.java.tera", T_MODEL),
        ("api.java.tera", T_API),
        ("ApiClient.java.tera", T_CLIENT),
        ("ApiException.java.tera", T_EXCEPTION),
        ("Configuration.java.tera", T_CONFIG),
        ("SmokeTest.java.tera", T_SMOKE),
    ])?;

    let group_id = opts.extra.get("groupId").cloned().unwrap_or_else(|| "dev.apiforge".into());
    let artifact_id = opts.package_name.clone().unwrap_or_else(|| {
        api.info.title.to_lowercase().replace(' ', "-")
    });
    let version = opts.package_version.clone().unwrap_or_else(|| api.info.version.clone());
    let pkg = format!("{}.{}", group_id, artifact_id.replace('-', ""));
    let src = format!("src/main/java/{}", pkg.replace('.', "/"));

    let mut files: Vec<GeneratedFile> = Vec::new();

    let pom = PomCtx { group_id: group_id.clone(), artifact_id: artifact_id.clone(), version: version.clone(), description: api.info.description.clone() };
    files.push(GeneratedFile { path: "pom.xml".into(), content: engine.render("pom.xml.tera", &pom)?, exec_bit: false });
    files.push(GeneratedFile { path: format!("{}/ApiClient.java", src), content: engine.render("ApiClient.java.tera", &serde_json::json!({ "package": pkg }))?, exec_bit: false });
    files.push(GeneratedFile { path: format!("{}/ApiException.java", src), content: engine.render("ApiException.java.tera", &serde_json::json!({ "package": pkg }))?, exec_bit: false });
    files.push(GeneratedFile { path: format!("{}/Configuration.java", src), content: engine.render("Configuration.java.tera", &serde_json::json!({ "package": pkg }))?, exec_bit: false });

    for (name, td) in &api.schemas {
        let ctx = build_java_model(name, td, &pkg);
        let content = engine.render("model.java.tera", &serde_json::json!({ "model": ctx }))?;
        files.push(GeneratedFile { path: format!("{}/model/{}.java", src, name.to_pascal_case()), content, exec_bit: false });
    }

    let mut tag_ops: IndexMap<String, Vec<&Operation>> = IndexMap::new();
    for op in &api.operations {
        let tag = op.tags.first().cloned().unwrap_or_else(|| "Default".into());
        tag_ops.entry(tag).or_default().push(op);
    }
    for (tag, ops) in &tag_ops {
        let ctx = build_java_api(tag, ops, &pkg);
        let content = engine.render("api.java.tera", &serde_json::json!({ "api": ctx }))?;
        files.push(GeneratedFile { path: format!("{}/api/{}Api.java", src, tag.to_pascal_case()), content, exec_bit: false });
    }

    let test_pkg = format!("{}.{}", group_id, artifact_id.replace('-', ""));
    let test_src = format!("src/test/java/{}", test_pkg.replace('.', "/"));
    files.push(GeneratedFile { path: format!("{}/SmokeTest.java", test_src), content: engine.render("SmokeTest.java.tera", &serde_json::json!({ "package": test_pkg }))?, exec_bit: false });

    Ok(files)
}

fn build_java_model(name: &str, td: &TypeDef, pkg: &str) -> JavaModelCtx {
    match td {
        TypeDef::Object(obj) => JavaModelCtx {
            package: format!("{}.model", pkg),
            name: name.to_pascal_case(),
            description: obj.description.clone(),
            kind: "record".into(),
            fields: obj.properties.iter().map(|p| JavaFieldCtx {
                name: p.name.to_lower_camel_case(),
                java_type: ir_to_java(&p.schema),
                json_property: p.name.clone(),
                required: p.required,
                description: p.description.clone(),
            }).collect(),
            enum_values: vec![],
        },
        TypeDef::Enum(e) => JavaModelCtx {
            package: format!("{}.model", pkg),
            name: name.to_pascal_case(),
            description: e.description.clone(),
            kind: "enum".into(),
            fields: vec![],
            enum_values: e.variants.iter().map(|v| JavaEnumValueCtx {
                constant: v.display.clone(),
                value: v.value.clone(),
            }).collect(),
        },
        _ => JavaModelCtx {
            package: format!("{}.model", pkg),
            name: name.to_pascal_case(),
            description: None,
            kind: "alias".into(),
            fields: vec![],
            enum_values: vec![],
        },
    }
}

fn build_java_api(tag: &str, ops: &[&Operation], pkg: &str) -> JavaApiCtx {
    let operations = ops.iter().map(|op| {
        JavaOpCtx {
            name: op.id.to_lower_camel_case(),
            http_method: op.method.as_str().to_string(),
            path: op.path.clone(),
            return_type: success_java_type(op),
            params: op.path_params.iter().map(|p| JavaParamCtx {
                name: p.name.to_lower_camel_case(),
                java_type: ir_to_java(&p.schema),
                kind: "path".into(),
            }).chain(op.query_params.iter().map(|p| JavaParamCtx {
                name: p.name.to_lower_camel_case(),
                java_type: ir_to_java(&p.schema),
                kind: "query".into(),
            })).collect(),
            has_body: op.request_body.is_some(),
            body_type: op.request_body.as_ref().map(|rb| ir_to_java(&rb.schema)),
            summary: op.summary.clone(),
        }
    }).collect();

    JavaApiCtx {
        package: format!("{}.api", pkg),
        name: format!("{}Api", tag.to_pascal_case()),
        operations,
        imports: vec![format!("{}.model.*", pkg)],
    }
}
