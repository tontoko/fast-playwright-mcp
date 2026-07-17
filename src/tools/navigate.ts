import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import {
  generateBackCode,
  generateForwardCode,
  generateNavigationCode,
} from '../utils/common-formatters.js';
import { defineTabTool, defineTool } from './tool.js';

const navigate = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_navigate',
    title: 'Navigate to a URL',
    description: 'Navigate to a URL',
    inputSchema: z.object({
      url: z.string().describe('The URL to navigate to'),
      expectation: expectationSchema.describe('Page state after navigation'),
    }),
    type: 'destructive',
  },
  handle: async (context, params, response) => {
    const tab = await context.ensureTab();
    await tab.navigate(params.url);
    response.addCode(generateNavigationCode(params.url));
  },
});
const goBack = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_navigate_back',
    title: 'Go back to previous page',
    description: 'Go back to previous page',
    inputSchema: z.object({
      expectation: expectationSchema.describe('Page state after going back'),
    }),
    type: 'destructive',
  },
  handle: async (tab, _params, response) => {
    await tab.page.goBack();
    response.addCode(generateBackCode());
  },
});
const goForward = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_navigate_forward',
    title: 'Go forward to next page',
    description: 'Go forward to next page',
    inputSchema: z.object({
      expectation: expectationSchema.describe('Page state after going forward'),
    }),
    type: 'destructive',
  },
  handle: async (tab, _params, response) => {
    await tab.page.goForward();
    response.addCode(generateForwardCode());
  },
});
export default [navigate, goBack, goForward];
