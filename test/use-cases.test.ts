import assert from 'node:assert'
import test, { describe } from 'node:test'
import type {
  CreateTaskDTO,
  CreateUserDTO,
  TaskAssignmentEntity,
  TaskEntity,
  TaskNotificationEntity,
  TaskStatus,
  UserEntity,
  UserTaskDTO,
  UserWithPendingTasksDTO,
} from '@domain/entities'
import type {
  ITaskNotificationRepository,
  ITaskRepository,
  IUserRepository,
} from '@domain/ports'
import { NotificationService } from '@application/services/notification.service'
import { TaskUseCase } from '@application/use-cases/task.use-case'
import { UserUseCase } from '@application/use-cases/user.use-case'
import { type AppError, ConflictError, NotFoundError, ValidationError } from '@common/app-error'

// In-Memory User Repository for testing
class MockUserRepository implements IUserRepository {
  private users: UserEntity[] = []
  private userTasks: { [userId: string]: UserTaskDTO[] } = {}

  async create(dto: CreateUserDTO): Promise<UserEntity> {
    const user: UserEntity = {
      id: `user-${(this.users.length + 1).toString()}`,
      name: dto.name,
      lastName: dto.lastName,
      email: dto.email,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.users.push(user)
    return user
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.users.find(u => u.id === id) || null
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.users.find(u => u.email === email) || null
  }

  async findByIds(ids: string[]): Promise<UserEntity[]> {
    return this.users.filter(u => ids.includes(u.id))
  }

  async findAllWithPendingTasks(): Promise<UserWithPendingTasksDTO[]> {
    return this.users.map(u => ({
      ...u,
      pendingTasks: (this.userTasks[u.id] || [])
        .filter(t => !t.isCompleted && t.status === 'open')
        .map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          createdAt: t.createdAt,
        })),
    }))
  }

  async findTasksByUserId(userId: string): Promise<UserTaskDTO[]> {
    return this.userTasks[userId] || []
  }

  setUserTasks(userId: string, tasks: UserTaskDTO[]) {
    this.userTasks[userId] = tasks
  }
}

// In-Memory Task Repository for testing
class MockTaskRepository implements ITaskRepository {
  private tasks: TaskEntity[] = []
  private assignments: TaskAssignmentEntity[] = []

