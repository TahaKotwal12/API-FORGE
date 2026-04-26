use anyhow::{anyhow, Context, Result};
use forge_ir::*;
use heck::{ToPascalCase, ToSnakeCase};
use indexmap::IndexMap;
use serde_json::Value;

pub fn parse(spec_str: &str) -> Result<Api> {
    let v: Value = if spec_str.trim_start().starts_with('{') {
        serde_json::from_str(spec_str)?
    } else {
        serde_yaml::from_str(spec_str)?
    };
    parse_value(&v)
}

fn parse_value(v: &Value) -> Result<Api> {
    let info = parse_info(v);
    let servers = parse_servers(v);
    let tags = parse_tags(v);
    let schemas = parse_schemas(v)?;
    let security_schemes = parse_security_schemes(v);
    let operations = parse_operations(v, &schemas)?;
    Ok(Api { info, servers, tags, schemas, security_schemes, operations })
}

fn str_opt(v: &Value, key: &str) -> Option<String> {
    v.get(key)?.as_str().map(|s| s.to_string())
}

fn parse_info(v: &Value) -> ApiInfo {
    let info = &v["info"];
    ApiInfo {
        title: str_opt(info, "title").unwrap_or_else(|| "API".into()),
        version: str_opt(info, "version").unwrap_or_else(|| "0.1.0".into()),
        description: str_opt(info, "description"),
        license: info.get("license").and_then(|l| l.get("name")).and_then(|n| n.as_str()).map(|s| s.into()),
        contact_email: info.get("contact").and_then(|c| c.get("email")).and_then(|e| e.as_str()).map(|s| s.into()),
    }
}

fn parse_servers(v: &Value) -> Vec<Server> {
    v.get("servers")
        .and_then(|s| s.as_array())
        .map(|arr| {
            arr.iter()
                .map(|s| Server {
                    url: str_opt(s, "url").unwrap_or_default(),
                    description: str_opt(s, "description"),
                })
                .collect()
        })
        .unwrap_or_default()
}

fn parse_tags(v: &Value) -> Vec<Tag> {
    v.get("tags")
        .and_then(|t| t.as_array())
        .map(|arr| {
            arr.iter()
                .map(|t| Tag { name: str_opt(t, "name").unwrap_or_default(), description: str_opt(t, "description") })
                .collect()
        })
        .unwrap_or_default()
}

// ─── Schema parsing ───────────────────────────────────────────────────────────

fn parse_schemas(v: &Value) -> Result<IndexMap<String, TypeDef>> {
    let mut out = IndexMap::new();
    let schemas = match v.pointer("/components/schemas") {
        Some(Value::Object(m)) => m,
        _ => return Ok(out),
    };
    for (name, schema) in schemas {
        let pascal = name.to_pascal_case();
        let td = schema_to_type(schema, &pascal, v)?;
        out.insert(pascal, td);
    }
    Ok(out)
}

