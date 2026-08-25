import type {
  CreateUserDTO,
  UserEntity,
  UserTaskDTO,
  UserWithPendingTasksDTO,
} from '@app/hexagonal/domain/entities'

export interface IUserRepository {
  create(user: CreateUserDTO): Promise<UserEntity>
  findById(id: string): Promise<UserEntity | null>
  findByEmail(email: string): Promise<UserEntity | null>
  findByIds(ids: string[]): Promise<UserEntity[]>
  findAllWithPendingTasks(): Promise<UserWithPendingTasksDTO[]>
  findTasksByUserId(userId: string): Promise<UserTaskDTO[]>
}
