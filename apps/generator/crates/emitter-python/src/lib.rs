use anyhow::Result;
use forge_bundler::GeneratedFile;
use forge_ir::*;
use forge_templates::TemplateEngine;
use heck::{ToPascalCase, ToSnakeCase};
use indexmap::IndexMap;
use serde::Serialize;

const T_PYPROJECT: &str = include_str!("../../../templates/python/pyproject.toml.tera");
const T_INIT: &str      = include_str!("../../../templates/python/src/__init__.py.tera");
const T_CLIENT: &str    = include_str!("../../../templates/python/src/client.py.tera");
const T_RUNTIME: &str   = include_str!("../../../templates/python/src/_runtime.py.tera");
const T_ERRORS: &str    = include_str!("../../../templates/python/src/errors.py.tera");
const T_MODEL: &str     = include_str!("../../../templates/python/src/models/_pydantic.py.tera");
const T_MOD_INIT: &str  = include_str!("../../../templates/python/src/models/__init__.py.tera");
const T_API: &str       = include_str!("../../../templates/python/src/apis/_api_sync.py.tera");
const T_API_INIT: &str  = include_str!("../../../templates/python/src/apis/__init__.py.tera");
const T_SMOKE: &str     = include_str!("../../../templates/python/tests/test_smoke.py.tera");

#[derive(Serialize)]
struct PyModelCtx {
    module: String,
    class_name: String,
    description: Option<String>,
    kind: String,
    fields: Vec<PyFieldCtx>,
    enum_values: Vec<PyEnumValueCtx>,
}

#[derive(Serialize)]
struct PyFieldCtx {
    name: String,
    py_type: String,
    alias: Option<String>,
    required: bool,
    description: Option<String>,
}

#[derive(Serialize)]
struct PyEnumValueCtx {
    name: String,
    value: String,
}

#[derive(Serialize)]
struct PyApiCtx {
    module: String,
    class_name: String,
    pkg: String,
    operations: Vec<PyOpCtx>,
}

#[derive(Serialize)]
struct PyOpCtx {
    name: String,
    http_method: String,
    path: String,
    return_type: String,
    path_params: Vec<PyParamCtx>,
    query_params: Vec<PyParamCtx>,
    has_body: bool,
    body_type: Option<String>,
    summary: Option<String>,
}

#[derive(Serialize)]
struct PyParamCtx {
    name: String,
    py_type: String,
    required: bool,
}

fn ir_to_py(td: &TypeDef) -> String {
    match td {
        TypeDef::Primitive(p) => match p {
            Primitive::String | Primitive::Date | Primitive::DateTime => "str".into(),
            Primitive::Integer => "int".into(),
            Primitive::Float => "float".into(),
            Primitive::Bool => "bool".into(),
            Primitive::Uuid => "UUID".into(),
            Primitive::Binary => "bytes".into(),
        },
        TypeDef::Array(a) => format!("List[{}]", ir_to_py(&a.items)),
        TypeDef::Map(m) => format!("Dict[str, {}]", ir_to_py(&m.value)),
        TypeDef::Nullable(n) => format!("Optional[{}]", ir_to_py(&n.inner)),
        TypeDef::Ref(r) => r.name.to_pascal_case(),
        TypeDef::Object(o) => if o.name.is_empty() { "Any".into() } else { o.name.to_pascal_case() },
        TypeDef::Enum(e) => e.name.to_pascal_case(),
        TypeDef::OneOf(o) => {
            if o.variants.is_empty() { return "Any".into(); }
            format!("Union[{}]", o.variants.iter().map(|v| ir_to_py(v)).collect::<Vec<_>>().join(", "))
        }
        TypeDef::AllOf(_) => "Any".into(),
        TypeDef::Unknown => "Any".into(),
    }
}

fn success_py_type(op: &Operation) -> String {
    for code in &["200", "201", "202"] {
        if let Some(resp) = op.responses.get(*code) {
            if let Some(s) = &resp.schema { return ir_to_py(s); }
        }
    }
    "None".into()
}

