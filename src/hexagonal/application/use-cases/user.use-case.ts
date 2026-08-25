import { ConflictError, NotFoundError, ValidationError } from '@app/common/app-error'
import {
  type PaginatedResult,
  type PaginationQueryParams,
  paginateArray,
  parsePaginationParams,
} from '@app/common/pagination'
import type {
  CreateUserDTO,
  UserEntity,
  UserTaskDTO,
  UserWithPendingTasksDTO,
} from '@app/hexagonal/domain/entities'
import type { IUserRepository } from '@app/hexagonal/domain/ports'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class UserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async createUser(dto: CreateUserDTO): Promise<UserEntity> {
    if (!dto.name || dto.name.trim() === '') {
      throw new ValidationError('Name is required')
    }

    if (!dto.lastName || dto.lastName.trim() === '') {
      throw new ValidationError('Last name is required')
    }

    if (!dto.email || dto.email.trim() === '') {
      throw new ValidationError('Email is required')
    }

    if (!EMAIL_REGEX.test(dto.email.trim())) {
      throw new ValidationError('Invalid email format')
    }

    const existingUser = await this.userRepository.findByEmail(dto.email)
    if (existingUser) {
      throw new ConflictError('EMAIL_ALREADY_EXISTS', 'A user with this email already exists')
    }

    return this.userRepository.create({
      name: dto.name.trim(),
      lastName: dto.lastName.trim(),
      email: dto.email.trim(),
    })
  }

  async getUserById(id: string): Promise<UserEntity> {
    if (!id || id.trim() === '') {
      throw new ValidationError('User ID is required')
    }

    const user = await this.userRepository.findById(id.trim())
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'User not found')
    }

    return user
  }

  async getUsersWithPendingTasks(
    options?: PaginationQueryParams,
  ): Promise<PaginatedResult<UserWithPendingTasksDTO>> {
    const pagination = parsePaginationParams(options)
    const users = await this.userRepository.findAllWithPendingTasks()
    return paginateArray(users, pagination)
  }

  async getUserTasks(
    userId: string,
    options?: PaginationQueryParams,
  ): Promise<PaginatedResult<UserTaskDTO>> {
    if (!userId || userId.trim() === '') {
      throw new ValidationError('User ID is required')
    }

    const user = await this.userRepository.findById(userId.trim())
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'User not found')
    }

    const pagination = parsePaginationParams(options)
    const tasks = await this.userRepository.findTasksByUserId(userId.trim())
    return paginateArray(tasks, pagination)
  }
}
