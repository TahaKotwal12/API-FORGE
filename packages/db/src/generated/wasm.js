
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  name: 'name',
  avatarUrl: 'avatarUrl',
  passwordHash: 'passwordHash',
  emailVerified: 'emailVerified',
  createdAt: 'createdAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.SessionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  token: 'token',
  userAgent: 'userAgent',
  ip: 'ip',
  createdAt: 'createdAt',
  expiresAt: 'expiresAt'
};

exports.Prisma.MfaSecretScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  secret: 'secret',
  verified: 'verified',
  createdAt: 'createdAt'
};

exports.Prisma.RefreshTokenScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  tokenHash: 'tokenHash',
  userAgent: 'userAgent',
  ip: 'ip',
  createdAt: 'createdAt',
  expiresAt: 'expiresAt',
  revokedAt: 'revokedAt'
};

exports.Prisma.OrganizationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  plan: 'plan',
  ssoConfig: 'ssoConfig',
  createdAt: 'createdAt'
};

exports.Prisma.MembershipScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  orgId: 'orgId',
  role: 'role'
};

exports.Prisma.TeamScalarFieldEnum = {
  id: 'id',
  orgId: 'orgId',
  name: 'name'
};

exports.Prisma.TeamMemberScalarFieldEnum = {
  teamId: 'teamId',
  userId: 'userId'
};

exports.Prisma.InviteScalarFieldEnum = {
  id: 'id',
  orgId: 'orgId',
  email: 'email',
  role: 'role',
  token: 'token',
  invitedBy: 'invitedBy',
  expiresAt: 'expiresAt',
  acceptedAt: 'acceptedAt',
  createdAt: 'createdAt'
};

exports.Prisma.ProjectScalarFieldEnum = {
  id: 'id',
  orgId: 'orgId',
  name: 'name',
  slug: 'slug',
  description: 'description',
  icon: 'icon',
  defaultBranchId: 'defaultBranchId',
  visibility: 'visibility',
  gitRemoteUrl: 'gitRemoteUrl',
  gitAuthRef: 'gitAuthRef',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.BranchScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  name: 'name',
  protected: 'protected',
  parentId: 'parentId',
  headCommitId: 'headCommitId',
  createdBy: 'createdBy',
  createdAt: 'createdAt'
};

exports.Prisma.CommitScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  parentId: 'parentId',
  message: 'message',
  authorId: 'authorId',
  specSnapshotId: 'specSnapshotId',
  createdAt: 'createdAt'
};

exports.Prisma.SpecSnapshotScalarFieldEnum = {
  id: 'id',
  sha256: 'sha256',
  format: 'format',
  content: 'content',
  size: 'size',
  createdAt: 'createdAt'
};

exports.Prisma.EndpointScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  method: 'method',
  path: 'path',
  summary: 'summary',
  description: 'description',
  tags: 'tags',
  parameters: 'parameters',
  requestBody: 'requestBody',
  responses: 'responses',
  security: 'security',
  deprecated: 'deprecated',
  extensions: 'extensions',
  order: 'order',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.SchemaComponentScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  name: 'name',
  schema: 'schema'
};

exports.Prisma.SecuritySchemeScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  name: 'name',
  scheme: 'scheme'
};

exports.Prisma.EnvironmentScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  name: 'name',
  variables: 'variables',
  isDefault: 'isDefault'
};

exports.Prisma.SecretScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  key: 'key',
  ciphertext: 'ciphertext',
  dekVersion: 'dekVersion',
  createdBy: 'createdBy',
  createdAt: 'createdAt'
};

exports.Prisma.MockRuleScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  endpointId: 'endpointId',
  scenario: 'scenario',
  priority: 'priority',
  matchExpr: 'matchExpr',
  response: 'response',
  script: 'script',
  latencyMs: 'latencyMs',
  enabled: 'enabled'
};

exports.Prisma.MockRunScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  endpointId: 'endpointId',
  ruleId: 'ruleId',
  requestJson: 'requestJson',
  responseJson: 'responseJson',
  latencyMs: 'latencyMs',
  timestamp: 'timestamp'
};

exports.Prisma.TestSuiteScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  name: 'name'
};

