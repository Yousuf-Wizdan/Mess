import {
  CamuClient,
  CamuCredentials,
} from "@/lib/camu";
import { mapCamuMenu } from "@/lib/camu-map";
import { KvStore } from "@/lib/kv";
import { UpstashKv } from "@/lib/kv-upstash";
import { MenuService } from "@/lib/menu-service";
import {
  HostellerSession,
  SessionManager,
} from "@/lib/session";
import { EncryptedSessionStore } from "@/lib/session-store";
import { MenuSnapshot } from "@/types/menu";

export const CAMU_BASE_URL =
  process.env.CAMU_BASE_URL ?? "https://student.bennetterp.camu.in/api";

export function readCredentials(): CamuCredentials {
  return {
    email: process.env.CAMU_EMAIL ?? "",
    password: process.env.CAMU_PASSWORD ?? "",
    institutionId: process.env.CAMU_INSTITUTION_ID ?? "",
  };
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
  const client = new CamuClient(CAMU_BASE_URL);
  return new SessionManager(client, readCredentials(), sessionStore);
}

export function createMenuService(): MenuService {
  const kv = createKv();
  const sessionManager = createSessionManager(kv);
  const client = new CamuClient(CAMU_BASE_URL);
  return new MenuService(kv, sessionManager, createMenuFetcher(client));
}

export function createMenuFetcher(
  client: CamuClient,
): (session: HostellerSession) => Promise<MenuSnapshot> {
  return async (session) => mapCamuMenu(await client.getMenu(session));
}
