import assert from 'node:assert'
import type { Server } from 'node:http'
import test, { after, before, describe } from 'node:test'
import { idempotencyMiddleware } from '@presentation/middlewares/idempotency.middleware'
import express, { type Request, type Response } from 'express'

describe('Idempotency System Tests', () => {
  let server: Server
  let baseUrl: string
  let executionCount = 0

  before(async () => {
    const testApp = express()
    testApp.use(express.json())
    testApp.use(idempotencyMiddleware)

    // A mock POST endpoint to test idempotency and concurrency
    testApp.post('/test-tasks', async (req: Request, res: Response) => {
      executionCount++
      // Add slight delay to simulate async database work and allow race conditions
      await new Promise(resolve => setTimeout(resolve, 50))
      res.status(201).json({
        code: 'TASK_CREATED',
        message: 'Task created successfully',
        data: {
          id: `task-${executionCount}`,
          title: req.body.title,
          description: req.body.description ?? null,
        },
      })
    })

    await new Promise<void>(resolve => {
      server = testApp.listen(0, '127.0.0.1', () => {
        const addr = server.address()
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`
        }
        resolve()
      })
    })
  })

  after(async () => {
    await new Promise<void>(resolve => {
      server.close(() => resolve())
    })
  })

  test('should process normal POST without Idempotency-Key independently', async () => {
    const res1 = await fetch(`${baseUrl}/test-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Task 1' }),
    })
    assert.strictEqual(res1.status, 201)
    const json1 = await res1.json()

    const res2 = await fetch(`${baseUrl}/test-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Task 2' }),
    })
    assert.strictEqual(res2.status, 201)
    const json2 = await res2.json()

    assert.notStrictEqual(json1.data.id, json2.data.id)
  })

  test('should return identical response on sequential requests with same Idempotency-Key and body', async () => {
    const idempotencyKey = `seq-key-${Date.now()}`
    const body = {
      title: 'Idempotent Task Test',
      description: 'First attempt',
    }

    // First request
    const res1 = await fetch(`${baseUrl}/test-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    })

    assert.strictEqual(res1.status, 201)
    const data1 = await res1.json()
    assert.ok(data1.data.id)
    assert.strictEqual(data1.data.title, 'Idempotent Task Test')

    // Second request with SAME key and SAME body
    const res2 = await fetch(`${baseUrl}/test-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    })

    assert.strictEqual(res2.status, 201)
    const data2 = await res2.json()

    // Identical responses
    assert.deepStrictEqual(data1, data2)
  })

  test('should return identical responses when parallel requests arrive with same Idempotency-Key and body', async () => {
    const idempotencyKey = `parallel-key-${Date.now()}`
    const body = {
      title: 'Parallel Idempotent Task',
      description: 'Testing concurrency',
    }

    // Send both requests concurrently
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/test-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
      }),
      fetch(`${baseUrl}/test-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
      }),
    ])

    assert.strictEqual(res1.status, 201)
    assert.strictEqual(res2.status, 201)

    const data1 = await res1.json()
    const data2 = await res2.json()

    // Both should receive identical results and the task should only have been created once
    assert.deepStrictEqual(data1, data2)
  })

  test('should return 409 Conflict if same Idempotency-Key is reused with a different body', async () => {
    const idempotencyKey = `conflict-key-${Date.now()}`

    const res1 = await fetch(`${baseUrl}/test-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ title: 'Original Task' }),
    })
    assert.strictEqual(res1.status, 201)

    // Reusing the same key with DIFFERENT body
    const res2 = await fetch(`${baseUrl}/test-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ title: 'Different Task' }),
    })

    assert.strictEqual(res2.status, 409)
    const errData = await res2.json()
    assert.strictEqual(errData.error.code, 'IDEMPOTENCY_CONFLICT')
  })
})
