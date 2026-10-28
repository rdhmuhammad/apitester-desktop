import type { ScriptLog, SendResponse } from "@/types/response"
import type { RestRequestResponse } from "@/pages/editor/services/requestConfig"
import cryptoJsRaw from "crypto-js/crypto-js.js?raw"

export interface ScriptTestResult {
    name: string
    passed: boolean
    error?: string
}

export interface ScriptInput {
    script: string
    response: SendResponse
    request?: RestRequestResponse
    variables: Record<string, string>
}

interface ScriptOutput {
    ok: boolean
    result?: unknown
    mutations?: Record<string, string | null>
    logs?: ScriptLog[]
    tests?: ScriptTestResult[]
    nextRequest?: string | null
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
    skipRequest?: boolean
    nextRequest?: string | null
    tests?: ScriptTestResult[]
}

interface PreScriptWorkerOutput {
    ok: boolean
    result?: unknown
    request?: RestRequestResponse
    mutations?: Record<string, string | null>
    logs?: ScriptLog[]
    skipRequest?: boolean
    nextRequest?: string | null
    tests?: ScriptTestResult[]
    error?: string
}

const CRYPTO_JS_BOOTSTRAP = `
${cryptoJsRaw}
self.require = function(moduleName) {
    if (moduleName === 'crypto-js') return self.CryptoJS;
    if (moduleName === 'postman-collection') return self.__postmanCollection;
    throw new Error("Module '" + moduleName + "' is not supported");
};
`

