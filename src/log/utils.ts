// Hybrid logger: prefer tslog when available; fallback to console when running inside environments
// where static bundling/closure (Pulumi) can’t handle tslog exports.

export interface Logger {
    trace: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
}

// Levels: 0=trace,1=debug,2=info,3=warn,4=error
const DEFAULT_LOG_LEVEL = 4
let logVerbosity = process.env.CLOUDYPAD_LOG_LEVEL ? Number.parseInt(process.env.CLOUDYPAD_LOG_LEVEL) : DEFAULT_LOG_LEVEL

function makePrinter(prefix: string, level: number) {
    return (...args: unknown[]) => {
        switch (level) {
            case 0: console.trace(prefix, ...args); break
            case 1: console.debug(prefix, ...args); break
            case 2: console.info(prefix, ...args); break
            case 3: console.warn(prefix, ...args); break
            case 4: console.error(prefix, ...args); break
            default: console.log(prefix, ...args)
        }
    }
}

function makeConsoleLogger(name: string, minLevel: number): Logger {
    const min = Number.isFinite(minLevel) ? minLevel : DEFAULT_LOG_LEVEL
    const prefix = `[${name}]`
    return {
        trace: (...a) => { if (min <= 0) makePrinter(prefix, 0)(...a) },
        debug: (...a) => { if (min <= 1) makePrinter(prefix, 1)(...a) },
        info:  (...a) => { if (min <= 2) makePrinter(prefix, 2)(...a) },
        warn:  (...a) => { if (min <= 3) makePrinter(prefix, 3)(...a) },
        error: (...a) => { if (min <= 4) makePrinter(prefix, 4)(...a) },
    }
}

function tryMakeTslogLogger(name: string, minLevel: number): Logger | undefined {
    try {
        // Hide require from static analyzers/bundlers (Pulumi closure)
        const req = (0, eval)("require") as unknown as (id: string) => unknown
        if (typeof req !== "function") return undefined
        const mod = req("tslog") as unknown
        const maybeLogger = (mod as Record<string, unknown>)["Logger"]
        if (typeof maybeLogger !== "function") return undefined
        type TslogCtor = new (opts: { name: string; minLevel: number }) => {
            trace: (...a: unknown[]) => void
            debug: (...a: unknown[]) => void
            info: (...a: unknown[]) => void
            warn: (...a: unknown[]) => void
            error: (...a: unknown[]) => void
        }
        const LoggerCtor = maybeLogger as TslogCtor
        const logger = new LoggerCtor({ name, minLevel })
        // Adapt to our Logger interface
        return {
            trace: (...a) => logger.trace(...a),
            debug: (...a) => logger.debug(...a),
            info:  (...a) => logger.info(...a),
            warn:  (...a) => logger.warn(...a),
            error: (...a) => logger.error(...a),
        }
    } catch {
        return undefined
    }
}

export function getLogger(name: string, args = { minLevel: logVerbosity }): Logger {
    const min = Number.isFinite(args.minLevel) ? args.minLevel : DEFAULT_LOG_LEVEL
    // Try tslog first; if not available (or not loadable under Pulumi), fallback to console
    return tryMakeTslogLogger(name, min) ?? makeConsoleLogger(name, min)
}

export function getLogVerbosity(){
    return logVerbosity
}

export function setLogVerbosity(v: number){
    logVerbosity=v
}