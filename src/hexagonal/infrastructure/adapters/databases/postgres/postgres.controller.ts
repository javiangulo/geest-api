import type { DatabaseHealthPort } from '@app/hexagonal/domain/ports'
import { PostgresService } from './postgres.service'

export class PostgresController {
  private readonly healthService = new PostgresService()

  getHealthPort(): DatabaseHealthPort {
    return this.healthService
  }
}
