interface DependencyExceptionLabelFields {
    fromPackage?: unknown;
    fromLayer?: unknown;
    toPackage?: unknown;
}

/**
 * Format a dependency exception for user-facing diagnostics.
 */
export function formatDependencyExceptionLabel(
    index: number,
    exception: DependencyExceptionLabelFields,
    source = 'dependencyExceptions'
): string {
    const fromPackage =
        typeof exception.fromPackage === 'string' && exception.fromPackage !== ''
            ? exception.fromPackage
            : undefined;
    const fromLayer =
        typeof exception.fromLayer === 'string' && exception.fromLayer !== ''
            ? exception.fromLayer
            : undefined;
    const toPackage =
        typeof exception.toPackage === 'string' && exception.toPackage !== ''
            ? exception.toPackage
            : undefined;

    let edge = '';
    if (fromPackage && fromLayer) {
        edge = ` (package "${fromPackage}", layer "${fromLayer}"${formatTarget(toPackage)})`;
    } else if (fromPackage) {
        edge = ` (package "${fromPackage}"${formatTarget(toPackage)})`;
    } else if (fromLayer) {
        edge = ` (layer "${fromLayer}"${formatTarget(toPackage)})`;
    } else if (toPackage) {
        edge = ` (target package "${toPackage}")`;
    }

    const location =
        source === 'dependencyExceptions'
            ? ` (${source}[${index}])`
            : ` in ${source} (array index ${index})`;
    return `Dependency exception #${index + 1}${edge}${location}`;
}

function formatTarget(toPackage: string | undefined): string {
    return toPackage === undefined ? '' : ` -> package "${toPackage}"`;
}
