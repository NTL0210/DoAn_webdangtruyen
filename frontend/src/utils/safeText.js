const INVISIBLE_FORMATTING_REGEX = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

function isCombiningMark(char) {
  return /\p{Mark}/u.test(char);
}

function limitCombiningMarks(input, maxMarksPerCharacter = 2) {
  let combiningMarks = 0;
  let previousWasBaseCharacter = false;
  let result = '';

  for (const char of input) {
    if (isCombiningMark(char)) {
      if (previousWasBaseCharacter && combiningMarks < maxMarksPerCharacter) {
        result += char;
        combiningMarks += 1;
      }

      continue;
    }

    result += char;
    previousWasBaseCharacter = !/\s/u.test(char);
    combiningMarks = 0;
  }

  return result;
}

function normalizeWhitespace(input, preserveLineBreaks) {
  if (preserveLineBreaks) {
    return input
      .replace(/\r\n?/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return input.replace(/\s+/g, ' ').trim();
}

export function toSafeText(value, options = {}) {
  const {
    fallback = '',
    preserveLineBreaks = true,
    maxCombiningMarksPerCharacter = 2
  } = options;

  if (value === undefined || value === null) {
    return fallback;
  }

  const normalized = String(value)
    .normalize('NFC')
    .replace(INVISIBLE_FORMATTING_REGEX, '')
    .replace(CONTROL_CHAR_REGEX, '');

  const compacted = normalizeWhitespace(normalized, preserveLineBreaks);
  const safeValue = limitCombiningMarks(compacted, maxCombiningMarksPerCharacter);

  return safeValue || fallback;
}

export function toSafeInlineText(value, fallback = '') {
  return toSafeText(value, {
    fallback,
    preserveLineBreaks: false
  });
}

export function toSafeInitial(value, fallback = '?') {
  const safeValue = toSafeInlineText(value, '');
  return safeValue.charAt(0).toUpperCase() || fallback;
}