exports.Prisma.TestScenarioScalarFieldEnum = {
  id: 'id',
  suiteId: 'suiteId',
  name: 'name',
  steps: 'steps',
  dataSource: 'dataSource'
};

exports.Prisma.TestCaseScalarFieldEnum = {
  id: 'id',
  endpointId: 'endpointId',
  name: 'name',
  input: 'input',
  assertions: 'assertions'
};

exports.Prisma.TestRunScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  suiteId: 'suiteId',
  triggeredBy: 'triggeredBy',
  status: 'status',
  startedAt: 'startedAt',
  endedAt: 'endedAt',
  summary: 'summary',
  stepResults: 'stepResults',
  reportUrl: 'reportUrl'
};

exports.Prisma.LoadTestRunScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  scenarioId: 'scenarioId',
  config: 'config',
  status: 'status',
  metricsUrl: 'metricsUrl',
  startedAt: 'startedAt',
  endedAt: 'endedAt'
};

exports.Prisma.DocPortalScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  slug: 'slug',
  customDomain: 'customDomain',
  branchId: 'branchId',
  visibility: 'visibility',
  passwordHash: 'passwordHash',
  ipAllowlist: 'ipAllowlist',
  emailAllowlist: 'emailAllowlist',
  theme: 'theme',
  seo: 'seo',
  publishedAt: 'publishedAt',
  publishedByUserId: 'publishedByUserId'
};

exports.Prisma.DocVersionScalarFieldEnum = {
  id: 'id',
  portalId: 'portalId',
  version: 'version',
  branchId: 'branchId',
  publishedAt: 'publishedAt'
};

exports.Prisma.MergeRequestScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  sourceBranch: 'sourceBranch',
  targetBranch: 'targetBranch',
  title: 'title',
  description: 'description',
  status: 'status',
  authorId: 'authorId',
  mergedBy: 'mergedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  mergedAt: 'mergedAt'
};

exports.Prisma.MrReviewScalarFieldEnum = {
  id: 'id',
  mrId: 'mrId',
  userId: 'userId',
  approved: 'approved',
  createdAt: 'createdAt'
};

exports.Prisma.MrCommentScalarFieldEnum = {
  id: 'id',
  mrId: 'mrId',
  authorId: 'authorId',
  body: 'body',
  path: 'path',
  createdAt: 'createdAt'
};

exports.Prisma.ScheduledJobScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  type: 'type',
  schedule: 'schedule',
  config: 'config',
  enabled: 'enabled',
  lastRun: 'lastRun',
  nextRun: 'nextRun'
};

exports.Prisma.AgentTokenScalarFieldEnum = {
  id: 'id',
  orgId: 'orgId',
  name: 'name',
  tokenHash: 'tokenHash',
  scopes: 'scopes',
  readOnly: 'readOnly',
  expiresAt: 'expiresAt',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  lastUsed: 'lastUsed'
};

exports.Prisma.AgentActivityScalarFieldEnum = {
  id: 'id',
  tokenId: 'tokenId',
  toolName: 'toolName',
  params: 'params',
  result: 'result',
  success: 'success',
  timestamp: 'timestamp'
};

exports.Prisma.PluginScalarFieldEnum = {
  id: 'id',
  name: 'name',
  version: 'version',
  source: 'source',
  manifest: 'manifest',
  publisher: 'publisher'
};

exports.Prisma.ProjectPluginScalarFieldEnum = {
  projectId: 'projectId',
  pluginId: 'pluginId',
  config: 'config',
  enabled: 'enabled'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  orgId: 'orgId',
  actorId: 'actorId',
  actorAgentId: 'actorAgentId',
  action: 'action',
  resource: 'resource',
  resourceId: 'resourceId',
  before: 'before',
  after: 'after',
  ip: 'ip',
  userAgent: 'userAgent',
  timestamp: 'timestamp'
};

exports.Prisma.ImportScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  source: 'source',
  sourceRef: 'sourceRef',
  status: 'status',
  scheduled: 'scheduled',
  cron: 'cron',
  lastRunAt: 'lastRunAt',
  report: 'report'
};

