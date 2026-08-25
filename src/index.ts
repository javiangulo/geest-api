import 'reflect-metadata'
import config, { type DatabaseProvider } from '@app/config'
import { DatabaseHealthFactory } from '@app/hexagonal/infrastructure/factories/database-health.factory'
import app from '@app/server'

const getDatabaseName = (provider: DatabaseProvider): string => {
  if (provider === 'none') {
    return 'disabled'
  }

  if (config.POSTGRES_URL) {
    try {
      const parsedUrl = new URL(config.POSTGRES_URL)
      const path = parsedUrl.pathname.replace(/^\//, '')
      return path.split('?')[0] || config.POSTGRES_DB
    } catch {
      return config.POSTGRES_DB
    }
  }

  return config.POSTGRES_DB
}

const logDatabaseConnectionStatus = async (): Promise<void> => {
  const provider = config.DB_PROVIDER
  if (provider === 'none') {
    console.info('ℹ️ Database connection is disabled (DB_PROVIDER=none)')
    return
  }

  const databaseHealth = DatabaseHealthFactory.create()
  const databaseName = getDatabaseName(provider)
  const providerLabel = provider.toUpperCase()

  const connected = await databaseHealth.isConnected()

  if (connected) {
    console.info(`✅ ${providerLabel} [${databaseName}] connected successfully`)
    return
  }

  console.warn(`⚠️ ${providerLabel} [${databaseName}] connection failed or pending`)
}

async function main(): Promise<void> {
  try {
    await logDatabaseConnectionStatus()

    const server = app.listen(config.PORT, () => {
      console.log(`🚀 Server ready on port ${config.PORT} (env: ${config.NODE_ENV})`)
    })

    // Graceful shutdown handling for Cloud Run & container orchestration
    const shutdown = (signal: string) => {
      console.info(`\n🛑 Received ${signal}. Starting graceful shutdown...`)
      server.close(() => {
        console.info('HTTP server closed successfully.')
        process.exit(0)
      })

      // Force shutdown if connections do not close in 10 seconds
      setTimeout(() => {
        console.error('⚠️ Could not close connections in time, forcefully shutting down.')
        process.exit(1)
      }, 10000).unref()
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  } catch (error) {
    console.error('Fatal error starting server:', error)
    process.exitCode = 1
    throw error
  }
}

void main()
