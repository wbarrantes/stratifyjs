import type {
    StratifyResolvedConfig,
    Package,
    Violation,
    ViolationType,
} from '../../types/types.js';

/**
 * Creates a StratifyResolvedConfig with the standard 3-layer setup (ui → core → infra).
 *
 * Usage:
 *   const config = createTestConfig(); // all defaults
 *   const config = createTestConfig({ enforcement: { mode: 'error' } }); // override mode
 *
 * The `Partial<StratifyResolvedConfig>` parameter uses TypeScript's Partial utility type,
 * which makes every property optional. Spread (`...`) merges overrides on top of defaults.
 */
export function createTestConfig(
    overrides?: Partial<StratifyResolvedConfig>
): StratifyResolvedConfig {
    return {
        layers: {
            ui: { allowedDependencies: ['core'] },
            core: { allowedDependencies: ['infra'] },
            infra: { allowedDependencies: [] },
        },
        enforcement: { mode: 'warn' },
        workspaces: {
            patterns: ['packages/**/*'],
            protocols: ['workspace:'],
            ignore: ['**/node_modules/**', '**/lib/**', '**/dist/**'],
            dependencyTypes: ['dependencies'],
        },
        dependencyExceptions: [],
        ...overrides,
    };
}

/**
 * Creates a Package with sensible defaults.
 *
 * Usage:
 *   const pkg = createTestPackage(); // default "test-pkg" in "core"
 *   const pkg = createTestPackage({ name: '@my/ui', layer: 'ui' }); // override name and layer
 */
export function createTestPackage(overrides?: Partial<Package>): Package {
    const pkg = {
        name: 'test-pkg',
        layer: 'core',
        dependencies: [],
        path: 'packages/test-pkg',
        ...overrides,
    };
    return {
        ...pkg,
        runtimeDependencies: overrides?.runtimeDependencies ?? pkg.dependencies,
    };
}

/**
 * Creates a Violation with sensible defaults.
 *
 * Usage:
 *   const v = createTestViolation(); // default missing-layer
 *   const v = createTestViolation({ type: 'invalid-dependency', package: '@my/ui' });
 */
export function createTestViolation(overrides?: Partial<Violation>): Violation {
    return {
        type: 'missing-layer' as ViolationType,
        package: 'test-pkg',
        message: 'Test violation',
        detailedMessage: 'Test violation (detailed)',
        ...overrides,
    };
}
