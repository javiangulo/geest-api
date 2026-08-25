import { successResponse } from '@app/common/api-response'
import HttpStatusCodes from '@app/common/httpStatusCodes'
import type { PaginationQueryParams } from '@app/common/pagination'
import type { CreateUserDTO } from '@app/hexagonal/domain/entities'
import { createUserUseCase } from '@app/hexagonal/infrastructure/factories/user.factory'
import type { NextFunction, Request, Response } from 'express'

export class UserController {
  private readonly useCase = createUserUseCase()

  create = async (
    req: Request<unknown, unknown, CreateUserDTO>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = await this.useCase.createUser(req.body)
      res
        .status(HttpStatusCodes.CREATED)
        .json(successResponse(user, 'User created successfully', 'USER_CREATED'))
    } catch (error) {
      next(error)
    }
  }

  findAllWithPendingTasks = async (
    req: Request<unknown, unknown, unknown, PaginationQueryParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { items, pagination } = await this.useCase.getUsersWithPendingTasks(req.query)
      res
        .status(HttpStatusCodes.OK)
        .json(
          successResponse(
            items,
            'Users with pending tasks retrieved successfully',
            'USERS_FETCHED',
            pagination,
          ),
        )
    } catch (error) {
      next(error)
    }
  }

  findUserTasks = async (
    req: Request<{ idUser: string }, unknown, unknown, PaginationQueryParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { items, pagination } = await this.useCase.getUserTasks(req.params.idUser, req.query)
      res
        .status(HttpStatusCodes.OK)
        .json(
          successResponse(
            items,
            'User tasks retrieved successfully',
            'USER_TASKS_FETCHED',
            pagination,
          ),
        )
    } catch (error) {
      next(error)
    }
  }
}
