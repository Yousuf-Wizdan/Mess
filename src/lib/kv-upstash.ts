import { Redis } from "@upstash/redis";
import { KvStore } from "@/lib/kv";

export class UpstashKv implements KvStore {
  private redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get<T>(key);
    return value ?? null;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds === undefined) {
      await this.redis.set(key, value);
    } else {
      await this.redis.set(key, value, { ex: ttlSeconds });
    }
  }

  async setIfNotExists(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await this.redis.set(key, value, {
      nx: true,
      ex: ttlSeconds,
    });
    return result === "OK" || result === true;
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
