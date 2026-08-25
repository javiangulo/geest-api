import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { TaskAssignmentModel } from './task-assignment.model'
import { TaskNotificationModel } from './task-notification.model'

@Entity('tasks')
export class TaskModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null

  @Column({ name: 'status', type: 'varchar', length: 50, default: 'open' })
  status!: 'open' | 'archived'

  @OneToMany(
    () => TaskAssignmentModel,
    assignment => assignment.task,
  )
  assignments!: TaskAssignmentModel[]

  @OneToMany(
    () => TaskNotificationModel,
    notification => notification.task,
  )
  notifications!: TaskNotificationModel[]

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date
}
