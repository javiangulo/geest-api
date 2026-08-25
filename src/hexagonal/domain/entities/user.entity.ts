export interface UserEntity {
  id: string
  name: string
  lastName: string
  email: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateUserDTO {
  name: string
  lastName: string
  email: string
}

export interface UserWithPendingTasksDTO extends UserEntity {
  pendingTasks: {
    id: string
    title: string
    description?: string | null
    status: string
    createdAt: Date
  }[]
}

export interface UserTaskDTO {
  id: string
  title: string
  description?: string | null
  status: string
  isCompleted: boolean
  completedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}
