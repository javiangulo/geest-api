import type { DatabaseHealthPort } from '@app/hexagonal/domain/ports'
import { isPostgresConnected } from './postgres.data-source'

export class PostgresService implements DatabaseHealthPort {
  provider = 'postgres' as const

  async isConnected(): Promise<boolean> {
    return isPostgresConnected()
  }
}
