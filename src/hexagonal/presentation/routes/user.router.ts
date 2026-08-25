import { UserController } from '@app/hexagonal/presentation/controllers/user.controller'
import { Router } from 'express'

const router = Router()
const ctrl = new UserController()

// POST /users
router.post('/', ctrl.create)
// GET /users
router.get('/', ctrl.findAllWithPendingTasks)
// GET /users/:idUser/tasks
router.get('/:idUser/tasks', ctrl.findUserTasks)

export const userRouter = router
