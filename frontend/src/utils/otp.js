export function sanitizeOtpCode(value, maxLength = 6) {
  return String(value || '').replace(/\D/g, '').slice(0, maxLength);
}

export function isCompleteOtpCode(value, expectedLength = 6) {
  return sanitizeOtpCode(value, expectedLength).length === expectedLength;
}