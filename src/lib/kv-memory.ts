import { KvStore } from "@/lib/kv";

interface Entry {
  value: unknown;
  expiresAt: number | null;
}

export class InMemoryKv implements KvStore {
  private entries = new Map<string, Entry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    this.entries.set(key, {
      value,
      expiresAt: ttlSeconds === undefined ? null : Date.now() + ttlSeconds * 1000,
    });
  }

  async setIfNotExists(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<boolean> {
    const existing = this.entries.get(key);
    if (
      existing &&
      (existing.expiresAt === null || Date.now() <= existing.expiresAt)
    ) {
      return false;
    }
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
}