const POSTMAN_SDK_BOOTSTRAP = `
if (!Object.getOwnPropertyDescriptor(String.prototype, 'value')) {
    Object.defineProperty(String.prototype, 'value', {
        get: function() { return String(this); },
        configurable: true,
        enumerable: false
    });
}

function __uid() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'id-' + Math.random().toString(36).slice(2, 10);
}

function __normalizeKeyVal(item) {
    if (typeof item === 'string') {
        var idx = item.indexOf(':');
        if (idx === -1) idx = item.indexOf('=');
        var k = idx !== -1 ? item.slice(0, idx).trim() : item.trim();
        var v = idx !== -1 ? item.slice(idx + 1).trim() : '';
        return { id: __uid(), key: k, value: v, disabled: false };
    }
    if (!item || typeof item !== 'object') {
        return { id: __uid(), key: '', value: '', disabled: false };
    }
    return {
        id: item.id || __uid(),
        key: String(item.key !== undefined ? item.key : (item.name !== undefined ? item.name : '')),
        value: item.value !== undefined && item.value !== null ? String(item.value) : '',
        description: item.description,
        disabled: Boolean(item.disabled),
        type: item.type,
        src: item.src
    };
}

function __attachPropertyListMethods(arr, isHeaderList, onMutate) {
    var notify = function() { if (typeof onMutate === 'function') onMutate(); };
    var methods = {
        __isPropertyList: { value: true },
        __isHeaderList: { value: Boolean(isHeaderList) },
        add: {
            value: function(item) {
                var norm = __normalizeKeyVal(item);
                arr.push(norm);
                notify();
                return norm;
            }
        },
        append: {
            value: function(item) { return arr.add(item); }
        },
        prepend: {
            value: function(item) {
                var norm = __normalizeKeyVal(item);
                arr.unshift(norm);
                notify();
                return norm;
            }
        },
        insert: {
            value: function(item, before) {
                var norm = __normalizeKeyVal(item);
                var idx = typeof before === 'number' ? before : arr.indexOf(before);
                if (idx < 0) arr.push(norm);
                else arr.splice(idx, 0, norm);
                notify();
                return norm;
            }
        },
        insertAfter: {
            value: function(item, after) {
                var norm = __normalizeKeyVal(item);
                var idx = typeof after === 'number' ? after : arr.indexOf(after);
                if (idx < 0) arr.push(norm);
                else arr.splice(idx + 1, 0, norm);
                notify();
                return norm;
            }
        },
        upsert: {
            value: function(item) {
                if (!item || typeof item !== 'object') return false;
                var norm = __normalizeKeyVal(item);
                var targetKey = norm.key.toLowerCase();
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i] && String(arr[i].key || '').toLowerCase() === targetKey) {
                        arr[i].value = norm.value;
                        if (item.disabled !== undefined) arr[i].disabled = Boolean(item.disabled);
                        else arr[i].disabled = false;
                        if (item.description !== undefined) arr[i].description = item.description;
                        notify();
                        return true;
                    }
                }
                arr.push(norm);
                notify();
                return true;
            }
        },
        remove: {
            value: function(predicate, context) {
                for (var i = arr.length - 1; i >= 0; i--) {
                    var it = arr[i];
                    var match = false;
                    if (typeof predicate === 'function') {
                        match = Boolean(predicate.call(context, it, i, arr));
                    } else if (typeof predicate === 'string') {
                        match = Boolean(it && String(it.key || '').toLowerCase() === predicate.toLowerCase());
                    } else if (predicate && typeof predicate === 'object') {
                        match = it === predicate || (predicate.key && it && String(it.key || '').toLowerCase() === String(predicate.key).toLowerCase());
                    }
                    if (match) arr.splice(i, 1);
                }
                notify();
            }
        },
        clear: {
            value: function() {
                arr.length = 0;
                notify();
            }
        },
        one: {
            value: function(key) {
                var target = String(key || '').toLowerCase();
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i] && !arr[i].disabled && String(arr[i].key || '').toLowerCase() === target) {
                        return arr[i];
                    }
                }
                for (var j = 0; j < arr.length; j++) {
                    if (arr[j] && String(arr[j].key || '').toLowerCase() === target) {
                        return arr[j];
                    }
                }
                return undefined;
            }
        },
        get: {
            value: function(key) {
                var found = arr.one(key);
                return found ? found.value : undefined;
            }
        },
        set: {
            value: function(key, value) {
                if (key && typeof key === 'object') return arr.upsert(key);
                return arr.upsert({ key: String(key), value: value !== undefined ? String(value) : '' });
            }
        },
        has: {
            value: function(item, value) {
                var key = typeof item === 'object' && item !== null ? item.key : String(item || '');
                var target = String(key || '').toLowerCase();
                for (var i = 0; i < arr.length; i++) {
                    var h = arr[i];
                    if (h && !h.disabled && String(h.key || '').toLowerCase() === target) {
                        if (value === undefined) return true;
                        if (h.value === String(value)) return true;
                    }
                }
                return false;
            }
        },
        idx: {
            value: function(index) { return arr[index]; }
        },
        indexOf: {
            value: function(item) {
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i] === item) return i;
                    if (typeof item === 'string' && arr[i] && String(arr[i].key || '').toLowerCase() === item.toLowerCase()) return i;
                }
                return -1;
            }
        },
        count: {
            value: function() { return arr.length; }
        },
        all: {
            value: function() { return arr.slice(); }
        },
        each: {
            value: function(iterator, context) {
                for (var i = 0; i < arr.length; i++) iterator.call(context, arr[i], i, arr);
            }
        },
        contentSize: {
            value: function() { return arr.toString().length; }
        },
        toObject: {
            value: function(excludeDisabled, caseSensitive, multiValue, sanitizeKeys) {
                var res = {};
                for (var i = 0; i < arr.length; i++) {
                    var h = arr[i];
                    if (!h) continue;
                    if (excludeDisabled && h.disabled) continue;
                    var rawKey = String(h.key || '');
                    if (sanitizeKeys && !rawKey.trim()) continue;
                    var k = caseSensitive ? rawKey : rawKey.toLowerCase();
                    var v = h.value !== undefined && h.value !== null ? String(h.value) : '';
                    if (Object.prototype.hasOwnProperty.call(res, k)) {
                        if (multiValue) {
                            if (Array.isArray(res[k])) res[k].push(v);
                            else res[k] = [res[k], v];
                        } else {
                            res[k] = res[k] + ', ' + v;
                        }
                    } else {
                        res[k] = multiValue ? [v] : v;
                    }
                }
                return res;
            }
        },
        toString: {
            value: function() {
                if (isHeaderList) {
                    return arr
                        .filter(function(h) { return h && !h.disabled && h.key; })
                        .map(function(h) { return h.key + ': ' + (h.value || ''); })
                        .join('\\r\\n');
                }
                return arr
                    .filter(function(q) { return q && !q.disabled && q.key; })
                    .map(function(q) { return encodeURIComponent(q.key) + '=' + encodeURIComponent(q.value || ''); })
                    .join('&');
            }
        },
        toJSON: {
            value: function() {
                return arr.map(function(h) {
                    var out = { id: h.id || __uid(), key: String(h.key || ''), value: String(h.value !== undefined ? h.value : '') };
                    if (h.description !== undefined) out.description = h.description;
                    if (h.disabled !== undefined) out.disabled = Boolean(h.disabled);
                    if (h.type !== undefined) out.type = h.type;
                    if (h.src !== undefined) out.src = h.src;
                    return out;
                });
            }
        }
    };
    Object.defineProperties(arr, methods);
    return arr;
}

function HeaderList(parent, headers, onMutate) {
    var arr = [];
    if (Array.isArray(headers)) {
        for (var i = 0; i < headers.length; i++) {
            if (headers[i]) arr.push(__normalizeKeyVal(headers[i]));
        }
    } else if (headers && typeof headers === 'object') {
        var keys = Object.keys(headers);
        for (var j = 0; j < keys.length; j++) {
            var k = keys[j];
            if (typeof headers[k] !== 'function') {
                arr.push(__normalizeKeyVal({ key: k, value: headers[k] }));
            }
        }
    } else if (typeof headers === 'string') {
        var lines = headers.split(/\\r?\\n/);
        for (var l = 0; l < lines.length; l++) {
            if (lines[l].trim()) arr.push(__normalizeKeyVal(lines[l]));
        }
    }
    return __attachPropertyListMethods(arr, true, onMutate);
}
HeaderList.isHeaderList = function(obj) {
    return Boolean(obj && obj.__isHeaderList);
};

function PropertyList(type, parent, populate, onMutate) {
    var arr = [];
    if (Array.isArray(populate)) {
        for (var i = 0; i < populate.length; i++) {
            if (populate[i]) arr.push(__normalizeKeyVal(populate[i]));
        }
    } else if (populate && typeof populate === 'object') {
        var keys = Object.keys(populate);
        for (var j = 0; j < keys.length; j++) {
            var k = keys[j];
            if (typeof populate[k] !== 'function') {
                arr.push(__normalizeKeyVal({ key: k, value: populate[k] }));
            }
        }
    }
    return __attachPropertyListMethods(arr, false, onMutate);
}

function __parseUrlString(str) {
    var raw = String(str || '');
    var hash = '';
    var work = raw;
    var hashIdx = work.indexOf('#');
    if (hashIdx !== -1) {
        hash = work.slice(hashIdx + 1);
        work = work.slice(0, hashIdx);
    }
    var query = [];
    var qIdx = work.indexOf('?');
    if (qIdx !== -1) {
        var qs = work.slice(qIdx + 1);
        work = work.slice(0, qIdx);
        if (qs) {
            var pairs = qs.split('&');
            for (var i = 0; i < pairs.length; i++) {
                if (!pairs[i]) continue;
                var eq = pairs[i].indexOf('=');
                var qk = eq !== -1 ? pairs[i].slice(0, eq) : pairs[i];
                var qv = eq !== -1 ? pairs[i].slice(eq + 1) : '';
                try { qk = decodeURIComponent(qk); } catch (e) {}
                try { qv = decodeURIComponent(qv); } catch (e) {}
                query.push({ id: __uid(), key: qk, value: qv, disabled: false });
            }
        }
    }
    var protocol = '';
    var auth = undefined;
    var port = '';
    var host = [];
    var path = [];
    var protoMatch = work.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\\/\\/(.*)$/);
    var remainder = work;
    if (protoMatch) {
        protocol = protoMatch[1].toLowerCase();
        remainder = protoMatch[2];
    }
    if (protoMatch || remainder.indexOf('/') !== 0) {
        var slashIdx = remainder.indexOf('/');
        var authority = slashIdx !== -1 ? remainder.slice(0, slashIdx) : remainder;
        var pathPart = slashIdx !== -1 ? remainder.slice(slashIdx + 1) : '';
        var atIdx = authority.indexOf('@');
        if (atIdx !== -1) {
            var userInfo = authority.slice(0, atIdx);
            authority = authority.slice(atIdx + 1);
            var colonAuth = userInfo.indexOf(':');
            auth = colonAuth !== -1
                ? { user: userInfo.slice(0, colonAuth), password: userInfo.slice(colonAuth + 1) }
                : { user: userInfo, password: '' };
        }
        var colonPort = authority.lastIndexOf(':');
        if (colonPort !== -1 && /^\\d+$/.test(authority.slice(colonPort + 1))) {
            port = authority.slice(colonPort + 1);
            authority = authority.slice(0, colonPort);
        }
        if (authority) {
            host = authority.indexOf('{{') !== -1 ? [authority] : authority.split('.');
        }
        if (pathPart) {
            path = pathPart.split('/').filter(Boolean);
        }
    } else {
        path = remainder.split('/').filter(Boolean);
    }
    return {
        raw: raw,
        protocol: protocol,
        host: host,
        port: port,
        path: path,
        query: query,
        hash: hash,
        auth: auth,
        variable: []
    };
}

function Url(options) {
    if (!(this instanceof Url)) return new Url(options);
    var selfUrl = this;
    this.__isUrl = true;
    this.raw = '';
    this.protocol = '';
    this.host = [];
    this.port = '';
    this.path = [];
    this.hash = '';
    this.auth = undefined;

    var __lastSyncedRaw = '';
    var __lastPartsSig = '';
    var getPartsSig = function() {
        return JSON.stringify([selfUrl.protocol, selfUrl.host, selfUrl.port, selfUrl.path, selfUrl.hash, selfUrl.auth]);
    };

    var syncRawFromParts = function() {
        var hostStr = selfUrl.getRemote();
        var proto = selfUrl.protocol ? selfUrl.protocol + '://' : '';
        if (hostStr && /^https?:\\/\\//i.test(hostStr)) {
            proto = '';
        }
        var authStr = selfUrl.auth && selfUrl.auth.user
            ? selfUrl.auth.user + (selfUrl.auth.password ? ':' + selfUrl.auth.password : '') + '@'
            : '';
        var pathStr = selfUrl.getPath(true);
        var qs = selfUrl.getQueryString();
        var hashStr = selfUrl.hash ? '#' + selfUrl.hash : '';
        var base = hostStr ? (proto + authStr + hostStr + pathStr) : (pathStr || '');
        selfUrl.raw = base + (qs ? '?' + qs : '') + hashStr;
        __lastSyncedRaw = selfUrl.raw;
        __lastPartsSig = getPartsSig();
    };

    this.query = PropertyList('QueryParam', this, [], syncRawFromParts);
    this.variables = PropertyList('Variable', this, []);
    this.variable = this.variables;

    this.update = function(input) {
        var parsed = typeof input === 'string'
            ? __parseUrlString(input)
            : (input && typeof input === 'object' ? input : {});
        if (typeof input !== 'string' && parsed.raw) {
            var fromRaw = __parseUrlString(parsed.raw);
            var hasTemplateHost = Array.isArray(parsed.host) && parsed.host.length === 1 && String(parsed.host[0]).indexOf('{{') !== -1 && /^https?:\\/\\//i.test(parsed.raw);
            parsed = Object.assign({}, fromRaw, parsed, {
                protocol: parsed.protocol || fromRaw.protocol,
                host: (!parsed.host || parsed.host.length === 0 || hasTemplateHost) ? fromRaw.host : parsed.host,
                port: parsed.port || fromRaw.port,
                path: (parsed.path && parsed.path.length) ? parsed.path : fromRaw.path,
                query: (parsed.query && parsed.query.length) ? parsed.query : fromRaw.query,
                hash: parsed.hash || fromRaw.hash,
                auth: parsed.auth || fromRaw.auth
            });
        }
        selfUrl.protocol = parsed.protocol || '';
        selfUrl.host = Array.isArray(parsed.host) ? parsed.host.slice() : (parsed.host ? String(parsed.host).split('.') : []);
        selfUrl.port = parsed.port ? String(parsed.port) : '';
        selfUrl.path = Array.isArray(parsed.path) ? parsed.path.slice() : (parsed.path ? String(parsed.path).split('/').filter(Boolean) : []);
        selfUrl.hash = parsed.hash || '';
        selfUrl.auth = parsed.auth;
        selfUrl.query = PropertyList('QueryParam', selfUrl, parsed.query || [], syncRawFromParts);
        selfUrl.variables = PropertyList('Variable', selfUrl, parsed.variable || parsed.variables || []);
        selfUrl.variable = selfUrl.variables;
        if (parsed.raw !== undefined) {
            selfUrl.raw = String(parsed.raw);
            __lastSyncedRaw = selfUrl.raw;
            __lastPartsSig = getPartsSig();
        } else {
            syncRawFromParts();
        }
    };

    this.addQueryParams = function(params) {
        if (!params) return selfUrl;
        if (typeof params === 'string') {
            var pairs = params.replace(/^\\?/, '').split('&');
            for (var i = 0; i < pairs.length; i++) {
                if (!pairs[i]) continue;
                var eq = pairs[i].indexOf('=');
                var k = eq !== -1 ? pairs[i].slice(0, eq) : pairs[i];
                var v = eq !== -1 ? pairs[i].slice(eq + 1) : '';
                try { k = decodeURIComponent(k); } catch (e) {}
                try { v = decodeURIComponent(v); } catch (e) {}
                selfUrl.query.push(__normalizeKeyVal({ key: k, value: v }));
            }
        } else if (Array.isArray(params)) {
            for (var j = 0; j < params.length; j++) {
                if (params[j]) selfUrl.query.push(__normalizeKeyVal(params[j]));
            }
        } else if (typeof params === 'object') {
            var keys = Object.keys(params);
            for (var m = 0; m < keys.length; m++) {
                selfUrl.query.push(__normalizeKeyVal({ key: keys[m], value: params[keys[m]] }));
            }
        }
        syncRawFromParts();
        return selfUrl;
    };

    this.removeQueryParams = function(params) {
        if (!params) return selfUrl;
        var list = Array.isArray(params) ? params : [params];
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            var key = typeof item === 'object' && item !== null ? item.key : String(item);
            selfUrl.query.remove(key);
        }
        syncRawFromParts();
        return selfUrl;
    };

    this.getQueryString = function() {
        return selfUrl.query
            .filter(function(q) { return q && !q.disabled && q.key; })
            .map(function(q) { return encodeURIComponent(q.key) + '=' + encodeURIComponent(q.value !== undefined ? q.value : ''); })
            .join('&');
    };

    this.getHost = function() {
        if (!Array.isArray(selfUrl.host) || selfUrl.host.length === 0) return '';
        return selfUrl.host.join('.');
    };

    this.getPath = function(unresolved) {
        if (!Array.isArray(selfUrl.path) || selfUrl.path.length === 0) return '';
        var segments = selfUrl.path.map(function(seg) {
            if (!unresolved && typeof seg === 'string' && seg.charAt(0) === ':') {
                var varKey = seg.slice(1);
                var found = selfUrl.variables.one(varKey);
                if (found && found.value) return found.value;
            }
            return seg;
        });
        return '/' + segments.join('/');
    };

    this.getPathWithQuery = function() {
        var p = selfUrl.getPath() || '/';
        var qs = selfUrl.getQueryString();
        return qs ? p + '?' + qs : p;
    };

    this.getRemote = function(forcePort) {
        var h = selfUrl.getHost();
        if (!selfUrl.port) return h;
        var isDefault = (!forcePort) && (
            (selfUrl.protocol === 'http' && selfUrl.port === '80') ||
            (selfUrl.protocol === 'https' && selfUrl.port === '443')
        );
        return isDefault ? h : (h ? h + ':' + selfUrl.port : selfUrl.port);
    };

    this.toString = function(forceProtocol) {
        if (selfUrl.raw === __lastSyncedRaw && getPartsSig() !== __lastPartsSig) {
            syncRawFromParts();
        } else if (!selfUrl.raw) {
            syncRawFromParts();
        }
        if (forceProtocol && selfUrl.raw && !/^[a-zA-Z][a-zA-Z0-9+.-]*:\\/\\//.test(selfUrl.raw)) {
            return (selfUrl.protocol || 'http') + '://' + selfUrl.raw.replace(/^\\/+/, '');
        }
        return selfUrl.raw;
    };

    this.toJSON = function() {
        if (selfUrl.raw === __lastSyncedRaw && getPartsSig() !== __lastPartsSig) {
            syncRawFromParts();
        }
        var out = {
            raw: selfUrl.raw,
            host: Array.isArray(selfUrl.host) ? selfUrl.host.slice() : [],
            path: Array.isArray(selfUrl.path) ? selfUrl.path.slice() : [],
            query: selfUrl.query.toJSON(),
            variable: selfUrl.variables.toJSON()
        };
        if (selfUrl.protocol) out.protocol = selfUrl.protocol;
        if (selfUrl.port) out.port = selfUrl.port;
        if (selfUrl.hash) out.hash = selfUrl.hash;
        if (selfUrl.auth) out.auth = selfUrl.auth;
        return out;
    };

    this.update(options || '');
}
Url.isUrl = function(obj) { return Boolean(obj && obj.__isUrl); };
Url.parse = function(urlStr) { return __parseUrlString(urlStr); };

var __VALID_AUTH_TYPES = ['apikey', 'awsv4', 'basic', 'bearer', 'digest', 'hawk', 'noauth', 'ntlm', 'oauth1', 'oauth2'];

function RequestAuth(options) {
    if (!(this instanceof RequestAuth)) return new RequestAuth(options);
    var selfAuth = this;
    var opts = options && typeof options === 'object' ? options : {};
    this.__isRequestAuth = true;
    this.id = opts.id || __uid();
    this.name = opts.name || '';
    this.type = opts.type || 'noauth';
    this.disabled = Boolean(opts.disabled);
    this.authSource = opts.authSource || (opts.type ? 'onrequest' : 'none');

    var initParams = function(list) {
        return PropertyList('AuthParam', selfAuth, Array.isArray(list) ? list : []);
    };

    for (var i = 0; i < __VALID_AUTH_TYPES.length; i++) {
        var t = __VALID_AUTH_TYPES[i];
        if (opts[t]) this[t] = initParams(opts[t]);
    }
    if (!this.bearer) this.bearer = initParams(opts.bearer);

    var normalizeAuthOptions = function(paramInput) {
        if (Array.isArray(paramInput)) return paramInput;
        if (paramInput && typeof paramInput === 'object') {
            return Object.keys(paramInput).map(function(k) {
                return { id: __uid(), key: k, value: String(paramInput[k] !== undefined ? paramInput[k] : ''), type: 'string' };
            });
        }
        return [];
    };

    this.use = function(type, authOptions) {
        selfAuth.type = String(type || 'noauth').toLowerCase();
        selfAuth.authSource = selfAuth.type === 'noauth' ? 'none' : 'onrequest';
        selfAuth[selfAuth.type] = initParams(normalizeAuthOptions(authOptions));
        return selfAuth;
    };

    this.update = function(authOptions, type) {
        var targetType = String(type || selfAuth.type || 'bearer').toLowerCase();
        selfAuth.type = targetType;
        if (targetType !== 'noauth') selfAuth.authSource = 'onrequest';
        if (!selfAuth[targetType] || !selfAuth[targetType].__isPropertyList) {
            selfAuth[targetType] = initParams([]);
        }
        var items = normalizeAuthOptions(authOptions);
        for (var j = 0; j < items.length; j++) {
            selfAuth[targetType].upsert(items[j]);
        }
        return selfAuth;
    };

    this.clear = function(type) {
        var targetType = String(type || selfAuth.type || '').toLowerCase();
        if (targetType && selfAuth[targetType] && selfAuth[targetType].clear) {
            selfAuth[targetType].clear();
        }
        return selfAuth;
    };

    this.parameters = function() {
        var t = String(selfAuth.type || '').toLowerCase();
        if (!selfAuth[t] || !selfAuth[t].__isPropertyList) {
            selfAuth[t] = initParams([]);
        }
        return selfAuth[t];
    };

    this.toJSON = function() {
        var out = {
            type: selfAuth.type,
            authSource: selfAuth.authSource || 'none'
        };
        if (selfAuth.id) out.id = selfAuth.id;
        if (selfAuth.name) out.name = selfAuth.name;
        if (selfAuth.disabled) out.disabled = selfAuth.disabled;
        for (var k = 0; k < __VALID_AUTH_TYPES.length; k++) {
            var at = __VALID_AUTH_TYPES[k];
            if (selfAuth[at] && selfAuth[at].toJSON && selfAuth[at].length > 0) {
                out[at] = selfAuth[at].toJSON();
            }
        }
        return out;
    };
}
RequestAuth.isValidType = function(type) {
    return __VALID_AUTH_TYPES.indexOf(String(type || '').toLowerCase()) !== -1;
};

function RequestBody(options, readOnly) {
    if (!(this instanceof RequestBody)) return new RequestBody(options, readOnly);
    var selfBody = this;
    this.__isRequestBody = true;
    this.mode = 'raw';
    this.raw = '';
    this.urlencoded = PropertyList('QueryParam', this, []);
    this.formdata = PropertyList('FormParam', this, []);
    this.file = undefined;
    this.graphql = undefined;
    this.options = undefined;
    this.disabled = false;

    this.update = function(opts) {
        if (readOnly) return selfBody;
        if (typeof opts === 'string') {
            selfBody.mode = 'raw';
            selfBody.raw = opts;
            return selfBody;
        }
        var o = opts && typeof opts === 'object' ? opts : {};
        if (o.mode !== undefined) selfBody.mode = o.mode;
        if (o.raw !== undefined) selfBody.raw = String(o.raw);
        if (o.urlencoded !== undefined) selfBody.urlencoded = PropertyList('QueryParam', selfBody, o.urlencoded);
        if (o.formdata !== undefined) selfBody.formdata = PropertyList('FormParam', selfBody, o.formdata);
        if (o.file !== undefined) selfBody.file = o.file;
        if (o.graphql !== undefined) selfBody.graphql = o.graphql;
        if (o.options !== undefined) selfBody.options = o.options;
        if (o.disabled !== undefined) selfBody.disabled = Boolean(o.disabled);
        return selfBody;
    };

    this.isEmpty = function() {
        if (selfBody.disabled) return true;
        if (selfBody.mode === 'raw') return !selfBody.raw;
        if (selfBody.mode === 'urlencoded') return !selfBody.urlencoded || selfBody.urlencoded.length === 0;
        if (selfBody.mode === 'formdata') return !selfBody.formdata || selfBody.formdata.length === 0;
        if (selfBody.mode === 'file') return !selfBody.file || !selfBody.file.src;
        if (selfBody.mode === 'graphql') return !selfBody.graphql || (!selfBody.graphql.query && !selfBody.graphql.variables);
        return true;
    };

    this.toString = function() {
        if (selfBody.disabled) return '';
        if (selfBody.mode === 'raw') return selfBody.raw || '';
        if (selfBody.mode === 'urlencoded') return selfBody.urlencoded.toString();
        if (selfBody.mode === 'graphql') return JSON.stringify(selfBody.graphql || {});
        return '';
    };

    this.toJSON = function() {
        var out = {
            mode: selfBody.mode,
            raw: selfBody.raw || ''
        };
        if (selfBody.formdata && selfBody.formdata.length > 0) out.formdata = selfBody.formdata.toJSON();
        if (selfBody.urlencoded && selfBody.urlencoded.length > 0) out.urlencoded = selfBody.urlencoded.toJSON();
        if (selfBody.file !== undefined) out.file = selfBody.file;
        if (selfBody.graphql !== undefined) out.graphql = selfBody.graphql;
        if (selfBody.options !== undefined) out.options = selfBody.options;
        if (selfBody.disabled) out.disabled = true;
        return out;
    };

    this.update(options || {});
    if (readOnly) {
        Object.freeze(this);
    }
}
RequestBody.MODES = {
    raw: 'raw',
    urlencoded: 'urlencoded',
    formdata: 'formdata',
    file: 'file',
    graphql: 'graphql'
};

self.__postmanCollection = {
    Url: Url,
    HeaderList: HeaderList,
    PropertyList: PropertyList,
    RequestAuth: RequestAuth,
    RequestBody: RequestBody
};
self.Url = Url;
self.HeaderList = HeaderList;
self.RequestAuth = RequestAuth;
self.RequestBody = RequestBody;

function __deepEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    var keysA = Object.keys(a);
    var keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (var i = 0; i < keysA.length; i++) {
        var k = keysA[i];
        if (!Object.prototype.hasOwnProperty.call(b, k) || !__deepEqual(a[k], b[k])) return false;
    }
    return true;
}

function __validateJsonSchema(data, schema, path) {
    var p = path || 'root';
    if (!schema || typeof schema !== 'object') return [];
    var errors = [];
    if (schema.type) {
        var types = Array.isArray(schema.type) ? schema.type : [schema.type];
        var actualType = Array.isArray(data) ? 'array' : (data === null ? 'null' : typeof data);
        var typeMatched = types.some(function(t) {
            if (t === 'integer') return typeof data === 'number' && Number.isInteger(data);
            return t === actualType;
        });
        if (!typeMatched) {
            errors.push(p + ': expected type ' + types.join('|') + ' but got ' + actualType);
            return errors;
        }
    }
    if (schema.enum && Array.isArray(schema.enum)) {
        if (!schema.enum.some(function(v) { return __deepEqual(v, data); })) {
            errors.push(p + ': value not in enum');
        }
    }
    if (typeof data === 'string') {
        if (typeof schema.minLength === 'number' && data.length < schema.minLength) {
            errors.push(p + ': string shorter than minLength ' + schema.minLength);
        }
        if (typeof schema.maxLength === 'number' && data.length > schema.maxLength) {
            errors.push(p + ': string longer than maxLength ' + schema.maxLength);
        }
        if (schema.pattern && !(new RegExp(schema.pattern)).test(data)) {
            errors.push(p + ': string does not match pattern ' + schema.pattern);
        }
        if (schema.format === 'email' && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(data)) {
            errors.push(p + ': invalid email format');
        }
    }
    if (typeof data === 'number') {
        if (typeof schema.minimum === 'number' && data < schema.minimum) {
            errors.push(p + ': number less than minimum ' + schema.minimum);
        }
        if (typeof schema.maximum === 'number' && data > schema.maximum) {
            errors.push(p + ': number greater than maximum ' + schema.maximum);
        }
    }
    if (Array.isArray(data) && schema.items) {
        for (var i = 0; i < data.length; i++) {
            errors = errors.concat(__validateJsonSchema(data[i], schema.items, p + '[' + i + ']'));
        }
    }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (Array.isArray(schema.required)) {
            for (var r = 0; r < schema.required.length; r++) {
                var reqKey = schema.required[r];
                if (!Object.prototype.hasOwnProperty.call(data, reqKey) || data[reqKey] === undefined) {
                    errors.push(p + ': missing required property "' + reqKey + '"');
                }
            }
        }
        if (schema.properties && typeof schema.properties === 'object') {
            var propKeys = Object.keys(schema.properties);
            for (var pk = 0; pk < propKeys.length; pk++) {
                var k = propKeys[pk];
                if (Object.prototype.hasOwnProperty.call(data, k) && data[k] !== undefined) {
                    errors = errors.concat(__validateJsonSchema(data[k], schema.properties[k], p + '.' + k));
                }
            }
        }
    }
    return errors;
}

function __createExpect(actual, negated) {
    var isNot = Boolean(negated);
    var check = function(cond, msg) {
        if (isNot ? cond : !cond) {
            throw new Error(msg);
        }
    };
    var api = {
        toBe: function(expected) {
            check(actual === expected, 'Expected ' + JSON.stringify(actual) + (isNot ? ' not' : '') + ' to be ' + JSON.stringify(expected));
            return api;
        },
        equal: function(expected) {
            check(actual === expected, 'Expected ' + JSON.stringify(actual) + (isNot ? ' not' : '') + ' to equal ' + JSON.stringify(expected));
            return api;
        },
        eql: function(expected) {
            check(__deepEqual(actual, expected), 'Expected ' + JSON.stringify(actual) + (isNot ? ' not' : '') + ' to deeply equal ' + JSON.stringify(expected));
            return api;
        },
        include: function(val) {
            var ok = false;
            if (typeof actual === 'string') ok = actual.indexOf(String(val)) !== -1;
            else if (Array.isArray(actual)) ok = actual.some(function(x) { return __deepEqual(x, val); });
            else if (actual && typeof actual === 'object' && val && typeof val === 'object') {
                ok = Object.keys(val).every(function(k) { return __deepEqual(actual[k], val[k]); });
            }
            check(ok, 'Expected ' + JSON.stringify(actual) + (isNot ? ' not' : '') + ' to include ' + JSON.stringify(val));
            return api;
        },
        contain: function(val) { return api.include(val); },
        match: function(regex) {
            var re = regex instanceof RegExp ? regex : new RegExp(String(regex));
            check(re.test(String(actual)), 'Expected ' + JSON.stringify(actual) + (isNot ? ' not' : '') + ' to match ' + String(re));
            return api;
        },
        above: function(n) {
            check(Number(actual) > n, 'Expected ' + actual + (isNot ? ' not' : '') + ' to be above ' + n);
            return api;
        },
        below: function(n) {
            check(Number(actual) < n, 'Expected ' + actual + (isNot ? ' not' : '') + ' to be below ' + n);
            return api;
        },
        least: function(n) {
            check(Number(actual) >= n, 'Expected ' + actual + (isNot ? ' not' : '') + ' to be at least ' + n);
            return api;
        },
        most: function(n) {
            check(Number(actual) <= n, 'Expected ' + actual + (isNot ? ' not' : '') + ' to be at most ' + n);
            return api;
        },
        a: function(typeStr) {
            var t = String(typeStr).toLowerCase();
            var actualT = Array.isArray(actual) ? 'array' : (actual === null ? 'null' : typeof actual);
            check(actualT === t, 'Expected ' + JSON.stringify(actual) + (isNot ? ' not' : '') + ' to be a ' + t);
            return api;
        },
        an: function(typeStr) { return api.a(typeStr); },
        property: function(name, val) {
            var hasProp = actual !== null && actual !== undefined && (name in Object(actual));
            check(hasProp, 'Expected object' + (isNot ? ' not' : '') + ' to have property "' + name + '"');
            if (arguments.length > 1 && hasProp) {
                check(__deepEqual(actual[name], val), 'Expected property "' + name + '" to equal ' + JSON.stringify(val));
            }
            return hasProp ? __createExpect(actual[name], false) : api;
        },
        length: function(n) {
            var len = actual && actual.length !== undefined ? actual.length : -1;
            check(len === n, 'Expected length ' + len + (isNot ? ' not' : '') + ' to equal ' + n);
            return api;
        },
        lengthOf: function(n) { return api.length(n); },
        keys: function() {
            var expectedKeys = Array.isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments);
            var objKeys = actual && typeof actual === 'object' ? Object.keys(actual) : [];
            var hasAll = expectedKeys.every(function(k) { return objKeys.indexOf(String(k)) !== -1; });
            check(hasAll, 'Expected object' + (isNot ? ' not' : '') + ' to have keys ' + JSON.stringify(expectedKeys));
            return api;
        },
        status: function(expected) {
            var code = actual && (actual.code !== undefined ? actual.code : actual.statusCode);
            var status = actual && (actual.status !== undefined ? actual.status : actual.statusText);
            var matched = typeof expected === 'number' ? code === expected : status === expected;
            check(matched, 'Expected response status ' + JSON.stringify(expected) + ', got ' + JSON.stringify(typeof expected === 'number' ? code : status));
            return api;
        },
        header: function(key, val) {
            var hdrs = actual && actual.headers;
            var hasHdr = false;
            if (hdrs && typeof hdrs.has === 'function') {
                hasHdr = hdrs.has(key, val);
            } else if (hdrs && typeof hdrs === 'object') {
                var target = String(key || '').toLowerCase();
                var foundKey = Object.keys(hdrs).find(function(k) { return k.toLowerCase() === target; });
                if (foundKey !== undefined) {
                    hasHdr = val === undefined ? true : hdrs[foundKey] === String(val);
                }
            }
            check(hasHdr, 'Expected header "' + key + '"' + (val !== undefined ? ' with value "' + val + '"' : '') + (isNot ? ' not' : '') + ' to exist');
            return api;
        },
        body: function(expected) {
            var b = actual && typeof actual.text === 'function' ? actual.text() : (actual && actual.data);
            if (expected instanceof RegExp) {
                check(expected.test(String(b)), 'Expected body to match ' + String(expected));
            } else if (expected !== undefined) {
                check(__deepEqual(b, expected) || String(b) === String(expected), 'Expected body to equal ' + JSON.stringify(expected));
            } else {
                check(Boolean(b), 'Expected response body to exist');
            }
            return api;
        },
        jsonBody: function(expected) {
            var parsed;
            var parseOk = true;
            try {
                parsed = actual && typeof actual.json === 'function' ? actual.json() : JSON.parse(String(actual && actual.data));
            } catch (e) {
                parseOk = false;
            }
            check(parseOk, 'Expected response body to be valid JSON');
            if (parseOk && expected !== undefined) {
                check(__deepEqual(parsed, expected), 'Expected JSON body to equal ' + JSON.stringify(expected));
            }
            return api;
        },
        jsonSchema: function(schema) {
            var target = actual;
            if (actual && typeof actual.json === 'function') {
                target = actual.json();
            }
            var errs = __validateJsonSchema(target, schema, 'response');
            check(errs.length === 0, 'JSON Schema validation failed: ' + errs.join('; '));
            return api;
        }
    };

    Object.defineProperties(api, {
        to: { get: function() { return api; } },
        be: { get: function() { return api; } },
        have: { get: function() { return api; } },
        at: { get: function() { return api; } },
        of: { get: function() { return api; } },
        and: { get: function() { return api; } },
        not: { get: function() { return __createExpect(actual, !isNot); } },
        exist: {
            get: function() {
                check(actual !== null && actual !== undefined, 'Expected value' + (isNot ? ' not' : '') + ' to exist');
                return api;
            }
        },
        ok: {
            get: function() {
                if (actual && (actual.code !== undefined || actual.statusCode !== undefined)) {
                    var c = actual.code !== undefined ? actual.code : actual.statusCode;
                    check(c >= 200 && c < 300, 'Expected HTTP status 2xx, got ' + c);
                } else {
                    check(Boolean(actual), 'Expected ' + JSON.stringify(actual) + (isNot ? ' not' : '') + ' to be truthy');
                }
                return api;
            }
        },
        success: {
            get: function() {
                var c = actual && (actual.code !== undefined ? actual.code : actual.statusCode);
                check(c >= 200 && c < 300, 'Expected 2xx status, got ' + c);
                return api;
            }
        },
        redirection: {
            get: function() {
                var c = actual && (actual.code !== undefined ? actual.code : actual.statusCode);
                check(c >= 300 && c < 400, 'Expected 3xx status, got ' + c);
                return api;
            }
        },
        clientError: {
            get: function() {
                var c = actual && (actual.code !== undefined ? actual.code : actual.statusCode);
                check(c >= 400 && c < 500, 'Expected 4xx status, got ' + c);
                return api;
            }
        },
        serverError: {
            get: function() {
                var c = actual && (actual.code !== undefined ? actual.code : actual.statusCode);
                check(c >= 500 && c < 600, 'Expected 5xx status, got ' + c);
                return api;
            }
        },
        error: {
            get: function() {
                var c = actual && (actual.code !== undefined ? actual.code : actual.statusCode);
                check(c >= 400 && c < 600, 'Expected 4xx/5xx error status, got ' + c);
                return api;
            }
        },
        json: {
            get: function() {
                var ok = true;
                try {
                    if (actual && typeof actual.json === 'function') actual.json();
                    else JSON.parse(String(actual));
                } catch (e) { ok = false; }
                check(ok, 'Expected valid JSON');
                return api;
            }
        },
        true: {
            get: function() {
                check(actual === true, 'Expected ' + JSON.stringify(actual) + (isNot ? ' not' : '') + ' to be true');
                return api;
            }
        },
        false: {
            get: function() {
                check(actual === false, 'Expected ' + JSON.stringify(actual) + (isNot ? ' not' : '') + ' to be false');
                return api;
            }
        },
        null: {
            get: function() {
                check(actual === null, 'Expected ' + JSON.stringify(actual) + (isNot ? ' not' : '') + ' to be null');
                return api;
            }
        },
        undefined: {
            get: function() {
                check(actual === undefined, 'Expected ' + JSON.stringify(actual) + (isNot ? ' not' : '') + ' to be undefined');
                return api;
            }
        },
        empty: {
            get: function() {
                var isEmpty = false;
                if (actual === null || actual === undefined || actual === '') isEmpty = true;
                else if (Array.isArray(actual) || typeof actual === 'string') isEmpty = actual.length === 0;
                else if (typeof actual === 'object') isEmpty = Object.keys(actual).length === 0;
                check(isEmpty, 'Expected ' + JSON.stringify(actual) + (isNot ? ' not' : '') + ' to be empty');
                return api;
            }
        }
    });
    return api;
}

function __hydrateRequest(rawReq, isPostResponse) {
    var req = rawReq && typeof rawReq === 'object' ? Object.assign({}, rawReq) : {};
    req.id = req.id || '';
    req.name = req.name || '';
    req.method = req.method || 'GET';
    req.url = new Url(req.url || '');
    req.headers = new HeaderList(req, req.headers || req.header || []);
    req.query = req.url.query;
    req.body = new RequestBody(req.body || { mode: 'raw', raw: '' }, isPostResponse);
    req.auth = new RequestAuth(req.auth || { type: 'noauth', authSource: 'none' });
    req.toJSON = function() {
        var urlObj = req.url && typeof req.url.toJSON === 'function' ? req.url.toJSON() : (typeof req.url === 'string' ? __parseUrlString(req.url) : req.url);
        var hdrs = req.headers && typeof req.headers.toJSON === 'function' ? req.headers.toJSON() : req.headers;
        var qry = req.query && typeof req.query.toJSON === 'function' ? req.query.toJSON() : (urlObj && urlObj.query ? urlObj.query : []);
        var bdy = req.body && typeof req.body.toJSON === 'function'
            ? req.body.toJSON()
            : (typeof req.body === 'string' ? { mode: 'raw', raw: req.body } : req.body);
        var authObj = req.auth && typeof req.auth.toJSON === 'function' ? req.auth.toJSON() : req.auth;
        return Object.assign({}, rawReq, {
            id: req.id,
            name: req.name,
            method: req.method,
            url: urlObj,
            headers: hdrs,
            query: qry,
            body: bdy,
            auth: authObj
        });
    };
    return req;
}

function __hydrateResponse(rawRes) {
    var res = rawRes && typeof rawRes === 'object' ? Object.assign({}, rawRes) : {};
    var code = res.statusCode !== undefined ? res.statusCode : (res.code !== undefined ? res.code : 0);
    var status = res.statusText !== undefined ? res.statusText : (res.status !== undefined ? res.status : '');
    var rawHeaders = res.headers || {};
    var headerList = new HeaderList(res, rawHeaders);
    if (rawHeaders && typeof rawHeaders === 'object' && !Array.isArray(rawHeaders)) {
        var hKeys = Object.keys(rawHeaders);
        for (var i = 0; i < hKeys.length; i++) {
            var hk = hKeys[i];
            if (!(hk in headerList)) {
                headerList[hk] = rawHeaders[hk];
            }
        }
    }
    var sizeBytes = typeof res.responseSizeBytes === 'number'
        ? res.responseSizeBytes
        : (typeof res.responseSize === 'number' ? res.responseSize : Math.round((parseFloat(res.responseSize) || 0) * 1024));

    var pmRes = {
        code: code,
        status: status,
        statusCode: code,
        statusText: status,
        headers: headerList,
        responseTime: res.responseTime || 0,
        responseSize: sizeBytes,
        data: res.data,
        rawRequest: res.rawRequest,
        protocol: res.protocol,
        contentType: res.contentType,
        isBinary: res.isBinary,
        text: function() {
            if (typeof res.rawText === 'string') return res.rawText;
            if (res.data === null || res.data === undefined) return '';
            if (typeof res.data === 'string') return res.data;
            return JSON.stringify(res.data);
        },
        json: function() {
            var txt = pmRes.text();
            return JSON.parse(txt);
        }
    };
    Object.defineProperty(pmRes, 'to', {
        get: function() { return __createExpect(pmRes, false); },
        enumerable: false
    });
    return pmRes;
}
`

