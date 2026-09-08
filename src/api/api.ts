import { resolve } from 'path';
import { loadAllowedPackages } from '../adapters/allowlist-file-loader.js';
import { loadConfigFromFile } from '../adapters/config-file-loader.js';
import { loadDependencyExceptions } from '../adapters/dependency-exceptions-file-loader.js';
import { discoverPackages } from '../adapters/file-system-discovery.js';
import { applyDefaults } from '../core/config-defaults.js';
import { validateConfigSchema } from '../core/config-schema.js';
import { DEFAULT_CONFIG_FILENAME } from '../core/constants.js';
import { StratifyError } from '../core/errors.js';
import { validatePackagesWithExceptions } from '../core/validation.js';
import type {
    AcceptedDependencyException,
    StratifyConfig,
    StratifyResolvedConfig,
    Violation,
    EnforcementMode,
} from '../types/types.js';

/**
 * Options for the validateLayers API.
 */
export interface ValidateLayersOptions {
    /** Workspace root directory. Defaults to process.cwd(). */
    workspaceRoot?: string;
    /** Path to the config file, relative to workspaceRoot. */
    configPath?: string;
    /** Provide a pre-built config directly, skipping file loading. */
    config?: StratifyConfig;
    /** Override the enforcement mode from config. */
    mode?: EnforcementMode;
}

/**
 * Result of running layer validation.
 */
export interface ValidateLayersResult {
    violations: Violation[];
    acceptedExceptions: AcceptedDependencyException[];
    totalPackages: number;
    duration: number;
}

/**
 * Validate monorepo packages against architectural layer rules.
 *
 * @param options - Configuration and workspace options.
 * @returns Violations, accepted exception usage, total package count, and duration.
 * @throws {StratifyError} On config loading/parsing or package discovery failures.
 *
 * @example
 * ```ts
 * import { validateLayers, StratifyError } from 'stratifyjs';
 *
 * try {
 *   const result = await validateLayers({ workspaceRoot: '.' });
 *   for (const v of result.violations) {
 *     console.log(v.detailedMessage);
 *   }
 * } catch (e) {
 *   if (e instanceof StratifyError) {
 *     console.error(e.message);
 *   }
 * }
 * ```
 */
export async function validateLayers(
    options: ValidateLayersOptions = {}
): Promise<ValidateLayersResult> {
    const startTime = performance.now();

    const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());

    // Resolve config
    let config: StratifyResolvedConfig;
    if (options.config) {
        const configResult = validateConfigSchema(options.config);
        if (!configResult.success) {
            throw new StratifyError(configResult.error);
        }
        config = applyDefaults(configResult.value);
    } else {
        const configPath = options.configPath ?? DEFAULT_CONFIG_FILENAME;
        const configResult = await loadConfigFromFile(workspaceRoot, configPath);
        if (!configResult.success) {
            throw new StratifyError(configResult.error);
        }
        config = configResult.value;
    }

    config = await resolveDependencyExceptions(config, workspaceRoot);

    // Apply mode override
    if (options.mode) {
        config = {
            ...config,
            enforcement: { ...config.enforcement, mode: options.mode },
        };
    }

    // Short-circuit when enforcement is off — skip all discovery and validation
    if (config.enforcement.mode === 'off' && config.dependencyExceptions.length === 0) {
        const duration = performance.now() - startTime;
        return { violations: [], acceptedExceptions: [], totalPackages: 0, duration };
    }

    // Discover packages
    const discoveryResult = await discoverPackages(workspaceRoot, config.workspaces);
    if (!discoveryResult.success) {
        throw new StratifyError(discoveryResult.error);
    }

    const { packages } = discoveryResult.value;

    // Resolve allowed-packages for layers with membership constraints
    const allowedPackagesByLayer = await resolveAllowedPackages(config, workspaceRoot);

    // Validate packages against config
    const validation = validatePackagesWithExceptions(packages, config, allowedPackagesByLayer);
    if (validation.exceptionErrors.length > 0) {
        throw new StratifyError({
            type: 'config-validation-error',
            message: 'Invalid dependency exceptions',
            details: validation.exceptionErrors,
        });
    }

    const duration = performance.now() - startTime;

    return {
        violations: config.enforcement.mode === 'off' ? [] : validation.violations,
        acceptedExceptions: validation.acceptedExceptions,
        totalPackages: packages.length,
        duration,
    };
}

async function resolveDependencyExceptions(
    config: StratifyResolvedConfig,
    workspaceRoot: string
): Promise<StratifyResolvedConfig> {
    if (config.dependencyExceptionsFile === undefined) {
        return config;
    }

    const result = await loadDependencyExceptions(
        workspaceRoot,
        config.dependencyExceptionsFile,
        config.layers
    );
    if (!result.success) {
        throw new StratifyError(result.error);
    }

    return {
        ...config,
        dependencyExceptions: result.value,
    };
}

/**
 * Resolve allowed-packages sets for all layers that define membership constraints.
 * Returns a Map from layer name to the resolved Set of allowed package names.
 *
 * @param config - The stratify configuration object.
 * @param workspaceRoot - The root directory of the workspace, used to resolve file paths.
 * @returns A Map where keys are layer names and values are Sets of allowed package names.
 * @throws {StratifyError} If loading any allowed-packages file fails.
 */
async function resolveAllowedPackages(
    config: StratifyResolvedConfig,
    workspaceRoot: string
): Promise<Map<string, Set<string>>> {
    const map = new Map<string, Set<string>>();

    // Separate inline allowedPackages (sync) from file-based ones (async)
    const fileLoads: { layerName: string; filePath: string }[] = [];

    for (const [layerName, layerDef] of Object.entries(config.layers)) {
        if (layerDef.allowedPackages !== undefined) {
            map.set(layerName, new Set(layerDef.allowedPackages));
        } else if (layerDef.allowedPackagesFile) {
            fileLoads.push({ layerName, filePath: layerDef.allowedPackagesFile });
        }
    }

    // Load all allowlist files in parallel
    const results = await Promise.all(
        fileLoads.map(async ({ layerName, filePath }) => {
            const result = await loadAllowedPackages(workspaceRoot, filePath);
            return { layerName, result };
        })
    );

    for (const { layerName, result } of results) {
        if (!result.success) {
            throw new StratifyError(result.error);
        }
        map.set(layerName, result.value);
    }

    return map;
}
