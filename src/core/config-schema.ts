import type {
    StratifyConfig,
    LayerDefinition,
    LayerMap,
    EnforcementConfig,
    WorkspaceConfig,
    DependencyException,
} from '../types/types.js';
import type { ConfigError } from './errors.js';
import type { Result } from './result.js';
import { ok, err } from './result.js';
import { VALID_ENFORCEMENT_MODES, VALID_DEPENDENCY_TYPES } from './constants.js';

/**
 * Validate that a raw parsed object conforms to the StratifyConfig schema.
 *
 * @param raw - The raw parsed JSON object to validate
 * @returns A Result containing the validated StratifyConfig, or a ConfigError with details of all validation issues
 */
export function validateConfigSchema(raw: unknown): Result<StratifyConfig, ConfigError> {
    if (typeof raw !== 'object' || raw === null) {
        return err({ type: 'config-validation-error', message: 'Config must be a JSON object' });
    }

    const obj = raw as Record<string, unknown>;

    // Validate 'layers' field
    if (typeof obj.layers !== 'object' || obj.layers === null) {
        return err({
            type: 'config-validation-error',
            message: 'Config must have a "layers" object',
        });
    }

    // Validate each layer definition
    const layers = obj.layers as Record<string, unknown>;
    const errors: string[] = [];

    for (const [layerName, layerDef] of Object.entries(layers)) {
        const result = validateLayerDefinition(layerName, layerDef);
        if (!result.success) {
            errors.push(result.error.message);
        }
    }

    if (errors.length > 0) {
        return err({
            type: 'config-validation-error',
            message: 'Invalid layer definitions',
            details: errors,
        });
    }

    if (obj.dependencyExceptions !== undefined && obj.dependencyExceptionsFile !== undefined) {
        return err({
            type: 'config-validation-error',
            message:
                'Config has both "dependencyExceptions" and "dependencyExceptionsFile" — use one or the other',
        });
    }

    if (
        obj.dependencyExceptionsFile !== undefined &&
        (typeof obj.dependencyExceptionsFile !== 'string' ||
            obj.dependencyExceptionsFile.trim() === '')
    ) {
        return err({
            type: 'config-validation-error',
            message: '"dependencyExceptionsFile" must be a non-empty string',
        });
    }

    const dependencyExceptionsResult = validateDependencyExceptions(
        obj.dependencyExceptions,
        layers
    );
    if (!dependencyExceptionsResult.success) {
        return dependencyExceptionsResult;
    }

    // Validate optional 'enforcement' field
    if (obj.enforcement !== undefined) {
        if (typeof obj.enforcement !== 'object' || obj.enforcement === null) {
            return err({
                type: 'config-validation-error',
                message: '"enforcement" field must be an object if defined',
            });
        }

        const enforcement = obj.enforcement as Record<string, unknown>;
        if (
            enforcement.mode !== undefined &&
            (typeof enforcement.mode !== 'string' ||
                !(VALID_ENFORCEMENT_MODES as readonly string[]).includes(enforcement.mode))
        ) {
            return err({
                type: 'config-validation-error',
                message: `Invalid enforcement mode: "${enforcement.mode}". Must be ${VALID_ENFORCEMENT_MODES.map(m => `"${m}"`).join(', ')}`,
            });
        }
    }

    // Validate optional 'workspaces'
    if (obj.workspaces !== undefined) {
        if (typeof obj.workspaces !== 'object' || obj.workspaces === null) {
            return err({
                type: 'config-validation-error',
                message: '"workspaces" must be an object',
            });
        }
        const workspaces = obj.workspaces as Record<string, unknown>;
        if (
            workspaces.patterns !== undefined &&
            (!Array.isArray(workspaces.patterns) ||
                !workspaces.patterns.every((p: unknown) => typeof p === 'string'))
        ) {
            return err({
                type: 'config-validation-error',
                message: '"workspaces.patterns" must be an array of strings',
            });
        }
        if (
            workspaces.protocols !== undefined &&
            (!Array.isArray(workspaces.protocols) ||
                !workspaces.protocols.every((p: unknown) => typeof p === 'string'))
        ) {
            return err({
                type: 'config-validation-error',
                message: '"workspaces.protocols" must be an array of strings',
            });
        }
        if (
            workspaces.ignore !== undefined &&
            (!Array.isArray(workspaces.ignore) ||
                !workspaces.ignore.every((p: unknown) => typeof p === 'string'))
        ) {
            return err({
                type: 'config-validation-error',
                message: '"workspaces.ignore" must be an array of strings',
            });
        }
        if (workspaces.dependencyTypes !== undefined) {
            if (
                !Array.isArray(workspaces.dependencyTypes) ||
                workspaces.dependencyTypes.length === 0 ||
                !workspaces.dependencyTypes.every((t: unknown) => typeof t === 'string')
            ) {
                return err({
                    type: 'config-validation-error',
                    message: '"workspaces.dependencyTypes" must be a non-empty array of strings',
                });
            }
            const invalid = (workspaces.dependencyTypes as string[]).filter(
                t => !(VALID_DEPENDENCY_TYPES as readonly string[]).includes(t)
            );
            if (invalid.length > 0) {
                return err({
                    type: 'config-validation-error',
                    message: `Invalid dependency type(s): ${invalid.map(t => `"${t}"`).join(', ')}. Valid values: ${VALID_DEPENDENCY_TYPES.map(t => `"${t}"`).join(', ')}`,
                });
            }
        }
    }

    return ok({
        layers: obj.layers as LayerMap,
        enforcement: obj.enforcement as Partial<EnforcementConfig> | undefined,
        workspaces: obj.workspaces as Partial<WorkspaceConfig> | undefined,
        dependencyExceptions: dependencyExceptionsResult.value,
        dependencyExceptionsFile: obj.dependencyExceptionsFile as string | undefined,
    });
}

