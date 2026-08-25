import type { TaskNotificationEntity } from '@app/hexagonal/domain/entities'

export interface ITaskNotificationRepository {
  createAttempt(
    notification: Omit<TaskNotificationEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<TaskNotificationEntity>
  findByTaskId(taskId: string): Promise<TaskNotificationEntity[]>
}
