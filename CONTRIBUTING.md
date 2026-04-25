# Contributing to APIForge

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Setting up the development environment

### Prerequisites

- Node.js 20.11.x (use `.nvmrc` via `nvm use` or `.tool-versions` via `asdf install`)
- pnpm 9.x — `npm install -g pnpm`
- Docker 24+ with Compose v2
- Go 1.23+ (for mock server and CLI)
- Rust 1.82+ stable (for generator service)

### First-time setup

```bash
# Clone the repo
git clone https://github.com/your-org/apiforge.git
cd apiforge

# Install all workspace dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start all backing services (postgres, redis, minio, nats)
docker compose up -d

# Start all apps in dev mode
pnpm dev
```

The web UI is at `http://localhost:3000` and the backend API at `http://localhost:4000`.

## Branch naming

All work branches should follow this pattern:

| Prefix | Use for |
|--------|---------|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `chore/` | Maintenance, deps, tooling |
| `docs/` | Documentation only |

Example: `feat/openapi-3.1-validator`

Branches are rebased onto `main` before opening a PR. We squash-merge; the PR title becomes the commit message.

## Commit messages — Conventional Commits

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional longer body]
```

### Types

`feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `perf` · `ci`

### Scopes (from the monorepo)

| Scope | Package/App |
|-------|------------|
| `web` | `apps/web` |
| `backend` | `apps/backend` |
| `mock` | `apps/mock-server` |
| `generator` | `apps/generator` |
| `cli` | `apps/cli` |
| `desktop` | `apps/desktop` |
| `db` | `packages/db` |
| `ui` | `packages/ui` |
| `mcp` | `packages/mcp-tools` |
| `docs` | `docs/` |
| `deploy` | `deploy/` |

Example: `feat(backend): add OpenAPI 3.1 spec validator`

A `commit-msg` hook validates the format automatically.

## Running tests

```bash
# All tests across the monorepo
pnpm test

# Tests for a single package
pnpm --filter @apiforge/backend test

# With coverage
pnpm --filter @apiforge/backend test -- --coverage
```

## Linting and formatting

We use [Biome](https://biomejs.dev/) for both linting and formatting (replaces ESLint + Prettier).

```bash
# Check all files
pnpm lint

# Auto-fix and format
pnpm format
```

The `pre-commit` hook runs `lint-staged` automatically, so staged files are always formatted before commit.

## Code style

- 2-space indent, single quotes, trailing commas, 100-char line width (enforced by Biome)
- TypeScript strict mode — no `any`, no `!` non-null assertions without justification
- No cross-package relative imports — always use `@apiforge/<pkg-name>`
- Types: PascalCase, no `I` prefix (`User` not `IUser`)
- Files: kebab-case for utilities, PascalCase for React components

## Pull requests

1. Open a PR against `main`
2. Fill in the PR template
3. CI must be green (lint + typecheck + test + build)
4. At least one maintainer approval required
5. Squash-merge — PR title becomes the commit message, so make it a valid Conventional Commit

## License

By contributing, you agree that your contributions will be licensed under the [Apache 2.0 License](LICENSE).
