import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { handleValidateCommand } from '../command-handler.js';
import type { CliOptions } from '../options.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = resolve(__dirname, '..', '..', '__tests__', 'fixtures');
const MONOREPO_DIR = resolve(FIXTURES_DIR, 'sample-monorepo');
const CONFIGS_DIR = resolve(FIXTURES_DIR, 'configs');

/**
 * Build a CliOptions object with sensible defaults, allowing overrides.
 */
function buildCliOptions(overrides?: Partial<CliOptions>): CliOptions {
    return {
        root: MONOREPO_DIR,
        config: resolve(CONFIGS_DIR, 'valid-config.json'),
        format: 'console',
        ...overrides,
    };
}

// Suppress all console output during tests
beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    jest.restoreAllMocks();
});

describe('handleValidateCommand', () => {
    it('returns exit code 1 when config mode is error and violations exist', async () => {
        // valid-config.json has mode: 'error'; sample-monorepo has a violation.
        const exitCode = await handleValidateCommand(buildCliOptions());

        expect(exitCode).toBe(1);
    });

    it('returns exit code 0 when config mode is warn and violations exist', async () => {
        // Override mode to 'warn' — violations exist but should not fail.
        const exitCode = await handleValidateCommand(buildCliOptions({ mode: 'warn' }));

        expect(exitCode).toBe(0);
    });

    it('uses config file mode (not hardcoded warn) when no --mode flag given', async () => {
        const exitCode = await handleValidateCommand(buildCliOptions({ mode: undefined }));

        expect(exitCode).toBe(1);
    });

    it('CLI --mode flag overrides config mode for exit-code logic', async () => {
        // Config has mode: 'error' but CLI passes --mode warn.
        // Violations exist, but warn mode → exit code 0.
        const exitCode = await handleValidateCommand(buildCliOptions({ mode: 'warn' }));

        expect(exitCode).toBe(0);
    });

    it('returns exit code 0 when mode is off', async () => {
        // mode: 'off' → short-circuits, no violations reported, exit 0.
        const exitCode = await handleValidateCommand(buildCliOptions({ mode: 'off' }));

        expect(exitCode).toBe(0);
    });

    it('returns exit code 1 when config file does not exist', async () => {
        const exitCode = await handleValidateCommand(
            buildCliOptions({ config: 'nonexistent.json' })
        );

        expect(exitCode).toBe(1);
    });

    it('outputs JSON format when format option is json', async () => {
        const logSpy = jest.spyOn(console, 'log');

        await handleValidateCommand(buildCliOptions({ mode: 'warn', format: 'json' }));

        const jsonOutput = logSpy.mock.calls.find(call => {
            try {
                const parsed = JSON.parse(call[0] as string);
                return 'violations' in parsed && 'totalPackages' in parsed;
            } catch {
                return false;
            }
        });

        expect(jsonOutput).toBeDefined();
        expect(JSON.parse(jsonOutput![0] as string)).toHaveProperty('acceptedExceptions');
    });

    it('reports accepted exceptions separately in console and JSON output', async () => {
        const config = resolve(CONFIGS_DIR, 'valid-config-with-exception.json');
        const logSpy = jest.spyOn(console, 'log');

        expect(await handleValidateCommand(buildCliOptions({ config, format: 'console' }))).toBe(0);
        expect(logSpy.mock.calls.flat().join('\n')).toContain('Accepted 1 dependency exception');

        logSpy.mockClear();
        await handleValidateCommand(buildCliOptions({ config, format: 'json' }));
        const output = logSpy.mock.calls
            .map(call => call[0] as string)
            .find(message => {
                try {
                    return JSON.parse(message).acceptedExceptions !== undefined;
                } catch {
                    return false;
                }
            });

        expect(JSON.parse(output!)).toMatchObject({
            violations: [],
            acceptedExceptions: [{ acceptedEdges: [{ fromPackage: '@sample/bad-pkg' }] }],
        });
    });

    it('reports accepted exceptions loaded from a file', async () => {
        const config = resolve(CONFIGS_DIR, 'valid-config-with-exception-file.json');
        const logSpy = jest.spyOn(console, 'log');

        expect(await handleValidateCommand(buildCliOptions({ config, format: 'json' }))).toBe(0);
        const output = logSpy.mock.calls
            .map(call => call[0] as string)
            .find(message => {
                try {
                    return JSON.parse(message).acceptedExceptions?.length === 1;
                } catch {
                    return false;
                }
            });

        expect(output).toBeDefined();
    });
});
