/**
 * Standardizes Bangladesh phone numbers to match the Lead Bank sheet format:
 * - Mobile: 17xxxxxxxx (10 digits without leading 0 or +880)
 * - IP Phone: 96xxxxxxxx
 * - Multi-number cells: "17xxxxxxxx, 18xxxxxxxx"
 */
export function standardizeSingleBdPhone(rawToken: string): string {
  const cleaned = rawToken.replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, '').trim();
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('880') && digits.length >= 12) {
    return digits.slice(3);
  }
  if (digits.startsWith('00880') && digits.length >= 14) {
    return digits.slice(5);
  }
  if (digits.startsWith('0') && (digits.length === 10 || digits.length === 11)) {
    return digits.slice(1);
  }
  return digits;
}

export function standardizePhoneField(rawInput: string): {
  standardized: string;
  primaryNormalized: string;
  allNormalized: string[];
} {
  const trimmed = (rawInput || '').trim();
  if (!trimmed || trimmed === '-') {
    return { standardized: trimmed === '-' ? '-' : '', primaryNormalized: '', allNormalized: [] };
  }

  // Split by comma, slash, semicolon, newline, or whitespace between distinct numbers
  let tokens = trimmed.split(/[,;/|\r\n]+/).map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 1) {
    // Handle space-separated pair like "01616-030227 1581-749803"
    const spaceParts = tokens[0].split(/\s+/).filter(Boolean);
    if (spaceParts.length === 2 && spaceParts.every((p) => p.replace(/\D/g, '').length >= 9)) {
      tokens = spaceParts;
    }
  }

  const seen = new Set<string>();
  const normalizedList: string[] = [];
  for (const tok of tokens) {
    const std = standardizeSingleBdPhone(tok);
    if (std && !seen.has(std)) {
      seen.add(std);
      normalizedList.push(std);
    }
  }

  return {
    standardized: normalizedList.join(', '),
    primaryNormalized: normalizedList[0] || '',
    allNormalized: normalizedList,
  };
}
