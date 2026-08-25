import config from '@app/config'
import type { TaskEntity, TaskNotificationEntity } from '@app/hexagonal/domain/entities'
import type { ITaskNotificationRepository } from '@app/hexagonal/domain/ports'

export interface INotificationService {
  sendTaskArchivedNotification(task: TaskEntity): Promise<TaskNotificationEntity[]>
}

export type FetchFunction = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>

export class NotificationService implements INotificationService {
  private readonly maxAttempts: number
  private readonly retryDelays: number[]
  private readonly fetchFn: FetchFunction
  private readonly notifyUrl: string
  private readonly timeoutMs: number

  constructor(
    private readonly notificationRepository: ITaskNotificationRepository,
    options?: {
      notifyUrl?: string
      maxAttempts?: number
      retryDelays?: number[]
      fetchFn?: FetchFunction
      timeoutMs?: number
    },
  ) {
    this.notifyUrl = options?.notifyUrl ?? config.NOTIFY_URL ?? ''
    this.maxAttempts = options?.maxAttempts ?? 3
    this.retryDelays = options?.retryDelays ?? [1000, 2000, 4000]
    this.fetchFn = options?.fetchFn ?? globalThis.fetch
    this.timeoutMs = options?.timeoutMs ?? 5000
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async sendTaskArchivedNotification(task: TaskEntity): Promise<TaskNotificationEntity[]> {
    const records: TaskNotificationEntity[] = []
    const url = this.notifyUrl

    // If no notifyUrl is set, we still record a notification attempt or return
    if (!url) {
      const attempt = await this.notificationRepository.createAttempt({
        taskId: task.id,
        status: 'sent',
        attemptNumber: 1,
        httpStatus: null,
        details: 'NOTIFY_URL not configured - simulated delivery',
      })
      records.push(attempt)
      return records
    }

    const payload = {
      taskId: Number.isNaN(Number(task.id)) ? task.id : Number(task.id),
      title: task.title,
      archivedAt: (task.updatedAt || new Date()).toISOString(),
    }

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const response = await this.fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.timeoutMs),
        })

        const isSuccess = response.status >= 200 && response.status < 300

        const record = await this.notificationRepository.createAttempt({
          taskId: task.id,
          status: isSuccess ? 'sent' : 'failed',
          attemptNumber: attempt,
          httpStatus: response.status,
          details: isSuccess
            ? `HTTP ${response.status} - Notification sent successfully`
            : `HTTP ${response.status} - Remote responded with error`,
        })
        records.push(record)

        if (isSuccess) {
          return records
        }

        // Client error 4xx - do not retry
        if (response.status >= 400 && response.status < 500) {
          return records
        }

        // 5xx error: retry with backoff if attempts remaining
        if (attempt < this.maxAttempts) {
          const delay = this.retryDelays[attempt - 1] ?? 1000
          await this.sleep(delay)
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Network error / Connection timeout'

        const record = await this.notificationRepository.createAttempt({
          taskId: task.id,
          status: 'failed',
          attemptNumber: attempt,
          httpStatus: null,
          details: errorMessage,
        })
        records.push(record)

        // Network error / timeout: retry with backoff if attempts remaining
        if (attempt < this.maxAttempts) {
          const delay = this.retryDelays[attempt - 1] ?? 1000
          await this.sleep(delay)
        }
      }
    }

    return records
  }
}
