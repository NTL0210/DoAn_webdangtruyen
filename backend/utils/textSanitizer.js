const SCRIPT_TAG_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const INLINE_HANDLER_REGEX = /on\w+\s*=\s*["'][^"']*["']/gi;
const JAVASCRIPT_SCHEME_REGEX = /javascript:/gi;
const INVISIBLE_FORMATTING_REGEX = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const LINE_ENDING_REGEX = /\r\n?/g;

const DEFAULT_MAX_COMBINING_MARKS = 2;

function isCombiningMark(char) {
  return /\p{Mark}/u.test(char);
}

function limitCombiningMarks(input, maxMarksPerCharacter = DEFAULT_MAX_COMBINING_MARKS) {
  if (!input) {
    return '';
  }

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
      .replace(LINE_ENDING_REGEX, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return input.replace(/\s+/g, ' ').trim();
}

export function sanitizeUserText(input, options = {}) {
  const {
    preserveLineBreaks = false,
    maxCombiningMarksPerCharacter = DEFAULT_MAX_COMBINING_MARKS
  } = options;

  if (input === undefined || input === null) {
    return '';
  }

  const normalizedInput = String(input)
    .normalize('NFC')
    .replace(SCRIPT_TAG_REGEX, '')
    .replace(INLINE_HANDLER_REGEX, '')
    .replace(JAVASCRIPT_SCHEME_REGEX, '')
    .replace(INVISIBLE_FORMATTING_REGEX, '')
    .replace(CONTROL_CHAR_REGEX, '');

  const normalizedWhitespace = normalizeWhitespace(normalizedInput, preserveLineBreaks);

  return limitCombiningMarks(normalizedWhitespace, maxCombiningMarksPerCharacter);
}

export function sanitizeInlineText(input) {
  return sanitizeUserText(input, { preserveLineBreaks: false });
}