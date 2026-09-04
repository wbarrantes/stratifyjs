import { validatePackages, validatePackagesWithExceptions } from '../validation.js';
import { createTestConfig, createTestPackage } from '../../__tests__/fixtures/helpers.js';
import type { Package, StratifyResolvedConfig } from '../../types/types.js';

describe('validatePackages', () => {
    let config: StratifyResolvedConfig;

    beforeEach(() => {
        config = createTestConfig();
    });

    // ── All valid ──────────────────────────────────────────────────────
    it('returns no violations when all packages are valid', () => {
        const packages: Package[] = [
            createTestPackage({ name: '@app/ui', layer: 'ui', dependencies: ['@app/core'] }),
            createTestPackage({ name: '@app/core', layer: 'core', dependencies: ['@app/infra'] }),
            createTestPackage({ name: '@app/infra', layer: 'infra', dependencies: [] }),
        ];

        const violations = validatePackages(packages, config);

        expect(violations).toHaveLength(0);
    });

    // ── Missing layer ──────────────────────────────────────────────────
    it('returns a missing-layer violation when layer is undefined', () => {
        const packages: Package[] = [
            createTestPackage({ name: '@app/no-layer', layer: undefined }),
        ];

        const violations = validatePackages(packages, config);

        expect(violations).toHaveLength(1);
        expect(violations[0].type).toBe('missing-layer');
        expect(violations[0].package).toBe('@app/no-layer');
        expect(violations[0].message).toContain('missing');
        // detailedMessage should include actionable guidance
        expect(violations[0].detailedMessage).toContain('@app/no-layer');
        expect(violations[0].detailedMessage).toContain('Missing Layer');
    });

    // ── Unknown layer ──────────────────────────────────────────────────
    it('returns an unknown-layer violation for unrecognized layer names', () => {
        const packages: Package[] = [createTestPackage({ name: '@app/mystery', layer: 'data' })];

        const violations = validatePackages(packages, config);

        expect(violations).toHaveLength(1);
        expect(violations[0].type).toBe('unknown-layer');
        expect(violations[0].package).toBe('@app/mystery');
        // The message should list valid layers so the user can fix it
        expect(violations[0].message).toContain('ui');
        expect(violations[0].message).toContain('core');
        expect(violations[0].message).toContain('infra');
    });

    // ── Invalid dependency ─────────────────────────────────────────────
    it('returns an invalid-dependency violation for disallowed cross-layer deps', () => {
        const packages: Package[] = [
            createTestPackage({ name: '@app/ui', layer: 'ui', dependencies: ['@app/infra'] }),
            createTestPackage({ name: '@app/infra', layer: 'infra', dependencies: [] }),
        ];

        const violations = validatePackages(packages, config);

        expect(violations).toHaveLength(1);
        expect(violations[0].type).toBe('invalid-dependency');
        expect(violations[0].package).toBe('@app/ui');
        // Check the structured details — this is how consumers programmatically
        // inspect violations, not just the message string.
        expect(violations[0].details).toEqual({
            fromLayer: 'ui',
            toPackage: '@app/infra',
            toLayer: 'infra',
            allowedLayers: ['core'],
        });
    });

    // ── External deps are skipped ──────────────────────────────────────
    it('skips dependencies that are not in the packages list (external deps)', () => {
        const packages: Package[] = [
            createTestPackage({
                name: '@app/ui',
                layer: 'ui',
                dependencies: ['react', 'lodash'], // not workspace packages
            }),
        ];

        const violations = validatePackages(packages, config);

        expect(violations).toHaveLength(0);
    });

    // ── Deps with no layer are skipped ─────────────────────────────────
    it('skips dependencies that have no layer defined', () => {
        const packages: Package[] = [
            createTestPackage({ name: '@app/ui', layer: 'ui', dependencies: ['@app/utils'] }),
            createTestPackage({ name: '@app/utils', layer: undefined, dependencies: [] }),
        ];

        const violations = validatePackages(packages, config);

        // @app/utils has no layer, so it should not produce a violation
        // for @app/ui's dependency on it. (It will produce its own
        // missing-layer violation.)
        const depViolations = violations.filter(v => v.type === 'invalid-dependency');
        expect(depViolations).toHaveLength(0);
    });

    // ── Multiple violations ────────────────────────────────────────────
    it('collects multiple violations across packages', () => {
        const packages: Package[] = [
            createTestPackage({ name: '@app/no-layer', layer: undefined }),
            createTestPackage({ name: '@app/bad-layer', layer: 'unknown' }),
            createTestPackage({ name: '@app/ui', layer: 'ui', dependencies: ['@app/infra'] }),
            createTestPackage({ name: '@app/infra', layer: 'infra', dependencies: [] }),
        ];

        const violations = validatePackages(packages, config);

        // One missing-layer + one unknown-layer + one invalid-dependency
        expect(violations).toHaveLength(3);
        const types = violations.map(v => v.type);
        expect(types).toContain('missing-layer');
        expect(types).toContain('unknown-layer');
        expect(types).toContain('invalid-dependency');
    });

    // ── Wildcard allowedDependencies ───────────────────────────────────
    it('allows all dependencies when allowedDependencies contains "*"', () => {
        const wildcardConfig = createTestConfig({
            layers: {
                ui: { allowedDependencies: ['*'] }, // allow everything
                core: { allowedDependencies: [] },
                infra: { allowedDependencies: [] },
            },
        });

        const packages: Package[] = [
            createTestPackage({
                name: '@app/ui',
                layer: 'ui',
                dependencies: ['@app/core', '@app/infra'],
            }),
            createTestPackage({ name: '@app/core', layer: 'core', dependencies: [] }),
            createTestPackage({ name: '@app/infra', layer: 'infra', dependencies: [] }),
        ];

        const violations = validatePackages(packages, wildcardConfig);

        expect(violations).toHaveLength(0);
    });

    // ── Unauthorized layer member ──────────────────────────────────────
    it('returns no violations for layers without membership restrictions', () => {
        const packages: Package[] = [
            createTestPackage({ name: '@app/core', layer: 'core', dependencies: [] }),
        ];

        const violations = validatePackages(packages, config, new Map());

        const membershipViolations = violations.filter(v => v.type === 'unauthorized-layer-member');
        expect(membershipViolations).toHaveLength(0);
    });

    it('returns an unauthorized-layer-member violation for unlisted packages', () => {
        const restrictedConfig = createTestConfig({
            layers: {
                legacy: { allowedDependencies: ['*'] },
            },
        });
        const packages: Package[] = [
            createTestPackage({ name: '@app/new-thing', layer: 'legacy', dependencies: [] }),
        ];
        const allowedMap = new Map([['legacy', new Set(['@app/old-thing'])]]);

        const violations = validatePackages(packages, restrictedConfig, allowedMap);

        expect(violations).toHaveLength(1);
        expect(violations[0].type).toBe('unauthorized-layer-member');
        expect(violations[0].package).toBe('@app/new-thing');
        expect(violations[0].detailedMessage).toContain('Unauthorized Layer Member');
        expect(violations[0].details).toEqual(expect.objectContaining({ fromLayer: 'legacy' }));
    });

    it('allows packages that are in the membership allowlist', () => {
        const restrictedConfig = createTestConfig({
            layers: {
                legacy: { allowedDependencies: ['*'] },
            },
        });
        const packages: Package[] = [
            createTestPackage({ name: '@app/old-thing', layer: 'legacy', dependencies: [] }),
        ];
        const allowedMap = new Map([['legacy', new Set(['@app/old-thing'])]]);

        const violations = validatePackages(packages, restrictedConfig, allowedMap);

        expect(violations).toHaveLength(0);
    });

    it('skips dependency checks for unauthorized layer members', () => {
        const restrictedConfig = createTestConfig({
            layers: {
                legacy: { allowedDependencies: [] },
                core: { allowedDependencies: [] },
            },
        });
        const packages: Package[] = [
            createTestPackage({
                name: '@app/unauthorized',
                layer: 'legacy',
                dependencies: ['@app/core'],
            }),
            createTestPackage({ name: '@app/core', layer: 'core', dependencies: [] }),
        ];
        const allowedMap = new Map([['legacy', new Set<string>()]]);

        const violations = validatePackages(packages, restrictedConfig, allowedMap);

        // Should get unauthorized-layer-member only, NOT invalid-dependency
        expect(violations).toHaveLength(1);
        expect(violations[0].type).toBe('unauthorized-layer-member');
    });

    it('preserves an empty membership Set as a restrict-all allowlist', () => {
        const restrictedConfig = createTestConfig({
            layers: { legacy: { allowedDependencies: ['*'], allowedPackages: [] } },
        });
        const packages = [createTestPackage({ name: '@app/old', layer: 'legacy' })];

        const violations = validatePackages(
            packages,
            restrictedConfig,
            new Map([['legacy', new Set()]])
        );

        expect(violations).toHaveLength(1);
        expect(violations[0].type).toBe('unauthorized-layer-member');
    });
});

