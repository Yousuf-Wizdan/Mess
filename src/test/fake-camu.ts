import {
  createServer,
  IncomingHttpHeaders,
  IncomingMessage,
  Server,
  ServerResponse,
} from "node:http";

export type PathHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  body: string,
) => void | Promise<void>;

export class FakeCamu {
  private server: Server | null = null;
  private handlers = new Map<string, PathHandler>();
  readonly requests: { path: string; method: string; headers: IncomingHttpHeaders; body: string }[] =
    [];

  on(path: string, handler: PathHandler): this {
    this.handlers.set(path, handler);
    return this;
  }

  async start(): Promise<string> {
    this.server = createServer(async (req, res) => {
      const body = await readBody(req);
      const handler = this.handlers.get(req.url ?? "");
      this.requests.push({
        path: req.url ?? "",
        method: req.method ?? "",
        headers: req.headers,
        body,
      });
      if (!handler) {
        res.statusCode = 404;
        res.end();
        return;
      }
      await handler(req, res, body);
    });
    await new Promise<void>((resolve) => this.server!.listen(0, "127.0.0.1", resolve));
    const address = this.server.address();
    if (typeof address === "object" && address) return `http://127.0.0.1:${address.port}`;
    throw new Error("fake camu failed to bind");
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      this.server?.close((err) => (err ? reject(err) : resolve())),
    );
    this.server = null;
  }

  callsTo(path: string): number {
    return this.requests.filter((r) => r.path === path).length;
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

export function jsonResponse(
  res: ServerResponse,
  status: number,
  payload: unknown,
  headers: Record<string, string> = {},
): void {
  res.statusCode = status;
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export const VALID_SESSION_RESPONSE = {
  output: {
    data: {
      token: "test-jwt-token",
      "api-key": "test-api-key",
    },
    errors: null,
  },
};

export const VALID_MENU_RESPONSE = {
  output: {
    data: {
      facNme: "Ground Floor",
      curntDte: "2026-08-25T04:35:00Z",
      isAtve: true,
      oMealList: [
        {
          _id: "b1",
          msCde: "Breakfast(Tue)",
          msNme: "Besan Chilla - (180 Kcal)\nGreen Chutney",
          mealTm: "Breakfast 07:30 AM - 09:30 AM",
          mealClr: "#fcb900",
          availFac: "Ground Floor",
          srvSts: "P",
        },
      ],
    },
    errors: null,
  },
};
