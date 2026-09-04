<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/smikula/stratifyjs/master/assets/stratifyjs-logo-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/smikula/stratifyjs/master/assets/stratifyjs-logo.svg" />
    <!-- PNG fallback for renderers that don't support <picture> (e.g. npmjs.com) -->
    <img src="https://raw.githubusercontent.com/smikula/stratifyjs/master/assets/stratifyjs-logo.png" alt="Stratify logo" width="300" />
  </picture>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/stratifyjs"><img src="https://img.shields.io/npm/v/stratifyjs" alt="npm version" /></a>
  <a href="https://github.com/smikula/stratifyjs/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/stratifyjs" alt="license" /></a>
  <a href="https://www.npmjs.com/package/stratifyjs"><img src="https://img.shields.io/npm/dm/stratifyjs" alt="downloads" /></a>
</p>

# Stratify

Enforce architectural layer boundaries in monorepos. Catches invalid cross-layer dependencies at build time by analyzing internal dependency protocols (e.g. `workspace:`, `link:`, `file:`) in `package.json` files.

## Installation

```bash
npm install stratifyjs
# or
yarn add stratifyjs
```

For CLI-only usage you can install globally:

```bash
npm install -g stratifyjs
```

## Quick Start

1. Add a `"layer"` field to each workspace `package.json`:

```json
{
    "name": "my-feature",
    "layer": "features",
    "dependencies": {
        "my-core-lib": "workspace:*"
    }
}
```

2. Create a `stratify.config.json` at your workspace root:

```json
{
    "layers": {
        "features": {
            "description": "Feature packages",
            "allowedDependencies": ["core", "shared"]
        },
        "core": {
            "description": "Core business logic",
            "allowedDependencies": ["shared"]
        },
        "shared": {
            "description": "Shared utilities",
            "allowedDependencies": []
        }
    }
}
```

3. Run:

```bash
stratify --config stratify.config.json
```

## CLI Usage

```
stratify [options]
```

| Option                | Default                | Description                                          |
| --------------------- | ---------------------- | ---------------------------------------------------- |
| `-c, --config <path>` | `stratify.config.json`    | Path to the layer config file (relative to root)     |
| `-r, --root <path>`   | `process.cwd()`        | Workspace root directory                             |
| `-m, --mode <mode>`   | Config value or `warn` | Override enforcement mode: `error`, `warn`, or `off` |
| `--format <type>`     | `console`              | Output format: `console` or `json`                   |
| `-V, --version`       |                        | Print version                                        |
| `-h, --help`          |                        | Print help                                           |

### Examples

```bash
# Basic check with defaults
stratify

# Explicit config and root
stratify --config stratify.config.json --root /path/to/monorepo

# Fail CI on violations
stratify --mode error

# Machine-readable output
stratify --format json

# Combine options
stratify -c stratify.config.json -r ../.. -m error --format console
```

### Exit Codes

| Code | Meaning                                                         |
| ---- | --------------------------------------------------------------- |
| `0`  | No violations, or mode is `warn`/`off`                          |
| `1`  | Violations found and mode is `error`, or a fatal error occurred |

## Programmatic API

The library exposes a single function for custom tooling, editor integrations, or CI pipelines.

### `validateLayers(options?)`

Validate monorepo packages against architectural layer rules.

```typescript
import { validateLayers, StratifyError } from 'stratifyjs';

try {
    const result = await validateLayers({
        workspaceRoot: '/path/to/monorepo',
        configPath: 'stratify.config.json',
        mode: 'error', // optional override
    });

    console.log(`Checked ${result.totalPackages} packages, found ${result.violations.length} violations`);

    for (const v of result.violations) {
        console.log(v.detailedMessage);
    }
    for (const usage of result.acceptedExceptions) {
        console.log(usage.exception.owner, usage.acceptedEdges);
    }
} catch (error) {
    if (error instanceof StratifyError) {
        console.error(error.type, error.message);
    }
}
```

