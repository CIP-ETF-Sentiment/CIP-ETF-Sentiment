import { NextRequest, NextResponse } from "next/server";
import { ApiError, GoogleGenAI, createPartFromFunctionResponse, type Content } from "@google/genai";
import { callTool, toolDeclarations } from "@/app/lib/agent-tools.server";

export const runtime = "nodejs";

const SYSTEM_INSTRUCTION = `你是「CIP 小樹洞」ETF 關鍵字熱度儀表板的助理。
你可以使用工具查詢五大類 ETF（主動式、債券型、市值型、產業型、高股息）的 Google Trends
搜尋熱度 Z-score 排行與週趨勢資料，來回答使用者關於「哪些 ETF 關鍵字最近很熱門」的問題。
回答時請使用繁體中文，簡潔明確，並在適當時候引用具體數字。若使用者的問題與 ETF 熱度資料
無關，禮貌地說明你只能回答這個儀表板相關的問題。`;

const MAX_TOOL_ROUNDS = 6;

function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 503 || error.status === 429;
  }
  const message = error instanceof Error ? error.message : "";
  return message.includes("UNAVAILABLE") || message.includes("RESOURCE_EXHAUSTED");
}

// Gemini occasionally returns transient 503 (overloaded) / 429 (rate limited)
// errors — retry with exponential backoff before giving up.
async function generateWithRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && isRetryable(error)) {
      console.warn(`[Gemini API] 遇到暫時性錯誤，${delayMs}ms 後重試... 剩餘重試次數: ${retries}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return generateWithRetry(fn, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "伺服器尚未設定 GEMINI_API_KEY，請在 frontend/.env.local 填入金鑰" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const message = body?.message;
  const history: Content[] = Array.isArray(body?.history) ? body.history : [];

  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "缺少 message" }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

  const chat = ai.chats.create({
    model,
    history,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2,
      tools: [{ functionDeclarations: toolDeclarations }],
    },
  });

  try {
    let response = await generateWithRetry(() => chat.sendMessage({ message }));
    let rounds = 0;

    while (response.functionCalls && response.functionCalls.length > 0 && rounds < MAX_TOOL_ROUNDS) {
      const parts = await Promise.all(
        response.functionCalls.map(async (call) => {
          const output = await callTool(call.name ?? "", call.args ?? {});
          return createPartFromFunctionResponse(call.id ?? call.name ?? "", call.name ?? "", { result: output });
        })
      );
      response = await generateWithRetry(() => chat.sendMessage({ message: parts }));
      rounds += 1;
    }

    return NextResponse.json({
      reply: response.text ?? "",
      history: chat.getHistory(),
    });
  } catch (err) {
    console.error("Gemini agent error:", err);
    if (err instanceof ApiError && err.status === 503) {
      return NextResponse.json(
        { error: "Gemini 目前需求量過大，請稍後再試一次（Google 那邊暫時忙碌，不是你的問題）" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "AI 服務暫時無法回應，請稍後再試" }, { status: 502 });
  }
}
