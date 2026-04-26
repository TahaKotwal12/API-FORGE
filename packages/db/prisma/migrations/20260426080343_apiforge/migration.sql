-- DropForeignKey
ALTER TABLE "AgentToken" DROP CONSTRAINT "AgentToken_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "Branch" DROP CONSTRAINT "Branch_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "Commit" DROP CONSTRAINT "Commit_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Commit" DROP CONSTRAINT "Commit_specSnapshotId_fkey";

-- DropForeignKey
ALTER TABLE "DocPortal" DROP CONSTRAINT "DocPortal_branchId_fkey";

-- DropForeignKey
ALTER TABLE "DocPortal" DROP CONSTRAINT "DocPortal_publishedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "DocVersion" DROP CONSTRAINT "DocVersion_branchId_fkey";

-- DropForeignKey
ALTER TABLE "LoadTestRun" DROP CONSTRAINT "LoadTestRun_scenarioId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectPlugin" DROP CONSTRAINT "ProjectPlugin_pluginId_fkey";

-- DropForeignKey
ALTER TABLE "Secret" DROP CONSTRAINT "Secret_createdBy_fkey";

-- AlterTable
ALTER TABLE "AgentActivity" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AgentToken" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Branch" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Commit" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DocPortal" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "ipAllowlist" DROP DEFAULT,
ALTER COLUMN "emailAllowlist" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DocVersion" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Endpoint" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "tags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Environment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Import" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Invite" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "token" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LoadTestRun" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Membership" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MfaSecret" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MockRule" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MockRun" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Plugin" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RefreshToken" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ScheduledJob" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SchemaComponent" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Secret" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SecurityScheme" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SpecSnapshot" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Team" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TestCase" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TestRun" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TestScenario" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TestSuite" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commit" ADD CONSTRAINT "Commit_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commit" ADD CONSTRAINT "Commit_specSnapshotId_fkey" FOREIGN KEY ("specSnapshotId") REFERENCES "SpecSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadTestRun" ADD CONSTRAINT "LoadTestRun_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "TestScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocPortal" ADD CONSTRAINT "DocPortal_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocPortal" ADD CONSTRAINT "DocPortal_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocVersion" ADD CONSTRAINT "DocVersion_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToken" ADD CONSTRAINT "AgentToken_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPlugin" ADD CONSTRAINT "ProjectPlugin_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "Plugin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
