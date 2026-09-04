import type { Package } from '../types/types.js';
import type { DiscoveryError } from './errors.js';
import type { Result } from './result.js';
import { ok, err } from './result.js';

/**
 * Parse a raw package.json object into a Package.
 *
 * @param content         - The raw parsed package.json object
 * @param relativePath    - Relative path to the package within the workspace
 * @param protocols       - Version-string prefixes that identify internal dependencies
 * @param dependencyTypes - Which dependency fields to check (e.g. ["dependencies", "devDependencies"])
 */
export function parsePackageJson(
    content: unknown,
    relativePath: string,
    protocols: string[],
    dependencyTypes: string[]
): Result<Package, DiscoveryError> {
    if (typeof content !== 'object' || content === null) {
        return err({
            type: 'package-parse-error',
            message: `Invalid package.json at "${relativePath}": must be a JSON object`,
            path: relativePath,
        });
    }

    const pkg = content as Record<string, unknown>;

    // Validate required fields
    if (typeof pkg.name !== 'string' || pkg.name.trim() === '') {
        return err({
            type: 'package-parse-error',
            message: `Invalid package.json at "${relativePath}": missing or invalid "name" field`,
            path: relativePath,
        });
    }

    return ok({
        name: pkg.name,
        layer: typeof pkg.layer === 'string' ? pkg.layer : undefined,
        dependencies: extractInternalDependencies(
            protocols,
            dependencyTypes,
            pkg as Record<string, unknown>
        ),
        runtimeDependencies: extractInternalDependencies(
            protocols,
            ['dependencies'],
            pkg as Record<string, unknown>
        ),
        path: relativePath,
    });
}

/**
 * Extract internal monorepo dependencies whose version string starts
 * with one of the given protocol prefixes.
 *
 * @param protocols       - Prefixes to match (e.g. ["workspace:", "link:"])
 * @param dependencyTypes - Which dependency fields to check (e.g. ["dependencies", "devDependencies"])
 * @param pkg             - The full parsed package.json object
 */
export function extractInternalDependencies(
    protocols: string[],
    dependencyTypes: string[],
    pkg: Record<string, unknown>
): string[] {
    const allDeps: Record<string, string> = {};
    for (const depType of dependencyTypes) {
        const field = pkg[depType];
        if (field && typeof field === 'object' && !Array.isArray(field)) {
            Object.assign(allDeps, field);
        }
    }
    return Object.entries(allDeps)
        .filter(
            ([_, version]) =>
                typeof version === 'string' &&
                protocols.some(protocol => version.startsWith(protocol))
        )
        .map(([name, _]) => name);
}
