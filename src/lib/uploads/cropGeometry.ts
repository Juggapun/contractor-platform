/** A normalized crop rectangle shared by the preview and exported pixels. */
export function cropRectangle(width: number, height: number, aspect: number, zoom: number, x: number, y: number) {
  const safeZoom = Math.max(1, zoom);
  const cropWidth = Math.min(width, height * aspect) / safeZoom;
  const cropHeight = cropWidth / aspect;
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  return { x: (width - cropWidth) * clamp(x), y: (height - cropHeight) * clamp(y), width: cropWidth, height: cropHeight };
}
