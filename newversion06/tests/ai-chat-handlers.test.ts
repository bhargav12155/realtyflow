import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express, { type Express } from "express";
import {
  createAiChatHandler,
  createAiAssistantChatHandler,
  type AiChatDeps,
  type AiAssistantDeps,
  type ChatService,
} from "../server/routes/ai-chat-handlers";

type Call = { kind: string; messages: any[] };

interface FakeMultiOpenAI {
  makeRequest: AiChatDeps["multiOpenAI"]["makeRequest"];
  calls: Call[];
  nextResponse: string;
}

function makeFakeMultiOpenAI(nextResponse = "OpenAI says hi"): FakeMultiOpenAI {
  const calls: Call[] = [];
  const fake: FakeMultiOpenAI = {
    calls,
    nextResponse,
    async makeRequest(kind, fn) {
      const fakeClient = {
        chat: {
          completions: {
            create: async (params: any) => {
              calls.push({ kind, messages: params.messages });
              return {
                choices: [
                  {
                    message: { content: fake.nextResponse },
                    finish_reason: "stop",
                  },
                ],
              };
            },
          },
        },
      };
      return fn(fakeClient);
    },
  };
  return fake;
}

interface QueuedFakeMultiOpenAI {
  makeRequest: AiChatDeps["multiOpenAI"]["makeRequest"];
  calls: Call[];
  responses: string[];
}

function makeQueuedFakeMultiOpenAI(
  responses: string[],
): QueuedFakeMultiOpenAI {
  const calls: Call[] = [];
  const queue = [...responses];
  return {
    calls,
    responses,
    async makeRequest(kind, fn) {
      const fakeClient = {
        chat: {
          completions: {
            create: async (params: any) => {
              calls.push({ kind, messages: params.messages });
              const content = queue.length > 0 ? queue.shift()! : "";
              return {
                choices: [
                  {
                    message: { content },
                    finish_reason: "stop",
                  },
                ],
              };
            },
          },
        },
      };
      return fn(fakeClient);
    },
  };
}

const FALLBACK_MESSAGE =
  "I'm having trouble processing your request right now. Could you try rephrasing your question or try again in a moment?";

function makeFakeChatService(label: string): ChatService & {
  calls: Array<{ message: string; systemPrompt?: string; images?: any[] }>;
} {
  const calls: Array<{
    message: string;
    systemPrompt?: string;
    images?: any[];
  }> = [];
  return {
    calls,
    async chat(message, _history, systemPrompt, images) {
      calls.push({ message, systemPrompt, images });
      return { success: true, message: `${label}: ${message}` };
    },
  };
}

function makeFakeOpenAIService() {
  const calls: Array<{ prompt: string }> = [];
  return {
    calls,
    async generateImage(opts: { prompt: string }) {
      calls.push(opts);
      return "https://example.com/fake-image.png";
    },
  };
}

const fakeUserPreferencesTable = { userId: Symbol("userId") } as any;
const fakeAiAssistantMessagesTable = { id: Symbol("id") } as any;

function makeFakeDb() {
  // Chainable select for /api/ai/chat path: db.select().from(...).where(...).limit(1)
  const select = () => ({
    from: () => ({
      where: () => ({
        limit: async (_n: number) => [
          {
            serviceArea: "Downtown",
            communities: ["Old Market", "Benson"],
          },
        ],
      }),
    }),
  });

  // Chainable insert for assistant: db.insert(table).values(v).returning()
  const inserts: any[] = [];
  const insert = (_table: any) => ({
    values: (v: any) => ({
      returning: async () => {
        const row = { id: inserts.length + 1, ...v };
        inserts.push(row);
        return [row];
      },
    }),
  });

  return { select, insert, inserts } as any;
}

const fakeStorage = {
  async getCompanyProfile(_userId: any) {
    return {
      companyName: "Acme Realty",
      tagline: "Best in town",
      city: "Omaha",
      state: "NE",
    };
  },
};

