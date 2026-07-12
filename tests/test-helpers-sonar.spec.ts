import { test } from '@playwright/test';
import {
  expectFullSnapshotFallback,
  expectPartialSnapshotForSelector,
} from './test-helpers.js';

type PartialSnapshotResponse = Parameters<
  typeof expectPartialSnapshotForSelector
>[0];

function responseWithText(text: string): PartialSnapshotResponse {
  return {
    content: [{ type: 'text', text }],
  } as unknown as PartialSnapshotResponse;
}

test('asserts a selector-scoped partial snapshot', () => {
  expectPartialSnapshotForSelector(
    responseWithText('Capturing partial snapshot for selector: #app'),
    '#app'
  );
});

test('asserts fallback to a full snapshot', () => {
  expectFullSnapshotFallback(responseWithText('Falling back to full snapshot'));
});
