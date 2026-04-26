use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// The full API, normalised from any supported spec format.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Api {
    pub info: ApiInfo,
    pub servers: Vec<Server>,
    pub operations: Vec<Operation>,
    /// Named schemas (components/schemas), PascalCase keys.
    pub schemas: IndexMap<String, TypeDef>,
    pub security_schemes: IndexMap<String, SecurityScheme>,
    pub tags: Vec<Tag>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ApiInfo {
    pub title: String,
    pub version: String,
    pub description: Option<String>,
    pub license: Option<String>,
    pub contact_email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Server {
    pub url: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub name: String,
    pub description: Option<String>,
}

// ─── Operations ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Operation {
    /// Normalised operationId (snake_case).
    pub id: String,
    pub method: HttpMethod,
    /// Original path string, e.g. `/users/{id}`.
    pub path: String,
    pub path_params: Vec<Parameter>,
    pub query_params: Vec<Parameter>,
    pub header_params: Vec<Parameter>,
    pub request_body: Option<RequestBody>,
    /// HTTP status code → response.  "200", "default", etc.
    pub responses: IndexMap<String, Response>,
    pub security: Vec<SecurityRequirement>,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub deprecated: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Head,
    Options,
    Trace,
}

impl HttpMethod {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Get => "GET",
            Self::Post => "POST",
            Self::Put => "PUT",
            Self::Patch => "PATCH",
            Self::Delete => "DELETE",
            Self::Head => "HEAD",
            Self::Options => "OPTIONS",
            Self::Trace => "TRACE",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameter {
    /// Original name from spec.
    pub name: String,
    pub description: Option<String>,
    pub required: bool,
    pub schema: TypeDef,
    pub location: ParameterLocation,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ParameterLocation {
    Path,
    Query,
    Header,
    Cookie,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestBody {
    pub description: Option<String>,
    pub required: bool,
    pub schema: TypeDef,
    pub content_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Response {
    pub description: Option<String>,
    pub schema: Option<TypeDef>,
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityRequirement {
    pub scheme_name: String,
    pub scopes: Vec<String>,
}

// ─── Type System ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum TypeDef {
    Primitive(Primitive),
    Object(ObjectDef),
    Array(ArrayDef),
    Enum(EnumDef),
    OneOf(OneOfDef),
    AllOf(AllOfDef),
    /// Reference to a named schema in `Api::schemas`. PascalCase name.
    Ref(RefDef),
    Nullable(NullableDef),
    /// `additionalProperties: <T>`
    Map(MapDef),
    Unknown,
}

impl Default for TypeDef {
    fn default() -> Self {
        Self::Unknown
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Primitive {
    String,
    Integer,
    Float,
    Bool,
    Date,
    DateTime,
    Uuid,
    Binary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArrayDef {
    pub items: Box<TypeDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MapDef {
    pub value: Box<TypeDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NullableDef {
    pub inner: Box<TypeDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefDef {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OneOfDef {
    pub variants: Vec<TypeDef>,
    pub discriminator: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllOfDef {
    pub parts: Vec<TypeDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ObjectDef {
    pub name: String,
    pub properties: Vec<Property>,
    pub required: BTreeSet<String>,
    pub description: Option<String>,
    pub additional_properties: Option<Box<TypeDef>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Property {
    /// Field name exactly as in the spec (camelCase or snake_case).
    pub name: String,
    pub schema: TypeDef,
    pub required: bool,
    pub nullable: bool,
    pub description: Option<String>,
    pub example: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnumDef {
    pub name: String,
    pub description: Option<String>,
    pub variants: Vec<EnumVariant>,
    pub default: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnumVariant {
    /// SCREAMING_SNAKE_CASE display name.
    pub display: String,
    /// Original string value from spec.
    pub value: String,
}

// ─── Security ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityScheme {
    pub name: String,
    pub kind: SecuritySchemeKind,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SecuritySchemeKind {
    ApiKey { location: ParameterLocation, param_name: String },
    Http { scheme: String, bearer_format: Option<String> },
    OAuth2,
    OpenIdConnect,
}

// ─── Generation options ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EmitOptions {
    pub mode: GeneratorMode,
    pub package_name: Option<String>,
    pub package_version: Option<String>,
    /// Language-specific options (e.g. "javaVersion", "httpClient").
    pub extra: IndexMap<String, String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "kebab-case")]
pub enum GeneratorMode {
    #[default]
    DtoOnly,
    Sdk,
    Server,
    MockClient,
    Validator,
    Hooks,
}
