const OPENAI_BASE_URL = "https://api.openai.com/v1";
const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "gpt-4o-mini";

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: { 
      role: string; 
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface StructuredDraftResponse {
  intent: string;
  confidence: number;
  needsHuman: boolean;
  missingFields: string[];
  draftReply: string;
  citations: Array<{ chunkId: string; snippet: string; url?: string }>;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

interface ChatWithToolsResponse {
  content: string | null;
  toolCalls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class AiOpenAIService {
  private getApiKey(): string {
    const key = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error("OpenAI API key not configured. Set AI_INTEGRATIONS_OPENAI_API_KEY or OPENAI_API_KEY.");
    }
    return key;
  }

  async createEmbedding(text: string): Promise<{ embedding: number[]; tokensUsed: number }> {
    const apiKey = this.getApiKey();
    
    const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding error: ${response.status} - ${error}`);
    }

    const data: EmbeddingResponse = await response.json();
    return {
      embedding: data.data[0].embedding,
      tokensUsed: data.usage.total_tokens,
    };
  }

  async createEmbeddings(texts: string[]): Promise<{ embeddings: number[][]; tokensUsed: number }> {
    if (texts.length === 0) return { embeddings: [], tokensUsed: 0 };

    const apiKey = this.getApiKey();
    
    const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embeddings error: ${response.status} - ${error}`);
    }

    const data: EmbeddingResponse = await response.json();
    const embeddings = data.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
    
    return {
      embeddings,
      tokensUsed: data.usage.total_tokens,
    };
  }

  async chat(
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ): Promise<{
    content: string;
    tokensIn: number;
    tokensOut: number;
    finishReason: string;
  }> {
    const apiKey = this.getApiKey();
    const model = options?.model ?? CHAT_MODEL;

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI chat error: ${response.status} - ${error}`);
    }

    const data: ChatCompletionResponse = await response.json();
    const choice = data.choices[0];

    return {
      content: choice.message.content || "",
      tokensIn: data.usage.prompt_tokens,
      tokensOut: data.usage.completion_tokens,
      finishReason: choice.finish_reason,
    };
  }

  async chatWithTools(
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    tools: Array<{ type: "function"; function: ToolDefinition }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ): Promise<ChatWithToolsResponse> {
    const apiKey = this.getApiKey();
    const model = options?.model ?? CHAT_MODEL;

    const chatMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const requestBody: Record<string, any> = {
      model,
      messages: chatMessages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 1024,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = "auto";
    }

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI chat with tools error: ${response.status} - ${error}`);
    }

    const data: ChatCompletionResponse = await response.json();
    const choice = data.choices[0];

    return {
      content: choice.message.content,
      toolCalls: choice.message.tool_calls,
      usage: data.usage,
    };
  }

  async generateDraftReply(
    customerMessage: string,
    relevantChunks: Array<{ id: string; content: string; meta?: { url?: string } }>,
    options?: {
      companyName?: string;
      agentName?: string;
      tone?: string;
    }
  ): Promise<StructuredDraftResponse & { tokensIn: number; tokensOut: number }> {
    const context = relevantChunks
      .map((c, i) => `[Source ${i + 1}]\n${c.content}`)
      .join("\n\n---\n\n");

    const systemPrompt = `You are an AI assistant helping customer service agents draft replies.
Your task is to:
1. Analyze the customer's message to understand their intent
2. Use the provided knowledge base context to draft a helpful response
3. Identify if the query requires human intervention
4. List any missing information needed to fully answer

Company: ${options?.companyName ?? "the company"}
Agent: ${options?.agentName ?? "Support Agent"}
Tone: ${options?.tone ?? "professional and helpful"}

Respond in JSON format:
{
  "intent": "brief description of customer intent",
  "confidence": 0.0-1.0,
  "needsHuman": true/false,
  "missingFields": ["list of missing info if any"],
  "draftReply": "the suggested response",
  "citations": [{"sourceIndex": 1, "snippet": "relevant quote"}]
}

Knowledge Base Context:
${context || "No relevant knowledge base content found."}`;

    const result = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: customerMessage },
      ],
      { temperature: 0.2, maxTokens: 1500 }
    );

    let parsed: StructuredDraftResponse;
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      const raw = JSON.parse(jsonMatch[0]);
      
      parsed = {
        intent: raw.intent ?? "unknown",
        confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0.5)),
        needsHuman: Boolean(raw.needsHuman),
        missingFields: Array.isArray(raw.missingFields) ? raw.missingFields : [],
        draftReply: raw.draftReply ?? "",
        citations: (raw.citations || []).map((c: { sourceIndex?: number; snippet?: string }) => {
          const chunk = relevantChunks[Number(c.sourceIndex ?? 1) - 1];
          return {
            chunkId: chunk?.id ?? "",
            snippet: c.snippet ?? "",
            url: chunk?.meta?.url,
          };
        }),
      };
    } catch (e) {
      parsed = {
        intent: "parse_error",
        confidence: 0,
        needsHuman: true,
        missingFields: [],
        draftReply: result.content,
        citations: [],
      };
    }

    return {
      ...parsed,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    };
  }

  async classifyIntent(
    message: string,
    intents: string[]
  ): Promise<{ intent: string; confidence: number; tokensIn: number; tokensOut: number }> {
    const systemPrompt = `Classify the user message into one of these intents: ${intents.join(", ")}
Respond in JSON: {"intent": "...", "confidence": 0.0-1.0}`;

    const result = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      { temperature: 0, maxTokens: 100 }
    );

    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        intent: parsed.intent ?? "unknown",
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      };
    } catch {
      return {
        intent: "unknown",
        confidence: 0,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      };
    }
  }

  estimateCost(tokensIn: number, tokensOut: number, model: string = CHAT_MODEL): number {
    const pricing: Record<string, { input: number; output: number }> = {
      "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
      "gpt-4o": { input: 0.005, output: 0.015 },
      "text-embedding-3-small": { input: 0.00002, output: 0 },
    };
    const p = pricing[model] ?? pricing["gpt-4o-mini"];
    return (tokensIn / 1000) * p.input + (tokensOut / 1000) * p.output;
  }
}

export const aiOpenAIService = new AiOpenAIService();
