import type {
  CreateUserDTO,
  UserEntity,
  UserTaskDTO,
  UserWithPendingTasksDTO,
} from '@app/hexagonal/domain/entities'
import type { IUserRepository } from '@app/hexagonal/domain/ports'
import { In } from 'typeorm'
import { TaskAssignmentModel, UserModel } from '../models'
import { ensurePostgresConnection } from '../postgres.data-source'

export class UserPostgresRepository implements IUserRepository {
  private async getRepository() {
    const dataSource = await ensurePostgresConnection()
    return dataSource.getRepository(UserModel)
  }

  private async getAssignmentRepository() {
    const dataSource = await ensurePostgresConnection()
    return dataSource.getRepository(TaskAssignmentModel)
  }

  async create(dto: CreateUserDTO): Promise<UserEntity> {
    const repo = await this.getRepository()
    const user = repo.create({
      name: dto.name,
      lastName: dto.lastName,
      email: dto.email.toLowerCase().trim(),
    })
    const saved = await repo.save(user)
    return {
      id: saved.id,
      name: saved.name,
      lastName: saved.lastName,
      email: saved.email,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    }
  }

  async findById(id: string): Promise<UserEntity | null> {
    const repo = await this.getRepository()
    const user = await repo.findOneBy({ id })
    if (!user) return null
    return {
      id: user.id,
      name: user.name,
      lastName: user.lastName,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const repo = await this.getRepository()
    const user = await repo.findOneBy({ email: email.toLowerCase().trim() })
    if (!user) return null
    return {
      id: user.id,
      name: user.name,
      lastName: user.lastName,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }

  async findByIds(ids: string[]): Promise<UserEntity[]> {
    if (!ids || ids.length === 0) return []
    const repo = await this.getRepository()
    const users = await repo.findBy({ id: In(ids) })
    return users.map(u => ({
      id: u.id,
      name: u.name,
      lastName: u.lastName,
      email: u.email,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }))
  }

  async findAllWithPendingTasks(): Promise<UserWithPendingTasksDTO[]> {
    const repo = await this.getRepository()
    const users = await repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.assignments', 'assignment')
      .leftJoinAndSelect('assignment.task', 'task')
      .orderBy('user.createdAt', 'DESC')
      .getMany()

    return users.map(user => {
      const pendingAssignments = (user.assignments || []).filter(
        a => !a.isCompleted && a.task && a.task.status === 'open',
      )

      return {
        id: user.id,
        name: user.name,
        lastName: user.lastName,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        pendingTasks: pendingAssignments.map(a => ({
          id: a.task.id,
          title: a.task.title,
          description: a.task.description,
          status: a.task.status,
          createdAt: a.task.createdAt,
        })),
      }
    })
  }

  async findTasksByUserId(userId: string): Promise<UserTaskDTO[]> {
    const assignmentRepo = await this.getAssignmentRepository()
    const assignments = await assignmentRepo
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.task', 'task')
      .where('assignment.userId = :userId', { userId })
      .orderBy('task.createdAt', 'DESC')
      .getMany()

    return assignments.map(a => ({
      id: a.task.id,
      title: a.task.title,
      description: a.task.description,
      status: a.task.status,
      isCompleted: a.isCompleted,
      completedAt: a.completedAt,
      createdAt: a.task.createdAt,
      updatedAt: a.task.updatedAt,
    }))
  }
}
