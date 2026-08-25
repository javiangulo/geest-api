import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { TaskModel } from './task.model'
import { UserModel } from './user.model'

@Entity('task_assignments')
@Index(['taskId', 'userId'], { unique: true })
export class TaskAssignmentModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ name: 'is_completed', type: 'boolean', default: false })
  isCompleted!: boolean

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt!: Date | null

  @ManyToOne(
    () => TaskModel,
    task => task.assignments,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'task_id' })
  task!: TaskModel

  @ManyToOne(
    () => UserModel,
    user => user.assignments,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'user_id' })
  user!: UserModel

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date
}
