// src/frontend/src/utils/avatarFilter.js
/**
 * Returns a deterministic CSS filter string for a user avatar.
 * Uses the golden angle (137°) for even hue distribution across IDs.
 * Saturation range: 100–179%.
 *
 * @param {number} userId
 * @returns {string}  e.g. "hue-rotate(137deg) saturate(123%)"
 */
export function getAvatarFilter(userId) {
  const hue        = (userId * 137) % 360
  const saturation = 100 + (userId * 23) % 80
  return `hue-rotate(${hue}deg) saturate(${saturation}%)`
}
