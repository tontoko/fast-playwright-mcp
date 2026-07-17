import type { Context } from '../context.js';
import type { Response } from '../response.js';
import type {
  BatchExecuteOptions,
  BatchResult,
  StepResult,
} from '../types/batch.js';
import { batchExecuteSchema } from '../types/batch.js';
import { createBatchErrorHandler } from '../utils/error-handler-middleware.js';
import { defineTool } from './tool.js';

export const batchExecuteTool = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_batch_execute',
    title: 'Batch Execute Browser Actions',
    description:
      'Execute multiple registered browser actions in sequence with one response.',
    inputSchema: batchExecuteSchema,
    type: 'destructive',
  },
  handle: async (context, params: BatchExecuteOptions, response, signal) => {
    try {
      const batchExecutor = getBatchExecutorOrError(context, response);
      if (!batchExecutor) {
        return;
      }
      const result = await batchExecutor.execute(params, signal);
      processExecutionResult(result, response);
    } catch (error) {
      const errorHandler = createBatchErrorHandler('BatchExecute');
      response.addError(errorHandler(error as Error).message);
    }
  },
});

function getBatchExecutorOrError(context: Context, response: Response) {
  const batchExecutor = context.getBatchExecutor();
  if (!batchExecutor) {
    response.addError(
      'Batch executor not available. Ensure the browser context is initialized.'
    );
    return null;
  }
  return batchExecutor;
}

function processExecutionResult(result: BatchResult, response: Response): void {
  response.addResult(formatBatchResult(result));
  if (result.steps.length > 0) {
    response.addResult('');
    response.addResult('### Step Details');
    for (const stepResult of result.steps) {
      addStepResult(stepResult, response);
    }
  }
  addFinalStateIfNeeded(result, response);
  if (result.stopReason === 'error' || result.failedSteps > 0) {
    response.addError(
      `Batch execution ${
        result.stopReason === 'error'
          ? 'stopped due to error'
          : 'completed with failures'
      }`
    );
  }
}

function addStepResult(stepResult: StepResult, response: Response): void {
  response.addResult(
    `${stepResult.success ? '✅' : '❌'} Step ${stepResult.stepIndex + 1}: ${
      stepResult.toolName
    } (${stepResult.executionTimeMs}ms)`
  );
  if (stepResult.success && stepResult.result) {
    const text = extractText(stepResult.result);
    if (text) {
      const lines = text.split('\n');
      response.addResult(`   ${lines.slice(0, 3).join('\n   ')}`);
      if (lines.length > 3) {
        response.addResult('   ...');
      }
    }
  } else if (stepResult.error) {
    response.addResult(`   Error: ${stepResult.error}`);
  }
}

function addFinalStateIfNeeded(result: BatchResult, response: Response): void {
  if (result.stopReason !== 'completed') {
    return;
  }
  const lastSuccessful = result.steps
    .filter(
      (step) => step.success && step.result && !isErrorResult(step.result)
    )
    .at(-1);
  const finalContent = lastSuccessful
    ? extractText(lastSuccessful.result)
    : undefined;
  if (finalContent) {
    response.addResult('');
    response.addResult('### Final State');
    response.addResult(finalContent);
  }
}

function extractText(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || !('content' in value)) {
    return;
  }
  const content = value.content;
  if (!Array.isArray(content)) {
    return;
  }
  const first = content[0];
  return first && typeof first === 'object' && 'text' in first
    ? String(first.text)
    : undefined;
}

function isErrorResult(value: unknown): boolean {
  return Boolean(
    value && typeof value === 'object' && 'isError' in value && value.isError
  );
}

function formatBatchResult(result: BatchResult): string {
  return [
    '### Batch Execution Summary',
    `- Status: ${getStatusDisplay(result.stopReason)}`,
    `- Total Steps: ${result.totalSteps}`,
    `- Successful: ${result.successfulSteps}`,
    `- Failed: ${result.failedSteps}`,
    `- Total Time: ${result.totalExecutionTimeMs}ms`,
    ...(result.stopReason === 'error'
      ? ['- Note: Execution stopped early due to error']
      : []),
  ].join('\n');
}

function getStatusDisplay(stopReason: BatchResult['stopReason']): string {
  switch (stopReason) {
    case 'completed':
      return '✅ Completed';
    case 'error':
      return '❌ Stopped on Error';
    case 'stopped':
      return '⏹️ Stopped';
    default:
      return '❓ Unknown';
  }
}
