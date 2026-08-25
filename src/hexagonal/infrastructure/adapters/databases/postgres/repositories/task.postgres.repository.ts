import type {
  CreateTaskDTO,
  TaskAssignmentEntity,
  TaskEntity,
  TaskStatus,
} from '@app/hexagonal/domain/entities'
import type { ITaskRepository } from '@app/hexagonal/domain/ports'
import { TaskAssignmentModel, TaskModel } from '../models'
import { ensurePostgresConnection } from '../postgres.data-source'

export class TaskPostgresRepository implements ITaskRepository {
  private async getRepository() {
    const dataSource = await ensurePostgresConnection()
    return dataSource.getRepository(TaskModel)
  }

  private async getAssignmentRepository() {
    const dataSource = await ensurePostgresConnection()
    return dataSource.getRepository(TaskAssignmentModel)
  }

  private mapTaskWithAssignments(task: TaskModel): TaskEntity {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      assignedUsers: (task.assignments || []).map(a => ({
        id: a.user?.id ?? a.userId,
        name: a.user?.name ?? '',
        lastName: a.user?.lastName ?? '',
        email: a.user?.email ?? '',
        isCompleted: a.isCompleted,
        completedAt: a.completedAt,
      })),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }
  }

  async create(dto: CreateTaskDTO): Promise<TaskEntity> {
    const repo = await this.getRepository()
    const task = repo.create({
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      status: 'open',
    })
    const saved = await repo.save(task)
    return {
      id: saved.id,
      title: saved.title,
      description: saved.description,
      status: saved.status,
      assignedUsers: [],
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    }
  }

  async findById(id: string): Promise<TaskEntity | null> {
    const repo = await this.getRepository()
    const task = await repo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignments', 'assignment')
      .leftJoinAndSelect('assignment.user', 'user')
      .where('task.id = :id', { id })
      .getOne()

    if (!task) return null
    return this.mapTaskWithAssignments(task)
  }

  async findAll(status?: TaskStatus): Promise<TaskEntity[]> {
    const repo = await this.getRepository()
    const query = repo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignments', 'assignment')
      .leftJoinAndSelect('assignment.user', 'user')
      .orderBy('task.createdAt', 'DESC')

    if (status) {
      query.where('task.status = :status', { status })
    }

    const tasks = await query.getMany()
    return tasks.map(t => this.mapTaskWithAssignments(t))
  }

  async assignUsers(taskId: string, userIds: string[]): Promise<void> {
    const assignmentRepo = await this.getAssignmentRepository()
    const existing = await assignmentRepo.find({ where: { taskId } })
    const existingUserIds = new Set(existing.map(e => e.userId))

    const newAssignments = userIds
      .filter(userId => !existingUserIds.has(userId))
      .map(userId =>
        assignmentRepo.create({
          taskId,
          userId,
          isCompleted: false,
          completedAt: null,
        }),
      )

    if (newAssignments.length > 0) {
      await assignmentRepo.save(newAssignments)
    }
  }

  async getAssignment(taskId: string, userId: string): Promise<TaskAssignmentEntity | null> {
    const assignmentRepo = await this.getAssignmentRepository()
    const record = await assignmentRepo.findOneBy({ taskId, userId })
    if (!record) return null
    return {
      id: record.id,
      taskId: record.taskId,
      userId: record.userId,
      isCompleted: record.isCompleted,
      completedAt: record.completedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  async completeUserAssignment(taskId: string, userId: string): Promise<void> {
    const assignmentRepo = await this.getAssignmentRepository()
    await assignmentRepo.update({ taskId, userId }, { isCompleted: true, completedAt: new Date() })
  }

  async areAllAssignmentsCompleted(taskId: string): Promise<boolean> {
    const assignmentRepo = await this.getAssignmentRepository()
    const assignments = await assignmentRepo.find({ where: { taskId } })
    if (assignments.length === 0) return false
    return assignments.every(a => a.isCompleted)
  }

  async updateStatus(taskId: string, status: TaskStatus): Promise<void> {
    const repo = await this.getRepository()
    await repo.update({ id: taskId }, { status })
  }

  async archiveIfOpen(taskId: string): Promise<boolean> {
    const repo = await this.getRepository()
    const result = await repo
      .createQueryBuilder()
      .update(TaskModel)
      .set({ status: 'archived' })
      .where('id = :id AND status = :status', { id: taskId, status: 'open' })
      .execute()

    return (result.affected ?? 0) > 0
  }
}
