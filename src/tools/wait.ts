import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import { defineTool } from './tool.js';

const wait = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_wait_for',
    title: 'Wait for',
    description:
      'Wait for text to appear or disappear or a specified time to pass',
    inputSchema: z.object({
      time: z.number().optional().describe('Wait time in seconds'),
      text: z.string().optional(),
      textGone: z.string().optional(),
      expectation: expectationSchema.describe('Page state after wait'),
    }),
    type: 'readOnly',
  },
  handle: async (context, params, response) => {
    if (!(params.text || params.textGone || params.time)) {
      throw new Error('Either time, text or textGone must be provided');
    }

    if (params.time) {
      response.addCode(
        `await new Promise(f => setTimeout(f, ${params.time} * 1000));`
      );
      await new Promise((f) =>
        setTimeout(f, Math.min(30_000, (params.time ?? 0) * 1000))
      );
    }
    const tab = context.currentTabOrDie();
    const locator = params.text
      ? tab.page.getByText(params.text).first()
      : undefined;
    const goneLocator = params.textGone
      ? tab.page.getByText(params.textGone).first()
      : undefined;
    if (goneLocator) {
      response.addCode(
        `await page.getByText(${JSON.stringify(params.textGone)}).first().waitFor({ state: 'hidden' });`
      );
      await goneLocator.waitFor({
        state: 'hidden',
        timeout: context.config.timeouts.expect,
      });
    }
    if (locator) {
      response.addCode(
        `await page.getByText(${JSON.stringify(params.text)}).first().waitFor({ state: 'visible' });`
      );
      await locator.waitFor({
        state: 'visible',
        timeout: context.config.timeouts.expect,
      });
    }
    response.addResult(
      `Waited for ${params.text ?? params.textGone ?? params.time}`
    );
    response.setIncludeSnapshot();
  },
});
export default [wait];
