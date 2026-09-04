import { validateConfigSchema, validateLayerDefinition } from '../config-schema.js';

describe('validateConfigSchema', () => {
    it('returns ok for a valid minimal config', () => {
        const raw = {
            layers: {
                ui: { allowedDependencies: ['core'] },
                core: { allowedDependencies: [] },
            },
        };

        const result = validateConfigSchema(raw);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.value.layers).toEqual(raw.layers);
            expect(result.value.enforcement).toBeUndefined();
            expect(result.value.workspaces).toBeUndefined();
        }
    });

    it('returns ok for a full config with enforcement and workspaces', () => {
        const raw = {
            layers: {
                ui: { allowedDependencies: ['core'] },
                core: { allowedDependencies: ['infra'] },
                infra: { allowedDependencies: [] },
            },
            enforcement: { mode: 'error' },
            workspaces: { patterns: ['apps/*', 'libs/*'] },
        };

        const result = validateConfigSchema(raw);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.value.enforcement).toEqual({ mode: 'error' });
            expect(result.value.workspaces).toEqual({ patterns: ['apps/*', 'libs/*'] });
        }
    });

    // ── Error cases ─────────────────────────────────────────────────────

    it('returns error for non-object input (string)', () => {
        const result = validateConfigSchema('not an object');
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.type).toBe('config-validation-error');
            expect(result.error.message).toContain('JSON object');
        }
    });

    it('returns error for null input', () => {
        const result = validateConfigSchema(null);
        expect(result.success).toBe(false);
    });

    it('returns error for array input', () => {
        const result = validateConfigSchema([1, 2, 3]);
        expect(result.success).toBe(false);
    });

    it('returns error when layers field is missing', () => {
        const result = validateConfigSchema({ enforcement: { mode: 'warn' } });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.type).toBe('config-validation-error');
            expect(result.error.message).toContain('layers');
        }
    });

    it('returns error when a layer is missing allowedDependencies', () => {
        const raw = {
            layers: {
                ui: { description: 'UI layer' }, // missing allowedDependencies!
            },
        };

        const result = validateConfigSchema(raw);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.type).toBe('config-validation-error');
            expect(result.error.message).toContain('Invalid layer definitions');
        }
    });

    it('returns error when allowedDependencies contains non-strings', () => {
        const raw = {
            layers: {
                ui: { allowedDependencies: [123, true] },
            },
        };

        const result = validateConfigSchema(raw);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('Invalid layer definitions');
        }
    });

    it('returns error for invalid enforcement mode', () => {
        const raw = {
            layers: {
                core: { allowedDependencies: [] },
            },
            enforcement: { mode: 'strict' }, // invalid!
        };

        const result = validateConfigSchema(raw);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('strict');
            // Should mention the valid modes so the user knows what to fix
            expect(result.error.message).toMatch(/error.*warn.*off/);
        }
    });

    it('returns error for invalid workspaces.patterns (non-array)', () => {
        const raw = {
            layers: {
                core: { allowedDependencies: [] },
            },
            workspaces: { patterns: 'not-an-array' },
        };

        const result = validateConfigSchema(raw);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('array of strings');
        }
    });

    it('returns ok for valid workspaces.protocols', () => {
        const config = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { protocols: ['workspace:', 'link:'] },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(true);
    });

    it('returns ok for config without protocols (uses default)', () => {
        const config = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { patterns: ['packages/*'] },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(true);
    });

    it('returns error for invalid workspaces.protocols (non-array)', () => {
        const config = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { protocols: 'workspace:' },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('array of strings');
        }
    });

    it('returns error for workspaces.protocols with non-string elements', () => {
        const config = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { protocols: [123, true] },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('array of strings');
        }
    });

    it('returns ok for valid workspaces.ignore', () => {
        const config = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { ignore: ['**/node_modules/**', '**/build/**'] },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(true);
    });

    it('returns ok for config without ignore (uses default)', () => {
        const config = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { patterns: ['packages/*'] },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(true);
    });

    it('returns error for invalid workspaces.ignore (non-array)', () => {
        const config = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { ignore: '**/node_modules/**' },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('array of strings');
        }
    });

    it('returns error for workspaces.ignore with non-string elements', () => {
        const config = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { ignore: [123, true] },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('array of strings');
        }
    });

    // ── workspaces.dependencyTypes ─────────────────────────────────────

    it('returns ok for valid workspaces.dependencyTypes', () => {
        const config = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { dependencyTypes: ['dependencies', 'devDependencies'] },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(true);
    });

    it('returns ok for config without dependencyTypes (uses default)', () => {
        const config = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { patterns: ['packages/*'] },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(true);
    });

    it('returns error for workspaces.dependencyTypes that is not an array', () => {
        const config = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { dependencyTypes: 'dependencies' },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('non-empty array of strings');
        }
    });

    it('returns error for workspaces.dependencyTypes that is an empty array', () => {
        const config = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { dependencyTypes: [] },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('non-empty array of strings');
        }
    });

    it('returns error for workspaces.dependencyTypes with non-string elements', () => {
        const config = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { dependencyTypes: [123] },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('non-empty array of strings');
        }
    });

    it('returns error for workspaces.dependencyTypes with invalid values', () => {
        const config = {
            layers: { core: { allowedDependencies: [] } },
            workspaces: { dependencyTypes: ['dependencies', 'optionalDependencies'] },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('optionalDependencies');
            expect(result.error.message).toContain('Invalid dependency type');
        }
    });
});

