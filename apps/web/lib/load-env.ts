import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOADED_ENV = Symbol.for('socrati.loadedEnv');

function parseEnvValue(value: string) {
    const trimmed = value.trim();

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }

    return trimmed;
}

function loadEnvFile(path: string) {
    if (!existsSync(path)) return;

    const content = readFileSync(path, 'utf8');

    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex === -1) continue;

        const key = trimmed.slice(0, equalsIndex).trim();
        const value = parseEnvValue(trimmed.slice(equalsIndex + 1));

        if (!key || value === '' || process.env[key] !== undefined) continue;

        process.env[key] = value;
    }
}

export function loadEnvFiles() {
    const globalState = globalThis as typeof globalThis & {
        [LOADED_ENV]?: boolean;
    };

    if (globalState[LOADED_ENV]) return;

    const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const repoRoot = resolve(webRoot, '../..');

    for (const dir of [repoRoot, webRoot]) {
        loadEnvFile(resolve(dir, '.env'));
        loadEnvFile(resolve(dir, '.env.local'));
    }

    globalState[LOADED_ENV] = true;
}
