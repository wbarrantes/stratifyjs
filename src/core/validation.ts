import type {
    AcceptedDependencyEdge,
    AcceptedDependencyException,
    Package,
    ResolvedDependencyException,
    StratifyResolvedConfig,
    Violation,
} from '../types/types.js';
import {
    hasRequiredLayer,
    isKnownLayer,
    isDependencyAllowed,
    isPackageAllowedInLayer,
} from './rules.js';

/**
 * Validate all packages against layer configuration.
 *
 * @param packages - Discovered packages to validate.
 * @param config - Fully resolved stratify configuration.
 * @param allowedPackagesByLayer - Map from layer name to the set of allowed package names.
 *   If a layer is not in this map, it has no membership restrictions.
 */
export function validatePackages(
    packages: Package[],
    config: StratifyResolvedConfig,
    allowedPackagesByLayer: Map<string, Set<string>> = new Map()
): Violation[] {
    return validatePackagesWithExceptions(packages, config, allowedPackagesByLayer).violations;
}

export interface PackageValidationResult {
    violations: Violation[];
    acceptedExceptions: AcceptedDependencyException[];
    exceptionErrors: string[];
}

interface ExceptionState {
    exception: ResolvedDependencyException;
    matchingRealEdges: number;
    matchedAllowedEdge: boolean;
    acceptedEdges: AcceptedDependencyEdge[];
}

/**
 * Validate packages and resolve every configured dependency exception against real edges.
 */
export function validatePackagesWithExceptions(
    packages: Package[],
    config: StratifyResolvedConfig,
    allowedPackagesByLayer: Map<string, Set<string>> = new Map()
): PackageValidationResult {
    const violations: Violation[] = [];
    const packageMap = new Map(packages.map(pkg => [pkg.name, pkg]));
    const validLayers = Object.keys(config.layers).join(', ');
    const exceptionErrors: string[] = [];
    const invalidExceptionIndexes = new Set<number>();
    const ambiguousExceptionIndexes = new Set<number>();
    const exceptionStates = config.dependencyExceptions.map(
        (exception, configurationIndex): ExceptionState => ({
            exception:
                exception.fromPackage !== undefined
                    ? {
                          scope: 'package',
                          configurationIndex,
                          fromPackage: exception.fromPackage,
                          toPackage: exception.toPackage,
                          owner: exception.owner,
                          reason: exception.reason,
                      }
                    : {
                          scope: 'layer',
                          configurationIndex,
                          fromLayer: exception.fromLayer,
                          toPackage: exception.toPackage,
                          owner: exception.owner,
                          reason: exception.reason,
                      },
            matchingRealEdges: 0,
            matchedAllowedEdge: false,
            acceptedEdges: [],
        })
    );

    for (const state of exceptionStates) {
        const { exception } = state;
        if (exception.scope === 'package' && !packageMap.has(exception.fromPackage)) {
            exceptionErrors.push(
                `dependencyExceptions[${exception.configurationIndex}] references unknown source package "${exception.fromPackage}"`
            );
            invalidExceptionIndexes.add(exception.configurationIndex);
        }
        if (exception.scope === 'layer' && !Object.hasOwn(config.layers, exception.fromLayer)) {
            exceptionErrors.push(
                `dependencyExceptions[${exception.configurationIndex}] references unknown source layer "${exception.fromLayer}"`
            );
            invalidExceptionIndexes.add(exception.configurationIndex);
        }
        if (!packageMap.has(exception.toPackage)) {
            exceptionErrors.push(
                `dependencyExceptions[${exception.configurationIndex}] references unknown target package "${exception.toPackage}"`
            );
            invalidExceptionIndexes.add(exception.configurationIndex);
        }
    }

    // Record real internal edges independently of rule eligibility so stale and unused
    // exceptions can be distinguished after normal validation.
    for (const pkg of packages) {
        for (const depName of pkg.dependencies) {
            if (!packageMap.has(depName) || !isRuntimeDependency(pkg, depName)) {
                continue;
            }
            for (const state of exceptionStates) {
                if (matchesException(state.exception, pkg, depName)) {
                    state.matchingRealEdges++;
                }
            }
        }
    }

    for (const pkg of packages) {
        // Rule 1: Check if package has a layer field
        if (!hasRequiredLayer(pkg)) {
            violations.push({
                type: 'missing-layer',
                package: pkg.name,
                message: `Package "${pkg.name}" is missing the required "layer" field in package.json`,
                detailedMessage:
                    `🏷️  Missing Layer: "${pkg.name}"\n` +
                    `   Add a "layer" field to ${pkg.path} to assign this package to an architectural layer.\n` +
                    `   Valid layers: ${validLayers}`,
            });
            continue; // Cannot validate further without layer
        }

        const layer = pkg.layer!;

        // Rule 2: Layer must be defined in config
        if (!isKnownLayer(layer, config.layers)) {
            violations.push({
                type: 'unknown-layer',
                package: pkg.name,
                message: `Package "${pkg.name}" has unknown layer "${layer}". Valid layers: ${validLayers}`,
                detailedMessage:
                    `❓ Unknown Layer: "${pkg.name}" declares layer "${layer}", which is not defined in the config.\n` +
                    `   Valid layers: ${validLayers}\n` +
                    `   Fix the "layer" field in ${pkg.path}.`,
            });
            continue;
        }

        // Rule 3: Package must be allowed in its declared layer (membership control)
        const allowedSet = allowedPackagesByLayer.get(layer);
        if (!isPackageAllowedInLayer(pkg.name, allowedSet)) {
            const layerDef = config.layers[layer];
            const source = layerDef.allowedPackagesFile ?? 'allowedPackages in config';
            violations.push({
                type: 'unauthorized-layer-member',
                package: pkg.name,
                message: `Package "${pkg.name}" is not permitted in layer "${layer}"`,
                detailedMessage:
                    `🔒 Unauthorized Layer Member: "${pkg.name}" declares layer "${layer}", but is not in the allowed list.\n` +
                    `   Add "${pkg.name}" to ${source}, or assign a different layer in ${pkg.path}.`,
                details: {
                    fromLayer: layer,
                    allowedPackagesSource: layerDef.allowedPackagesFile ?? 'inline',
                },
            });
            continue; // Skip dependency checks for unauthorized packages
        }

        // Rule 4: Each dependency must target an allowed layer
        const layerDef = config.layers[layer];
        const allowedDeps = new Set(layerDef.allowedDependencies);
        for (const depName of pkg.dependencies) {
            const depPkg = packageMap.get(depName);
            if (!depPkg || !depPkg.layer) {
                continue; // Skip dependencies that are not discovered or have no layer
            }

            const matchingStates = isRuntimeDependency(pkg, depName)
                ? exceptionStates.filter(state => matchesException(state.exception, pkg, depName))
                : [];
            if (isDependencyAllowed(layer, depPkg.layer, allowedDeps)) {
                for (const state of matchingStates) {
                    state.matchedAllowedEdge = true;
                }
                continue;
            }

            if (matchingStates.length === 1) {
                matchingStates[0].acceptedEdges.push({
                    fromPackage: pkg.name,
                    fromLayer: layer,
                    toPackage: depPkg.name,
                    toLayer: depPkg.layer,
                });
                continue;
            }

            if (matchingStates.length > 1) {
                const indexes = matchingStates.map(state => state.exception.configurationIndex);
                for (const index of indexes) {
                    ambiguousExceptionIndexes.add(index);
                }
                exceptionErrors.push(
                    `Dependency "${pkg.name}" -> "${depPkg.name}" is ambiguously covered by dependencyExceptions[${indexes.join('], dependencyExceptions[')}]`
                );
            }

            violations.push(
                createInvalidDependencyViolation(pkg, layer, depPkg, depPkg.layer, layerDef)
            );
        }
    }

    for (const state of exceptionStates) {
        const { exception } = state;
        if (
            invalidExceptionIndexes.has(exception.configurationIndex) ||
            ambiguousExceptionIndexes.has(exception.configurationIndex)
        ) {
            continue;
        }
        if (state.matchedAllowedEdge) {
            exceptionErrors.push(
                `dependencyExceptions[${exception.configurationIndex}] is unnecessary because its matching dependency is already allowed`
            );
        } else if (state.matchingRealEdges === 0) {
            exceptionErrors.push(
                `dependencyExceptions[${exception.configurationIndex}] is stale because no matching runtime dependency exists`
            );
        } else if (state.acceptedEdges.length === 0) {
            exceptionErrors.push(
                `dependencyExceptions[${exception.configurationIndex}] is unused because its matching dependency is not eligible for a dependency exception`
            );
        }
    }

    return {
        violations,
        acceptedExceptions: exceptionStates
            .filter(state => state.acceptedEdges.length > 0)
            .map(state => ({
                exception: state.exception,
                acceptedEdges: state.acceptedEdges,
            })),
        exceptionErrors,
    };
}

