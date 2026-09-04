/**
 * Stratify configuration as written by the user.
 * Only `layers` is required — all other top-level fields are optional.
 * When omitted (or partially provided), defaults are applied internally.
 */
export interface StratifyConfig {
    layers: LayerMap;
    workspaces?: Partial<WorkspaceConfig>;
    enforcement?: Partial<EnforcementConfig>;
    dependencyExceptions?: DependencyException[];
}

/**
 * Fully resolved stratify configuration with all defaults applied.
 * Used internally throughout the library after defaults have been merged.
 */
export interface StratifyResolvedConfig {
    layers: LayerMap;
    workspaces: WorkspaceConfig;
    enforcement: EnforcementConfig;
    dependencyExceptions: DependencyException[];
}

interface DependencyExceptionBase {
    /** Exact target package for the acknowledged dependency. */
    toPackage: string;
    /** Team or person accountable for removing or reviewing the exception. */
    owner: string;
    /** Architectural reason the exception is currently required. */
    reason: string;
}

/** A narrow exception for one exact package-to-package dependency. */
export interface PackageDependencyException extends DependencyExceptionBase {
    fromPackage: string;
    fromLayer?: never;
}

/** An exception for packages in one layer consuming one designated target package. */
export interface LayerDependencyException extends DependencyExceptionBase {
    fromLayer: string;
    fromPackage?: never;
}

/** A dependency exception as configured by a user. */
export type DependencyException = PackageDependencyException | LayerDependencyException;

export interface ResolvedPackageDependencyException extends PackageDependencyException {
    scope: 'package';
    configurationIndex: number;
}

export interface ResolvedLayerDependencyException extends LayerDependencyException {
    scope: 'layer';
    configurationIndex: number;
}

/** A configured dependency exception with an explicit scope and stable config index. */
export type ResolvedDependencyException =
    ResolvedPackageDependencyException | ResolvedLayerDependencyException;

/** One real dependency edge accepted by a configured exception. */
export interface AcceptedDependencyEdge {
    fromPackage: string;
    fromLayer: string;
    toPackage: string;
    toLayer: string;
}

/** Observable usage of one configured dependency exception. */
export interface AcceptedDependencyException {
    exception: ResolvedDependencyException;
    acceptedEdges: AcceptedDependencyEdge[];
}

/**
 * Map of layer names to their definitions
 */
export type LayerMap = Record<string, LayerDefinition>;

/**
 * Layer definition in the configuration
 */
export interface LayerDefinition {
    /**
     * Optional description of the layer
     */
    description?: string;
    /**
     * List of allowed dependencies (other layers)
     * that packages in this layer can depend on
     */
    allowedDependencies: string[];
    /**
     * Inline list of package names allowed to declare this layer.
     * If set, only these packages may use this layer.
     * Mutually exclusive with allowedPackagesFile.
     */
    allowedPackages?: string[];
    /**
     * Path to a JSON file (relative to workspace root) containing an array of
     * allowed package names. If set, only packages listed in the file may use this layer.
     * Mutually exclusive with allowedPackages.
     */
    allowedPackagesFile?: string;
}

/**
 * Workspace discovery configuration
 */
export interface WorkspaceConfig {
    /**
     * Glob patterns to discover packages in the monorepo. Each pattern is relative
     * to the workspace root and should point to directories containing package.json files.
     */
    patterns: string[];
    /**
     * Version-string prefixes that identify internal (monorepo) dependencies.
     * Each entry is matched via `version.startsWith(prefix)`.
     *
     * Common protocols: "workspace:", "link:", "portal:", "file:"
     *
     * @default ["workspace:"]
     */
    protocols: string[];
    /**
     * Glob patterns to exclude from package discovery.
     * Paths matching any of these patterns are skipped during globbing.
     *
     * @default ["**​/node_modules/**", "**​/lib/**", "**​/dist/**"]
     */
    ignore: string[];
    /**
     * Which dependency fields in package.json to check for internal dependencies.
     * Valid values: "dependencies", "devDependencies", "peerDependencies".
     *
     * @default ["dependencies"]
     */
    dependencyTypes: string[];
}

/**
 * Valid enforcement mode values.
 */
export type EnforcementMode = 'error' | 'warn' | 'off';

/**
 * Enforcement configuration
 */
export interface EnforcementConfig {
    mode: EnforcementMode;
}

/**
 * A single validation violation
 */
export interface Violation {
    type: ViolationType;
    package: string;
    message: string;
    detailedMessage: string;
    details?: {
        fromLayer?: string;
        toPackage?: string;
        toLayer?: string;
        allowedLayers?: string[];
        allowedPackagesSource?: string;
    };
}

/**
 * Violation types
 */
export type ViolationType =
    'missing-layer' | 'unknown-layer' | 'invalid-dependency' | 'unauthorized-layer-member';

/**
 * Represents a discovered package in the monorepo
 */
export interface Package {
    name: string;
    layer?: string;
    /** Internal dependencies selected for layer validation. */
    dependencies: string[];
    /** Internal production dependencies eligible for dependency exceptions. */
    runtimeDependencies?: string[];
    path: string;
}

/**
 * Output formats for CLI results.
 */
export type OutputFormat = 'console' | 'json';