### Options

| Field           | Type             | Default                  | Description                                    |
| --------------- | ---------------- | ------------------------ | ---------------------------------------------- |
| `workspaceRoot` | `string`         | `process.cwd()`          | Workspace root directory                       |
| `configPath`    | `string`         | `'stratify.config.json'` | Path to config file, relative to workspaceRoot |
| `config`        | `StratifyConfig` | —                        | Pre-built config (skips file loading). `workspaces` and `enforcement` are optional — defaults are applied when omitted. |
| `mode`          | `string`         | From config              | Override: `'error'`, `'warn'`, or `'off'`      |

### Result

| Field                | Type                            | Description                                                   |
| -------------------- | ------------------------------- | ------------------------------------------------------------- |
| `violations`         | `Violation[]`                   | All violations found                                          |
| `acceptedExceptions` | `AcceptedDependencyException[]` | Configured exceptions and the real dependency edges they used |
| `totalPackages`      | `number`                        | Number of discovered packages                                 |
| `duration`           | `number`                        | Elapsed time in milliseconds                                  |

Each `Violation` has a short `message` for programmatic use and a rich `detailedMessage` with actionable context for human-readable output.

### Pre-built config

You can pass a config object directly instead of loading from a file:

```typescript
import { validateLayers } from 'stratifyjs';

const result = await validateLayers({
    workspaceRoot: '/path/to/monorepo',
    config: {
        layers: {
            features: { allowedDependencies: ['core'] },
            core: { allowedDependencies: [] },
        },
        // enforcement and workspaces are optional — defaults applied automatically
    },
});
```

### Error handling

Infrastructure failures (missing config, bad JSON, discovery errors) throw a `StratifyError`:

```typescript
import { validateLayers, StratifyError } from 'stratifyjs';

try {
    const result = await validateLayers();
} catch (error) {
    if (error instanceof StratifyError) {
        // error.type: 'config-not-found' | 'config-parse-error' | 'glob-failed' | ...
        console.error(error.message);
    }
}
```

## Config File Format

The config file (default: `stratify.config.json`) is a JSON object with four sections:

```json
{
  "layers": { ... },
  "dependencyExceptions": [ ... ],
  "enforcement": { ... },
  "workspaces": { ... }
}
```

### `layers` (required)

A map of layer names to their definitions. Each layer must specify which other layers it is allowed to depend on.

```json
{
    "layers": {
        "adapters": {
            "description": "I/O and external integrations",
            "allowedDependencies": ["core", "types"]
        },
        "core": {
            "description": "Pure business logic",
            "allowedDependencies": ["types"]
        },
        "types": {
            "description": "Shared type definitions",
            "allowedDependencies": []
        }
    }
}
```

| Field                 | Type       | Required | Description                                                          |
| --------------------- | ---------- | -------- | -------------------------------------------------------------------- |
| `description`         | `string`   | No       | Human-readable description of the layer's purpose                    |
| `allowedDependencies` | `string[]` | **Yes**  | Layer names this layer may depend on. Use `"*"` to allow all layers. |
| `allowedPackages`     | `string[]` | No       | Inline list of package names allowed to declare this layer. An empty array prevents every package from declaring it. Mutually exclusive with `allowedPackagesFile`. |
| `allowedPackagesFile` | `string`   | No       | Path to a JSON file (relative to workspace root) containing an array of allowed package names. Mutually exclusive with `allowedPackages`. |

### `enforcement` (optional)

Controls how violations are reported.

```json
{
    "enforcement": {
        "mode": "error"
    }
}
```

| Field  | Type                         | Default  | Description                                                               |
| ------ | ---------------------------- | -------- | ------------------------------------------------------------------------- |
| `mode` | `"error" \| "warn" \| "off"` | `"warn"` | `error` = non-zero exit on violations; `warn` = report only; `off` = skip |

### `workspaces` (optional)

