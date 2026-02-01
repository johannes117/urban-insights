import { createServerFn } from "@tanstack/react-start";
import { streamAgent, runAgent, type Message } from "../lib/agent";
import type { UIElement } from "@json-render/core";
import type { NestedUIElement, QueryResult } from "../lib/types";

type StreamTextChunk = { type: "text"; content: string };
type StreamToolStartChunk = {
  type: "tool_start";
  toolCallId: string;
  name: string;
  args: { [x: string]: {} };
};
type StreamToolEndChunk = {
  type: "tool_end";
  toolCallId: string;
  result: {};
};
type StreamDoneChunk = {
  type: "done";
  ui: NestedUIElement | null;
  queryResults: QueryResult[];
};

interface StepData {
  toolCalls?: Array<{ toolName: string; args: Record<string, unknown> }>;
  toolResults?: Array<{ toolName: string; result: unknown }>;
}

function extractUiFromSteps(steps: StepData[]): UIElement | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (!step.toolCalls) continue;
    for (let j = step.toolCalls.length - 1; j >= 0; j--) {
      const tc = step.toolCalls[j];
      if (tc.toolName === "render_ui" && tc.args?.ui) {
        return tc.args.ui as UIElement;
      }
    }
  }
  return null;
}

function extractQueryResultsFromSteps(steps: StepData[]): QueryResult[] {
  const results: QueryResult[] = [];
  for (const step of steps) {
    if (!step.toolResults) continue;
    for (const tr of step.toolResults) {
      if (tr.toolName === "query_dataset") {
        const result = tr.result as {
          success?: boolean;
          resultKey?: string;
          data?: Record<string, unknown>[];
        };
        if (result.success && result.resultKey && result.data) {
          results.push({ resultKey: result.resultKey, data: result.data });
        }
      }
    }
  }
  return results;
}

interface SendMessageInput {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  lgaContext?: string;
}

export interface SendMessageResult {
  success: boolean;
  response: string;
  ui: NestedUIElement | null;
  queryResults: QueryResult[];
}

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((d: SendMessageInput) => d)
  .handler(async ({ data }) => {
    const messages: Message[] = [
      ...(data.history?.map((m) => ({
        role: m.role,
        content: m.content,
      })) ?? []),
      { role: "user" as const, content: data.message },
    ];

    try {
      const result = await runAgent(messages, { lgaContext: data.lgaContext });

      const steps: StepData[] = result.steps.map((step) => ({
        toolCalls: step.toolCalls
          ?.filter((tc): tc is typeof tc & { args: Record<string, unknown> } => "args" in tc)
          .map((tc) => ({
            toolName: tc.toolName,
            args: tc.args as Record<string, unknown>,
          })),
        toolResults: step.toolResults
          ?.filter((tr): tr is typeof tr & { output: unknown } => "output" in tr)
          .map((tr) => ({
            toolName: tr.toolName,
            result: tr.output,
          })),
      }));

      const ui = extractUiFromSteps(steps);
      const queryResults = extractQueryResultsFromSteps(steps);

      return {
        success: true,
        response: result.text || "I've created the visualization for you.",
        ui: (ui as NestedUIElement | null) ?? null,
        queryResults,
      };
    } catch (error) {
      console.error("Agent error:", error);
      return {
        success: false,
        response: "Sorry, I encountered an error processing your request.",
        ui: null,
        queryResults: [],
      };
    }
  });

export const streamMessage = createServerFn({ method: "POST" })
  .inputValidator((d: SendMessageInput) => d)
  .handler(async function* ({ data }) {
    const messages: Message[] = [
      ...(data.history?.map((m) => ({
        role: m.role,
        content: m.content,
      })) ?? []),
      { role: "user" as const, content: data.message },
    ];

    try {
      const result = streamAgent(messages, { lgaContext: data.lgaContext });

      const pendingToolCalls = new Map<
        string,
        { name: string; args: Record<string, unknown> }
      >();
      const collectedSteps: StepData[] = [];
      let currentStep: StepData = {};

      for await (const event of result.fullStream) {
        if (event.type === "text-delta") {
          const text = "text" in event ? event.text : ("delta" in event ? (event as { delta: string }).delta : "");
          if (text) {
            yield { type: "text", content: text } as StreamTextChunk;
          }
        } else if (event.type === "tool-call") {
          const args = "args" in event
            ? (event.args as Record<string, unknown>)
            : "input" in event
              ? (event.input as Record<string, unknown>)
              : {};
          pendingToolCalls.set(event.toolCallId, {
            name: event.toolName,
            args,
          });
          yield {
            type: "tool_start",
            toolCallId: event.toolCallId,
            name: event.toolName,
            args,
          } as StreamToolStartChunk;
          if (!currentStep.toolCalls) currentStep.toolCalls = [];
          currentStep.toolCalls.push({ toolName: event.toolName, args });
        } else if (event.type === "tool-result") {
          const pending = pendingToolCalls.get(event.toolCallId);
          if (pending) {
            pendingToolCalls.delete(event.toolCallId);
          }
          const output = "output" in event ? event.output : undefined;
          yield {
            type: "tool_end",
            toolCallId: event.toolCallId,
            result: output,
          } as StreamToolEndChunk;
          if (!currentStep.toolResults) currentStep.toolResults = [];
          currentStep.toolResults.push({
            toolName: event.toolName,
            result: output,
          });
        } else if (event.type === "finish") {
          if (currentStep.toolCalls || currentStep.toolResults) {
            collectedSteps.push(currentStep);
            currentStep = {};
          }
        }
      }

      if (currentStep.toolCalls || currentStep.toolResults) {
        collectedSteps.push(currentStep);
      }

      const ui = extractUiFromSteps(collectedSteps);
      const queryResults = extractQueryResultsFromSteps(collectedSteps);

      yield {
        type: "done",
        ui: (ui as NestedUIElement | null) ?? null,
        queryResults,
      } as StreamDoneChunk;
    } catch (error) {
      console.error("Agent streaming error:", error);
      yield { type: "done", ui: null, queryResults: [] } as StreamDoneChunk;
    }
  });
