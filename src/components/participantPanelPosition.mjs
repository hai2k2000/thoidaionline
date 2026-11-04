/** Position in viewport coordinates; above panels translate by their actual height. */
export function calculateParticipantPanelPosition(rect, { viewportWidth, viewportHeight }) {
  const margin = 8;
  const gap = 4;
  const limit = viewportWidth < 640 ? viewportHeight * 0.6 : 320;
  const below = Math.max(0, viewportHeight - rect.bottom - gap - margin);
  const aboveSpace = Math.max(0, rect.top - gap - margin);
  const above = below < limit && aboveSpace > below;
  const width = Math.min(rect.width, Math.max(0, viewportWidth - margin * 2));
  return {
    left: Math.max(margin, Math.min(rect.left, viewportWidth - margin - width)),
    top: above ? rect.top - gap : rect.bottom + gap,
    width,
    maxHeight: Math.min(limit, above ? aboveSpace : below),
    above,
  };
}
