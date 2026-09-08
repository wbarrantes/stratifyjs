import type {
    StratifyConfig,
    StratifyResolvedConfig,
    EnforcementConfig,
    WorkspaceConfig,
} from '../types/types.js';
import {
    DEFAULT_PATTERNS,
    DEFAULT_PROTOCOLS,
    DEFAULT_IGNORE,
    DEFAULT_DEPENDENCY_TYPES,
    DEFAULT_ENFORCEMENT_MODE,
} from './constants.js';

export const DEFAULT_ENFORCEMENT: EnforcementConfig = {
    mode: DEFAULT_ENFORCEMENT_MODE,
};

export const DEFAULT_WORKSPACES: WorkspaceConfig = {
    patterns: DEFAULT_PATTERNS,
    protocols: DEFAULT_PROTOCOLS,
    ignore: DEFAULT_IGNORE,
    dependencyTypes: DEFAULT_DEPENDENCY_TYPES,
};

/**
 * Apply defaults to a validated StratifyConfig, producing a fully resolved config.
 */
export function applyDefaults(config: StratifyConfig): StratifyResolvedConfig {
    return {
        layers: config.layers,
        enforcement: {
            ...DEFAULT_ENFORCEMENT,
            ...config.enforcement,
        },
        workspaces: {
            ...DEFAULT_WORKSPACES,
            ...config.workspaces,
        },
        dependencyExceptions: config.dependencyExceptions ?? [],
        dependencyExceptionsFile: config.dependencyExceptionsFile,
    };
}
