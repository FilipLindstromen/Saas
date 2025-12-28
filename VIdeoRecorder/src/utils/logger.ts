/**
 * Production-ready logging utility
 * Automatically removes console logs in production builds
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  data?: any
  timestamp: string
}

class Logger {
  private isProduction: boolean
  private logHistory: LogEntry[] = []
  private maxHistorySize = 100

  constructor() {
    // Check if we're in production
    this.isProduction = 
      typeof window !== 'undefined' && 
      (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') ||
      (typeof __IS_PRODUCTION__ !== 'undefined' && __IS_PRODUCTION__)
  }

  private addToHistory(level: LogLevel, message: string, data?: any) {
    if (this.logHistory.length >= this.maxHistorySize) {
      this.logHistory.shift()
    }
    this.logHistory.push({
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    })
  }

  debug(message: string, ...args: any[]) {
    this.addToHistory('debug', message, args)
    if (!this.isProduction) {
      console.debug(`[DEBUG] ${message}`, ...args)
    }
  }

  info(message: string, ...args: any[]) {
    this.addToHistory('info', message, args)
    if (!this.isProduction) {
      console.info(`[INFO] ${message}`, ...args)
    }
  }

  warn(message: string, ...args: any[]) {
    this.addToHistory('warn', message, args)
    // Always show warnings, even in production
    console.warn(`[WARN] ${message}`, ...args)
  }

  error(message: string, error?: Error | any, ...args: any[]) {
    this.addToHistory('error', message, { error, args })
    // Always show errors, even in production
    console.error(`[ERROR] ${message}`, error, ...args)
    
    // In production, you might want to send errors to a logging service
    if (this.isProduction && error) {
      this.reportError(message, error)
    }
  }

  private reportError(message: string, error: Error | any) {
    // TODO: Integrate with error reporting service (e.g., Sentry, LogRocket)
    // For now, we'll just store it in localStorage as a fallback
    try {
      const errorLog = {
        message,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : error,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }
      
      const existingLogs = JSON.parse(localStorage.getItem('error_logs') || '[]')
      existingLogs.push(errorLog)
      // Keep only last 10 errors
      if (existingLogs.length > 10) {
        existingLogs.shift()
      }
      localStorage.setItem('error_logs', JSON.stringify(existingLogs))
    } catch (e) {
      // Silently fail if localStorage is not available
    }
  }

  getHistory(): LogEntry[] {
    return [...this.logHistory]
  }

  clearHistory() {
    this.logHistory = []
  }
}

// Export singleton instance
export const logger = new Logger()

// Export convenience functions
export const log = {
  debug: (message: string, ...args: any[]) => logger.debug(message, ...args),
  info: (message: string, ...args: any[]) => logger.info(message, ...args),
  warn: (message: string, ...args: any[]) => logger.warn(message, ...args),
  error: (message: string, error?: Error | any, ...args: any[]) => logger.error(message, error, ...args),
}