describe('dependency exceptions', () => {
    const packages: Package[] = [
        createTestPackage({
            name: '@app/shell',
            layer: 'ui',
            dependencies: ['@app/infra'],
        }),
        createTestPackage({
            name: '@app/admin',
            layer: 'ui',
            dependencies: ['@app/infra'],
        }),
        createTestPackage({ name: '@app/infra', layer: 'infra' }),
    ];

    it('accepts and reports an exact package edge', () => {
        const config = createTestConfig({
            dependencyExceptions: [
                {
                    fromPackage: '@app/shell',
                    toPackage: '@app/infra',
                    owner: 'platform',
                    reason: 'Temporary migration bridge',
                },
            ],
        });

        const result = validatePackagesWithExceptions(packages, config);

        expect(result.exceptionErrors).toEqual([]);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].package).toBe('@app/admin');
        expect(result.acceptedExceptions).toEqual([
            {
                exception: {
                    scope: 'package',
                    configurationIndex: 0,
                    fromPackage: '@app/shell',
                    toPackage: '@app/infra',
                    owner: 'platform',
                    reason: 'Temporary migration bridge',
                },
                acceptedEdges: [
                    {
                        fromPackage: '@app/shell',
                        fromLayer: 'ui',
                        toPackage: '@app/infra',
                        toLayer: 'infra',
                    },
                ],
            },
        ]);
    });

    it('accepts every real violating edge covered by a layer-to-package exception', () => {
        const config = createTestConfig({
            dependencyExceptions: [
                {
                    fromLayer: 'ui',
                    toPackage: '@app/infra',
                    owner: 'platform',
                    reason: 'Designated infrastructure capability',
                },
            ],
        });

        const result = validatePackagesWithExceptions(packages, config);

        expect(result.exceptionErrors).toEqual([]);
        expect(result.violations).toEqual([]);
        expect(result.acceptedExceptions[0].acceptedEdges.map(edge => edge.fromPackage)).toEqual([
            '@app/shell',
            '@app/admin',
        ]);
    });

    it('rejects ambiguous coverage instead of giving package scope precedence', () => {
        const config = createTestConfig({
            dependencyExceptions: [
                {
                    fromPackage: '@app/shell',
                    toPackage: '@app/infra',
                    owner: 'platform',
                    reason: 'Exact exception',
                },
                {
                    fromLayer: 'ui',
                    toPackage: '@app/infra',
                    owner: 'architecture',
                    reason: 'Capability exception',
                },
            ],
        });

        const result = validatePackagesWithExceptions(packages, config);

        expect(result.exceptionErrors).toEqual([expect.stringContaining('ambiguously covered')]);
        expect(result.violations.map(violation => violation.package)).toEqual(['@app/shell']);
    });

    it('rejects stale exceptions with no matching runtime dependency', () => {
        const config = createTestConfig({
            dependencyExceptions: [
                {
                    fromPackage: '@app/infra',
                    toPackage: '@app/shell',
                    owner: 'platform',
                    reason: 'No longer needed',
                },
            ],
        });

        const result = validatePackagesWithExceptions(packages, config);

        expect(result.exceptionErrors).toEqual([expect.stringContaining('is stale')]);
    });

    it('rejects unnecessary exceptions for already allowed edges', () => {
        const allowedPackages = [
            createTestPackage({
                name: '@app/shell',
                layer: 'ui',
                dependencies: ['@app/core'],
            }),
            createTestPackage({ name: '@app/core', layer: 'core' }),
        ];
        const config = createTestConfig({
            dependencyExceptions: [
                {
                    fromPackage: '@app/shell',
                    toPackage: '@app/core',
                    owner: 'platform',
                    reason: 'Not actually needed',
                },
            ],
        });

        const result = validatePackagesWithExceptions(allowedPackages, config);

        expect(result.exceptionErrors).toEqual([expect.stringContaining('is unnecessary')]);
        expect(result.acceptedExceptions).toEqual([]);
    });

    it('rejects unknown source and target packages', () => {
        const config = createTestConfig({
            dependencyExceptions: [
                {
                    fromPackage: '@app/missing-source',
                    toPackage: '@app/missing-target',
                    owner: 'platform',
                    reason: 'Invalid references',
                },
            ],
        });

        const result = validatePackagesWithExceptions(packages, config);

        expect(result.exceptionErrors).toEqual(
            expect.arrayContaining([
                expect.stringContaining('unknown source package'),
                expect.stringContaining('unknown target package'),
            ])
        );
    });

    it('rejects otherwise unused exceptions', () => {
        const config = createTestConfig({
            layers: {
                ui: { allowedDependencies: ['core'], allowedPackages: [] },
                core: { allowedDependencies: ['infra'] },
                infra: { allowedDependencies: [] },
            },
            dependencyExceptions: [
                {
                    fromPackage: '@app/shell',
                    toPackage: '@app/infra',
                    owner: 'platform',
                    reason: 'Blocked before dependency validation',
                },
            ],
        });

        const result = validatePackagesWithExceptions(
            packages,
            config,
            new Map([['ui', new Set()]])
        );

        expect(result.exceptionErrors).toEqual([expect.stringContaining('is unused')]);
        expect(result.violations.every(v => v.type === 'unauthorized-layer-member')).toBe(true);
    });

    it('does not allow an exception to cover a non-runtime dependency', () => {
        const devOnlyPackages = [
            createTestPackage({
                name: '@app/shell',
                layer: 'ui',
                dependencies: ['@app/infra'],
                runtimeDependencies: [],
            }),
            createTestPackage({ name: '@app/infra', layer: 'infra' }),
        ];
        const config = createTestConfig({
            dependencyExceptions: [
                {
                    fromPackage: '@app/shell',
                    toPackage: '@app/infra',
                    owner: 'platform',
                    reason: 'Dev-only dependencies cannot be excepted',
                },
            ],
        });

        const result = validatePackagesWithExceptions(devOnlyPackages, config);

        expect(result.exceptionErrors).toEqual([expect.stringContaining('is stale')]);
        expect(result.violations).toHaveLength(1);
        expect(result.acceptedExceptions).toEqual([]);
    });
});
