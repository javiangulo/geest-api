export interface TaskAssignmentEntity {
  id: string
  taskId: string
  userId: string
  isCompleted: boolean
  completedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}