function buildAiChatApp(overrides: Partial<AiChatDeps> = {}) {
  const multiOpenAI = makeFakeMultiOpenAI("openai-default-response");
  const openaiService = makeFakeOpenAIService();
  const claudeService = makeFakeChatService("claude");
  const geminiService = makeFakeChatService("gemini");
  const db = makeFakeDb();

  const handler = createAiChatHandler({
    multiOpenAI,
    openaiService,
    storage: fakeStorage,
    db,
    userPreferencesTable: fakeUserPreferencesTable,
    loadAnthropic: async () => ({ anthropicService: claudeService }),
    loadGemini: async () => ({ geminiService }),
    ...overrides,
  });

  const app: Express = express();
  app.use(express.json());
  app.post("/api/ai/chat", (req: any, res, next) => {
    req.user = { id: 42 };
    handler(req, res).catch(next);
  });
  return { app, multiOpenAI, openaiService, claudeService, geminiService, db };
}

function buildAssistantApp(overrides: Partial<AiAssistantDeps> = {}) {
  const multiOpenAI = makeFakeMultiOpenAI("vision-or-text-default");
  const claudeService = makeFakeChatService("claude");
  const geminiService = makeFakeChatService("gemini");
  const db = makeFakeDb();
  const s3UploadService = {
    async uploadBuffer(_b: Buffer, key: string, _mime: string) {
      return `https://s3.example.com/${key}`;
    },
  };

  const handler = createAiAssistantChatHandler({
    multiOpenAI,
    db,
    aiAssistantMessagesTable: fakeAiAssistantMessagesTable,
    s3UploadService,
    loadAnthropic: async () => ({ anthropicService: claudeService }),
    loadGemini: async () => ({ geminiService }),
    ...overrides,
  });

  const app: Express = express();
  app.use(express.json());
  app.post("/api/ai-assistant/chat", (req: any, res, next) => {
    req.user = { id: 99 };
    if (!req.files) req.files = [];
    handler(req, res).catch(next);
  });
  return { app, multiOpenAI, claudeService, geminiService, db };
}

