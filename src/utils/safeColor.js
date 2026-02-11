/**
 * Safely append a hex opacity suffix to a color string.
 * Returns fallback + suffix if the color is not a valid hex color.
 */
const HEX_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export function withOpacity(color, opacitySuffix, fallback = '#418FDE') {
  const base = color && HEX_REGEX.test(color) ? color : fallback;
  return base + opacitySuffix;
}
