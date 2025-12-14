/**
 * Backend Logger - Captures Extension Host console logs for MCP access
 */

export interface BackendLogEntry {
  type: 'log' | 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: number;
  source?: string;
}

class BackendLogger {
  private logs: BackendLogEntry[] = [];
  private maxLogs = 500;
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
    debug: typeof console.debug;
  };
  private initialized = false;

  constructor() {
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console),
    };
  }

  /**
   * Initialize the logger by intercepting console methods
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    const self = this;

    // Intercept console methods
    (['log', 'error', 'warn', 'info', 'debug'] as const).forEach((method) => {
      console[method] = function (...args: any[]) {
        // Call original method
        self.originalConsole[method](...args);

        // Serialize arguments
        const message = args
          .map((arg) => {
            if (arg === null) return 'null';
            if (arg === undefined) return 'undefined';
            if (typeof arg === 'string') return arg;
            if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
            if (arg instanceof Error) return `${arg.name}: ${arg.message}${arg.stack ? '\n' + arg.stack : ''}`;
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          })
          .join(' ');

        // Store log entry
        self.addLog({
          type: method,
          message,
          timestamp: Date.now(),
        });
      };
    });

    this.originalConsole.log('[BackendLogger] Initialized - capturing Extension Host logs');
  }

  /**
   * Add a log entry to the buffer
   */
  private addLog(entry: BackendLogEntry): void {
    this.logs.push(entry);

    // Trim old logs if exceeding limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * Get logs with optional filtering
   */
  getLogs(filter?: 'all' | 'log' | 'error' | 'warn' | 'info' | 'debug', limit = 100): {
    logs: BackendLogEntry[];
    total: number;
    truncated: boolean;
  } {
    let filteredLogs = this.logs;

    if (filter && filter !== 'all') {
      filteredLogs = this.logs.filter((log) => log.type === filter);
    }

    const total = filteredLogs.length;
    const truncated = total > limit;
    const logs = filteredLogs.slice(-limit);

    return { logs, total, truncated };
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.originalConsole.log('[BackendLogger] Logs cleared');
  }

  /**
   * Get the original console for internal use
   */
  getOriginalConsole() {
    return this.originalConsole;
  }
}

// Singleton instance
export const backendLogger = new BackendLogger();
