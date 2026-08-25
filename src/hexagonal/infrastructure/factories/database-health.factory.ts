import config from '@app/config'
import type { DatabaseHealthPort } from '@app/hexagonal/domain/ports'
import { PostgresController } from '@app/hexagonal/infrastructure/adapters/databases/postgres/postgres.controller'

export const DatabaseHealthFactory = {
  create(): DatabaseHealthPort {
    if (config.DB_PROVIDER === 'postgres') {
      return new PostgresController().getHealthPort()
    }

    return {
      provider: 'none',
      isConnected: async () => true,
    }
  },
}
