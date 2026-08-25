export interface DatabaseHealthPort {
  provider: string
  isConnected(): Promise<boolean>
}
