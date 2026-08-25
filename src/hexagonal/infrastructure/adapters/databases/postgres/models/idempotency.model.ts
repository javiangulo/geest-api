import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

@Entity('idempotency_keys')
export class IdempotencyModel {
  @PrimaryColumn({ name: 'key', type: 'varchar', length: 255 })
  key!: string

  @Column({ name: 'request_path', type: 'varchar', length: 255 })
  requestPath!: string

  @Column({ name: 'request_method', type: 'varchar', length: 10 })
  requestMethod!: string

  @Column({ name: 'request_hash', type: 'varchar', length: 64 })
  requestHash!: string

  @Column({ name: 'status_code', type: 'int' })
  statusCode!: number

  @Column({ name: 'response_body', type: 'text' })
  responseBody!: string

  @Column({ name: 'headers', type: 'jsonb', nullable: true })
  headers!: Record<string, string | string[]> | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date
}
