import { TaskController } from '@app/hexagonal/presentation/controllers/task.controller'
import { Router } from 'express'

const router = Router()
const ctrl = new TaskController()

// POST /tasks
router.post('/', ctrl.create)
// GET /tasks
router.get('/', ctrl.findAll)
// GET /tasks/:idTask
router.get('/:idTask', ctrl.findById)
// POST /tasks/:idTask/assign
router.post('/:idTask/assign', ctrl.assignUsers)
// POST /tasks/:idTask/complete
router.post('/:idTask/complete', ctrl.completeTaskPart)
// GET /tasks/:idTask/notifications
router.get('/:idTask/notifications', ctrl.getNotifications)

export const taskRouter = router