describe('validateLayerDefinition', () => {
    it('returns ok for a valid layer definition', () => {
        const result = validateLayerDefinition('ui', {
            description: 'UI packages',
            allowedDependencies: ['core'],
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.value.allowedDependencies).toEqual(['core']);
            expect(result.value.description).toBe('UI packages');
        }
    });

    it('returns error when the layer is not an object', () => {
        const result = validateLayerDefinition('ui', 'invalid');

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('ui');
            expect(result.error.message).toContain('must be an object');
        }
    });

    it('returns error when the layer is an array', () => {
        const result = validateLayerDefinition('ui', ['core']);

        expect(result.success).toBe(false);
    });
});

describe('allowedPackages and allowedPackagesFile validation', () => {
    it('should accept a layer with allowedPackages as a non-empty string array', () => {
        const config = {
            layers: {
                entry: {
                    allowedDependencies: [],
                    allowedPackages: ['@app/main', '@app/admin'],
                },
            },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(true);
    });

    it('should accept a layer with allowedPackagesFile as a non-empty string', () => {
        const config = {
            layers: {
                legacy: {
                    allowedDependencies: ['*'],
                    allowedPackagesFile: 'legacy-packages.json',
                },
            },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(true);
    });

    it('should accept a layer with neither allowedPackages nor allowedPackagesFile', () => {
        const config = {
            layers: {
                core: { allowedDependencies: [] },
            },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(true);
    });

    it('should reject a layer with both allowedPackages and allowedPackagesFile', () => {
        const config = {
            layers: {
                legacy: {
                    allowedDependencies: [],
                    allowedPackages: ['@app/old'],
                    allowedPackagesFile: 'legacy-packages.json',
                },
            },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('Invalid layer definitions');
        }
    });

    it('should reject allowedPackages that is not an array', () => {
        const config = {
            layers: {
                entry: { allowedDependencies: [], allowedPackages: 'not-an-array' },
            },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(false);
    });

    it('should accept allowedPackages that is an empty array', () => {
        const config = {
            layers: {
                entry: { allowedDependencies: [], allowedPackages: [] },
            },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(true);
    });

    it('should reject allowedPackages with non-string elements', () => {
        const config = {
            layers: {
                entry: { allowedDependencies: [], allowedPackages: [123, true] },
            },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(false);
    });

    it('should reject allowedPackagesFile that is not a string', () => {
        const config = {
            layers: {
                legacy: { allowedDependencies: [], allowedPackagesFile: 123 },
            },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(false);
    });

    it('should reject allowedPackagesFile that is an empty string', () => {
        const config = {
            layers: {
                legacy: { allowedDependencies: [], allowedPackagesFile: '' },
            },
        };
        const result = validateConfigSchema(config);
        expect(result.success).toBe(false);
    });
});

describe('dependencyExceptions validation', () => {
    const layers = {
        ui: { allowedDependencies: ['core'] },
        core: { allowedDependencies: [] },
    };

    it('accepts exact package and layer-to-package exceptions', () => {
        const dependencyExceptions = [
            {
                fromPackage: '@app/shell',
                toPackage: '@app/core',
                owner: 'platform',
                reason: 'Temporary package migration',
            },
            {
                fromLayer: 'ui',
                toPackage: '@app/capability',
                owner: 'architecture',
                reason: 'Designated capability',
            },
        ];

        const result = validateConfigSchema({ layers, dependencyExceptions });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.value.dependencyExceptions).toEqual(dependencyExceptions);
        }
    });

    it('accepts an empty dependencyExceptions array', () => {
        expect(validateConfigSchema({ layers, dependencyExceptions: [] }).success).toBe(true);
    });

    it('accepts dependencyExceptionsFile as a non-empty string', () => {
        const result = validateConfigSchema({
            layers,
            dependencyExceptionsFile: 'config/dependency-exceptions.json',
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.value.dependencyExceptions).toBeUndefined();
            expect(result.value.dependencyExceptionsFile).toBe('config/dependency-exceptions.json');
        }
    });

    it('rejects dependencyExceptions and dependencyExceptionsFile together', () => {
        const result = validateConfigSchema({
            layers,
            dependencyExceptions: [],
            dependencyExceptionsFile: 'dependency-exceptions.json',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('use one or the other');
        }
    });

    it.each([[''], ['   '], [123]])(
        'rejects invalid dependencyExceptionsFile value %p',
        dependencyExceptionsFile => {
            const result = validateConfigSchema({ layers, dependencyExceptionsFile });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.message).toContain('must be a non-empty string');
            }
        }
    );

    it.each([
        ['non-array', {}, '"dependencyExceptions" must be an array'],
        ['non-object entry', [null], 'must be an object'],
        [
            'both source selectors',
            [
                {
                    fromPackage: '@app/shell',
                    fromLayer: 'ui',
                    toPackage: '@app/core',
                    owner: 'platform',
                    reason: 'Migration',
                },
            ],
            'exactly one',
        ],
        [
            'neither source selector',
            [{ toPackage: '@app/core', owner: 'platform', reason: 'Migration' }],
            'exactly one',
        ],
        [
            'empty owner',
            [
                {
                    fromPackage: '@app/shell',
                    toPackage: '@app/core',
                    owner: '',
                    reason: 'Migration',
                },
            ],
            'owner must be a non-empty string',
        ],
        [
            'empty reason',
            [
                {
                    fromPackage: '@app/shell',
                    toPackage: '@app/core',
                    owner: 'platform',
                    reason: ' ',
                },
            ],
            'reason must be a non-empty string',
        ],
        [
            'unknown source layer',
            [
                {
                    fromLayer: 'missing',
                    toPackage: '@app/core',
                    owner: 'platform',
                    reason: 'Migration',
                },
            ],
            'unknown source layer',
        ],
        [
            'unsupported broad target layer',
            [
                {
                    fromLayer: 'ui',
                    toLayer: 'core',
                    owner: 'platform',
                    reason: 'Migration',
                },
            ],
            'unsupported field',
        ],
    ])('rejects %s', (_name, dependencyExceptions, expectedMessage) => {
        const result = validateConfigSchema({ layers, dependencyExceptions });

        expect(result.success).toBe(false);
        if (!result.success) {
            const details =
                result.error.type === 'config-validation-error' ? result.error.details : undefined;
            expect(result.error.message + details?.join(' ')).toContain(expectedMessage);
        }
    });

    it('rejects duplicate exception scopes even when metadata differs', () => {
        const result = validateConfigSchema({
            layers,
            dependencyExceptions: [
                {
                    fromPackage: '@app/shell',
                    toPackage: '@app/core',
                    owner: 'platform',
                    reason: 'First reason',
                },
                {
                    fromPackage: '@app/shell',
                    toPackage: '@app/core',
                    owner: 'other-team',
                    reason: 'Second reason',
                },
            ],
        });

        expect(result.success).toBe(false);
        if (!result.success && result.error.type === 'config-validation-error') {
            expect(result.error.details).toEqual(
                expect.arrayContaining([expect.stringContaining('duplicates')])
            );
        }
    });

    it('does not treat inherited object properties as known source layers', () => {
        const result = validateConfigSchema({
            layers,
            dependencyExceptions: [
                {
                    fromLayer: 'toString',
                    toPackage: '@app/core',
                    owner: 'platform',
                    reason: 'Invalid inherited layer',
                },
            ],
        });

        expect(result.success).toBe(false);
        if (!result.success && result.error.type === 'config-validation-error') {
            expect(result.error.details).toEqual(
                expect.arrayContaining([expect.stringContaining('unknown source layer')])
            );
        }
    });
});
