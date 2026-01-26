/**
 * Convert a character to its hex code point representation
 * @param char - The character to convert
 * @param padLength - Minimum length to pad to (default: 5)
 * @returns Lowercase hex string padded to specified length
 */
export function toHex(char: string, padLength = 5): string {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) {
    throw new Error('Invalid character: empty string');
  }
  return codePoint.toString(16).toLowerCase().padStart(padLength, '0');
}

/**
 * Get all code points for a string (handles surrogate pairs)
 * @param str - The string to get code points from
 * @returns Array of code points
 */
export function getCodePoints(str: string): number[] {
  return [...str].map((char) => {
    const cp = char.codePointAt(0);
    if (cp === undefined) {
      throw new Error('Invalid character in string');
    }
    return cp;
  });
}
