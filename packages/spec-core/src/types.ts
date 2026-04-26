// OpenAPI 3.1 types — forked from openapi3-ts, no runtime dependency.

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// ─── Core document ────────────────────────────────────────────────────────────

export interface OpenAPIDocument {
  openapi: string;
  info: InfoObject;
  paths?: PathsObject;
  components?: ComponentsObject;
  tags?: TagObject[];
  servers?: ServerObject[];
  security?: SecurityRequirementObject[];
  externalDocs?: ExternalDocumentationObject;
  [key: string]: unknown;
}

export interface InfoObject {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: ContactObject;
  license?: LicenseObject;
  summary?: string;
}

export interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
}

export interface LicenseObject {
  name: string;
  url?: string;
  identifier?: string;
}

export interface ServerObject {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariableObject>;
}

export interface ServerVariableObject {
  enum?: string[];
  default: string;
  description?: string;
}

export interface TagObject {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
}

export interface ExternalDocumentationObject {
  url: string;
  description?: string;
}

// ─── Paths ────────────────────────────────────────────────────────────────────

export type PathsObject = Record<string, PathItemObject>;

export interface PathItemObject {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  patch?: OperationObject;
  delete?: OperationObject;
  head?: OperationObject;
  options?: OperationObject;
  trace?: OperationObject;
  summary?: string;
  description?: string;
  parameters?: ParameterObject[];
  servers?: ServerObject[];
  [key: string]: unknown;
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: ResponsesObject;
  security?: SecurityRequirementObject[];
  deprecated?: boolean;
  servers?: ServerObject[];
  externalDocs?: ExternalDocumentationObject;
  [key: string]: unknown;
}

// ─── Parameters ───────────────────────────────────────────────────────────────

export type ParameterLocation = 'path' | 'query' | 'header' | 'cookie';

export interface ParameterObject {
  name: string;
  in: ParameterLocation;
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  content?: Record<string, MediaTypeObject>;
  [key: string]: unknown;
}

// ─── Request body / responses ─────────────────────────────────────────────────

export interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content: Record<string, MediaTypeObject>;
  [key: string]: unknown;
}

export type ResponsesObject = Record<string, ResponseObject | ReferenceObject>;

export interface ResponseObject {
  description: string;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  content?: Record<string, MediaTypeObject>;
  links?: Record<string, LinkObject | ReferenceObject>;
  [key: string]: unknown;
}

export interface MediaTypeObject {
  schema?: SchemaObject | ReferenceObject;
  example?: unknown;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  encoding?: Record<string, EncodingObject>;
}

export interface HeaderObject {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject | ReferenceObject;
}

export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
}

export interface LinkObject {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, unknown>;
  requestBody?: unknown;
  description?: string;
  server?: ServerObject;
}

export interface EncodingObject {
  contentType?: string;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

export interface SchemaObject {
  type?: string | string[];
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  example?: unknown;
  examples?: unknown[];
  enum?: unknown[];
  const?: unknown;
  // Numeric
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  multipleOf?: number;
  // String
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  // Array
  items?: SchemaObject | ReferenceObject;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  // Object
  properties?: Record<string, SchemaObject | ReferenceObject>;
  additionalProperties?: SchemaObject | ReferenceObject | boolean;
  required?: string[];
  minProperties?: number;
  maxProperties?: number;
  // Composition
  allOf?: Array<SchemaObject | ReferenceObject>;
  anyOf?: Array<SchemaObject | ReferenceObject>;
  oneOf?: Array<SchemaObject | ReferenceObject>;
  not?: SchemaObject | ReferenceObject;
  discriminator?: DiscriminatorObject;
  // External
  externalDocs?: ExternalDocumentationObject;
  xml?: XmlObject;
  [key: string]: unknown;
}

export interface DiscriminatorObject {
  propertyName: string;
  mapping?: Record<string, string>;
}

export interface XmlObject {
  name?: string;
  namespace?: string;
  prefix?: string;
  attribute?: boolean;
  wrapped?: boolean;
}

export interface ReferenceObject {
  $ref: string;
  summary?: string;
  description?: string;
}

// ─── Components ───────────────────────────────────────────────────────────────

export interface ComponentsObject {
  schemas?: Record<string, SchemaObject | ReferenceObject>;
  responses?: Record<string, ResponseObject | ReferenceObject>;
  parameters?: Record<string, ParameterObject | ReferenceObject>;
  examples?: Record<string, ExampleObject | ReferenceObject>;
  requestBodies?: Record<string, RequestBodyObject | ReferenceObject>;
  headers?: Record<string, HeaderObject | ReferenceObject>;
  securitySchemes?: Record<string, SecuritySchemeObject | ReferenceObject>;
  links?: Record<string, LinkObject | ReferenceObject>;
  callbacks?: Record<string, CallbackObject | ReferenceObject>;
}

export type CallbackObject = Record<string, PathItemObject>;

// ─── Security ─────────────────────────────────────────────────────────────────

export type SecurityRequirementObject = Record<string, string[]>;

export type SecuritySchemeType = 'apiKey' | 'http' | 'oauth2' | 'openIdConnect' | 'mutualTLS';

export interface SecuritySchemeObject {
  type: SecuritySchemeType;
  description?: string;
  // apiKey
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  // http
  scheme?: string;
  bearerFormat?: string;
  // oauth2
  flows?: OAuthFlowsObject;
  // openIdConnect
  openIdConnectUrl?: string;
  [key: string]: unknown;
}

export interface OAuthFlowsObject {
  implicit?: OAuthFlowObject;
  password?: OAuthFlowObject;
  clientCredentials?: OAuthFlowObject;
  authorizationCode?: OAuthFlowObject;
}

export interface OAuthFlowObject {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

// ─── Internal representation (maps to Prisma models) ─────────────────────────

export interface InternalEndpoint {
  id?: string;
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: ResponsesObject;
  security?: SecurityRequirementObject[];
  deprecated: boolean;
  extensions: Record<string, unknown>;
  order: number;
}

export interface InternalSchema {
  id?: string;
  name: string;
  schema: SchemaObject;
}

export interface InternalSecurityScheme {
  id?: string;
  name: string;
  scheme: SecuritySchemeObject;
}

export interface InternalSpec {
  endpoints: InternalEndpoint[];
  schemas: InternalSchema[];
  securitySchemes: InternalSecurityScheme[];
}
