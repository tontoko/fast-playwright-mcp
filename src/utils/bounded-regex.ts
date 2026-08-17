import { Worker } from 'node:worker_threads';

export const REGEX_SEARCH_BUDGET_MS = 1000;
const HOST_TERMINATION_GRACE_MS = 500;

export const REGEX_SEARCH_TIMEOUT_ERROR =
  'Regular expression search exceeded its time budget; simplify the pattern.';

// The matcher runs in a worker so a catastrophic-backtracking pattern over
// untrusted snapshot text (e.g. `^(a+)+$` against a long line) fails this
// one call instead of blocking the process event loop and every MCP request.
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
const start = Date.now();
try {
  const pattern = new RegExp(workerData.source, workerData.flags);
  const matchedLines = [];
  let timedOut = false;
  for (let index = 0; index < workerData.lines.length; index++) {
    if (pattern.test(workerData.lines[index])) {
      matchedLines.push(index);
    }
    if (Date.now() - start > workerData.budgetMs) {
      timedOut = true;
      break;
    }
  }
  if (timedOut) {
    parentPort.postMessage({ timedOut: true });
  } else {
    parentPort.postMessage({ matchedLines });
  }
} catch (error) {
  parentPort.postMessage({
    invalidPattern: error && error.message ? error.message : String(error),
  });
}
parentPort.close();
`;

type WorkerMessage =
  | { matchedLines: number[] }
  | { timedOut: true }
  | { invalidPattern: string };

export async function regexMatchedLineIndices(
  lines: readonly string[],
  source: string,
  flags: string
): Promise<number[]> {
  return await new Promise<number[]>((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true, // NOSONAR
      workerData: { lines, source, flags, budgetMs: REGEX_SEARCH_BUDGET_MS },
    });
    const terminate = () => {
      worker.terminate().catch(() => {
        // Termination failures are irrelevant: the worker is being discarded.
      });
    };
    const watchdog = setTimeout(() => {
      terminate();
      reject(new Error(REGEX_SEARCH_TIMEOUT_ERROR));
    }, REGEX_SEARCH_BUDGET_MS + HOST_TERMINATION_GRACE_MS);
    worker.on('message', (message: WorkerMessage) => {
      clearTimeout(watchdog);
      terminate();
      if ('matchedLines' in message) {
        resolve(message.matchedLines);
        return;
      }
      if ('timedOut' in message) {
        reject(new Error(REGEX_SEARCH_TIMEOUT_ERROR));
        return;
      }
      reject(
        new Error(`Invalid regular expression: ${message.invalidPattern}`)
      );
    });
    worker.on('error', (error) => {
      clearTimeout(watchdog);
      terminate();
      reject(error);
    });
  });
}