exports.Prisma.GenerationRunScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  userId: 'userId',
  language: 'language',
  mode: 'mode',
  options: 'options',
  status: 'status',
  specHash: 'specHash',
  errorMessage: 'errorMessage',
  createdAt: 'createdAt',
  completedAt: 'completedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.Plan = exports.$Enums.Plan = {
  FREE: 'FREE',
  TEAM: 'TEAM',
  ENTERPRISE: 'ENTERPRISE',
  SELF_HOSTED: 'SELF_HOSTED'
};

exports.Role = exports.$Enums.Role = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
  GUEST: 'GUEST'
};

exports.Visibility = exports.$Enums.Visibility = {
  PRIVATE: 'PRIVATE',
  ORG: 'ORG',
  PUBLIC: 'PUBLIC'
};

exports.SpecFormat = exports.$Enums.SpecFormat = {
  OPENAPI_3_1: 'OPENAPI_3_1',
  ASYNCAPI_2_6: 'ASYNCAPI_2_6',
  GRAPHQL: 'GRAPHQL',
  PROTOBUF: 'PROTOBUF'
};

exports.HttpMethod = exports.$Enums.HttpMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS'
};

exports.TriggerType = exports.$Enums.TriggerType = {
  MANUAL: 'MANUAL',
  SCHEDULED: 'SCHEDULED',
  CI: 'CI',
  AGENT: 'AGENT'
};

exports.RunStatus = exports.$Enums.RunStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

exports.DocVisibility = exports.$Enums.DocVisibility = {
  PUBLIC: 'PUBLIC',
  PASSWORD: 'PASSWORD',
  IP_ALLOWLIST: 'IP_ALLOWLIST',
  EMAIL_ALLOWLIST: 'EMAIL_ALLOWLIST',
  SSO: 'SSO'
};

exports.MrStatus = exports.$Enums.MrStatus = {
  OPEN: 'OPEN',
  MERGED: 'MERGED',
  CLOSED: 'CLOSED'
};

exports.JobType = exports.$Enums.JobType = {
  TEST_RUN: 'TEST_RUN',
  SPEC_IMPORT: 'SPEC_IMPORT',
  BACKUP: 'BACKUP',
  DOC_PUBLISH: 'DOC_PUBLISH'
};

exports.ImportSource = exports.$Enums.ImportSource = {
  POSTMAN: 'POSTMAN',
  INSOMNIA: 'INSOMNIA',
  SWAGGER: 'SWAGGER',
  OPENAPI: 'OPENAPI',
  HAR: 'HAR',
  CURL: 'CURL',
  GIT_URL: 'GIT_URL',
  APIDOG: 'APIDOG',
  HOPPSCOTCH: 'HOPPSCOTCH',
  WSDL: 'WSDL'
};

exports.ImportStatus = exports.$Enums.ImportStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

exports.GenerationStatus = exports.$Enums.GenerationStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

exports.Prisma.ModelName = {
  User: 'User',
  Session: 'Session',
  MfaSecret: 'MfaSecret',
  RefreshToken: 'RefreshToken',
  Organization: 'Organization',
  Membership: 'Membership',
  Team: 'Team',
  TeamMember: 'TeamMember',
  Invite: 'Invite',
  Project: 'Project',
  Branch: 'Branch',
  Commit: 'Commit',
  SpecSnapshot: 'SpecSnapshot',
  Endpoint: 'Endpoint',
  SchemaComponent: 'SchemaComponent',
  SecurityScheme: 'SecurityScheme',
  Environment: 'Environment',
  Secret: 'Secret',
  MockRule: 'MockRule',
  MockRun: 'MockRun',
  TestSuite: 'TestSuite',
  TestScenario: 'TestScenario',
  TestCase: 'TestCase',
  TestRun: 'TestRun',
  LoadTestRun: 'LoadTestRun',
  DocPortal: 'DocPortal',
  DocVersion: 'DocVersion',
  MergeRequest: 'MergeRequest',
  MrReview: 'MrReview',
  MrComment: 'MrComment',
  ScheduledJob: 'ScheduledJob',
  AgentToken: 'AgentToken',
  AgentActivity: 'AgentActivity',
  Plugin: 'Plugin',
  ProjectPlugin: 'ProjectPlugin',
  AuditLog: 'AuditLog',
  Import: 'Import',
  GenerationRun: 'GenerationRun'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
