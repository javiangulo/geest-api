import { successResponse } from '@app/common/api-response'
import HttpStatusCodes from '@app/common/httpStatusCodes'
import type { PaginationQueryParams } from '@app/common/pagination'
import type {
  AssignUsersDTO,
  CompleteTaskPartDTO,
  CreateTaskDTO,
} from '@app/hexagonal/domain/entities'
import { createTaskUseCase } from '@app/hexagonal/infrastructure/factories/task.factory'
import type { NextFunction, Request, Response } from 'express'

export class TaskController {
  private readonly useCase = createTaskUseCase()

  create = async (
    req: Request<unknown, unknown, CreateTaskDTO>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const task = await this.useCase.createTask(req.body)
      res
        .status(HttpStatusCodes.CREATED)
        .json(successResponse(task, 'Task created successfully', 'TASK_CREATED'))
    } catch (error) {
      next(error)
    }
  }

  findAll = async (
    req: Request<unknown, unknown, unknown, PaginationQueryParams & { status?: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { items, pagination } = await this.useCase.getTasks({
        status: req.query.status,
        page: req.query.page,
        limit: req.query.limit,
        offset: req.query.offset,
        order: req.query.order,
        cursor: req.query.cursor,
      })
      res
        .status(HttpStatusCodes.OK)
        .json(successResponse(items, 'Tasks retrieved successfully', 'TASKS_FETCHED', pagination))
    } catch (error) {
      next(error)
    }
  }

  findById = async (
    req: Request<{ idTask: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const task = await this.useCase.getTaskById(req.params.idTask)
      res
        .status(HttpStatusCodes.OK)
        .json(successResponse(task, 'Task retrieved successfully', 'TASK_FETCHED'))
    } catch (error) {
      next(error)
    }
  }

  assignUsers = async (
    req: Request<{ idTask: string }, unknown, AssignUsersDTO>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.useCase.assignUsers(req.params.idTask, req.body.userIds)
      res
        .status(HttpStatusCodes.OK)
        .json(successResponse(result, 'Users assigned to task successfully', 'USERS_ASSIGNED'))
    } catch (error) {
      next(error)
    }
  }

  completeTaskPart = async (
    req: Request<{ idTask: string }, unknown, CompleteTaskPartDTO>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.useCase.completeTaskPart(req.params.idTask, req.body.userId)
      res
        .status(HttpStatusCodes.OK)
        .json(
          successResponse(
            result,
            'Task marked as completed by user successfully',
            'TASK_PART_COMPLETED',
          ),
        )
    } catch (error) {
      next(error)
    }
  }

  getNotifications = async (
    req: Request<{ idTask: string }, unknown, unknown, PaginationQueryParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { items, pagination } = await this.useCase.getTaskNotifications(
        req.params.idTask,
        req.query,
      )
      res
        .status(HttpStatusCodes.OK)
        .json(
          successResponse(
            items,
            'Task notifications retrieved successfully',
            'TASK_NOTIFICATIONS_FETCHED',
            pagination,
          ),
        )
    } catch (error) {
      next(error)
    }
  }
}
