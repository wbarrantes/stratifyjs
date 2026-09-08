import { readFile } from 'fs/promises';
import type { ConfigError } from '../core/errors.js';
import { err, ok } from '../core/result.js';
import type { Result } from '../core/result.js';

/**
 * Read and parse a JSON file while preserving the standard configuration error shape.
 */
export async function loadJsonFile(
    fullPath: string,
    description: string
): Promise<Result<unknown, ConfigError>> {
    let content: string;
    try {
        content = await readFile(fullPath, 'utf-8');
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
            return err({
                type: 'config-not-found',
                message: `${description} not found: ${fullPath}`,
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

    try {
        return ok(JSON.parse(content) as unknown);
    } catch (error) {
        return err({
            type: 'config-parse-error',
            message: error instanceof Error ? error.message : String(error),
            path: fullPath,
            cause: error,
        });
    }
}
