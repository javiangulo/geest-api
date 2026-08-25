import { AppError, NotFoundError, ValidationError } from '@app/common/app-error'
import {
  type PaginatedResult,
  type PaginationQueryParams,
  paginateArray,
  parsePaginationParams,
} from '@app/common/pagination'
import {
  type INotificationService,
  NotificationService,
} from '@app/hexagonal/application/services/notification.service'
import type {
  CreateTaskDTO,
  TaskEntity,
  TaskNotificationEntity,
  TaskStatus,
} from '@app/hexagonal/domain/entities'
import type {
  ITaskNotificationRepository,
  ITaskRepository,
  IUserRepository,
} from '@app/hexagonal/domain/ports'

export interface GetTasksOptions extends PaginationQueryParams {
  status?: string
}

export class TaskUseCase {
  private readonly notificationService: INotificationService

  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly userRepository: IUserRepository,
    private readonly notificationRepository: ITaskNotificationRepository,
    notificationService?: INotificationService,
  ) {
    this.notificationService =
      notificationService ?? new NotificationService(notificationRepository)
  }

  async createTask(dto: CreateTaskDTO): Promise<TaskEntity> {
    if (!dto.title || dto.title.trim() === '') {
      throw new ValidationError('Title is required')
    }

    return this.taskRepository.create({
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
    })
  }

  async getTasks(options?: string | GetTasksOptions): Promise<PaginatedResult<TaskEntity>> {
    let statusFilter: string | undefined
    let queryParams: PaginationQueryParams = {}

    if (typeof options === 'string') {
      statusFilter = options
    } else if (options && typeof options === 'object') {
      statusFilter = options.status
      queryParams = options
    }

    let taskStatus: TaskStatus | undefined

    if (statusFilter) {
      const normalized = statusFilter.toLowerCase().trim()
      if (normalized !== 'open' && normalized !== 'archived') {
        throw new ValidationError("Invalid status filter. Must be 'open' or 'archived'")
      }
      taskStatus = normalized as TaskStatus
    }

    const pagination = parsePaginationParams(queryParams)
    const allTasks = await this.taskRepository.findAll(taskStatus)

    return paginateArray(allTasks, pagination)
  }

  async getTaskById(taskId: string): Promise<TaskEntity> {
    if (!taskId || taskId.trim() === '') {
      throw new ValidationError('Task ID is required')
    }

    const task = await this.taskRepository.findById(taskId)
    if (!task) {
      throw new NotFoundError('TASK_NOT_FOUND', 'Task not found')
    }

    return task
  }

  async assignUsers(taskId: string, userIds: string[]): Promise<{ message: string }> {
    if (!taskId || taskId.trim() === '') {
      throw new ValidationError('Task ID is required')
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new ValidationError('userIds must be a non-empty array of user IDs')
    }

    const task = await this.taskRepository.findById(taskId)
    if (!task) {
      throw new NotFoundError('TASK_NOT_FOUND', 'Task not found')
    }

    // Validate that all users exist
    const uniqueUserIds = Array.from(new Set(userIds.map(id => String(id).trim())))
    const existingUsers = await this.userRepository.findByIds(uniqueUserIds)

    if (existingUsers.length !== uniqueUserIds.length) {
      const foundIds = new Set(existingUsers.map(u => u.id))
      const missingIds = uniqueUserIds.filter(id => !foundIds.has(id))
      throw new NotFoundError(
        'USER_NOT_FOUND',
        `One or more users not found: ${missingIds.join(', ')}`,
      )
    }

    await this.taskRepository.assignUsers(taskId, uniqueUserIds)

    return { message: 'Users assigned successfully' }
  }

  async completeTaskPart(
    taskId: string,
    userId: string,
  ): Promise<{ message: string; taskArchived: boolean }> {
    if (!taskId || taskId.trim() === '') {
      throw new ValidationError('Task ID is required')
    }

    if (!userId || String(userId).trim() === '') {
      throw new ValidationError('userId is required')
    }

    const normalizedUserId = String(userId).trim()

    const task = await this.taskRepository.findById(taskId)
    if (!task) {
      throw new NotFoundError('TASK_NOT_FOUND', 'Task not found')
    }

    const user = await this.userRepository.findById(normalizedUserId)
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'User not found')
    }

    const assignment = await this.taskRepository.getAssignment(taskId, normalizedUserId)
    if (!assignment) {
      throw new AppError('USER_NOT_ASSIGNED', 'User is not assigned to this task', 400)
    }

    // Mark assignment completed
    await this.taskRepository.completeUserAssignment(taskId, normalizedUserId)

    // Check if all assigned users have completed their part
    const allCompleted = await this.taskRepository.areAllAssignmentsCompleted(taskId)

    if (allCompleted) {
      // Deduplicated atomic archive transition
      const wasArchived = await this.taskRepository.archiveIfOpen(taskId)

      if (wasArchived) {
        const currentTask = await this.taskRepository.findById(taskId)
        if (currentTask) {
          await this.notificationService.sendTaskArchivedNotification(currentTask)
        }
      }

      return {
        message: 'Task part marked as completed and task archived',
        taskArchived: true,
      }
    }

    return {
      message: 'Task part marked as completed successfully',
      taskArchived: false,
    }
  }

  async getTaskNotifications(
    taskId: string,
    options?: PaginationQueryParams,
  ): Promise<PaginatedResult<TaskNotificationEntity>> {
    if (!taskId || taskId.trim() === '') {
      throw new ValidationError('Task ID is required')
    }

    const task = await this.taskRepository.findById(taskId)
    if (!task) {
      throw new NotFoundError('TASK_NOT_FOUND', 'Task not found')
    }

    const pagination = parsePaginationParams(options)
    const notifications = await this.notificationRepository.findByTaskId(taskId)

    return paginateArray(notifications, pagination)
  }
}
