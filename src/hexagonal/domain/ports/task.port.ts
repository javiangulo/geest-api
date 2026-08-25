import type {
  CreateTaskDTO,
  TaskAssignmentEntity,
  TaskEntity,
  TaskStatus,
} from '@app/hexagonal/domain/entities'

export interface ITaskRepository {
  create(task: CreateTaskDTO): Promise<TaskEntity>
  findById(id: string): Promise<TaskEntity | null>
  findAll(status?: TaskStatus): Promise<TaskEntity[]>
  assignUsers(taskId: string, userIds: string[]): Promise<void>
  getAssignment(taskId: string, userId: string): Promise<TaskAssignmentEntity | null>
  completeUserAssignment(taskId: string, userId: string): Promise<void>
  areAllAssignmentsCompleted(taskId: string): Promise<boolean>
  updateStatus(taskId: string, status: TaskStatus): Promise<void>
  archiveIfOpen(taskId: string): Promise<boolean>
}
