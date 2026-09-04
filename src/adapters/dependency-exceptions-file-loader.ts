import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { validateDependencyExceptions } from '../core/config-schema.js';
import type { ConfigError } from '../core/errors.js';
import { err } from '../core/result.js';
import type { Result } from '../core/result.js';
import type { DependencyException, LayerMap } from '../types/types.js';

/**
 * Load and validate dependency exceptions from a JSON file.
 */
export async function loadDependencyExceptions(
    workspaceRoot: string,
    filePath: string,
    layers: LayerMap
): Promise<Result<DependencyException[], ConfigError>> {
    const fullPath = resolve(workspaceRoot, filePath);

    let content: string;
    try {
        content = await readFile(fullPath, 'utf-8');
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
            return err({
                type: 'config-not-found',
                message: `Dependency-exceptions file not found: ${fullPath}`,
                path: fullPath,
            });
        }
        return err({
            type: 'config-read-error',
            message: error instanceof Error ? error.message : String(error),
            path: fullPath,
            cause: error,
        });
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch (error) {
        return err({
            type: 'config-parse-error',
            message: error instanceof Error ? error.message : String(error),
            path: fullPath,
            cause: error,
        });
    }

    const result = validateDependencyExceptions(
        parsed,
        layers,
        `Dependency-exceptions file "${filePath}"`
    );
    if (!result.success) {
        return result;
    }
    return { success: true, value: result.value ?? [] };
}