export function validateDependencyExceptions(
    raw: unknown,
    layers: Record<string, unknown>,
    source = 'dependencyExceptions'
): Result<DependencyException[] | undefined, ConfigError> {
    if (raw === undefined) {
        return ok(undefined);
    }
    if (!Array.isArray(raw)) {
        return err({
            type: 'config-validation-error',
            message:
                source === 'dependencyExceptions'
                    ? '"dependencyExceptions" must be an array'
                    : `${source} must contain a JSON array`,
        });
    }

    const errors: string[] = [];
    const exceptions: DependencyException[] = [];
    const seen = new Set<string>();
    const allowedKeys = new Set(['fromPackage', 'fromLayer', 'toPackage', 'owner', 'reason']);

    raw.forEach((value, index) => {
        const label = `${source}[${index}]`;
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            errors.push(`${label} must be an object`);
            return;
        }

        const entry = value as Record<string, unknown>;
        const unknownKeys = Object.keys(entry).filter(key => !allowedKeys.has(key));
        if (unknownKeys.length > 0) {
            errors.push(`${label} has unsupported field(s): ${unknownKeys.join(', ')}`);
        }

        const hasFromPackage = entry.fromPackage !== undefined;
        const hasFromLayer = entry.fromLayer !== undefined;
        if (hasFromPackage === hasFromLayer) {
            errors.push(`${label} must specify exactly one of "fromPackage" or "fromLayer"`);
        }

        for (const field of ['toPackage', 'owner', 'reason'] as const) {
            if (typeof entry[field] !== 'string' || entry[field].trim() === '') {
                errors.push(`${label}.${field} must be a non-empty string`);
            }
        }
        if (
            hasFromPackage &&
            (typeof entry.fromPackage !== 'string' || entry.fromPackage.trim() === '')
        ) {
            errors.push(`${label}.fromPackage must be a non-empty string`);
        }
        if (
            hasFromLayer &&
            (typeof entry.fromLayer !== 'string' || entry.fromLayer.trim() === '')
        ) {
            errors.push(`${label}.fromLayer must be a non-empty string`);
        } else if (
            hasFromLayer &&
            typeof entry.fromLayer === 'string' &&
            !Object.hasOwn(layers, entry.fromLayer)
        ) {
            errors.push(`${label} references unknown source layer "${entry.fromLayer}"`);
        }

        const isValid =
            unknownKeys.length === 0 &&
            hasFromPackage !== hasFromLayer &&
            typeof entry.toPackage === 'string' &&
            entry.toPackage.trim() !== '' &&
            typeof entry.owner === 'string' &&
            entry.owner.trim() !== '' &&
            typeof entry.reason === 'string' &&
            entry.reason.trim() !== '' &&
            (hasFromPackage
                ? typeof entry.fromPackage === 'string' && entry.fromPackage.trim() !== ''
                : typeof entry.fromLayer === 'string' &&
                  entry.fromLayer.trim() !== '' &&
                  Object.hasOwn(layers, entry.fromLayer));

        if (!isValid) {
            return;
        }

        const key = hasFromPackage
            ? `package:${entry.fromPackage as string}->${entry.toPackage}`
            : `layer:${entry.fromLayer as string}->${entry.toPackage}`;
        if (seen.has(key)) {
            errors.push(`${label} duplicates an earlier exception for ${key}`);
            return;
        }
        seen.add(key);

        if (hasFromPackage) {
            exceptions.push({
                fromPackage: entry.fromPackage as string,
                toPackage: entry.toPackage as string,
                owner: entry.owner as string,
                reason: entry.reason as string,
            });
        } else {
            exceptions.push({
                fromLayer: entry.fromLayer as string,
                toPackage: entry.toPackage as string,
                owner: entry.owner as string,
                reason: entry.reason as string,
            });
        }
    });

    if (errors.length > 0) {
        return err({
            type: 'config-validation-error',
            message: 'Invalid dependency exceptions',
            details: errors,
        });
    }

    return ok(exceptions);
}

