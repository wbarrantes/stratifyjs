import { readFile } from 'fs/promises';
import { resolve } from 'path';
import type { ConfigError } from '../core/errors.js';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';

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

    let content: string;
    try {
        content = await readFile(fullPath, 'utf-8');
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
            return err({
                type: 'config-not-found',
                message: `Allowed-packages file not found: ${fullPath}`,
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

    return validateAllowlistContent(parsed, filePath);
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
