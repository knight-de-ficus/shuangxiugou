/**
 * Produce the compact two-character mark used in brand cards.
 * Punctuation is ignored so Chinese and Latin brand labels behave uniformly.
 * @param {string} value
 * @returns {string}
 */
export function getBrandMark(value) {
  const glyphs = Array.from(value.normalize('NFKC')).filter((char) =>
    /[\p{Script=Han}\p{L}\p{N}]/u.test(char)
  );

  return glyphs.slice(-2).join('').toLocaleUpperCase('en-US') || '—';
}
