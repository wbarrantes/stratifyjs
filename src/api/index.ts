// Public API
export { validateLayers } from './api.js';
export type { ValidateLayersOptions, ValidateLayersResult } from './api.js';

// Public types
export type {
    AcceptedDependencyException,
    DependencyException,
    EnforcementMode,
    StratifyConfig,
    Violation,
} from '../types/types.js';

// Public error class
export { StratifyError } from '../core/errors.js';
