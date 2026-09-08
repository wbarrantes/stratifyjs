import type { Package, LayerMap } from '../types/types.js';
import { WILDCARD_LAYER } from './constants.js';

/**
 * Check whether a package has the required "layer" field.
 *
 * @param pkg - The package to check.
 * @returns True if the package has a non-empty "layer" field, false otherwise.
 */
export function hasRequiredLayer(pkg: Package): boolean {
    return pkg.layer !== undefined && pkg.layer !== '';
}

/**
 * Check whether a layer name is defined in the config.
 *
 * @param layerName - The name of the layer to check.
 * @param layers - The map of defined layers from the config.
 * @returns True if the layer is known, false otherwise.
 */
export function isKnownLayer(layerName: string, layers: LayerMap): boolean {
    return Object.hasOwn(layers, layerName);
}

/**
 * Check whether a dependency from one layer to another is permitted.
 * Wildcard '*' in allowedDependencies permits any target layer.
 *
 * @param fromLayer - The layer of the package declaring the dependency.
 * @param toLayer - The layer of the target package being depended on.
 * @param allowedDependencies - The list of allowed target layers for dependencies from fromLayer.
 * @returns True if the dependency is allowed, false otherwise.
 */
export function isDependencyAllowed(
    fromLayer: string,
    toLayer: string,
    allowedDependencies: ReadonlySet<string>
): boolean {
    return allowedDependencies.has(WILDCARD_LAYER) || allowedDependencies.has(toLayer);
}

/**
 * Check whether a package is allowed to be a member of its declared layer.
 *
 * If the layer has no membership restrictions (no allowedPackages set), returns true.
 * Otherwise, the package name must be present in the allowed set.
 *
 * @param packageName - The name of the package from package.json.
 * @param allowedPackages - The resolved set of allowed package names for this layer, or undefined if unrestricted.
 */
export function isPackageAllowedInLayer(
    packageName: string,
    allowedPackages: Set<string> | undefined
): boolean {
    if (allowedPackages === undefined) return true;
    return allowedPackages.has(packageName);
}
