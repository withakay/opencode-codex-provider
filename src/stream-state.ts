import { LanguageModelV2FinishReason, LanguageModelV2StreamPart } from "@ai-sdk/provider";
import { CodexMCPClient } from "./codexClient";

type StreamType = "text" | "exec" | "reasoning";

export class StreamState {
  private finished = false;
  private streams: Map<StreamType, boolean> = new Map();
  private lastReasoningChunk = "";
  private lastReasoningNormalized = "";
  public reasoningDeltaSeen = false;

  constructor(
    private readonly controller: ReadableStreamDefaultController<LanguageModelV2StreamPart>,
    private readonly client: CodexMCPClient,
    private readonly includeReasoning: boolean,
  ) {}

  public finish(reason: LanguageModelV2FinishReason, error?: Error) {
    if (this.finished) return;
    this.finished = true;

    if (error) {
      this.controller.enqueue({ type: "error", error });
    }

    this.streams.forEach((_started, type) => {
      this.endStream(type);
    });

    this.controller.enqueue({
      type: "finish",
      finishReason: reason,
      usage: {
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined,
      },
    });

    this.controller.close();
    this.client.close();
  }

  public ensureStreamStart(type: StreamType) {
    if (!this.streams.has(type)) {
      this.streams.set(type, true);
      this.controller.enqueue({ type: "text-start", id: `codex-${type}` });
    }
  }

  private endStream(type: StreamType) {
    if (this.streams.has(type)) {
      this.controller.enqueue({ type: "text-end", id: `codex-${type}` });
      this.streams.delete(type);
    }
  }

  private normalizeReasoning(value: string) {
    return value.trim().replace(/\*/g, "").replace(/\s+/g, " ");
  }

  public pushReasoning(chunk: string, source?: string) {
    if (!chunk || !this.includeReasoning) return;
    const normalized = this.normalizeReasoning(chunk);
    if (!normalized && chunk === "\n" && this.lastReasoningChunk === "\n") {
      return;
    }
    if (normalized && normalized === this.lastReasoningNormalized) {
      return;
    }
    if (!normalized && this.lastReasoningChunk === chunk) {
      return;
    }
    this.reasoningDeltaSeen = true;
    this.pushDelta("reasoning", chunk, source);
    this.lastReasoningChunk = chunk;
    if (normalized) {
      this.lastReasoningNormalized = normalized;
    }
  }

  public pushDelta(type: StreamType, delta: string, source?: string) {
    if (!delta) return;
    if (type === "reasoning" && !this.includeReasoning) return;

    this.ensureStreamStart(type);
    this.controller.enqueue({ type: "text-delta", id: `codex-${type}`, delta });
  }
}