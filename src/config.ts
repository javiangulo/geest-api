// Load .env automatically if running with Node without --env-file
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile()
  } catch {
    // Ignore if .env is missing or already provided by environment
  }
}

export type DatabaseProvider = 'postgres' | 'none'

const parseNumber = (val: string | undefined, fallback: number): number => {
  if (!val || val.trim() === '') return fallback
  const num = Number(val)
  return Number.isNaN(num) ? fallback : num
}

const parseBoolean = (val: string | undefined, fallback: boolean): boolean => {
  if (val === undefined || val === '') return fallback
  const normalized = val.toLowerCase().trim()
  return normalized === 'true' || normalized === '1'
}

const parseDbProvider = (val: string | undefined): DatabaseProvider => {
  const normalized = (val || '').toLowerCase().trim()
  return normalized === 'none' ? 'none' : 'postgres'
}

const config = {
  PORT: parseNumber(process.env.PORT, 5500),
  HOSTNAME: process.env.HOSTNAME || 'localhost',
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_PROVIDER: parseDbProvider(process.env.DB_PROVIDER),
  POSTGRES_URL: process.env.POSTGRES_URL || '',
  POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
  POSTGRES_PORT: parseNumber(process.env.POSTGRES_PORT, 5432),
  POSTGRES_USER: process.env.POSTGRES_USER || 'postgres',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || 'postgres',
  POSTGRES_DB: process.env.POSTGRES_DB || 'geest_db',
  POSTGRES_SYNCHRONIZE: parseBoolean(process.env.POSTGRES_SYNCHRONIZE, true),
  POSTGRES_LOGGING: parseBoolean(process.env.POSTGRES_LOGGING, false),
  NOTIFY_URL: process.env.NOTIFY_URL || '',
}

export default config