Controls which packages are discovered and how internal dependencies are detected.

```json
{
    "workspaces": {
        "patterns": ["packages/**/*", "shared/**/*"],
        "protocols": ["workspace:", "link:"],
        "ignore": ["**/node_modules/**", "**/lib/**", "**/dist/**", "**/build/**"],
        "dependencyTypes": ["dependencies"]
    }
}
```

| Field              | Type       | Default                                                    | Description                                                                                               |
| ------------------ | ---------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `patterns`         | `string[]` | `["packages/**/*"]`                                        | Glob patterns to locate workspace packages (each must contain a `package.json`)                           |
| `protocols`        | `string[]` | `["workspace:"]`                                           | Version-string prefixes that identify internal dependencies. Common values: `"workspace:"`, `"link:"`, `"portal:"`, `"file:"` |
| `ignore`           | `string[]` | `["**/node_modules/**", "**/lib/**", "**/dist/**"]`        | Glob patterns to exclude from package discovery                                                           |
| `dependencyTypes`  | `string[]` | `["dependencies"]`                                         | Which `package.json` dependency fields to check. Valid values: `"dependencies"`, `"devDependencies"`, `"peerDependencies"` |

## Layer Definition Reference

### Package Assignment

Each workspace package declares its layer via the `"layer"` field in `package.json`:

```json
{
    "name": "my-package",
    "version": "1.0.0",
    "layer": "core"
}
```

Packages missing the `"layer"` field produce a `missing-layer` violation.

### Dependency Detection

By default, only `workspace:` protocol dependencies are checked. You can configure additional protocols (e.g. `link:`, `portal:`, `file:`) via the `workspaces.protocols` config field.

By default, only the `dependencies` field is scanned — this represents the true runtime/production boundary between packages. If you also want to enforce layer rules on build-time or test-time dependencies, add `"devDependencies"` and/or `"peerDependencies"` to `workspaces.dependencyTypes`:

```json
{
    "workspaces": {
        "dependencyTypes": ["dependencies", "devDependencies"]
    }
}
```

| Value                | Meaning                                                       |
| -------------------- | ------------------------------------------------------------- |
| `"dependencies"`     | Production/runtime dependencies (default, always recommended) |
| `"devDependencies"`  | Build tools, test helpers, linters                            |
| `"peerDependencies"` | Peer contracts provided by the consumer                       |

External (npm registry) dependencies are ignored — layers only govern internal monorepo boundaries.

### Violation Types

| Type                 | Description                                                                    |
| -------------------- | ------------------------------------------------------------------------------ |
| `missing-layer`      | Package has no `"layer"` field in its `package.json`                           |
| `unknown-layer`      | Package declares a layer not defined in the config                             |
| `invalid-dependency` | Package depends on another package whose layer is not in `allowedDependencies` |
| `unauthorized-layer-member` | Package declares a layer that has an allowlist, but the package is not in it |

### Layer Membership Control

You can restrict which packages are allowed to belong to a specific layer. This is useful for preventing growth of tech-debt layers, limiting entry points to approved app shells, or requiring approval before packages join privileged layers.

**Inline allowlist** — for layers with a small, stable set of members:

```json
{
    "layers": {
        "entry": {
            "description": "App bootstraps — only approved entry points",
            "allowedDependencies": ["features", "core", "shared"],
            "allowedPackages": ["@myapp/web-main", "@myapp/web-admin"]
        }
    }
}
```

**External JSON file** — for layers with many members (keeps the config readable):

```json
{
    "layers": {
        "legacy": {
            "description": "Existing packages not yet migrated",
            "allowedDependencies": ["*"],
            "allowedPackagesFile": "legacy-packages.json"
        }
    }
}
```

Where `legacy-packages.json` is a sorted JSON array checked into source control:

```json
[
    "@myapp/old-auth",
    "@myapp/old-cart",
    "@myapp/old-checkout"
]
```

