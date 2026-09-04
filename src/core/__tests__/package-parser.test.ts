import { parsePackageJson, extractInternalDependencies } from '../package-parser.js';
import { DEFAULT_PROTOCOLS, DEFAULT_DEPENDENCY_TYPES } from '../constants.js';

describe('parsePackageJson', () => {
    it('parses a valid package.json with layer and workspace deps', () => {
        const content = {
            name: '@my/ui',
            version: '1.0.0',
            layer: 'ui',
            dependencies: {
                '@my/core': 'workspace:*',
                react: '^18.0.0', // not a workspace dep
            },
            devDependencies: {
                '@my/test-utils': 'workspace:^',
            },
        };

        const result = parsePackageJson(
            content,
            'packages/ui',
            DEFAULT_PROTOCOLS,
            DEFAULT_DEPENDENCY_TYPES
        );

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.value.name).toBe('@my/ui');
            expect(result.value.layer).toBe('ui');
            expect(result.value.path).toBe('packages/ui');
            // Default dependencyTypes is ['dependencies'] — only production deps extracted
            expect(result.value.dependencies).toContain('@my/core');
            expect(result.value.dependencies).not.toContain('@my/test-utils');
            expect(result.value.dependencies).not.toContain('react');
            expect(result.value.runtimeDependencies).toEqual(['@my/core']);
        }
    });

    it('includes devDependencies when dependencyTypes includes it', () => {
        const content = {
            name: '@my/ui',
            version: '1.0.0',
            layer: 'ui',
            dependencies: {
                '@my/core': 'workspace:*',
                react: '^18.0.0',
            },
            devDependencies: {
                '@my/test-utils': 'workspace:^',
            },
        };

        const result = parsePackageJson(content, 'packages/ui', DEFAULT_PROTOCOLS, [
            'dependencies',
            'devDependencies',
        ]);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.value.dependencies).toContain('@my/core');
            expect(result.value.dependencies).toContain('@my/test-utils');
            expect(result.value.dependencies).not.toContain('react');
            expect(result.value.runtimeDependencies).toEqual(['@my/core']);
        }
    });

    it('parses a package without a layer (layer is optional)', () => {
        const content = { name: '@my/utils', version: '1.0.0' };

        const result = parsePackageJson(
            content,
            'packages/utils',
            DEFAULT_PROTOCOLS,
            DEFAULT_DEPENDENCY_TYPES
        );

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.value.layer).toBeUndefined();
        }
    });

    it('returns error for non-object content', () => {
        const result = parsePackageJson(
            'string',
            'packages/bad',
            DEFAULT_PROTOCOLS,
            DEFAULT_DEPENDENCY_TYPES
        );

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.type).toBe('package-parse-error');
            expect(result.error.message).toContain('JSON object');
        }
    });

    it('returns error for null content', () => {
        const result = parsePackageJson(
            null,
            'packages/bad',
            DEFAULT_PROTOCOLS,
            DEFAULT_DEPENDENCY_TYPES
        );
        expect(result.success).toBe(false);
    });

    it('returns error when name is missing', () => {
        const result = parsePackageJson(
            { version: '1.0.0' },
            'packages/no-name',
            DEFAULT_PROTOCOLS,
            DEFAULT_DEPENDENCY_TYPES
        );

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.type).toBe('package-parse-error');
            expect(result.error.message).toContain('name');
        }
    });

    it('returns error when name is empty string', () => {
        const result = parsePackageJson(
            { name: '' },
            'packages/empty-name',
            DEFAULT_PROTOCOLS,
            DEFAULT_DEPENDENCY_TYPES
        );

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.type).toBe('package-parse-error');
        }
    });

    it('uses custom protocols when provided', () => {
        const content = {
            name: '@my/app',
            layer: 'app',
            dependencies: {
                '@my/core': 'link:../core',
                react: '^18.0.0',
            },
        };

        const result = parsePackageJson(
            content,
            'packages/app',
            ['link:'],
            DEFAULT_DEPENDENCY_TYPES
        );

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.value.dependencies).toEqual(['@my/core']);
        }
    });
});

describe('extractInternalDependencies', () => {
    it('extracts only workspace: protocol dependencies from dependencies field', () => {
        const deps = extractInternalDependencies(DEFAULT_PROTOCOLS, DEFAULT_DEPENDENCY_TYPES, {
            dependencies: { '@my/core': 'workspace:*', react: '^18.0.0' },
        });
        expect(deps).toEqual(['@my/core']);
    });

    it('extracts from all three fields when all dependencyTypes are specified', () => {
        const deps = extractInternalDependencies(
            DEFAULT_PROTOCOLS,
            ['dependencies', 'devDependencies', 'peerDependencies'],
            {
                dependencies: { '@my/core': 'workspace:*' },
                devDependencies: { '@my/test': 'workspace:^' },
                peerDependencies: { '@my/shared': 'workspace:~' },
            }
        );
        expect(deps).toHaveLength(3);
        expect(deps).toContain('@my/core');
        expect(deps).toContain('@my/test');
        expect(deps).toContain('@my/shared');
    });

    it('ignores devDependencies when dependencyTypes is only ["dependencies"]', () => {
        const deps = extractInternalDependencies(DEFAULT_PROTOCOLS, ['dependencies'], {
            dependencies: { '@my/core': 'workspace:*' },
            devDependencies: { '@my/test': 'workspace:^' },
            peerDependencies: { '@my/shared': 'workspace:~' },
        });
        expect(deps).toEqual(['@my/core']);
    });

    it('returns empty array when no workspace deps exist', () => {
        const deps = extractInternalDependencies(DEFAULT_PROTOCOLS, DEFAULT_DEPENDENCY_TYPES, {
            dependencies: { react: '^18.0.0', lodash: '^4.0.0' },
        });
        expect(deps).toEqual([]);
    });

    it('handles missing deps fields gracefully', () => {
        const deps = extractInternalDependencies(
            DEFAULT_PROTOCOLS,
            ['dependencies', 'devDependencies', 'peerDependencies'],
            {}
        );
        expect(deps).toEqual([]);
    });

    it('matches link: and portal: when configured', () => {
        const deps = extractInternalDependencies(
            ['workspace:', 'link:', 'portal:'],
            DEFAULT_DEPENDENCY_TYPES,
            {
                dependencies: {
                    '@my/core': 'workspace:*',
                    '@my/utils': 'link:../utils',
                    '@my/shared': 'portal:../shared',
                    react: '^18.0.0',
                },
            }
        );
        expect(deps).toHaveLength(3);
        expect(deps).toContain('@my/core');
        expect(deps).toContain('@my/utils');
        expect(deps).toContain('@my/shared');
    });

    it('matches file: when configured', () => {
        const deps = extractInternalDependencies(['file:'], DEFAULT_DEPENDENCY_TYPES, {
            dependencies: { '@my/local': 'file:../local-pkg', lodash: '^4.0.0' },
        });
        expect(deps).toEqual(['@my/local']);
    });

    it('ignores protocols not in the list', () => {
        const deps = extractInternalDependencies(['workspace:'], DEFAULT_DEPENDENCY_TYPES, {
            dependencies: { '@my/linked': 'link:../linked', '@my/core': 'workspace:*' },
        });
        expect(deps).toEqual(['@my/core']);
    });
});
