import { resolve } from 'path';
import { validateDependencyExceptions } from '../core/config-schema.js';
import type { ConfigError } from '../core/errors.js';
import type { Result } from '../core/result.js';
import type { DependencyException, LayerMap } from '../types/types.js';
import { loadJsonFile } from './json-file-loader.js';

/**
 * Load and validate dependency exceptions from a JSON file.
 */
export async function loadDependencyExceptions(
    workspaceRoot: string,
    filePath: string,
    layers: LayerMap
): Promise<Result<DependencyException[], ConfigError>> {
    const fullPath = resolve(workspaceRoot, filePath);
    const parsed = await loadJsonFile(fullPath, 'Dependency-exceptions file');
    if (!parsed.success) {
        return parsed;
    }

    const result = validateDependencyExceptions(
        parsed.value,
        layers,
        `Dependency-exceptions file "${filePath}"`
    );
    if (!result.success) {
        return result;
    }
    return { success: true, value: result.value ?? [] };
}