pub fn emit(api: &Api, opts: &EmitOptions) -> Result<Vec<GeneratedFile>> {
    let engine = TemplateEngine::from_strings(&[
        ("pyproject.toml.tera", T_PYPROJECT),
        ("__init__.py.tera", T_INIT),
        ("client.py.tera", T_CLIENT),
        ("_runtime.py.tera", T_RUNTIME),
        ("errors.py.tera", T_ERRORS),
        ("model.py.tera", T_MODEL),
        ("models_init.py.tera", T_MOD_INIT),
        ("api.py.tera", T_API),
        ("apis_init.py.tera", T_API_INIT),
        ("smoke.py.tera", T_SMOKE),
    ])?;

    let pkg = opts.package_name.clone().unwrap_or_else(|| {
        api.info.title.to_snake_case().replace(' ', "_")
    });
    let version = opts.package_version.clone().unwrap_or_else(|| api.info.version.clone());

    let mut files: Vec<GeneratedFile> = Vec::new();
    let base = format!("src/{}", pkg);

    files.push(GeneratedFile { path: "pyproject.toml".into(), content: engine.render("pyproject.toml.tera", &serde_json::json!({ "name": pkg, "version": version, "description": api.info.description }))?, exec_bit: false });
    files.push(GeneratedFile { path: format!("{}/client.py", base), content: engine.render("client.py.tera", &serde_json::json!({ "pkg": pkg }))?, exec_bit: false });
    files.push(GeneratedFile { path: format!("{}/errors.py", base), content: engine.render("errors.py.tera", &serde_json::json!({}))?, exec_bit: false });
    files.push(GeneratedFile { path: format!("{}/_runtime.py", base), content: engine.render("_runtime.py.tera", &serde_json::json!({}))?, exec_bit: false });
    files.push(GeneratedFile { path: format!("{}/py.typed", base), content: "".into(), exec_bit: false });

    let mut model_names: Vec<String> = Vec::new();
    for (name, td) in &api.schemas {
        let ctx = build_py_model(name, td);
        let module = name.to_snake_case();
        let content = engine.render("model.py.tera", &serde_json::json!({ "model": ctx }))?;
        files.push(GeneratedFile { path: format!("{}/models/{}.py", base, module), content, exec_bit: false });
        model_names.push(module);
    }
    files.push(GeneratedFile {
        path: format!("{}/models/__init__.py", base),
        content: engine.render("models_init.py.tera", &serde_json::json!({ "models": model_names }))?,
        exec_bit: false,
    });

    let mut tag_ops: IndexMap<String, Vec<&Operation>> = IndexMap::new();
    for op in &api.operations {
        let tag = op.tags.first().cloned().unwrap_or_else(|| "default".into());
        tag_ops.entry(tag).or_default().push(op);
    }
    let mut api_modules: Vec<String> = Vec::new();
    for (tag, ops) in &tag_ops {
        let ctx = build_py_api(tag, ops, &pkg);
        let module = format!("{}_api", tag.to_snake_case());
        let content = engine.render("api.py.tera", &serde_json::json!({ "api": ctx }))?;
        files.push(GeneratedFile { path: format!("{}/apis/{}.py", base, module), content, exec_bit: false });
        api_modules.push(module);
    }
    files.push(GeneratedFile {
        path: format!("{}/apis/__init__.py", base),
        content: engine.render("apis_init.py.tera", &serde_json::json!({ "apis": api_modules }))?,
        exec_bit: false,
    });
    files.push(GeneratedFile { path: format!("{}/__init__.py", base), content: engine.render("__init__.py.tera", &serde_json::json!({ "pkg": pkg }))?, exec_bit: false });
    files.push(GeneratedFile { path: "tests/test_smoke.py".into(), content: engine.render("smoke.py.tera", &serde_json::json!({ "pkg": pkg }))?, exec_bit: false });

    Ok(files)
}

fn build_py_model(name: &str, td: &TypeDef) -> PyModelCtx {
    match td {
        TypeDef::Object(obj) => PyModelCtx {
            module: name.to_snake_case(),
            class_name: name.to_pascal_case(),
            description: obj.description.clone(),
            kind: "pydantic".into(),
            fields: obj.properties.iter().map(|p| {
                let snake = p.name.to_snake_case();
                let alias = if snake != p.name { Some(p.name.clone()) } else { None };
                PyFieldCtx {
                    name: snake,
                    py_type: ir_to_py(&p.schema),
                    alias,
                    required: p.required,
                    description: p.description.clone(),
                }
            }).collect(),
            enum_values: vec![],
        },
        TypeDef::Enum(e) => PyModelCtx {
            module: name.to_snake_case(),
            class_name: name.to_pascal_case(),
            description: e.description.clone(),
            kind: "enum".into(),
            fields: vec![],
            enum_values: e.variants.iter().map(|v| PyEnumValueCtx {
                name: v.display.clone(),
                value: v.value.clone(),
            }).collect(),
        },
        _ => PyModelCtx {
            module: name.to_snake_case(),
            class_name: name.to_pascal_case(),
            description: None,
            kind: "alias".into(),
            fields: vec![],
            enum_values: vec![],
        },
    }
}

fn build_py_api(tag: &str, ops: &[&Operation], pkg: &str) -> PyApiCtx {
    PyApiCtx {
        module: format!("{}_api", tag.to_snake_case()),
        class_name: format!("{}Api", tag.to_pascal_case()),
        pkg: pkg.to_string(),
        operations: ops.iter().map(|op| PyOpCtx {
            name: op.id.to_snake_case(),
            http_method: op.method.as_str().to_lowercase(),
            path: op.path.clone(),
            return_type: success_py_type(op),
            path_params: op.path_params.iter().map(|p| PyParamCtx {
                name: p.name.to_snake_case(),
                py_type: ir_to_py(&p.schema),
                required: p.required,
            }).collect(),
            query_params: op.query_params.iter().map(|p| PyParamCtx {
                name: p.name.to_snake_case(),
                py_type: ir_to_py(&p.schema),
                required: p.required,
            }).collect(),
            has_body: op.request_body.is_some(),
            body_type: op.request_body.as_ref().map(|rb| ir_to_py(&rb.schema)),
            summary: op.summary.clone(),
        }).collect(),
    }
}