The two fields are mutually exclusive — specifying both on the same layer is a config validation error. An empty inline array or empty file is a valid restrict-all allowlist. Layers without either field remain unrestricted.

### Dependency Exceptions

`dependencyExceptions` records narrow, owned acknowledgements for real runtime dependency edges that violate the layer rules. Exact package-to-package exceptions are preferred:

```json
{
    "dependencyExceptions": [
        {
            "fromPackage": "@example/checkout",
            "toPackage": "@example/legacy-payments",
            "owner": "payments-platform",
            "reason": "Temporary bridge while payment authorization is migrated"
        }
    ]
}
```

A layer may consume one designated target capability when multiple packages require the same exception:

```json
{
    "dependencyExceptions": [
        {
            "fromLayer": "features",
            "toPackage": "@example/audit-client",
            "owner": "architecture",
            "reason": "Designated audit capability for feature packages"
        }
    ]
}
```

Each entry must use exactly one supported scope:

| Scope | Required fields | Meaning |
| ----- | --------------- | ------- |
| Exact edge | `fromPackage`, `toPackage`, `owner`, `reason` | Allows one package to depend on one package |
| Designated capability | `fromLayer`, `toPackage`, `owner`, `reason` | Allows packages in one layer to depend on one package |

Broad layer-to-layer exceptions are intentionally unsupported. `owner` and `reason` must be non-empty. Source layers and all referenced packages must exist, and each exception must match at least one discovered runtime dependency that would otherwise violate `allowedDependencies`. Duplicate, overlapping, stale, unnecessary, and otherwise unused exceptions are configuration errors.

Successful uses are never hidden: the API returns them in `acceptedExceptions`, and both console and JSON CLI output report them separately from violations. Each accepted item includes the resolved exception and its `acceptedEdges`.

### Wildcard Dependencies

Use `"*"` to allow a layer to depend on any other layer:

```json
{
    "layers": {
        "app": {
            "description": "Application entry points — can use anything",
            "allowedDependencies": ["*"]
        }
    }
}
```

### Full Config Example

```json
{
    "layers": {
        "app": {
            "description": "Application entry points",
            "allowedDependencies": ["features", "core", "shared"]
        },
        "features": {
            "description": "Feature modules",
            "allowedDependencies": ["core", "shared"]
        },
        "core": {
            "description": "Core business logic",
            "allowedDependencies": ["shared"]
        },
        "shared": {
            "description": "Shared utilities and types",
            "allowedDependencies": []
        }
    },
    "dependencyExceptions": [
        {
            "fromPackage": "@example/checkout",
            "toPackage": "@example/audit-client",
            "owner": "architecture",
            "reason": "Temporary migration bridge"
        }
    ],
    "enforcement": {
        "mode": "error"
    },
    "workspaces": {
        "patterns": ["packages/**/*", "libs/**/*"],
        "protocols": ["workspace:"],
        "ignore": ["**/node_modules/**", "**/lib/**", "**/dist/**"],
        "dependencyTypes": ["dependencies"]
    }
}
```

## CI Integration

Add to your CI pipeline to enforce boundaries on every PR:

```yaml
# GitHub Actions
- name: Enforce layers
  run: npx stratify --config stratify.config.json --mode error
```

```yaml
# Azure Pipelines
- script: npx stratify --config stratify.config.json --mode error
  displayName: 'Enforce layer boundaries'
```

## Development

```bash
# Install dependencies
yarn install

# Run tests
yarn test

# Run tests in watch mode
yarn test:watch

# Build (compile TypeScript → lib/)
yarn build

# Type-check without emitting
yarn typecheck
```

## Documenting Changes

This project uses [Beachball](https://microsoft.github.io/beachball/) to manage versioning and changelogs. Every PR that affects the published package must include a change file. Run `yarn change` before submitting your PR and follow the prompts. CI will fail if the change file is missing.

> PRs that only touch tests, documentation, or configuration files are excluded from this requirement.

## License

MIT
