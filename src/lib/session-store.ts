import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { HostellerSession, SessionStore } from "@/lib/session";
import { KvStore } from "@/lib/kv";

const SESSION_KEY = "mess:hosteller-session";

export class EncryptedSessionStore implements SessionStore {
  private readonly key: Buffer;

  constructor(
    private readonly kv: KvStore,
    encryptionKey: string,
  ) {
    this.key = createHash("sha256").update(encryptionKey).digest();
  }

  async get(): Promise<HostellerSession | null> {
    const blob = await this.kv.get<string>(SESSION_KEY);
    if (!blob) return null;
    try {
      const json = decrypt(blob, this.key);
      return JSON.parse(json) as HostellerSession;
    } catch {
      return null;
    }
  }

  async set(session: HostellerSession): Promise<void> {
    const json = JSON.stringify(session);
    await this.kv.set(SESSION_KEY, encrypt(json, this.key));
  }

  static isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    return Boolean(
      env.UPSTASH_REDIS_REST_URL &&
        env.UPSTASH_REDIS_REST_TOKEN &&
        env.SESSION_ENCRYPTION_KEY,
    );
  }
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((b) => b.toString("base64")).join(".");
}

function decrypt(blob: string, key: Buffer): string {
  const [ivB64, tagB64, dataB64] = blob.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("malformed ciphertext");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