fn schema_to_type(schema: &Value, hint_name: &str, root: &Value) -> Result<TypeDef> {
    // Handle $ref
    if let Some(r) = schema.get("$ref").and_then(|r| r.as_str()) {
        let name = ref_to_name(r);
        return Ok(TypeDef::Ref(RefDef { name }));
    }

    // nullable wrapper (OAS 3.0 style)
    let nullable = schema.get("nullable").and_then(|n| n.as_bool()).unwrap_or(false);

    // allOf
    if let Some(all_of) = schema.get("allOf").and_then(|a| a.as_array()) {
        let parts: Result<Vec<_>> = all_of.iter().map(|s| schema_to_type(s, hint_name, root)).collect();
        let td = TypeDef::AllOf(AllOfDef { parts: parts? });
        return Ok(if nullable { TypeDef::Nullable(NullableDef { inner: Box::new(td) }) } else { td });
    }

    // oneOf / anyOf
    if let Some(one_of) = schema.get("oneOf").or_else(|| schema.get("anyOf")).and_then(|o| o.as_array()) {
        let variants: Result<Vec<_>> = one_of.iter().map(|s| schema_to_type(s, hint_name, root)).collect();
        let discriminator = schema.pointer("/discriminator/propertyName").and_then(|d| d.as_str()).map(|s| s.into());
        let td = TypeDef::OneOf(OneOfDef { variants: variants?, discriminator });
        return Ok(if nullable { TypeDef::Nullable(NullableDef { inner: Box::new(td) }) } else { td });
    }

    // enum on string type
    let enum_values: Vec<String> = schema
        .get("enum")
        .and_then(|e| e.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let typ = schema.get("type").and_then(|t| t.as_str()).unwrap_or("object");

    if !enum_values.is_empty() && (typ == "string" || typ == "integer") {
        let variants = enum_values
            .iter()
            .map(|v| EnumVariant { display: v.to_snake_case().to_uppercase(), value: v.clone() })
            .collect();
        let td = TypeDef::Enum(EnumDef {
            name: hint_name.to_string(),
            description: str_opt(schema, "description"),
            variants,
            default: str_opt(schema, "default"),
        });
        return Ok(if nullable { TypeDef::Nullable(NullableDef { inner: Box::new(td) }) } else { td });
    }

    let td = match typ {
        "string" => match schema.get("format").and_then(|f| f.as_str()) {
            Some("date") => TypeDef::Primitive(Primitive::Date),
            Some("date-time") => TypeDef::Primitive(Primitive::DateTime),
            Some("uuid") => TypeDef::Primitive(Primitive::Uuid),
            Some("binary" | "byte") => TypeDef::Primitive(Primitive::Binary),
            _ => TypeDef::Primitive(Primitive::String),
        },
        "integer" | "int32" | "int64" => TypeDef::Primitive(Primitive::Integer),
        "number" | "float" | "double" => TypeDef::Primitive(Primitive::Float),
        "boolean" => TypeDef::Primitive(Primitive::Bool),
        "array" => {
            let items = schema.get("items").unwrap_or(&Value::Null);
            let inner = schema_to_type(items, hint_name, root)?;
            TypeDef::Array(ArrayDef { items: Box::new(inner) })
        }
        "object" | _ => {
            // additionalProperties → Map
            if let Some(ap) = schema.get("additionalProperties") {
                if ap.is_object() {
                    let val = schema_to_type(ap, hint_name, root)?;
                    return Ok(TypeDef::Map(MapDef { value: Box::new(val) }));
                }
                if ap.as_bool() == Some(true) {
                    return Ok(TypeDef::Map(MapDef { value: Box::new(TypeDef::Unknown) }));
                }
            }

            let required_set: std::collections::BTreeSet<String> = schema
                .get("required")
                .and_then(|r| r.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.into())).collect())
                .unwrap_or_default();

            let properties = schema
                .get("properties")
                .and_then(|p| p.as_object())
                .map(|props| {
                    props.iter().map(|(k, pv)| {
                        let req = required_set.contains(k.as_str());
                        let prop_nullable = pv.get("nullable").and_then(|n| n.as_bool()).unwrap_or(false);
                        let prop_name = k.to_snake_case();
                        let prop_hint = format!("{}{}", hint_name, k.to_pascal_case());
                        let mut inner = schema_to_type(pv, &prop_hint, root).unwrap_or(TypeDef::Unknown);
                        if prop_nullable {
                            inner = TypeDef::Nullable(NullableDef { inner: Box::new(inner) });
                        }
                        Property {
                            name: k.clone(),
                            schema: inner,
                            required: req,
                            nullable: prop_nullable,
                            description: str_opt(pv, "description"),
                            example: pv.get("example").cloned(),
                        }
                    }).collect()
                })
                .unwrap_or_default();

            TypeDef::Object(ObjectDef {
                name: hint_name.to_string(),
                properties,
                required: required_set,
                description: str_opt(schema, "description"),
                additional_properties: None,
            })
        }
    };

    Ok(if nullable { TypeDef::Nullable(NullableDef { inner: Box::new(td) }) } else { td })
}

fn ref_to_name(reference: &str) -> String {
    reference.split('/').last().unwrap_or(reference).to_pascal_case()
}

// ─── Operation parsing ────────────────────────────────────────────────────────

