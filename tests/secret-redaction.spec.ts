import { expect, test } from '@playwright/test';
import { SecretRedactor } from '../src/utils/secret-redactor.js';

test('redacts longest configured literals first', () => {
  const redactor = new SecretRedactor({ SHORT: 'abc', LONG: 'abcdef' });
  expect(redactor.redact('abcdef abc')).toBe(
    '<redacted:LONG> <redacted:SHORT>'
  );
});

test('ignores empty values and leaves unrelated text unchanged', () => {
  const redactor = new SecretRedactor({ EMPTY: '', TOKEN: 'secret' });
  expect(redactor.enabled).toBe(true);
  expect(redactor.redact('ordinary')).toBe('ordinary');
});
