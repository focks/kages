// Wheel deltas are pixels on most trackpads but lines/pages on some mice.
// The frame bridge accepts pixels only; forwarding raw line deltas barely moves.
/** Convert a wheel event to finite pixel deltas without changing trackpad precision. */
export function wheelPixels(event: { deltaX: number; deltaY: number; deltaMode: number }, pageHeight: number, lineHeight = 16): { left: number; top: number } {
  const scale = event.deltaMode === 1 ? lineHeight : event.deltaMode === 2 ? pageHeight : 1;
  const finite = (n: number) => Number.isFinite(n) ? n : 0;
  return { left: finite(event.deltaX * scale), top: finite(event.deltaY * scale) };
}