function createWorkerBootstrap(mode: "prerequest" | "postrequest"): string {
    const isPre = mode === "prerequest"
    return `
${CRYPTO_JS_BOOTSTRAP}
${POSTMAN_SDK_BOOTSTRAP}
self.onmessage = function(e) {
    var __script = e.data.script;
    var __vars = Object.assign({}, e.data.variables || {});
    var __mutations = {};
    var __logs = [];
    var __tests = [];
    var __skipRequest = false;
    var __nextRequest = null;

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

    var __reqObj = __hydrateRequest(e.data.request || {}, ${!isPre});
    var __resObj = ${isPre ? "undefined" : "__hydrateResponse(e.data.response || {})"};

    function __createVarScope() {
        return {
            get: function(key) { return __vars[key]; },
            set: function(key, value) {
                __mutations[key] = value;
                __vars[key] = value;
            },
            unset: function(key) {
                __mutations[key] = null;
                delete __vars[key];
            },
            has: function(key) {
                return Object.prototype.hasOwnProperty.call(__vars, key) && __vars[key] !== undefined && __vars[key] !== null;
            },
            clear: function() {
                var keys = Object.keys(__vars);
                for (var i = 0; i < keys.length; i++) {
                    __mutations[keys[i]] = null;
                    delete __vars[keys[i]];
                }
            },
            toObject: function() { return Object.assign({}, __vars); },
            replaceIn: function(template) {
                return String(template || '').replace(/\\{\\{\\s*([^}]+?)\\s*\\}\\}/g, function(m, k) {
                    return __vars[k] !== undefined && __vars[k] !== null ? String(__vars[k]) : m;
                });
            }
        };
    }

    var __scope = __createVarScope();

    var pm = {
        info: {
            eventName: '${isPre ? "prerequest" : "test"}',
            iteration: 0,
            iterationCount: 1,
            requestName: __reqObj.name || '',
            requestId: __reqObj.id || ''
        },
        environment: __scope,
        collectionVariables: __scope,
        variables: __scope,
        globals: __scope,
        iterationData: __scope,
        request: __reqObj,
        ${isPre ? "" : "response: __resObj,"}
        execution: {
            skipRequest: function() { __skipRequest = true; },
            setNextRequest: function(target) { __nextRequest = target; }
        },
        expect: function(actual) { return __createExpect(actual, false); },
        test: function(testName, specFunction) {
            try {
                if (typeof specFunction === 'function') specFunction();
                __tests.push({ name: String(testName), passed: true });
                __logs.push({ type: 'info', message: 'PASS: ' + String(testName), timestamp: Date.now(), scriptType: '${mode}' });
            } catch (err) {
                var errMsg = err && err.message ? err.message : String(err);
                __tests.push({ name: String(testName), passed: false, error: errMsg });
                __logs.push({ type: 'error', message: 'FAIL: ' + String(testName) + ' - ' + errMsg, timestamp: Date.now(), scriptType: '${mode}' });
            }
        },
        CryptoJS: self.CryptoJS
    };

    try {
        delete self.fetch;
        delete self.XMLHttpRequest;
        delete self.WebSocket;
        delete self.importScripts;
        var fn = new Function('${isPre ? "request" : "response"}', 'pm', ${isPre ? "__script" : "'var request = pm.request;\\n' + __script"});
        var result = fn(${isPre ? "__reqObj" : "__resObj"}, pm);
        if (result === undefined && __tests.length > 0) {
            result = __tests;
        }
        self.postMessage({
            ok: true,
            result: result,
            ${isPre ? "request: __reqObj.toJSON()," : ""}
            mutations: __mutations,
            logs: __logs,
            tests: __tests,
            skipRequest: __skipRequest,
            nextRequest: __nextRequest
        });
    } catch (err) {
        self.postMessage({
            ok: false,
            error: err.message || '${isPre ? "Pre-request script" : "Script"} execution failed',
            logs: __logs,
            tests: __tests
        });
    }
};
`
}

const POST_REQUEST_BOOTSTRAP = createWorkerBootstrap("postrequest")
const PRE_REQUEST_BOOTSTRAP = createWorkerBootstrap("prerequest")

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
): Promise<{
    result: unknown
    mutations: Record<string, string | null>
    logs: ScriptLog[]
    tests?: ScriptTestResult[]
    nextRequest?: string | null
}> {
    const res = await executeWorker<ScriptOutput>(POST_REQUEST_BOOTSTRAP, input, "Script timed out (5s)")
    return {
        result: res.result,
        mutations: res.mutations || {},
        logs: res.logs || [],
        tests: res.tests,
        nextRequest: res.nextRequest,
    }
}

export async function runPreRequestScript(
    input: PreRequestScriptInput
): Promise<PreRequestScriptOutput> {
    const res = await executeWorker<PreScriptWorkerOutput>(
        PRE_REQUEST_BOOTSTRAP,
        input,
        "Pre-request script timed out (5s)"
    )
    return {
        result: res.result,
        request: res.request || input.request,
        mutations: res.mutations || {},
        logs: res.logs || [],
        skipRequest: res.skipRequest,
        nextRequest: res.nextRequest,
        tests: res.tests,
    }
}
