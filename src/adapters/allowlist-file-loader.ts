import { resolve } from 'path';
import type { ConfigError } from '../core/errors.js';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import { loadJsonFile } from './json-file-loader.js';

/**
 * Load an allowed-packages JSON file from disk and return the set of package names.
 * I/O adapter — reads from the file system.
 *
 * The file must contain a JSON array of package name strings, e.g.:
 * ["@scope/pkg-a", "@scope/pkg-b"]
 *
 * @param workspaceRoot - Absolute path to the workspace root.
 * @param filePath - Path to the allowlist file, relative to workspaceRoot.
 * @returns A Result containing the set of allowed package names, or a ConfigError.
 */
export async function loadAllowedPackages(
    workspaceRoot: string,
    filePath: string
): Promise<Result<Set<string>, ConfigError>> {
    const fullPath = resolve(workspaceRoot, filePath);
    const parsed = await loadJsonFile(fullPath, 'Allowed-packages file');
    if (!parsed.success) {
        return parsed;
    }

    return validateAllowlistContent(parsed.value, filePath);
}

/**
 * Validate that parsed JSON is an array of strings.
 *
 * @param parsed - The parsed JSON content to validate
 * @param filePath - The path to the file (for error messages)
 * @returns A Result containing a Set of allowed package names, or a ConfigError if validation fails
 */
export function validateAllowlistContent(
    parsed: unknown,
    filePath: string
): Result<Set<string>, ConfigError> {
    if (!Array.isArray(parsed)) {
        return err({
            type: 'config-validation-error',
            message: `Allowed-packages file "${filePath}" must contain a JSON array`,
        });
    }

    if (!parsed.every((item: unknown) => typeof item === 'string')) {
        return err({
            type: 'config-validation-error',
            message: `Allowed-packages file "${filePath}" must contain only strings`,
        });
    }

    return ok(new Set(parsed as string[]));
}