async function postJSON(app: Express, path: string, body: any) {
  const server = app.listen(0);
  try {
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no address");
    const url = `http://127.0.0.1:${addr.port}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    return { status: res.status, body: json };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function postWithFiles(
  app: Express,
  path: string,
  body: any,
  files: Express.Multer.File[],
) {
  const handler = (app as any)._router.stack.find(
    (l: any) => l.route?.path === path,
  );
  assert.ok(handler, `route ${path} not registered`);

  // Bypass HTTP and call the handler directly with files attached
  const req: any = {
    body,
    files,
    user: { id: 99 },
  };

  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    let statusCode = 200;
    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(payload: any) {
        resolve({ status: statusCode, body: payload });
      },
    };
    const stack = handler.route.stack;
    // The last layer is our handler wrapper
    const fn = stack[stack.length - 1].handle;
    try {
      fn(req, res, reject);
    } catch (err) {
      reject(err);
    }
  });
}

describe("/api/ai/chat handler", () => {
  describe("provider routing", () => {
    it("routes to Claude when provider=claude", async () => {
      const { app, claudeService, multiOpenAI } = buildAiChatApp();
      const res = await postJSON(app, "/api/ai/chat", {
        message: "Hello there",
        provider: "claude",
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.provider, "claude");
      assert.equal(res.body.message, "claude: Hello there");
      assert.equal(claudeService.calls.length, 1);
      assert.equal(multiOpenAI.calls.length, 0);
    });

    it("routes to Gemini when provider=gemini", async () => {
      const { app, geminiService, multiOpenAI } = buildAiChatApp();
      const res = await postJSON(app, "/api/ai/chat", {
        message: "Tell me a joke",
        provider: "gemini",
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.provider, "gemini");
      assert.equal(res.body.message, "gemini: Tell me a joke");
      assert.equal(geminiService.calls.length, 1);
      assert.equal(multiOpenAI.calls.length, 0);
    });

    it("routes to OpenAI when provider=openai", async () => {
      const { app, multiOpenAI, claudeService, geminiService } =
        buildAiChatApp();
      const res = await postJSON(app, "/api/ai/chat", {
        message: "What is 2+2?",
        provider: "openai",
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.provider, "openai");
      assert.equal(res.body.message, "openai-default-response");
      assert.equal(multiOpenAI.calls.length, 1);
      assert.equal(claudeService.calls.length, 0);
      assert.equal(geminiService.calls.length, 0);
    });

    it("routes to OpenAI when provider=auto", async () => {
      const { app, multiOpenAI } = buildAiChatApp();
      const res = await postJSON(app, "/api/ai/chat", {
        message: "Hi",
        provider: "auto",
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.provider, "openai");
      assert.equal(multiOpenAI.calls.length, 1);
    });

    it("rejects unknown providers", async () => {
      const { app } = buildAiChatApp();
      const res = await postJSON(app, "/api/ai/chat", {
        message: "Hi",
        provider: "bogus",
      });
      assert.equal(res.status, 400);
    });
  });

  describe("inline image generation", () => {
    it("triggers generateImage and returns imageUrl on OpenAI path", async () => {
      const { app, openaiService } = buildAiChatApp();
      const res = await postJSON(app, "/api/ai/chat", {
        message: "Please create an image of a cozy living room",
        provider: "openai",
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.provider, "openai");
      assert.equal(openaiService.calls.length, 1);
      assert.match(
        openaiService.calls[0].prompt,
        /cozy living room/i,
        "image prompt must include the user's request",
      );
      assert.equal(
        res.body.imageUrl,
        "https://example.com/fake-image.png",
        "response must surface the generated image URL",
      );
    });

    it("triggers generateImage and returns imageUrl on Gemini path", async () => {
      const { app, openaiService, geminiService } = buildAiChatApp();
      const res = await postJSON(app, "/api/ai/chat", {
        message: "Generate a photo of a modern kitchen",
        provider: "gemini",
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.provider, "gemini");
      assert.equal(geminiService.calls.length, 1);
      assert.equal(openaiService.calls.length, 1);
      assert.match(openaiService.calls[0].prompt, /modern kitchen/i);
      assert.equal(res.body.imageUrl, "https://example.com/fake-image.png");
    });

    it("triggers generateImage on auto provider when prompt matches", async () => {
      const { app, openaiService } = buildAiChatApp();
      const res = await postJSON(app, "/api/ai/chat", {
        message: "make an illustration of a sunset over the ocean",
        provider: "auto",
      });
      assert.equal(res.status, 200);
      assert.equal(openaiService.calls.length, 1);
      assert.equal(res.body.imageUrl, "https://example.com/fake-image.png");
    });

    it("does NOT call generateImage for non-image messages on OpenAI path", async () => {
      const { app, openaiService } = buildAiChatApp();
      const res = await postJSON(app, "/api/ai/chat", {
        message: "What is the capital of France?",
        provider: "openai",
      });
      assert.equal(res.status, 200);
      assert.equal(openaiService.calls.length, 0);
      assert.equal(res.body.imageUrl, undefined);
    });

    it("does NOT call generateImage for non-image messages on Gemini path", async () => {
      const { app, openaiService } = buildAiChatApp();
      const res = await postJSON(app, "/api/ai/chat", {
        message: "Tell me a joke about cats",
        provider: "gemini",
      });
      assert.equal(res.status, 200);
      assert.equal(openaiService.calls.length, 0);
      assert.equal(res.body.imageUrl, undefined);
    });

    it("does NOT call generateImage when provider=claude even for image prompts", async () => {
      const { app, openaiService } = buildAiChatApp();
      const res = await postJSON(app, "/api/ai/chat", {
        message: "Create an image of a beach house",
        provider: "claude",
      });
      assert.equal(res.status, 200);
      assert.equal(openaiService.calls.length, 0);
      assert.equal(res.body.imageUrl, undefined);
    });

    it("still returns the chat message when image generation fails (OpenAI path)", async () => {
      const failingOpenAI = {
        calls: [] as Array<{ prompt: string }>,
        async generateImage(opts: { prompt: string }) {
          this.calls.push(opts);
          throw new Error("image gen blew up");
        },
      };
      const { app } = buildAiChatApp({ openaiService: failingOpenAI });
      const res = await postJSON(app, "/api/ai/chat", {
        message: "Create an image of a mountain cabin",
        provider: "openai",
      });
      assert.equal(res.status, 200);
      assert.equal(failingOpenAI.calls.length, 1);
      assert.equal(res.body.imageUrl, undefined);
      assert.equal(res.body.message, "openai-default-response");
    });
  });

  describe("generalMode toggle", () => {
    for (const provider of ["openai", "claude", "gemini", "auto"]) {
      it(`omits company/location context in general mode (provider=${provider})`, async () => {
        const { app, multiOpenAI, claudeService, geminiService } =
          buildAiChatApp();
        await postJSON(app, "/api/ai/chat", {
          message: "Tell me about cats",
          provider,
          generalMode: true,
        });

        const systemPrompts: string[] = [
          ...multiOpenAI.calls.map(
            (c) =>
              c.messages.find((m: any) => m.role === "system")?.content ?? "",
          ),
          ...claudeService.calls.map((c) => c.systemPrompt ?? ""),
          ...geminiService.calls.map((c) => c.systemPrompt ?? ""),
        ];

        assert.ok(
          systemPrompts.length > 0,
          "expected at least one system prompt",
        );
        for (const prompt of systemPrompts) {
          assert.doesNotMatch(
            prompt,
            /real estate|Acme Realty|Omaha|Downtown|Old Market/i,
            `general-mode prompt leaked context: ${prompt}`,
          );
          assert.match(prompt, /helpful AI assistant/i);
        }
      });

      it(`includes real-estate context when generalMode=false (provider=${provider})`, async () => {
        const { app, multiOpenAI, claudeService, geminiService } =
          buildAiChatApp();
        await postJSON(app, "/api/ai/chat", {
          message: "Tell me about my market",
          provider,
          generalMode: false,
        });

        const systemPrompts: string[] = [
          ...multiOpenAI.calls.map(
            (c) =>
              c.messages.find((m: any) => m.role === "system")?.content ?? "",
          ),
          ...claudeService.calls.map((c) => c.systemPrompt ?? ""),
          ...geminiService.calls.map((c) => c.systemPrompt ?? ""),
        ];

        assert.ok(systemPrompts.length > 0);
        for (const prompt of systemPrompts) {
          assert.match(prompt, /real estate/i);
        }
      });
    }
  });

  describe("empty-response retry & final fallback", () => {
    it("retries with simpler prompt and returns the retry content when first response is empty", async () => {
      const queued = makeQueuedFakeMultiOpenAI(["", "retry-content-here"]);
      const { app } = buildAiChatApp({ multiOpenAI: queued });
      const res = await postJSON(app, "/api/ai/chat", {
        message: "What is the meaning of life?",
        provider: "openai",
        generalMode: false,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.message, "retry-content-here");
      assert.equal(queued.calls.length, 2, "must retry exactly once");

      const firstSystem = queued.calls[0].messages.find(
        (m: any) => m.role === "system",
      )?.content;
      const retrySystem = queued.calls[1].messages.find(
        (m: any) => m.role === "system",
      )?.content;
      assert.match(firstSystem, /Creating social media posts/);
      assert.equal(
        retrySystem,
        "You are a helpful assistant for real estate professionals. Be concise and helpful.",
      );
      const retryUser = queued.calls[1].messages.find(
        (m: any) => m.role === "user",
      );
      assert.equal(retryUser.content, "What is the meaning of life?");
    });

    it("uses generic simpler retry prompt when generalMode=true", async () => {
      const queued = makeQueuedFakeMultiOpenAI(["", "general-retry"]);
      const { app } = buildAiChatApp({ multiOpenAI: queued });
      const res = await postJSON(app, "/api/ai/chat", {
        message: "Tell me a joke",
        provider: "openai",
        generalMode: true,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.message, "general-retry");
      assert.equal(queued.calls.length, 2);
      const retrySystem = queued.calls[1].messages.find(
        (m: any) => m.role === "system",
      )?.content;
      assert.equal(
        retrySystem,
        "You are a helpful assistant. Be concise and helpful.",
      );
    });

    it("returns the canned fallback message when both responses are empty", async () => {
      const queued = makeQueuedFakeMultiOpenAI(["", ""]);
      const { app } = buildAiChatApp({ multiOpenAI: queued });
      const res = await postJSON(app, "/api/ai/chat", {
        message: "Hello?",
        provider: "openai",
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.message, FALLBACK_MESSAGE);
      assert.equal(queued.calls.length, 2);
    });

    it("treats whitespace-only responses as empty and falls through to the canned message", async () => {
      const queued = makeQueuedFakeMultiOpenAI(["   ", "\n\t"]);
      const { app } = buildAiChatApp({ multiOpenAI: queued });
      const res = await postJSON(app, "/api/ai/chat", {
        message: "Hello?",
        provider: "openai",
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.message, FALLBACK_MESSAGE);
      assert.equal(queued.calls.length, 2);
    });
  });
});

describe("/api/ai-assistant/chat handler", () => {
  it("routes text-only messages to Claude when provider=claude", async () => {
    const { app, claudeService, multiOpenAI } = buildAssistantApp();
    const res = await postWithFiles(
      app,
      "/api/ai-assistant/chat",
      { message: "Hello Claude", provider: "claude" },
      [],
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.assistantMessage.content, "claude: Hello Claude");
    assert.equal(claudeService.calls.length, 1);
    assert.equal(multiOpenAI.calls.length, 0);
  });

  it("routes text-only messages to Gemini when provider=gemini", async () => {
    const { app, geminiService, multiOpenAI } = buildAssistantApp();
    const res = await postWithFiles(
      app,
      "/api/ai-assistant/chat",
      { message: "Hi Gemini", provider: "gemini" },
      [],
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.assistantMessage.content, "gemini: Hi Gemini");
    assert.equal(geminiService.calls.length, 1);
    assert.equal(multiOpenAI.calls.length, 0);
  });

  it("routes text-only messages to OpenAI when provider=openai", async () => {
    const { app, claudeService, geminiService, multiOpenAI } =
      buildAssistantApp();
    const res = await postWithFiles(
      app,
      "/api/ai-assistant/chat",
      { message: "Hi GPT", provider: "openai" },
      [],
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.assistantMessage.content, "vision-or-text-default");
    assert.equal(multiOpenAI.calls.length, 1);
    assert.equal(multiOpenAI.calls[0].kind, "content");
    assert.equal(claudeService.calls.length, 0);
    assert.equal(geminiService.calls.length, 0);
  });

  it("routes text-only messages to OpenAI when provider=auto", async () => {
    const { app, multiOpenAI } = buildAssistantApp();
    const res = await postWithFiles(
      app,
      "/api/ai-assistant/chat",
      { message: "Hi", provider: "auto" },
      [],
    );
    assert.equal(res.status, 200);
    assert.equal(multiOpenAI.calls.length, 1);
    assert.equal(multiOpenAI.calls[0].kind, "content");
  });

  it("uses Claude native vision when provider=claude with images", async () => {
    const { app, multiOpenAI, claudeService } = buildAssistantApp();
    const fakeFile: any = {
      buffer: Buffer.from("fake"),
      originalname: "photo.png",
      mimetype: "image/png",
    };
    const res = await postWithFiles(
      app,
      "/api/ai-assistant/chat",
      { message: "Describe this", provider: "claude" },
      [fakeFile],
    );
    assert.equal(res.status, 200);
    assert.equal(claudeService.calls.length, 1, "Claude must be invoked");
    assert.equal(
      claudeService.calls[0].images?.length,
      1,
      "Claude must receive image inputs",
    );
    assert.equal(
      claudeService.calls[0].images?.[0].mediaType,
      "image/png",
    );
    assert.equal(
      multiOpenAI.calls.length,
      0,
      "GPT-4o must not be called when Claude vision succeeds",
    );
  });

  it("falls back to GPT-4o vision when Claude vision fails", async () => {
    const failingClaude: ChatService & {
      calls: Array<{ message: string; systemPrompt?: string; images?: any[] }>;
    } = {
      calls: [],
      async chat(message, _history, systemPrompt, images) {
        this.calls.push({ message, systemPrompt, images });
        return { success: false, error: "claude vision boom" };
      },
    };
    const { app, multiOpenAI } = buildAssistantApp({
      loadAnthropic: async () => ({ anthropicService: failingClaude }),
    });
    const fakeFile: any = {
      buffer: Buffer.from("fake"),
      originalname: "photo.png",
      mimetype: "image/png",
    };
    const res = await postWithFiles(
      app,
      "/api/ai-assistant/chat",
      { message: "Describe this", provider: "claude" },
      [fakeFile],
    );
    assert.equal(res.status, 200);
    assert.equal(failingClaude.calls.length, 1);
    assert.equal(multiOpenAI.calls.length, 1);
    assert.equal(multiOpenAI.calls[0].kind, "vision");
    const userMsg = multiOpenAI.calls[0].messages.find(
      (m: any) => m.role === "user",
    );
    assert.ok(Array.isArray(userMsg.content));
    assert.ok(
      userMsg.content.some((p: any) => p.type === "image_url"),
      "fallback vision request must include image_url part",
    );
  });

  it("uses Gemini native vision when provider=gemini with images", async () => {
    const { app, multiOpenAI, geminiService } = buildAssistantApp();
    const fakeFile: any = {
      buffer: Buffer.from("fake"),
      originalname: "photo.jpg",
      mimetype: "image/jpeg",
    };
    const res = await postWithFiles(
      app,
      "/api/ai-assistant/chat",
      { message: "What's in this picture?", provider: "gemini" },
      [fakeFile],
    );
    assert.equal(res.status, 200);
    assert.equal(geminiService.calls.length, 1);
    assert.equal(geminiService.calls[0].images?.length, 1);
    assert.equal(geminiService.calls[0].images?.[0].mediaType, "image/jpeg");
    assert.equal(multiOpenAI.calls.length, 0);
  });

  it("falls back to GPT-4o vision when Gemini vision fails", async () => {
    const failingGemini: ChatService & {
      calls: Array<{ message: string; systemPrompt?: string; images?: any[] }>;
    } = {
      calls: [],
      async chat(message, _history, systemPrompt, images) {
        this.calls.push({ message, systemPrompt, images });
        return { success: false, error: "gemini vision boom" };
      },
    };
    const { app, multiOpenAI } = buildAssistantApp({
      loadGemini: async () => ({ geminiService: failingGemini }),
    });
    const fakeFile: any = {
      buffer: Buffer.from("fake"),
      originalname: "photo.jpg",
      mimetype: "image/jpeg",
    };
    const res = await postWithFiles(
      app,
      "/api/ai-assistant/chat",
      { message: "What's in this picture?", provider: "gemini" },
      [fakeFile],
    );
    assert.equal(res.status, 200);
    assert.equal(failingGemini.calls.length, 1);
    assert.equal(multiOpenAI.calls.length, 1);
    assert.equal(multiOpenAI.calls[0].kind, "vision");
  });

  for (const provider of ["openai", "claude", "gemini", "auto"]) {
    it(`uses generic system prompt in general mode (provider=${provider})`, async () => {
      const { app, multiOpenAI, claudeService, geminiService } =
        buildAssistantApp();
      await postWithFiles(
        app,
        "/api/ai-assistant/chat",
        {
          message: "Help me bake a cake",
          provider,
          generalMode: true,
        },
        [],
      );

      const prompts: string[] = [
        ...multiOpenAI.calls.map(
          (c) =>
            c.messages.find((m: any) => m.role === "system")?.content ?? "",
        ),
        ...claudeService.calls.map((c) => c.systemPrompt ?? ""),
        ...geminiService.calls.map((c) => c.systemPrompt ?? ""),
      ];
      assert.ok(prompts.length > 0);
      for (const p of prompts) {
        assert.doesNotMatch(
          p,
          /iMakePage|real estate|My Golden Brick|HeyGen|Kling/i,
          `general-mode prompt leaked context: ${p}`,
        );
        assert.match(p, /helpful AI assistant/i);
      }
    });

    it(`uses real-estate system prompt when generalMode=false (provider=${provider})`, async () => {
      const { app, multiOpenAI, claudeService, geminiService } =
        buildAssistantApp();
      await postWithFiles(
        app,
        "/api/ai-assistant/chat",
        { message: "Help me list a property", provider, generalMode: false },
        [],
      );

      const prompts: string[] = [
        ...multiOpenAI.calls.map(
          (c) =>
            c.messages.find((m: any) => m.role === "system")?.content ?? "",
        ),
        ...claudeService.calls.map((c) => c.systemPrompt ?? ""),
        ...geminiService.calls.map((c) => c.systemPrompt ?? ""),
      ];
      assert.ok(prompts.length > 0);
      for (const p of prompts) {
        assert.match(p, /iMakePage|real estate/i);
      }
    });
  }

  it("returns the canned fallback when multiOpenAI.makeRequest throws", async () => {
    const throwingMultiOpenAI: AiAssistantDeps["multiOpenAI"] & {
      calls: Call[];
    } = {
      calls: [],
      async makeRequest(kind, _fn) {
        this.calls.push({ kind, messages: [] });
        throw new Error("openai exploded mid-conversation");
      },
    };
    const { app, db } = buildAssistantApp({
      multiOpenAI: throwingMultiOpenAI,
    });
    const res = await postWithFiles(
      app,
      "/api/ai-assistant/chat",
      { message: "Hi GPT", provider: "openai" },
      [],
    );
    assert.equal(res.status, 200);
    assert.equal(throwingMultiOpenAI.calls.length, 1);
    assert.match(
      res.body.assistantMessage.content,
      /I apologize, but I'm having trouble processing your request right now\. Please try again later\./,
    );
    const persisted = (db.inserts as any[]).find(
      (row) => row.role === "assistant",
    );
    assert.ok(persisted, "assistant message must be persisted");
    assert.equal(
      persisted.content,
      res.body.assistantMessage.content,
      "persisted assistant content must match returned fallback",
    );
  });

  it("returns 400 when both message and files are missing", async () => {
    const { app } = buildAssistantApp();
    const res = await postWithFiles(
      app,
      "/api/ai-assistant/chat",
      { provider: "openai" },
      [],
    );
    assert.equal(res.status, 400);
  });

  describe("empty-response retry & final fallback (text path)", () => {
    it("retries with simpler prompt and returns the retry content when first response is empty", async () => {
      const queued = makeQueuedFakeMultiOpenAI(["", "text-retry-content"]);
      const { app } = buildAssistantApp({ multiOpenAI: queued });
      const res = await postWithFiles(
        app,
        "/api/ai-assistant/chat",
        { message: "Help me", provider: "openai", generalMode: false },
        [],
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.assistantMessage.content, "text-retry-content");
      assert.equal(queued.calls.length, 2);
      const retrySystem = queued.calls[1].messages.find(
        (m: any) => m.role === "system",
      )?.content;
      assert.equal(
        retrySystem,
        "You are a helpful real estate assistant. Be concise.",
      );
    });

    it("uses generic simpler retry prompt when generalMode=true", async () => {
      const queued = makeQueuedFakeMultiOpenAI(["", "text-retry-generic"]);
      const { app } = buildAssistantApp({ multiOpenAI: queued });
      const res = await postWithFiles(
        app,
        "/api/ai-assistant/chat",
        { message: "Help me", provider: "openai", generalMode: true },
        [],
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.assistantMessage.content, "text-retry-generic");
      assert.equal(queued.calls.length, 2);
      const retrySystem = queued.calls[1].messages.find(
        (m: any) => m.role === "system",
      )?.content;
      assert.equal(retrySystem, "You are a helpful assistant. Be concise.");
    });

    it("returns the canned fallback message when both responses are empty", async () => {
      const queued = makeQueuedFakeMultiOpenAI(["", ""]);
      const { app } = buildAssistantApp({ multiOpenAI: queued });
      const res = await postWithFiles(
        app,
        "/api/ai-assistant/chat",
        { message: "Help me", provider: "openai" },
        [],
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.assistantMessage.content, FALLBACK_MESSAGE);
      assert.equal(queued.calls.length, 2);
    });
  });

  describe("empty-response retry & final fallback (vision path)", () => {
    const fakeFile: any = {
      buffer: Buffer.from("fake"),
      originalname: "photo.png",
      mimetype: "image/png",
    };

    it("retries with simpler prompt and returns the retry content when first vision response is empty", async () => {
      const queued = makeQueuedFakeMultiOpenAI(["", "vision-retry-content"]);
      const { app } = buildAssistantApp({ multiOpenAI: queued });
      const res = await postWithFiles(
        app,
        "/api/ai-assistant/chat",
        { message: "Describe this", provider: "openai", generalMode: false },
        [fakeFile],
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.assistantMessage.content, "vision-retry-content");
      assert.equal(queued.calls.length, 2);
      assert.equal(queued.calls[0].kind, "vision");
      assert.equal(queued.calls[1].kind, "content");
      const retrySystem = queued.calls[1].messages.find(
        (m: any) => m.role === "system",
      )?.content;
      assert.equal(
        retrySystem,
        "You are a helpful real estate AI assistant. Be concise.",
      );
      const retryUser = queued.calls[1].messages.find(
        (m: any) => m.role === "user",
      );
      assert.equal(retryUser.content, "Describe this");
    });

    it("uses generic simpler retry prompt and falls back to the default user prompt when message is empty", async () => {
      const queued = makeQueuedFakeMultiOpenAI(["", "vision-retry-generic"]);
      const { app } = buildAssistantApp({ multiOpenAI: queued });
      const res = await postWithFiles(
        app,
        "/api/ai-assistant/chat",
        { provider: "openai", generalMode: true },
        [fakeFile],
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.assistantMessage.content, "vision-retry-generic");
      assert.equal(queued.calls.length, 2);
      const retrySystem = queued.calls[1].messages.find(
        (m: any) => m.role === "system",
      )?.content;
      assert.equal(retrySystem, "You are a helpful AI assistant. Be concise.");
      const retryUser = queued.calls[1].messages.find(
        (m: any) => m.role === "user",
      );
      assert.equal(
        retryUser.content,
        "Please describe what you see in the uploaded images.",
      );
    });

    it("returns the canned fallback message when both vision responses are empty", async () => {
      const queued = makeQueuedFakeMultiOpenAI(["", ""]);
      const { app } = buildAssistantApp({ multiOpenAI: queued });
      const res = await postWithFiles(
        app,
        "/api/ai-assistant/chat",
        { message: "Describe this", provider: "openai" },
        [fakeFile],
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.assistantMessage.content, FALLBACK_MESSAGE);
      assert.equal(queued.calls.length, 2);
    });
  });
});