fn parse_operations(v: &Value, schemas: &IndexMap<String, TypeDef>) -> Result<Vec<Operation>> {
    let paths = match v.get("paths").and_then(|p| p.as_object()) {
        Some(p) => p,
        None => return Ok(vec![]),
    };

    let mut ops = Vec::new();
    for (path, path_item) in paths {
        for method_str in &["get", "post", "put", "patch", "delete", "head", "options", "trace"] {
            if let Some(op_v) = path_item.get(method_str) {
                let method = match *method_str {
                    "get" => HttpMethod::Get,
                    "post" => HttpMethod::Post,
                    "put" => HttpMethod::Put,
                    "patch" => HttpMethod::Patch,
                    "delete" => HttpMethod::Delete,
                    "head" => HttpMethod::Head,
                    "options" => HttpMethod::Options,
                    _ => HttpMethod::Trace,
                };
                let op = parse_operation(op_v, path, method, v)
                    .with_context(|| format!("{} {}", method_str.to_uppercase(), path))?;
                ops.push(op);
            }
        }
    }
    Ok(ops)
}

fn parse_operation(op: &Value, path: &str, method: HttpMethod, root: &Value) -> Result<Operation> {
    let tags: Vec<String> = op.get("tags")
        .and_then(|t| t.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.into())).collect())
        .unwrap_or_default();

    let id = op.get("operationId")
        .and_then(|id| id.as_str())
        .map(|s| s.to_snake_case())
        .unwrap_or_else(|| derive_op_id(method, path));

    let params = parse_params(op, root)?;
    let path_params = params.iter().filter(|p| p.location == ParameterLocation::Path).cloned().collect();
    let query_params = params.iter().filter(|p| p.location == ParameterLocation::Query).cloned().collect();
    let header_params = params.iter().filter(|p| p.location == ParameterLocation::Header).cloned().collect();

    let request_body = parse_request_body(op, root, &id)?;
    let responses = parse_responses(op, root, &id)?;

    let security = op.get("security")
        .and_then(|s| s.as_array())
        .map(|arr| {
            arr.iter().flat_map(|req| {
                req.as_object().into_iter().flat_map(|m| {
                    m.iter().map(|(k, v)| SecurityRequirement {
                        scheme_name: k.clone(),
                        scopes: v.as_array().map(|a| a.iter().filter_map(|s| s.as_str().map(|s| s.into())).collect()).unwrap_or_default(),
                    })
                })
            }).collect()
        })
        .unwrap_or_default();

    Ok(Operation {
        id,
        method,
        path: path.to_string(),
        path_params,
        query_params,
        header_params,
        request_body,
        responses,
        security,
        summary: str_opt(op, "summary"),
        description: str_opt(op, "description"),
        tags,
        deprecated: op.get("deprecated").and_then(|d| d.as_bool()).unwrap_or(false),
    })
}

fn derive_op_id(method: HttpMethod, path: &str) -> String {
    let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty() && !s.starts_with('{')).collect();
    let suffix = parts.last().copied().unwrap_or("resource");
    format!("{}_{}", method.as_str().to_lowercase(), suffix.to_snake_case())
}

fn resolve_schema(v: &Value, root: &Value) -> Value {
    if let Some(r) = v.get("$ref").and_then(|r| r.as_str()) {
        let ptr = r.trim_start_matches('#');
        if let Some(resolved) = root.pointer(ptr) {
            return resolved.clone();
        }
    }
    v.clone()
}

fn parse_params(op: &Value, root: &Value) -> Result<Vec<Parameter>> {
    let arr = match op.get("parameters").and_then(|p| p.as_array()) {
        Some(a) => a,
        None => return Ok(vec![]),
    };

    let mut out = Vec::new();
    for param in arr {
        let param = resolve_schema(param, root);
        let location = match param.get("in").and_then(|i| i.as_str()) {
            Some("path") => ParameterLocation::Path,
            Some("query") => ParameterLocation::Query,
            Some("header") => ParameterLocation::Header,
            _ => ParameterLocation::Query,
        };
        let name = str_opt(&param, "name").unwrap_or_default();
        let schema_v = param.get("schema").cloned().unwrap_or(Value::Null);
        let schema = schema_to_type(&schema_v, &name.to_pascal_case(), root)?;
        out.push(Parameter {
            name,
            description: str_opt(&param, "description"),
            required: param.get("required").and_then(|r| r.as_bool()).unwrap_or(location == ParameterLocation::Path),
            schema,
            location,
        });
    }
    Ok(out)
}

