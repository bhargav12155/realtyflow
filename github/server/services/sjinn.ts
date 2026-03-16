const SJINN_BASE_URL = "https://sjinn.ai/api/un-api";

const SJINN_TEMPLATE_IDS: Record<string, string | undefined> = {
  auto: undefined,
  veo3: "9b371ec6-09a2-43d5-97c2-0aea79a12371",
  sora2: "de733710-fc66-4a2b-b53c-27b52c6c6f5e",
};

export type SJinnModel = "auto" | "veo3" | "sora2";
export type SJinnStatus = "pending" | "processing" | "completed" | "failed";

export interface SJinnTaskResult {
  chatId: string;
  projectId: string;
}

export interface SJinnStatusResult {
  status: SJinnStatus;
  videoUrl?: string;
  error?: string;
}

function getApiKey(): string {
  const key = process.env.SJINN_API_KEY;
  if (!key) {
    throw new Error("SJINN_API_KEY is not configured. Please add it in Settings.");
  }
  return key;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  };
}

export async function createVideoTask(
  prompt: string,
  model: SJinnModel = "auto"
): Promise<SJinnTaskResult> {
  const body: Record<string, string> = {
    message: prompt,
  };

  const templateId = SJINN_TEMPLATE_IDS[model];
  if (templateId) {
    body.template_id = templateId;
  }

  const response = await fetch(`${SJINN_BASE_URL}/create_agent_task`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`SJinn API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  console.log("[SJinn] create_agent_task response:", JSON.stringify(data));

  if (!data.success) {
    throw new Error(`SJinn task creation failed: ${data.errorMsg || "Unknown error"}`);
  }

  return {
    chatId: data.data.chat_id,
    projectId: data.data.project_id,
  };
}

export async function getTaskStatus(chatId: string): Promise<SJinnStatusResult> {
  const response = await fetch(`${SJINN_BASE_URL}/query_agent_task_status`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      chat_id: chatId,
      tool_names: ["ffmpeg_full_compose"],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`SJinn status error ${response.status}: ${text}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(`SJinn status query failed: ${data.errorMsg || "Unknown error"}`);
  }

  const taskData = data.data;

  if (taskData.status === 2) {
    return { status: "processing" };
  }

  const toolResults: Array<{ name: string; result: string[] }> = taskData.tool_results || [];
  const composeResult = toolResults.find((r) => r.name === "ffmpeg_full_compose");

  if (composeResult && composeResult.result && composeResult.result.length > 0) {
    return {
      status: "completed",
      videoUrl: composeResult.result[0],
    };
  }

  if (taskData.status === 1 && toolResults.length === 0) {
    return { status: "pending" };
  }

  return { status: "completed" };
}

export const sjinnService = {
  createVideoTask,
  getTaskStatus,
};