/**
 * Validate a single layer definition.
 *
 * @param name - The name of the layer (for error messages)
 * @param raw - The raw layer definition object to validate
 * @returns A Result containing the validated LayerDefinition, or a ConfigError
 */
export function validateLayerDefinition(
    name: string,
    raw: unknown
): Result<LayerDefinition, ConfigError> {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return err({
            type: 'config-validation-error',
            message: `Layer "${name}" must be an object`,
        });
    }

    const def = raw as Record<string, unknown>;

    if (!Array.isArray(def.allowedDependencies)) {
        return err({
            type: 'config-validation-error',
            message: `Layer "${name}" must have an "allowedDependencies" array`,
        });
    }

    if (!def.allowedDependencies.every((d: unknown) => typeof d === 'string')) {
        return err({
            type: 'config-validation-error',
            message: `Layer "${name}" allowedDependencies must contain only strings`,
        });
    }

    // Validate allowedPackages (optional inline list)
    if (def.allowedPackages !== undefined) {
        if (
            !Array.isArray(def.allowedPackages) ||
            !def.allowedPackages.every((p: unknown) => typeof p === 'string')
        ) {
            return err({
                type: 'config-validation-error',
                message: `Layer "${name}" allowedPackages must be an array of strings`,
            });
        }
    }

    // Validate allowedPackagesFile (optional external file path)
    if (def.allowedPackagesFile !== undefined) {
        if (typeof def.allowedPackagesFile !== 'string' || def.allowedPackagesFile.trim() === '') {
            return err({
                type: 'config-validation-error',
                message: `Layer "${name}" allowedPackagesFile must be a non-empty string`,
            });
        }
    }

    // Mutual exclusion: cannot have both
    if (def.allowedPackages !== undefined && def.allowedPackagesFile !== undefined) {
        return err({
            type: 'config-validation-error',
            message: `Layer "${name}" has both "allowedPackages" and "allowedPackagesFile" — use one or the other`,
        });
    }

    return ok({
        description: typeof def.description === 'string' ? def.description : undefined,
        allowedDependencies: def.allowedDependencies as string[],
        allowedPackages: def.allowedPackages as string[] | undefined,
        allowedPackagesFile: def.allowedPackagesFile as string | undefined,
    });
}
