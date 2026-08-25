import config from '@app/config'
import { DataSource, type DataSourceOptions } from 'typeorm'
import {
  IdempotencyModel,
  TaskAssignmentModel,
  TaskModel,
  TaskNotificationModel,
  UserModel,
} from './models'

let dataSourceInstance: DataSource | null = null
let connectionPromise: Promise<DataSource> | null = null

export const createPostgresDataSourceOptions = (): DataSourceOptions => {
  const baseOptions = {
    type: 'postgres' as const,
    entities: [UserModel, TaskModel, TaskAssignmentModel, TaskNotificationModel, IdempotencyModel],
    synchronize: config.POSTGRES_SYNCHRONIZE,
    logging: config.POSTGRES_LOGGING,
  }

  // 1. If POSTGRES_URL is provided, connect directly via connection string
  if (config.POSTGRES_URL && config.POSTGRES_URL.trim() !== '') {
    return {
      ...baseOptions,
      url: config.POSTGRES_URL,
    }
  }

  // 2. Otherwise, connect using individual parameters
  return {
    ...baseOptions,
    host: config.POSTGRES_HOST,
    port: config.POSTGRES_PORT,
    username: config.POSTGRES_USER,
    password: config.POSTGRES_PASSWORD,
    database: config.POSTGRES_DB,
  }
}

export const getPostgresDataSource = (): DataSource => {
  if (!dataSourceInstance) {
    dataSourceInstance = new DataSource(createPostgresDataSourceOptions())
  }
  return dataSourceInstance
}

export const ensurePostgresConnection = async (): Promise<DataSource> => {
  const dataSource = getPostgresDataSource()

  if (dataSource.isInitialized) {
    return dataSource
  }

  if (!connectionPromise) {
    connectionPromise = dataSource.initialize()
  }

  try {
    await connectionPromise
  } catch (error) {
    connectionPromise = null
    throw error
  }

  return dataSource
}

export const isPostgresConnected = async (): Promise<boolean> => {
  try {
    const ds = await ensurePostgresConnection()
    return ds.isInitialized
  } catch {
    return false
  }
}
