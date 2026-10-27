import type { ScriptLog, SendResponse } from "@/types/response"
import type { RestRequestResponse } from "@/pages/editor/services/requestConfig"
import cryptoJsRaw from "crypto-js/crypto-js.js?raw"

interface ScriptInput {
    script: string
    response: SendResponse
    variables: Record<string, string>
}

interface ScriptOutput {
    ok: boolean
    result?: unknown
    mutations?: Record<string, string | null>
    logs?: ScriptLog[]
    error?: string
}

export interface PreRequestScriptInput {
    script: string
    request: RestRequestResponse
    variables: Record<string, string>
}

export interface PreRequestScriptOutput {
    result: unknown
    request: RestRequestResponse
    mutations: Record<string, string | null>
    logs: ScriptLog[]
}

interface PreScriptWorkerOutput {
    ok: boolean
    result?: unknown
    request?: RestRequestResponse
    mutations?: Record<string, string | null>
    logs?: ScriptLog[]
    error?: string
}

const CRYPTO_JS_BOOTSTRAP = `
${cryptoJsRaw}
self.require = function(moduleName) {
    if (moduleName === 'crypto-js') return self.CryptoJS;
    throw new Error("Module '" + moduleName + "' is not supported");
};
`;

function createWorkerBootstrap(mode: 'prerequest' | 'postrequest'): string {
    const isPre = mode === 'prerequest'
    return `
${CRYPTO_JS_BOOTSTRAP}
self.onmessage = function(e) {
    var __script = e.data.script;
    var __data = ${isPre ? 'e.data.request || {}' : 'e.data.response'};
    var __vars = e.data.variables || {};
    var __mutations = {};
    var __logs = [];

    var __originalConsole = {
        log: self.console.log,
        error: self.console.error,
        warn: self.console.warn,
        info: self.console.info,
    };

    function __captureLog(type) {
        return function() {
            var args = Array.prototype.slice.call(arguments);
            var msg = args.map(function(a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' ');
            __logs.push({ type: type, message: msg, timestamp: Date.now(), scriptType: '${mode}' });
            __originalConsole[type].apply(self.console, args);
        };
    }

    self.console.log = __captureLog('log');
    self.console.error = __captureLog('error');
    self.console.warn = __captureLog('warn');
    self.console.info = __captureLog('info');

    var pm = {
        environment: {
            get: function(key) { return __vars[key]; },
            set: function(key, value) { __mutations[key] = value; ${isPre ? '__vars[key] = value;' : ''} },
            unset: function(key) { delete __mutations[key]; __mutations[key] = null; ${isPre ? 'delete __vars[key];' : ''} },
            toObject: function() { return Object.assign({}, __vars, __mutations); }
        },
        variables: {
            get: function(key) { return __vars[key]; },
            set: function(key, value) { __mutations[key] = value; ${isPre ? '__vars[key] = value;' : ''} },
            unset: function(key) { delete __mutations[key]; __mutations[key] = null; ${isPre ? 'delete __vars[key];' : ''} },
            toObject: function() { return Object.assign({}, __vars, __mutations); }
        },
        ${isPre ? 'request: __data,' : ''}
        CryptoJS: self.CryptoJS
    };

    try {
        delete self.fetch;
        delete self.XMLHttpRequest;
        delete self.WebSocket;
        delete self.importScripts;
        var fn = new Function('${isPre ? 'request' : 'response'}', 'pm', __script);
        var result = fn(__data, pm);
        self.postMessage({ ok: true, result: result, ${isPre ? 'request: __data,' : ''} mutations: __mutations, logs: __logs });
    } catch (err) {
        self.postMessage({ ok: false, error: err.message || '${isPre ? 'Pre-request script' : 'Script'} execution failed', logs: __logs });
    }
};
`
}

const POST_REQUEST_BOOTSTRAP = createWorkerBootstrap('postrequest')
const PRE_REQUEST_BOOTSTRAP = createWorkerBootstrap('prerequest')

function executeWorker<T>(bootstrap: string, input: unknown, timeoutMsg: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([bootstrap], { type: "application/javascript" })
        const url = URL.createObjectURL(blob)
        const worker = new Worker(url)

        const cleanup = () => {
            clearTimeout(timer)
            worker.terminate()
            URL.revokeObjectURL(url)
        }

        const timer = setTimeout(() => {
            cleanup()
            reject(new Error(timeoutMsg))
        }, 5000)

        worker.onmessage = (e: MessageEvent<{ ok: boolean; error?: string } & T>) => {
            cleanup()
            if (e.data.ok) {
                resolve(e.data)
            } else {
                reject(new Error(e.data.error || "Execution failed"))
            }
        }

        worker.onerror = (err) => {
            cleanup()
            reject(new Error(err.message || "Worker error"))
        }

        worker.postMessage(input)
    })
}

export async function runScript(
    input: ScriptInput
): Promise<{ result: unknown; mutations: Record<string, string | null>; logs: ScriptLog[] }> {
    const res = await executeWorker<ScriptOutput>(POST_REQUEST_BOOTSTRAP, input, "Script timed out (5s)")
    return { result: res.result, mutations: res.mutations || {}, logs: res.logs || [] }
}

export async function runPreRequestScript(
    input: PreRequestScriptInput
): Promise<PreRequestScriptOutput> {
    const res = await executeWorker<PreScriptWorkerOutput>(PRE_REQUEST_BOOTSTRAP, input, "Pre-request script timed out (5s)")
    return {
        result: res.result,
        request: res.request || input.request,
        mutations: res.mutations || {},
        logs: res.logs || []
    }
}
