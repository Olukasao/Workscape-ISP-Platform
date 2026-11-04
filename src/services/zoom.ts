export const MIN_ZOOM = 50;
export const MAX_ZOOM = 200;
export const ZOOM_STEP = 5;
export const DEFAULT_ZOOM = 70;

export function normalizeZoom(percent: unknown): number {
  if (typeof percent !== "number" || !Number.isFinite(percent)) return DEFAULT_ZOOM;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(percent / ZOOM_STEP) * ZOOM_STEP));
}
