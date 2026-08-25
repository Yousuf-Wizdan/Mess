import { CamuClient, CamuCredentials } from "@/lib/camu";
import { mapCamuMenu } from "@/lib/camu-map";
import { KvStore } from "@/lib/kv";
import { UpstashKv } from "@/lib/kv-upstash";
import { MenuService } from "@/lib/menu-service";
import { NutritionEnricher } from "@/lib/nutrition-enricher";
import { HostellerSession, SessionManager, SessionStore } from "@/lib/session";
import { EncryptedSessionStore } from "@/lib/session-store";
import { MenuSnapshot } from "@/types/menu";

export const CAMU_BASE_URL =
  process.env.CAMU_BASE_URL ?? "https://student.bennetterp.camu.in";

export function readCredentials(): CamuCredentials {
  return {
    Email: process.env.CAMU_EMAIL ?? "",
    pwd: process.env.CAMU_PASSWORD ?? "",
    InId: process.env.CAMU_INSTITUTION_ID ?? "",
  };
}

function readManualSession(): HostellerSession | null {
  const cookie = process.env.CAMU_SESSION_COOKIE;
  if (!cookie) return null;
  return {
    cookie,
    jwt: process.env.CAMU_JWT || undefined,
    apiKey: process.env.CAMU_API_KEY || undefined,
    createdAt: "manual",
  };
}

class ManualSeededSessionStore implements SessionStore {
  constructor(
    private readonly inner: SessionStore,
    private readonly manual: HostellerSession,
  ) {}

  async get(): Promise<HostellerSession | null> {
    return (await this.inner.get()) ?? this.manual;
  }

  async set(session: HostellerSession): Promise<void> {
    await this.inner.set(session);
  }
}

export function createKv(): KvStore {
  return new UpstashKv(
    process.env.UPSTASH_REDIS_REST_URL ?? "",
    process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  );
}

export function createSessionManager(kv: KvStore): SessionManager {
  const sessionStore = new EncryptedSessionStore(
    kv,
    process.env.SESSION_ENCRYPTION_KEY ?? "",
  );
  const manual = readManualSession();
  const store: SessionStore = manual
    ? new ManualSeededSessionStore(sessionStore, manual)
    : sessionStore;
  const client = new CamuClient(CAMU_BASE_URL);
  return new SessionManager(client, readCredentials(), store);
}

export function createMenuService(): MenuService {
  const kv = createKv();
  const sessionManager = createSessionManager(kv);
  const client = new CamuClient(CAMU_BASE_URL);
  const enricher = new NutritionEnricher(kv, fetch.bind(globalThis));
  return new MenuService(kv, sessionManager, createMenuFetcher(client), (s) =>
    enricher.enrichSnapshot(s),
  );
}

export function createMenuFetcher(
  client: CamuClient,
): (session: HostellerSession) => Promise<MenuSnapshot> {
  return async (session) => mapCamuMenu(await client.getMenu(session));
}
