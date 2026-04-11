import { describe, expect, it } from 'vitest';

import { sanitizeInlineText, sanitizeUserText } from '../../utils/textSanitizer.js';

function getMaxCombiningMarksPerBaseCharacter(value) {
  let maxCount = 0;
  let currentCount = 0;

  for (const char of value) {
    if (/\p{Mark}/u.test(char)) {
      currentCount += 1;
      maxCount = Math.max(maxCount, currentCount);
      continue;
    }

    currentCount = 0;
  }

  return maxCount;
}

describe('textSanitizer', () => {
  it('removes script fragments and invisible formatting characters', () => {
    expect(sanitizeInlineText('safe<script>alert(1)</script>\u200Bname')).toBe('safename');
  });

  it('limits excessive combining marks used by zalgo text', () => {
    const zalgo = 'Z̶̓̋̎͝A̸̾̈́͋͝l̷̒̌̏̊G̴̈́̈́͆̀O̴͑͌̔͋';
    const sanitized = sanitizeInlineText(zalgo);

    expect(sanitized.replace(/\p{Mark}/gu, '')).toBe('ZAlGO');
    expect(getMaxCombiningMarksPerBaseCharacter(sanitized)).toBeLessThanOrEqual(2);
  });

  it('supports a higher combining mark cap when explicitly requested', () => {
    const zalgo = 'T̴̿̍̑̅̇e̷̾̍̈́̚͠x̷̂̇̓̍̚t̵̊̿̑̍̕';
    const sanitized = sanitizeUserText(zalgo, { maxCombiningMarksPerCharacter: 4 });

    expect(sanitized.replace(/\p{Mark}/gu, '')).toBe('Text');
    expect(getMaxCombiningMarksPerBaseCharacter(sanitized)).toBeLessThanOrEqual(4);
    expect(getMaxCombiningMarksPerBaseCharacter(sanitized)).toBeGreaterThan(2);
  });

  it('preserves reasonable line breaks for multi-line content', () => {
    expect(sanitizeUserText('Line 1\r\n\r\n\r\nLine 2', { preserveLineBreaks: true })).toBe('Line 1\n\nLine 2');
  });
});