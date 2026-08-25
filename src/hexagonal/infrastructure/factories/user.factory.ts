import { UserUseCase } from '@app/hexagonal/application/use-cases/user.use-case'
import { UserPostgresRepository } from '@app/hexagonal/infrastructure/adapters/databases/postgres/repositories/user.postgres.repository'

export const createUserUseCase = (): UserUseCase => new UserUseCase(new UserPostgresRepository())
