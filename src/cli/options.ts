import type { ValidateLayersOptions } from '../api/api.js';
import type { EnforcementMode, OutputFormat } from '../types/types.js';
import { DEFAULT_CONFIG_FILENAME, DEFAULT_OUTPUT_FORMAT } from '../core/constants.js';

/**
 * Parsed CLI options.
 */
export interface CliOptions {
    config: string;
    root: string;
    mode?: EnforcementMode;
    format: OutputFormat;
}

/**
 * Convert raw commander output into typed CliOptions.
 */
export function parseCliOptions(raw: Record<string, unknown>): CliOptions {
    return {
        config: (raw.config as string) ?? DEFAULT_CONFIG_FILENAME,
        root: (raw.root as string) ?? process.cwd(),
        mode: raw.mode as CliOptions['mode'],
        format: (raw.format as CliOptions['format']) ?? DEFAULT_OUTPUT_FORMAT,
    };
}

/**
 * Convert CLI options to library options.
 */
export function toLibraryOptions(cli: CliOptions): ValidateLayersOptions {
    return {
        workspaceRoot: cli.root,
        configPath: cli.config,
        mode: cli.mode,
    };
}
