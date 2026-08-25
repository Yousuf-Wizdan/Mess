import {
  CamuClient,
  CamuCredentials,
} from "@/lib/camu";
import { logEvent, logError } from "@/lib/log";
import { CamuAuthError } from "@/lib/retry";

export interface HostellerSession {
  cookie: string;
  jwt?: string;
  apiKey?: string;
  createdAt: string;
}

export interface SessionStore {
  get(): Promise<HostellerSession | null>;
  set(session: HostellerSession): Promise<void>;
}

export class InMemorySessionStore implements SessionStore {
  private session: HostellerSession | null = null;

  async get(): Promise<HostellerSession | null> {
    return this.session;
  }

  async set(session: HostellerSession): Promise<void> {
    this.session = session;
  }
}

export function isHostellerConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    (env.CAMU_EMAIL && env.CAMU_PASSWORD && env.CAMU_INSTITUTION_ID) ||
      env.CAMU_SESSION_COOKIE,
  );
}

export class SessionManager {
  private inflightLogin: Promise<HostellerSession> | null = null;

  constructor(
    private readonly client: CamuClient,
    private readonly credentials: CamuCredentials,
    private readonly store: SessionStore,
  ) {}

  async getValidSession(): Promise<HostellerSession> {
    const existing = await this.store.get();
    if (existing && (await this.client.validateSession(existing))) {
      return existing;
    }
    logEvent("session.refresh", { reason: existing ? "invalid" : "missing" });
    return this.login();
  }

  async recoverFromAuthFailure(): Promise<HostellerSession> {
    logEvent("session.relogin", { reason: "auth_failure" });
    return this.login();
  }

  async runWithSession<T>(
    fn: (session: HostellerSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.getValidSession();
    try {
      return await fn(session);
    } catch (error) {
      if (error instanceof CamuAuthError) {
        const fresh = await this.recoverFromAuthFailure();
        return fn(fresh);
      }
      throw error;
    }
  }

  private async login(): Promise<HostellerSession> {
    if (this.inflightLogin) return this.inflightLogin;
    this.inflightLogin = this.doLogin().finally(() => {
      this.inflightLogin = null;
    });
    return this.inflightLogin;
  }

  private async doLogin(): Promise<HostellerSession> {
    try {
      const session = await this.client.login(this.credentials);
      await this.store.set(session);
      return session;
    } catch (error) {
      logError("session.login.failed", error);
      throw error;
    }
  }
}
