const DEFAULT_MAX_EDGE = 1920;

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image.'));
    img.src = dataUrl;
  });
}

/**
 * Read an image file and return a data URL, downscaling if larger than maxEdge.
 * @param {File} file
 * @param {number} [maxEdge]
 * @returns {Promise<string>}
 */
export async function readImageFileAsDataUrl(file, maxEdge = DEFAULT_MAX_EDGE) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Please choose an image file (JPEG, PNG, WebP, etc.).');
  }

  const rawDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });

  const img = await loadImageFromDataUrl(rawDataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('Invalid image dimensions.');

  const edge = Math.max(w, h);
  if (edge <= maxEdge) return rawDataUrl;

  const scale = maxEdge / edge;
  const tw = Math.round(w * scale);
  const th = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) return rawDataUrl;
  ctx.drawImage(img, 0, 0, tw, th);

  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const quality = mime === 'image/jpeg' ? 0.88 : undefined;
  return canvas.toDataURL(mime, quality);
}
