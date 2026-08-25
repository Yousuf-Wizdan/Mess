export interface KvStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  setIfNotExists(key: string, value: unknown, ttlSeconds: number): Promise<boolean>;
  delete(key: string): Promise<void>;
}
