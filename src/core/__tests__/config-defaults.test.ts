import { applyDefaults, DEFAULT_ENFORCEMENT, DEFAULT_WORKSPACES } from '../config-defaults.js';
import type { StratifyConfig } from '../../types/types.js';
import {
    DEFAULT_PATTERNS,
    DEFAULT_PROTOCOLS,
    DEFAULT_IGNORE,
    DEFAULT_DEPENDENCY_TYPES,
} from '../constants.js';

describe('applyDefaults', () => {
    // ── Minimal config (all defaults applied) ──────────────────────────
    it('applies default enforcement and workspaces when not specified', () => {
        const config: StratifyConfig = {
            layers: {
                core: { allowedDependencies: [] },
            },
            // enforcement and workspaces are intentionally omitted
        };

        const resolved = applyDefaults(config);

        // The layers themselves pass through unchanged
        expect(resolved.layers).toEqual(config.layers);
        // Enforcement mode defaults to 'warn'
        expect(resolved.enforcement).toEqual(DEFAULT_ENFORCEMENT);
        expect(resolved.enforcement.mode).toBe('warn');
        // Workspaces defaults to ['packages/**/*']
        expect(resolved.workspaces).toEqual(DEFAULT_WORKSPACES);
        expect(resolved.workspaces.patterns).toEqual(DEFAULT_PATTERNS);
        expect(resolved.workspaces.protocols).toEqual(DEFAULT_PROTOCOLS);
        expect(resolved.workspaces.ignore).toEqual(DEFAULT_IGNORE);
        expect(resolved.workspaces.dependencyTypes).toEqual(DEFAULT_DEPENDENCY_TYPES);
    });

    // ── Override enforcement only ──────────────────────────────────────
    it('uses provided enforcement mode', () => {
        const config: StratifyConfig = {
            layers: { core: { allowedDependencies: [] } },
            enforcement: { mode: 'error' },
        };

        const resolved = applyDefaults(config);

        expect(resolved.enforcement.mode).toBe('error');
        // workspaces should still get defaults
        expect(resolved.workspaces.patterns).toEqual(DEFAULT_PATTERNS);
        expect(resolved.workspaces.protocols).toEqual(DEFAULT_PROTOCOLS);
        expect(resolved.workspaces.ignore).toEqual(DEFAULT_IGNORE);
        expect(resolved.workspaces.dependencyTypes).toEqual(DEFAULT_DEPENDENCY_TYPES);
    });

    // ── Override workspaces only ───────────────────────────────────────
    it('uses provided workspaces patterns', () => {
        const config: StratifyConfig = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { patterns: ['apps/*', 'libs/*'] },
        };

        const resolved = applyDefaults(config);

        expect(resolved.workspaces.patterns).toEqual(['apps/*', 'libs/*']);
        expect(resolved.workspaces.protocols).toEqual(DEFAULT_PROTOCOLS);
        expect(resolved.workspaces.ignore).toEqual(DEFAULT_IGNORE);
        expect(resolved.workspaces.dependencyTypes).toEqual(DEFAULT_DEPENDENCY_TYPES);
        // enforcement should still get defaults
        expect(resolved.enforcement.mode).toBe('warn');
    });

    // ── Override both ──────────────────────────────────────────────────
    it('uses overrides when provided', () => {
        const config: StratifyConfig = {
            layers: { core: { allowedDependencies: [] } },
            enforcement: { mode: 'off' },
            workspaces: { patterns: ['modules/*'], protocols: ['workspace:'] },
        };

        const resolved = applyDefaults(config);

        expect(resolved.enforcement.mode).toBe('off');
        expect(resolved.workspaces.patterns).toEqual(['modules/*']);
        expect(resolved.workspaces.protocols).toEqual(['workspace:']);
        expect(resolved.workspaces.ignore).toEqual(DEFAULT_IGNORE);
    });

    it('uses provided workspaces protocols', () => {
        const config: StratifyConfig = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { patterns: ['packages/*'], protocols: ['workspace:', 'link:'] },
        };

        const resolved = applyDefaults(config);

        expect(resolved.workspaces.protocols).toEqual(['workspace:', 'link:']);
        expect(resolved.workspaces.patterns).toEqual(['packages/*']);
        expect(resolved.workspaces.ignore).toEqual(DEFAULT_IGNORE);
        expect(resolved.workspaces.dependencyTypes).toEqual(DEFAULT_DEPENDENCY_TYPES);
    });

    it('uses provided workspaces ignore', () => {
        const config: StratifyConfig = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: {
                patterns: ['packages/*'],
                ignore: ['**/node_modules/**', '**/build/**'],
            },
        };

        const resolved = applyDefaults(config);

        expect(resolved.workspaces.ignore).toEqual(['**/node_modules/**', '**/build/**']);
        expect(resolved.workspaces.patterns).toEqual(['packages/*']);
    });

    it('uses provided workspaces dependencyTypes', () => {
        const config: StratifyConfig = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: {
                dependencyTypes: ['dependencies', 'devDependencies'],
            },
        };

        const resolved = applyDefaults(config);

        expect(resolved.workspaces.dependencyTypes).toEqual(['dependencies', 'devDependencies']);
        expect(resolved.workspaces.patterns).toEqual(DEFAULT_PATTERNS);
    });

    it('preserves a dependencyExceptionsFile without creating inline exceptions', () => {
        const resolved = applyDefaults({
            layers: { core: { allowedDependencies: [] } },
            dependencyExceptionsFile: 'dependency-exceptions.json',
        });

        expect(resolved.dependencyExceptions).toEqual([]);
        expect(resolved.dependencyExceptionsFile).toBe('dependency-exceptions.json');
    });
});
