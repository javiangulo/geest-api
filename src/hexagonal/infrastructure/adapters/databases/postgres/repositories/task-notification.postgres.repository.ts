import type { TaskNotificationEntity } from '@app/hexagonal/domain/entities'
import type { ITaskNotificationRepository } from '@app/hexagonal/domain/ports'
import { TaskNotificationModel } from '../models'
import { ensurePostgresConnection } from '../postgres.data-source'

export class TaskNotificationPostgresRepository implements ITaskNotificationRepository {
  private async getRepository() {
    const dataSource = await ensurePostgresConnection()
    return dataSource.getRepository(TaskNotificationModel)
  }

  async createAttempt(
    dto: Omit<TaskNotificationEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<TaskNotificationEntity> {
    const repo = await this.getRepository()
    const record = repo.create({
      taskId: dto.taskId,
      status: dto.status,
      attemptNumber: dto.attemptNumber,
      httpStatus: dto.httpStatus ?? null,
      details: dto.details,
    })
    const saved = await repo.save(record)
    return {
      id: saved.id,
      taskId: saved.taskId,
      status: saved.status,
      attemptNumber: saved.attemptNumber,
      httpStatus: saved.httpStatus,
      details: saved.details,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    }
  }

  async findByTaskId(taskId: string): Promise<TaskNotificationEntity[]> {
    const repo = await this.getRepository()
    const records = await repo.find({
      where: { taskId },
      order: { attemptNumber: 'ASC', createdAt: 'ASC' },
    })
    return records.map(r => ({
      id: r.id,
      taskId: r.taskId,
      status: r.status,
      attemptNumber: r.attemptNumber,
      httpStatus: r.httpStatus,
      details: r.details,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  }
}
