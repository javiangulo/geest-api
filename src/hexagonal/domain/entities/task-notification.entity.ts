export type NotificationStatus = 'sent' | 'failed' | 'pending'

export interface TaskNotificationEntity {
  id: string
  taskId: string
  status: NotificationStatus
  attemptNumber: number
  httpStatus?: number | null
  details?: string | null
  createdAt: Date
  updatedAt: Date
}
