import type * as playwright from 'playwright';
import { TIMEOUTS } from '../config/constants.js';
import type { Tab } from '../tab.js';
import { toolsUtilsDebug } from '../utils/log.js';
export async function waitForCompletion<R>(
  tab: Tab,
  callback: () => Promise<R>
): Promise<R> {
  const settleTimeout =
    tab.context.config.timeouts?.settle ?? TIMEOUTS.WAIT_FOR_COMPLETION;
  const requests = new Set<playwright.Request>();
  let frameNavigated = false;
  let navigationCompleted = false;
  let waitCallback: () => void = () => {
    // Default empty callback
  };
  const waitBarrier = new Promise<void>((f) => {
    waitCallback = f;
  });
  const requestListener = (request: playwright.Request) =>
    requests.add(request);
  const requestFinishedListener = (request: playwright.Request) => {
    requests.delete(request);
    if (!requests.size && navigationCompleted) {
      waitCallback();
    }
  };
  const frameNavigateListener = (frame: playwright.Frame) => {
    if (frame.parentFrame()) {
      return;
    }
    frameNavigated = true;

    // Enhanced navigation handling with stability checks
    (async () => {
      try {
        await tab.waitForLoadState('load');
        await tab
          .waitForLoadState('networkidle', {
            timeout: getNavigationConfig().networkIdleTimeout,
          })
          .catch((error) => {
            toolsUtilsDebug('Network idle timeout reached:', error);
          });
        navigationCompleted = true;
        if (!requests.size) {
          waitCallback();
        }
      } catch (error) {
        // Fallback if load states fail
        toolsUtilsDebug('Load state waiting failed, continuing:', error);
        navigationCompleted = true;
        waitCallback();
      }
    })().catch((error) => {
      toolsUtilsDebug('Navigation handling failed:', error);
      navigationCompleted = true;
      waitCallback();
    });
  };
  const onTimeout = () => {
    dispose();
    navigationCompleted = true;
    waitCallback();
  };
  tab.page.on('request', requestListener);
  tab.page.on('requestfinished', requestFinishedListener);
  tab.page.on('framenavigated', frameNavigateListener);
  const timeout = setTimeout(
    onTimeout,
    getNavigationConfig().completionTimeout
  );
  const dispose = () => {
    tab.page.off('request', requestListener);
    tab.page.off('requestfinished', requestFinishedListener);
    tab.page.off('framenavigated', frameNavigateListener);
    clearTimeout(timeout);
  };
  try {
    const result = await callback();
    if (!(requests.size || frameNavigated)) {
      navigationCompleted = true;
      waitCallback();
    }
    await waitBarrier;
    // Additional stability wait with context verification
    if (frameNavigated) {
      await tab.waitForTimeout(settleTimeout);
      // Verify page is still responsive
      try {
        await tab.page.evaluate(() => document.readyState);
      } catch (error) {
        // Context might be destroyed, but we still return the result
        toolsUtilsDebug(
          'Page readyState check failed (context may be destroyed):',
          error
        );
      }
    } else {
      await tab.waitForTimeout(settleTimeout);
    }
    return result;
  } finally {
    dispose();
  }
}
export async function generateLocator(
  locator: playwright.Locator
): Promise<string> {
  try {
    const normalized = await locator.normalize();
    return normalized.toString();
  } catch (error) {
    toolsUtilsDebug('Locator generation failed:', error);
    throw new Error(
      'Ref not found, likely because element was removed. Use browser_snapshot to see what elements are currently on the page.'
    );
  }
}
function getNavigationConfig() {
  return {
    networkIdleTimeout: TIMEOUTS.NETWORK_IDLE_TIMEOUT,
    completionTimeout: 15_000,
  };
}
