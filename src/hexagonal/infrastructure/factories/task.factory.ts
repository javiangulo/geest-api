import { TaskUseCase } from '@app/hexagonal/application/use-cases/task.use-case'
import { TaskPostgresRepository } from '@app/hexagonal/infrastructure/adapters/databases/postgres/repositories/task.postgres.repository'
import { TaskNotificationPostgresRepository } from '@app/hexagonal/infrastructure/adapters/databases/postgres/repositories/task-notification.postgres.repository'
import { UserPostgresRepository } from '@app/hexagonal/infrastructure/adapters/databases/postgres/repositories/user.postgres.repository'

export const createTaskUseCase = (): TaskUseCase =>
  new TaskUseCase(
    new TaskPostgresRepository(),
    new UserPostgresRepository(),
    new TaskNotificationPostgresRepository(),
  )