fn parse_request_body(op: &Value, root: &Value, op_id: &str) -> Result<Option<RequestBody>> {
    let rb_v = match op.get("requestBody") {
        Some(v) => resolve_schema(v, root),
        None => return Ok(None),
    };

    let content = rb_v.get("content").and_then(|c| c.as_object());
    let (content_type, schema_v) = content
        .and_then(|c| {
            c.get("application/json")
                .map(|s| ("application/json".to_string(), s.clone()))
                .or_else(|| c.iter().next().map(|(k, v)| (k.clone(), v.clone())))
        })
        .unwrap_or_else(|| ("application/json".to_string(), Value::Null));

    let schema_v = schema_v.get("schema").cloned().unwrap_or(Value::Null);
    let hint = format!("{}Request", op_id.to_pascal_case());
    let schema = schema_to_type(&schema_v, &hint, root)?;

    Ok(Some(RequestBody {
        description: str_opt(&rb_v, "description"),
        required: rb_v.get("required").and_then(|r| r.as_bool()).unwrap_or(true),
        schema,
        content_type,
    }))
}

fn parse_responses(op: &Value, root: &Value, op_id: &str) -> Result<IndexMap<String, Response>> {
    let responses = match op.get("responses").and_then(|r| r.as_object()) {
        Some(r) => r,
        None => return Ok(IndexMap::new()),
    };

    let mut out = IndexMap::new();
    for (code, resp_v) in responses {
        let resp_v = resolve_schema(resp_v, root);
        let content = resp_v.get("content").and_then(|c| c.as_object());
        let (content_type, schema) = if let Some(content) = content {
            let (ct, sv) = content
                .get("application/json")
                .map(|s| ("application/json".to_string(), s.clone()))
                .or_else(|| content.iter().next().map(|(k, v)| (k.clone(), v.clone())))
                .unwrap_or_else(|| ("application/json".to_string(), Value::Null));
            let schema_v = sv.get("schema").cloned().unwrap_or(Value::Null);
            if schema_v.is_null() {
                (Some(ct), None)
            } else {
                let hint = format!("{}{}Response", op_id.to_pascal_case(), code.replace(['X', 'x'], "xx"));
                let td = schema_to_type(&schema_v, &hint, root)?;
                (Some(ct), Some(td))
            }
        } else {
            (None, None)
        };

        out.insert(code.clone(), Response {
            description: str_opt(&resp_v, "description"),
            schema,
            content_type,
        });
    }
    Ok(out)
}

// ─── Security schemes ─────────────────────────────────────────────────────────

fn parse_security_schemes(v: &Value) -> IndexMap<String, SecurityScheme> {
    let mut out = IndexMap::new();
    let schemes = match v.pointer("/components/securitySchemes").and_then(|s| s.as_object()) {
        Some(s) => s,
        None => return out,
    };
    for (name, scheme) in schemes {
        let kind = match scheme.get("type").and_then(|t| t.as_str()) {
            Some("apiKey") => SecuritySchemeKind::ApiKey {
                location: match scheme.get("in").and_then(|i| i.as_str()) {
                    Some("query") => ParameterLocation::Query,
                    Some("cookie") => ParameterLocation::Cookie,
                    _ => ParameterLocation::Header,
                },
                param_name: str_opt(scheme, "name").unwrap_or_default(),
            },
            Some("http") => SecuritySchemeKind::Http {
                scheme: str_opt(scheme, "scheme").unwrap_or_else(|| "bearer".into()),
                bearer_format: str_opt(scheme, "bearerFormat"),
            },
            Some("oauth2") => SecuritySchemeKind::OAuth2,
            _ => SecuritySchemeKind::OpenIdConnect,
        };
        out.insert(name.clone(), SecurityScheme {
            name: name.clone(),
            kind,
            description: str_opt(scheme, "description"),
        });
    }
    out
}
