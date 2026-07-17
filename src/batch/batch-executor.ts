import { randomBytes } from 'node:crypto';
import type { Context } from '../context.js';
import { Response } from '../response.js';
import type { ExpectationOptions } from '../schemas/expectation.js';
import { mergeExpectations } from '../schemas/expectation.js';
import type { Tool } from '../tools/tool.js';
import type {
  BatchContext,
  BatchExecuteOptions,
  BatchResult,
  BatchStep,
  StepResult,
} from '../types/batch.js';
import { getErrorMessage } from '../utils/common-formatters.js';
import { batchExecutorDebug } from '../utils/log.js';

const DISALLOWED_BATCH_TARGETS = new Set([
  'browser_batch_execute',
  'browser_tools',
  'browser_query',
  'browser_execute',
]);

export interface SerializedResponse {
  content: Array<{ type: string; [key: string]: unknown }>;
  isError?: boolean;
}

export class BatchExecutor {
  private readonly toolRegistry: Map<string, Tool>;
  private readonly context: Context;
  private currentBatchContext?: BatchContext;

  constructor(context: Context, toolRegistry: Map<string, Tool>) {
    this.context = context;
    this.toolRegistry = toolRegistry;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  validateAllSteps(steps: BatchStep[]): void {
    for (const [index, step] of steps.entries()) {
      if (DISALLOWED_BATCH_TARGETS.has(step.tool)) {
        throw new Error(
          `Tool cannot be nested in batch execution: ${step.tool}`
        );
      }
      const tool = this.toolRegistry.get(step.tool);
      if (!tool) {
        const availableTools = Array.from(this.toolRegistry.keys())
          .filter(
            (name) =>
              name.startsWith('browser_') && !DISALLOWED_BATCH_TARGETS.has(name)
          )
          .sort((left, right) => left.localeCompare(right))
          .join(',');
        throw new Error(
          `Unknown tool: "${step.tool}" at step ${index}. Available tools: ${availableTools}`
        );
      }
      const parseResult = tool.schema.inputSchema.safeParse({
        ...step.arguments,
        expectation: step.expectation,
      });
      if (!parseResult.success) {
        throw new Error(
          `Invalid arguments for ${step.tool} at step ${index}: ${parseResult.error.message}`
        );
      }
    }
  }

  async execute(
    options: BatchExecuteOptions,
    signal?: AbortSignal
  ): Promise<BatchResult> {
    const results: StepResult[] = [];
    const startTime = Date.now();
    let stopReason: BatchResult['stopReason'] = 'completed';
    this.currentBatchContext = {
      batchId: this.generateBatchId(),
      startTime,
    };

    batchExecutorDebug(
      `Starting batch execution ${this.currentBatchContext.batchId} with ${options.steps.length} steps`
    );
    this.validateAllSteps(options.steps);

    const executeSequentially = async (index: number): Promise<void> => {
      if (index >= options.steps.length || stopReason === 'error') {
        return;
      }
      signal?.throwIfAborted();
      const step = options.steps[index];
      const stepStartTime = Date.now();
      try {
        const batchContext = this.currentBatchContext;
        if (!batchContext) {
          throw new Error('Batch context is not initialized');
        }
        batchContext.currentStepIndex = index;
        const result = await this.executeStep(
          step,
          options.globalExpectation,
          batchContext,
          signal
        );
        results.push({
          stepIndex: index,
          toolName: step.tool,
          success: true,
          result,
          executionTimeMs: Date.now() - stepStartTime,
        });
      } catch (error) {
        results.push({
          stepIndex: index,
          toolName: step.tool,
          success: false,
          error: getErrorMessage(error),
          executionTimeMs: Date.now() - stepStartTime,
        });
        if (!step.continueOnError || options.stopOnFirstError) {
          stopReason = 'error';
          return;
        }
      }
      await executeSequentially(index + 1);
    };
    await executeSequentially(0);

    return {
      steps: results,
      totalSteps: options.steps.length,
      successfulSteps: results.filter((result) => result.success).length,
      failedSteps: results.filter((result) => !result.success).length,
      totalExecutionTimeMs: Date.now() - startTime,
      stopReason,
    };
  }

  async executeStep(
    step: BatchStep,
    globalExpectation?: ExpectationOptions,
    batchContext?: BatchContext,
    signal?: AbortSignal
  ): Promise<unknown> {
    signal?.throwIfAborted();
    const tool = this.toolRegistry.get(step.tool);
    if (!tool) {
      throw new Error(`Unknown tool: ${step.tool}`);
    }

    const mergedExpectation = this.mergeStepExpectations(
      step.tool,
      globalExpectation,
      step.expectation
    );
    const argsWithExpectation = {
      ...step.arguments,
      expectation: mergedExpectation,
    };
    const previousBatchContext = this.context.batchContext;
    this.context.batchContext = batchContext;

    try {
      const response = new Response(
        this.context,
        step.tool,
        argsWithExpectation,
        mergedExpectation
      );
      batchExecutorDebug(`Executing batch step: ${step.tool}`);
      const rawResponse = await tool.handle(
        this.context,
        argsWithExpectation,
        response,
        signal
      );
      if (rawResponse) {
        return rawResponse;
      }
      await response.finish();
      batchExecutorDebug(`Batch step ${step.tool} completed`);
      return response.serialize();
    } finally {
      this.context.batchContext = previousBatchContext;
    }
  }

  private mergeStepExpectations(
    toolName: string,
    globalExpectation?: ExpectationOptions,
    stepExpectation?: ExpectationOptions
  ): ExpectationOptions {
    let merged = mergeExpectations(toolName);
    if (globalExpectation) {
      merged = mergeExpectations(toolName, {
        ...merged,
        ...globalExpectation,
      });
    }
    if (stepExpectation) {
      merged = mergeExpectations(toolName, {
        ...merged,
        ...stepExpectation,
      });
    }
    return merged;
  }
}
