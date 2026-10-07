/** Read the selected file completely before releasing the file input.
 * A data URL keeps the crop source available for its entire lifetime, without
 * depending on a file-backed blob URL or Image.decode() support.
 */
export async function loadCropImage(file: File): Promise<HTMLImageElement> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result) : reject(new Error('image-read-failed'));
    reader.onerror = () => reject(new Error('image-read-failed'));
    reader.onabort = () => reject(new Error('image-read-failed'));
    reader.readAsDataURL(file);
  });
  const original = await openImage(dataUrl);
  // Crop gestures redraw repeatedly. Keep a bounded editing source instead
  // of decoding/drawing a full-resolution phone photo on every pointer move.
  const scale = Math.min(1, 2000 / Math.max(original.naturalWidth, original.naturalHeight));
  if (scale === 1) return original;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(original.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(original.naturalHeight * scale));
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('image-open-failed');
    ctx.drawImage(original, 0, 0, canvas.width, canvas.height);
    const resizedUrl = canvas.toDataURL('image/png');
    original.src = '';
    return await openImage(resizedUrl);
  } finally {
    original.src = '';
    canvas.width = canvas.height = 0;
  }
}

function openImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      image.onload = null; image.onerror = null;
      if (image.naturalWidth && image.naturalHeight) resolve(image);
      else reject(new Error('image-open-failed'));
    };
    image.onerror = () => {
      image.onload = null; image.onerror = null;
      reject(new Error('image-open-failed'));
    };
    image.src = src;
  });
}
