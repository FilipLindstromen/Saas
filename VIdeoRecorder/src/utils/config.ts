/**
 * Application configuration
 * Centralized configuration management for production and development
 */

export interface AppConfig {
  isProduction: boolean
  version: string
  buildTime: string
  enableDevTools: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  maxErrorLogs: number
  api: {
    openai?: {
      baseUrl: string
    }
  }
}

/**
 * Get application configuration
 */
export function getConfig(): AppConfig {
  const isProduction = 
    typeof __IS_PRODUCTION__ !== 'undefined' ? __IS_PRODUCTION__ :
    typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1'

  return {
    isProduction,
    version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0',
    buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString(),
    enableDevTools: !isProduction,
    logLevel: isProduction ? 'warn' : 'debug',
    maxErrorLogs: 10,
    api: {
      openai: {
        baseUrl: 'https://api.openai.com/v1',
      },
    },
  }
}

export const config = getConfig()

