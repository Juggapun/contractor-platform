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
    image.src = dataUrl;
  });
}