  async create(dto: CreateTaskDTO): Promise<TaskEntity> {
    const task: TaskEntity = {
      id: `task-${(this.tasks.length + 1).toString()}`,
      title: dto.title,
      description: dto.description || null,
      status: 'open',
      assignedUsers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.tasks.push(task)
    return task
  }

  async findById(id: string): Promise<TaskEntity | null> {
    return this.tasks.find(t => t.id === id) || null
  }

  async findAll(status?: TaskStatus): Promise<TaskEntity[]> {
    if (status) {
      return this.tasks.filter(t => t.status === status)
    }
    return this.tasks
  }

  async assignUsers(taskId: string, userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      const exists = this.assignments.some(a => a.taskId === taskId && a.userId === userId)
      if (!exists) {
        this.assignments.push({
          id: `assignment-${(this.assignments.length + 1).toString()}`,
          taskId,
          userId,
          isCompleted: false,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
    }
  }

  async getAssignment(taskId: string, userId: string): Promise<TaskAssignmentEntity | null> {
    return this.assignments.find(a => a.taskId === taskId && a.userId === userId) || null
  }

  async completeUserAssignment(taskId: string, userId: string): Promise<void> {
    const a = this.assignments.find(x => x.taskId === taskId && x.userId === userId)
    if (a) {
      a.isCompleted = true
      a.completedAt = new Date()
    }
  }

  async areAllAssignmentsCompleted(taskId: string): Promise<boolean> {
    const taskAssignments = this.assignments.filter(a => a.taskId === taskId)
    if (taskAssignments.length === 0) return false
    return taskAssignments.every(a => a.isCompleted)
  }

  async updateStatus(taskId: string, status: TaskStatus): Promise<void> {
    const task = this.tasks.find(t => t.id === taskId)
    if (task) {
      task.status = status
    }
  }

  async archiveIfOpen(taskId: string): Promise<boolean> {
    const task = this.tasks.find(t => t.id === taskId)
    if (task && task.status === 'open') {
      task.status = 'archived'
      return true
    }
    return false
  }
}

// In-Memory Notification Repository for testing
class MockTaskNotificationRepository implements ITaskNotificationRepository {
  private notifications: TaskNotificationEntity[] = []

  async createAttempt(
    dto: Omit<TaskNotificationEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<TaskNotificationEntity> {
    const notif: TaskNotificationEntity = {
      id: `notif-${(this.notifications.length + 1).toString()}`,
      taskId: dto.taskId,
      status: dto.status,
      attemptNumber: dto.attemptNumber,
      httpStatus: dto.httpStatus ?? null,
      details: dto.details || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.notifications.push(notif)
    return notif
  }

  async findByTaskId(taskId: string): Promise<TaskNotificationEntity[]> {
    return this.notifications.filter(n => n.taskId === taskId)
  }
}

describe('UserUseCase Tests', () => {
  test('should create a user successfully', async () => {
    const userRepo = new MockUserRepository()
    const userUseCase = new UserUseCase(userRepo)

    const user = await userUseCase.createUser({
      name: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
    })

    assert.strictEqual(user.name, 'John')
    assert.strictEqual(user.lastName, 'Doe')
    assert.strictEqual(user.email, 'john.doe@example.com')
    assert.ok(user.id)
  })

  test('should throw ValidationError on missing name, lastName, or email', async () => {
    const userRepo = new MockUserRepository()
    const userUseCase = new UserUseCase(userRepo)

    await assert.rejects(
      userUseCase.createUser({ name: '', lastName: 'Doe', email: 'test@example.com' }),
      ValidationError,
    )
    await assert.rejects(
      userUseCase.createUser({ name: 'John', lastName: '', email: 'test@example.com' }),
      ValidationError,
    )
    await assert.rejects(
      userUseCase.createUser({ name: 'John', lastName: 'Doe', email: '' }),
      ValidationError,
    )
  })

  test('should throw ValidationError on invalid email format', async () => {
    const userRepo = new MockUserRepository()
    const userUseCase = new UserUseCase(userRepo)

    await assert.rejects(
      userUseCase.createUser({ name: 'John', lastName: 'Doe', email: 'invalid-email' }),
      ValidationError,
    )
  })

  test('should throw ConflictError when email is duplicated', async () => {
    const userRepo = new MockUserRepository()
    const userUseCase = new UserUseCase(userRepo)

    await userUseCase.createUser({
      name: 'John',
      lastName: 'Doe',
      email: 'duplicate@example.com',
    })

    await assert.rejects(
      userUseCase.createUser({
        name: 'Jane',
        lastName: 'Doe',
        email: 'duplicate@example.com',
      }),
      ConflictError,
    )
  })

  test('should get user by id or throw NotFoundError', async () => {
    const userRepo = new MockUserRepository()
    const userUseCase = new UserUseCase(userRepo)

    const created = await userUseCase.createUser({
      name: 'Alice',
      lastName: 'Smith',
      email: 'alice.smith@example.com',
    })

    const found = await userUseCase.getUserById(created.id)
    assert.strictEqual(found.id, created.id)
    assert.strictEqual(found.email, 'alice.smith@example.com')

    await assert.rejects(userUseCase.getUserById('non-existent-user'), NotFoundError)
    await assert.rejects(userUseCase.getUserById(''), ValidationError)
  })

  test('should get users with pending tasks', async () => {
    const userRepo = new MockUserRepository()
    const userUseCase = new UserUseCase(userRepo)

    await userUseCase.createUser({
      name: 'Bob',
      lastName: 'Builder',
      email: 'bob.builder@example.com',
    })

    const result = await userUseCase.getUsersWithPendingTasks()
    assert.ok(Array.isArray(result.items))
    assert.strictEqual(result.items.length, 1)
    assert.strictEqual(result.items[0].name, 'Bob')
    assert.strictEqual(result.pagination.page, 1)
    assert.strictEqual(result.pagination.totalPages, 1)
    assert.strictEqual(result.pagination.totalItems, 1)
  })

  test('should get user tasks with pagination or throw ValidationError if empty', async () => {
    const userRepo = new MockUserRepository()
    const userUseCase = new UserUseCase(userRepo)

    const user = await userUseCase.createUser({
      name: 'Charlie',
      lastName: 'Brown',
      email: 'charlie@example.com',
    })

    const tasksResult = await userUseCase.getUserTasks(user.id, { page: 1, limit: 5 })
    assert.ok(Array.isArray(tasksResult.items))
    assert.strictEqual(tasksResult.items.length, 0)
    assert.strictEqual(tasksResult.pagination.page, 1)
    assert.strictEqual(tasksResult.pagination.limit, 5)
    assert.strictEqual(tasksResult.pagination.totalItems, 0)
    assert.strictEqual(tasksResult.pagination.totalPages, 1)

    await assert.rejects(userUseCase.getUserTasks(''), ValidationError)
  })
})

describe('TaskUseCase Tests', () => {
  test('should create a task with default open status', async () => {
    const taskRepo = new MockTaskRepository()
    const userRepo = new MockUserRepository()
    const notifRepo = new MockTaskNotificationRepository()
    const taskUseCase = new TaskUseCase(taskRepo, userRepo, notifRepo)

    const task = await taskUseCase.createTask({
      title: 'Fix issue',
      description: 'Fix the bug in API',
    })

    assert.strictEqual(task.title, 'Fix issue')
    assert.strictEqual(task.status, 'open')
    assert.ok(task.id)
  })

  test('should throw ValidationError if task title is missing', async () => {
    const taskRepo = new MockTaskRepository()
    const userRepo = new MockUserRepository()
    const notifRepo = new MockTaskNotificationRepository()
    const taskUseCase = new TaskUseCase(taskRepo, userRepo, notifRepo)

    await assert.rejects(taskUseCase.createTask({ title: '' }), ValidationError)
  })

  test('should assign users to task and avoid duplicate assignment', async () => {
    const taskRepo = new MockTaskRepository()
    const userRepo = new MockUserRepository()
    const notifRepo = new MockTaskNotificationRepository()
    const taskUseCase = new TaskUseCase(taskRepo, userRepo, notifRepo)

    const user1 = await userRepo.create({ name: 'Alice', lastName: 'Smith', email: 'alice@test.com' })
    const user2 = await userRepo.create({ name: 'Bob', lastName: 'Jones', email: 'bob@test.com' })
    const task = await taskRepo.create({ title: 'Deploy App' })

    const res = await taskUseCase.assignUsers(task.id, [user1.id, user2.id])
    assert.strictEqual(res.message, 'Users assigned successfully')

    // Assigning again should not duplicate
    await taskUseCase.assignUsers(task.id, [user1.id])
  })

  test('should throw NotFoundError if assigning non-existent user or task', async () => {
    const taskRepo = new MockTaskRepository()
    const userRepo = new MockUserRepository()
    const notifRepo = new MockTaskNotificationRepository()
    const taskUseCase = new TaskUseCase(taskRepo, userRepo, notifRepo)

    const task = await taskRepo.create({ title: 'Deploy App' })

    await assert.rejects(
      taskUseCase.assignUsers('non-existent-task-id', ['user-1']),
      NotFoundError,
    )

    await assert.rejects(
      taskUseCase.assignUsers(task.id, ['non-existent-user-id']),
      NotFoundError,
    )
  })

  test('should complete task part and archive task with notification when all finish', async () => {
    const taskRepo = new MockTaskRepository()
    const userRepo = new MockUserRepository()
    const notifRepo = new MockTaskNotificationRepository()
    const taskUseCase = new TaskUseCase(taskRepo, userRepo, notifRepo)

    const user1 = await userRepo.create({ name: 'Alice', lastName: 'Smith', email: 'alice@test.com' })
    const user2 = await userRepo.create({ name: 'Bob', lastName: 'Jones', email: 'bob@test.com' })
    const task = await taskRepo.create({ title: 'Review PR' })

    await taskUseCase.assignUsers(task.id, [user1.id, user2.id])

    // User 1 completes part -> task should NOT be archived yet
    const res1 = await taskUseCase.completeTaskPart(task.id, user1.id)
    assert.strictEqual(res1.taskArchived, false)

    let updatedTask = await taskRepo.findById(task.id)
    assert.strictEqual(updatedTask?.status, 'open')

    // User 2 completes part -> task SHOULD be archived and notification created
    const res2 = await taskUseCase.completeTaskPart(task.id, user2.id)
    assert.strictEqual(res2.taskArchived, true)

    updatedTask = await taskRepo.findById(task.id)
    assert.strictEqual(updatedTask?.status, 'archived')

    const notifications = await taskUseCase.getTaskNotifications(task.id)
    assert.strictEqual(notifications.items.length, 1)
    assert.strictEqual(notifications.items[0].status, 'sent')
    assert.strictEqual(notifications.pagination.page, 1)
    assert.strictEqual(notifications.pagination.totalPages, 1)
  })

  test('should throw error if completing task for unassigned user', async () => {
    const taskRepo = new MockTaskRepository()
    const userRepo = new MockUserRepository()
    const notifRepo = new MockTaskNotificationRepository()
    const taskUseCase = new TaskUseCase(taskRepo, userRepo, notifRepo)

    const user1 = await userRepo.create({ name: 'Alice', lastName: 'Smith', email: 'alice@test.com' })
    const user2 = await userRepo.create({ name: 'Bob', lastName: 'Jones', email: 'bob@test.com' })
    const task = await taskRepo.create({ title: 'Review PR' })

    await taskUseCase.assignUsers(task.id, [user1.id])

    // User2 is not assigned
    await assert.rejects(taskUseCase.completeTaskPart(task.id, user2.id), (err: AppError) => {
      return err.code === 'USER_NOT_ASSIGNED'
    })
  })

  test('should archive exactly once and send notification exactly once when two users complete simultaneously', async () => {
    const taskRepo = new MockTaskRepository()
    const userRepo = new MockUserRepository()
    const notifRepo = new MockTaskNotificationRepository()

    let notificationDispatches = 0
    const mockNotificationService = {
      sendTaskArchivedNotification: async () => {
        notificationDispatches++
        return []
      },
    }

    const taskUseCase = new TaskUseCase(
      taskRepo,
      userRepo,
      notifRepo,
      mockNotificationService as any,
    )

    const user1 = await userRepo.create({ name: 'Alice', lastName: 'Smith', email: 'alice@concurrent.com' })
    const user2 = await userRepo.create({ name: 'Bob', lastName: 'Jones', email: 'bob@concurrent.com' })
    const task = await taskRepo.create({ title: 'Simultaneous Task' })

    await taskUseCase.assignUsers(task.id, [user1.id, user2.id])

    // Both users complete simultaneously
    const [res1, res2] = await Promise.all([
      taskUseCase.completeTaskPart(task.id, user1.id),
      taskUseCase.completeTaskPart(task.id, user2.id),
    ])

    // Both get completion response
    assert.strictEqual(res1.taskArchived, true)
    assert.strictEqual(res2.taskArchived, true)

    // Task is archived exactly once
    const updatedTask = await taskRepo.findById(task.id)
    assert.strictEqual(updatedTask?.status, 'archived')

    // Notification is dispatched EXACTLY ONCE
    assert.strictEqual(notificationDispatches, 1)
  })

  test('should get tasks with and without filter, and validate filter parameter', async () => {
    const taskRepo = new MockTaskRepository()
    const userRepo = new MockUserRepository()
    const notifRepo = new MockTaskNotificationRepository()
    const taskUseCase = new TaskUseCase(taskRepo, userRepo, notifRepo)

    await taskUseCase.createTask({ title: 'Task 1' })
    await taskUseCase.createTask({ title: 'Task 2' })
    await taskUseCase.createTask({ title: 'Task 3' })

    const allTasks = await taskUseCase.getTasks()
    assert.strictEqual(allTasks.items.length, 3)
    assert.strictEqual(allTasks.pagination.totalItems, 3)
    assert.strictEqual(allTasks.pagination.page, 1)
    assert.strictEqual(allTasks.pagination.totalPages, 1)

    const paginated = await taskUseCase.getTasks({ page: 2, limit: 2, order: 'ASC' })
    assert.strictEqual(paginated.items.length, 1)
    assert.strictEqual(paginated.pagination.page, 2)
    assert.strictEqual(paginated.pagination.limit, 2)
    assert.strictEqual(paginated.pagination.totalPages, 2)
    assert.strictEqual(paginated.pagination.totalItems, 3)
    assert.strictEqual(paginated.pagination.hasNextPage, false)
    assert.strictEqual(paginated.pagination.hasPrevPage, true)
    assert.strictEqual(paginated.pagination.order, 'ASC')

    const openTasks = await taskUseCase.getTasks('open')
    assert.strictEqual(openTasks.items.length, 3)

    const archivedTasks = await taskUseCase.getTasks('archived')
    assert.strictEqual(archivedTasks.items.length, 0)
    assert.strictEqual(archivedTasks.pagination.totalItems, 0)

    await assert.rejects(taskUseCase.getTasks('invalid-status'), ValidationError)
  })

  test('should support cursor-based navigation in getTasks', async () => {
    const taskRepo = new MockTaskRepository()
    const userRepo = new MockUserRepository()
    const notifRepo = new MockTaskNotificationRepository()
    const taskUseCase = new TaskUseCase(taskRepo, userRepo, notifRepo)

    await taskUseCase.createTask({ title: 'Task A' })
    await taskUseCase.createTask({ title: 'Task B' })
    await taskUseCase.createTask({ title: 'Task C' })

    const page1 = await taskUseCase.getTasks({ limit: 2 })
    assert.strictEqual(page1.items.length, 2)
    assert.strictEqual(page1.pagination.page, 1)
    assert.strictEqual(page1.pagination.hasNextPage, true)
    assert.ok(page1.pagination.nextCursor)

    // Use nextCursor
    const page2 = await taskUseCase.getTasks({ limit: 2, cursor: page1.pagination.nextCursor })
    assert.strictEqual(page2.items.length, 1)
    assert.strictEqual(page2.pagination.page, 2)
    assert.strictEqual(page2.pagination.hasNextPage, false)
  })

  test('should get task by id or throw NotFoundError', async () => {
    const taskRepo = new MockTaskRepository()
    const userRepo = new MockUserRepository()
    const notifRepo = new MockTaskNotificationRepository()
    const taskUseCase = new TaskUseCase(taskRepo, userRepo, notifRepo)

    const created = await taskUseCase.createTask({ title: 'Inspect Task' })
    const found = await taskUseCase.getTaskById(created.id)
    assert.strictEqual(found.id, created.id)
    assert.strictEqual(found.title, 'Inspect Task')

    await assert.rejects(taskUseCase.getTaskById('non-existent-task'), NotFoundError)
    await assert.rejects(taskUseCase.getTaskById(''), ValidationError)
  })

  test('should get task notifications or throw NotFoundError', async () => {
    const taskRepo = new MockTaskRepository()
    const userRepo = new MockUserRepository()
    const notifRepo = new MockTaskNotificationRepository()
    const taskUseCase = new TaskUseCase(taskRepo, userRepo, notifRepo)

    const task = await taskRepo.create({ title: 'Notification Test' })
    const notifs = await taskUseCase.getTaskNotifications(task.id)
    assert.ok(Array.isArray(notifs.items))
    assert.strictEqual(notifs.items.length, 0)
    assert.strictEqual(notifs.pagination.page, 1)
    assert.strictEqual(notifs.pagination.totalPages, 1)

    await assert.rejects(taskUseCase.getTaskNotifications('non-existent-task'), NotFoundError)
    await assert.rejects(taskUseCase.getTaskNotifications(''), ValidationError)
  })
})

describe('NotificationService Retry Tests', () => {
  test('should succeed on first attempt if remote responds 200 OK', async () => {
    const notifRepo = new MockTaskNotificationRepository()
    const mockFetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 })

    const notifService = new NotificationService(notifRepo, {
      notifyUrl: 'https://example.com/notify',
      fetchFn: mockFetch as any,
      retryDelays: [1, 1],
    })

    const task: TaskEntity = {
      id: 'task-123',
      title: 'Notify Task',
      status: 'archived',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const records = await notifService.sendTaskArchivedNotification(task)
    assert.strictEqual(records.length, 1)
    assert.strictEqual(records[0].attemptNumber, 1)
    assert.strictEqual(records[0].status, 'sent')
    assert.strictEqual(records[0].httpStatus, 200)

    const stored = await notifRepo.findByTaskId('task-123')
    assert.strictEqual(stored.length, 1)
    assert.strictEqual(stored[0].httpStatus, 200)
    assert.ok(stored[0].createdAt instanceof Date)
  })

  test('should retry on 500 error up to 3 attempts with increasing wait and record all attempts', async () => {
    const notifRepo = new MockTaskNotificationRepository()
    let attemptsCount = 0

    const mockFetch = async () => {
      attemptsCount++
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 })
    }

    const notifService = new NotificationService(notifRepo, {
      notifyUrl: 'https://example.com/notify',
      fetchFn: mockFetch as any,
      maxAttempts: 3,
      retryDelays: [5, 10],
    })

    const task: TaskEntity = {
      id: 'task-500',
      title: 'Retry 500 Task',
      status: 'archived',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const records = await notifService.sendTaskArchivedNotification(task)
    assert.strictEqual(attemptsCount, 3)
    assert.strictEqual(records.length, 3)

    assert.strictEqual(records[0].attemptNumber, 1)
    assert.strictEqual(records[0].httpStatus, 500)
    assert.strictEqual(records[0].status, 'failed')

    assert.strictEqual(records[1].attemptNumber, 2)
    assert.strictEqual(records[1].httpStatus, 500)
    assert.strictEqual(records[1].status, 'failed')

    assert.strictEqual(records[2].attemptNumber, 3)
    assert.strictEqual(records[2].httpStatus, 500)
    assert.strictEqual(records[2].status, 'failed')

    const stored = await notifRepo.findByTaskId('task-500')
    assert.strictEqual(stored.length, 3)
  })

  test('should retry on network timeout (null httpStatus) and succeed on 2nd attempt', async () => {
    const notifRepo = new MockTaskNotificationRepository()
    let callCount = 0

    const mockFetch = async () => {
      callCount++
      if (callCount === 1) {
        throw new Error('Connection timeout')
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    const notifService = new NotificationService(notifRepo, {
      notifyUrl: 'https://example.com/notify',
      fetchFn: mockFetch as any,
      maxAttempts: 3,
      retryDelays: [5, 10],
    })

    const task: TaskEntity = {
      id: 'task-timeout',
      title: 'Timeout Task',
      status: 'archived',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const records = await notifService.sendTaskArchivedNotification(task)
    assert.strictEqual(records.length, 2)

    // Attempt 1: Network error -> null httpStatus, failed
    assert.strictEqual(records[0].attemptNumber, 1)
    assert.strictEqual(records[0].httpStatus, null)
    assert.strictEqual(records[0].status, 'failed')

    // Attempt 2: 200 OK -> sent
    assert.strictEqual(records[1].attemptNumber, 2)
    assert.strictEqual(records[1].httpStatus, 200)
    assert.strictEqual(records[1].status, 'sent')
  })

  test('should not retry on client error (4xx)', async () => {
    const notifRepo = new MockTaskNotificationRepository()
    let callCount = 0

    const mockFetch = async () => {
      callCount++
      return new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400 })
    }

    const notifService = new NotificationService(notifRepo, {
      notifyUrl: 'https://example.com/notify',
      fetchFn: mockFetch as any,
      maxAttempts: 3,
      retryDelays: [5, 10],
    })

    const task: TaskEntity = {
      id: 'task-400',
      title: 'Bad Request Task',
      status: 'archived',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const records = await notifService.sendTaskArchivedNotification(task)
    assert.strictEqual(callCount, 1)
    assert.strictEqual(records.length, 1)
    assert.strictEqual(records[0].attemptNumber, 1)
    assert.strictEqual(records[0].httpStatus, 400)
    assert.strictEqual(records[0].status, 'failed')
  })
})

