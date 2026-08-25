import { successResponse } from '@app/common/api-response'
import { AppError } from '@app/common/app-error'
import HttpStatusCodes from '@app/common/httpStatusCodes'
import { idempotencyMiddleware } from '@app/hexagonal/presentation/middlewares/idempotency.middleware'
import { taskRouter, userRouter } from '@app/hexagonal/presentation/routes'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'

const app = express()

app.set('trust proxy', 1)

// Security middleware
app.use(helmet())
app.use(cors())

// Rate limiting: 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again later.',
    },
  },
})
app.use(limiter)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Idempotency middleware for POST requests
app.use(idempotencyMiddleware)

app.get('/', (_: Request, res: Response) => {
  res
    .status(HttpStatusCodes.OK)
    .json(
      successResponse(
        { service: 'geest-api', health: '/health' },
        'Service is running',
        'SERVICE_OK',
      ),
    )
})

// Health check
app.get('/health', (_: Request, res: Response) => {
  res
    .status(HttpStatusCodes.OK)
    .json(successResponse({ status: 'ok' }, 'Service is healthy', 'HEALTH_OK'))
})

// ─── API Routes ────────────────────────────────────────────────────────────────
const apiRouter = express.Router()
apiRouter.use('/users', userRouter)
apiRouter.use('/tasks', taskRouter)

app.use('/api', apiRouter)

// 404 fallback
app.all('/{*any}', (_req: Request, res: Response) => {
  res.status(HttpStatusCodes.NOT_FOUND).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Route not found',
    },
  })
})

// Global error handler complying with required error format:
// { "error": { "code": "...", "message": "..." } }
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    })
    return
  }

  // Handle malformed JSON body errors from express.json()
  if ('type' in err && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(HttpStatusCodes.BAD_REQUEST).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON payload in request body',
      },
    })
    return
  }

  console.error('Unhandled Exception:', err)
  res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Internal Server Error',
    },
  })
})

export default app
