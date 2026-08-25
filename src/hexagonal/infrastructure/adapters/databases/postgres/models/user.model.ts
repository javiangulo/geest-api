import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { TaskAssignmentModel } from './task-assignment.model'

@Entity('users')
export class UserModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string

  @Column({ name: 'last_name', type: 'varchar', length: 255 })
  lastName!: string

  @Column({ name: 'email', type: 'varchar', length: 255, unique: true })
  email!: string

  @OneToMany(
    () => TaskAssignmentModel,
    assignment => assignment.user,
  )
  assignments!: TaskAssignmentModel[]

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date
}
