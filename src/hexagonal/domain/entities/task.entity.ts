export type TaskStatus = 'open' | 'archived'

export interface TaskAssignedUserDTO {
  id: string
  name: string
  lastName: string
  email: string
  isCompleted: boolean
  completedAt?: Date | null
}

export interface TaskEntity {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  assignedUsers?: TaskAssignedUserDTO[]
  createdAt: Date
  updatedAt: Date
}

export interface CreateTaskDTO {
  title: string
  description?: string | null
}

export interface AssignUsersDTO {
  userIds: string[]
}

export interface CompleteTaskPartDTO {
  userId: string
}
