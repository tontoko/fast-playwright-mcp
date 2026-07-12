import type {
  Resource,
  ResourceContents,
} from '@modelcontextprotocol/sdk/types.js';
import { DASHBOARD_HTML } from '../generated/dashboard.js';

export const DASHBOARD_RESOURCE_URI = 'ui://dashboard';

export function dashboardResources(): Resource[] {
  return [
    {
      uri: DASHBOARD_RESOURCE_URI,
      name: 'Browser dashboard',
      description: 'Browser preview and explicit tab selection.',
      mimeType: 'text/html',
    },
  ];
}

export function readDashboardResource(
  uri: string
): Promise<ResourceContents[]> {
  if (uri !== DASHBOARD_RESOURCE_URI) {
    return Promise.reject(new Error(`Resource not found: ${uri}`));
  }
  return Promise.resolve([
    {
      uri,
      mimeType: 'text/html',
      text: DASHBOARD_HTML,
    },
  ]);
}
