import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { TaskModel } from './task.model'

@Entity('task_notifications')
export class TaskNotificationModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: string

  @Column({ name: 'status', type: 'varchar', length: 50, default: 'sent' })
  status!: 'sent' | 'failed' | 'pending'

  @Column({ name: 'attempt_number', type: 'int', default: 1 })
  attemptNumber!: number

  @Column({ name: 'http_status', type: 'int', nullable: true })
  httpStatus!: number | null

  @Column({ name: 'details', type: 'text', nullable: true })
  details!: string | null

  @ManyToOne(
    () => TaskModel,
    task => task.notifications,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'task_id' })
  task!: TaskModel

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date
}
