import { resolve } from 'path';
import type { StratifyResolvedConfig } from '../types/types.js';
import type { ConfigError } from '../core/errors.js';
import type { Result } from '../core/result.js';
import { ok } from '../core/result.js';
import { validateConfigSchema } from '../core/config-schema.js';
import { applyDefaults } from '../core/config-defaults.js';
import { loadJsonFile } from './json-file-loader.js';

/**
 * Load a layer config file from disk, validate it, and apply defaults.
 * I/O adapter — reads from the file system.
 */
export async function loadConfigFromFile(
    workspaceRoot: string,
    configPath: string
): Promise<Result<StratifyResolvedConfig, ConfigError>> {
    const fullPath = resolve(workspaceRoot, configPath);
    const rawConfig = await loadJsonFile(fullPath, 'Config file');
    if (!rawConfig.success) {
        return rawConfig;
    }

    // Validate schema
    const validated = validateConfigSchema(rawConfig.value);
    if (!validated.success) {
        return validated;
    }

    return ok(applyDefaults(validated.value));
}
