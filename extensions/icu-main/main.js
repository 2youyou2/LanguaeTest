'use strict';

const path = require('path');
const { execFile } = require('child_process');

const DEFAULT_EXTERNAL_NODE = 'node';
const WORKER_SCRIPT_PATH = path.resolve(__dirname, 'icu-worker.mjs');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function resolveExternalNodePath() {
    const envPath = process.env.ICU_NODE_PATH;
    return envPath || DEFAULT_EXTERNAL_NODE;
}

function runIcuWorker(payload) {
    return new Promise((resolve, reject) => {
        const nodePath = resolveExternalNodePath();

        const child = execFile(
            nodePath,
            [WORKER_SCRIPT_PATH],
            {
                cwd: PROJECT_ROOT,
                encoding: 'utf8',
                maxBuffer: 2 * 1024 * 1024,
                timeout: 20000,
                windowsHide: true,
            },
            (error, stdout, stderr) => {
                if (error) {
                    if (error.code === 'ENOENT') {
                        reject(new Error(
                            `[icu-main] Node executable was not found in PATH. `
                            + `node=${nodePath}. Install Node or set ICU_NODE_PATH.`
                        ));
                        return;
                    }

                    reject(new Error(
                        `[icu-main] ICU worker failed. node=${nodePath}, code=${error.code}, `
                        + `signal=${error.signal}, stderr=${stderr || '(empty)'}`
                    ));
                    return;
                }

                try {
                    resolve(JSON.parse(stdout));
                } catch (parseError) {
                    reject(new Error(
                        `[icu-main] ICU worker returned invalid JSON. stdout=${stdout || '(empty)'}, `
                        + `stderr=${stderr || '(empty)'}, parseError=${String(parseError)}`
                    ));
                }
            }
        );

        child.stdin.end(JSON.stringify(payload), 'utf8');
    });
}

exports.methods = {
    async getBreakPoints(payload = {}) {
        const text = typeof payload.text === 'string' ? payload.text : '';
        const locale = typeof payload.locale === 'string' || payload.locale === null
            ? payload.locale
            : 'ar';

        if (!text) {
            return {
                lineBreaks: [],
                graphemeBreaks: [],
            };
        }

        return runIcuWorker({ text, locale });
    },
};

exports.load = function load() {};
exports.unload = function unload() {};