function isRuntimeDependency(pkg: Package, dependencyName: string): boolean {
    return (pkg.runtimeDependencies ?? pkg.dependencies).includes(dependencyName);
}

function matchesException(
    exception: ResolvedDependencyException,
    fromPackage: Package,
    toPackage: string
): boolean {
    if (exception.toPackage !== toPackage) {
        return false;
    }
    return exception.scope === 'package'
        ? exception.fromPackage === fromPackage.name
        : exception.fromLayer === fromPackage.layer;
}

function createInvalidDependencyViolation(
    pkg: Package,
    layer: string,
    depPkg: Package,
    depLayer: string,
    layerDef: StratifyResolvedConfig['layers'][string]
): Violation {
    const allowed =
        layerDef.allowedDependencies.length > 0
            ? layerDef.allowedDependencies.join(', ')
            : '(none)';
    return {
        type: 'invalid-dependency',
        package: pkg.name,
        message: `Layer violation: "${pkg.name}" (${layer}) cannot depend on "${depPkg.name}" (${depLayer})`,
        detailedMessage:
            `🚫 Invalid Dependency: "${pkg.name}" (layer: ${layer}) → "${depPkg.name}" (layer: ${depLayer})\n` +
            `   The "${layer}" layer is only allowed to depend on: ${allowed}\n` +
            `   Remove the dependency or adjust layer rules in the config.`,
        details: {
            fromLayer: layer,
            toPackage: depPkg.name,
            toLayer: depLayer,
            allowedLayers: layerDef.allowedDependencies,
        },
    };
}
