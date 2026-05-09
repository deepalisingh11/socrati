import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFiles } from '../lib/load-env.js';

loadEnvFiles();

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = new Set<ChildProcess>();
let shuttingDown = false;

function prefixOutput(name: string, data: Buffer) {
    const text = data.toString();
    for (const line of text.split(/\r?\n/)) {
        if (line.length > 0) {
            console.log(`[${name}] ${line}`);
        }
    }
}

function startProcess(name: string, args: string[]) {
    const child = spawn(npmCommand, args, {
        cwd: webRoot,
        env: process.env,
        stdio: ['inherit', 'pipe', 'pipe'],
    });

    children.add(child);

    child.stdout?.on('data', (data: Buffer) => prefixOutput(name, data));
    child.stderr?.on('data', (data: Buffer) => prefixOutput(name, data));

    child.on('exit', (code, signal) => {
        children.delete(child);
        if (shuttingDown) return;

        shuttingDown = true;
        console.error(
            `[dev] ${name} exited with ${signal ? `signal ${signal}` : `code ${code}`}`,
        );
        stopChildren();
        process.exit(code ?? 1);
    });

    return child;
}

function stopChildren() {
    for (const child of children) {
        child.kill('SIGTERM');
    }
}

process.on('SIGINT', () => {
    shuttingDown = true;
    stopChildren();
    process.exit(0);
});

process.on('SIGTERM', () => {
    shuttingDown = true;
    stopChildren();
    process.exit(0);
});

startProcess('next', ['run', 'dev:next']);
startProcess('worker', ['run', 'worker']);
