export class Logger {
    static start = new Date().getTime();

    constructor(
        private scopes: string[] = []
    ) {
    }

    scope(scope: string) {
        return new Logger([...this.scopes, scope]);
    }

    log(level: 'error' | 'info' | 'trace' | 'warn' | 'debug', msg: string, ...args: any[]) {
        const scopes = this.scopes.map(s => `[${s}]`).join('');
        const coloredText = this.color(level, `[${level.toUpperCase()}]${scopes}`);
        const stamp = (new Date().getTime() - Logger.start).toString().padStart(8, ' ');
        console.log(`[${stamp}]${coloredText} ${msg}`, ...args);
    }

    info(msg: string, ...args: any[]) {
        this.log('info', msg, ...args);
    }

    error(msg: string, ...args: any[]) {
        this.log('error', msg, ...args);
    }

    trace(msg: string, ...args: any[]) {
        this.log('trace', msg, ...args);
    }

    warn(msg: string, ...args: any[]) {
        this.log('warn', msg, ...args);
    }

    debug(msg: string, ...args: any[]) {
        this.log('debug', msg, ...args);
    }

    private color(level: 'error' | 'info' | 'trace' | 'warn' | 'debug', text: string) {
        const MAP = new Map([
            ['error', '31m'],
            ['info', '36m'],
            ['trace', '32m'],
            ['warn', '33m'],
            ['debug', '35m'],
        ]);
        return `\x1b[${MAP.get(level)}${text}\x1b[0m`;
    }
}

export const logger: Logger | null = null; //new Logger();