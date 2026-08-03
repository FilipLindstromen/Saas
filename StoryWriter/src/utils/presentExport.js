/** Capture a DOM node as PNG and trigger download. */
export async function downloadNodeAsPng(node, filename = 'story-slide.png') {
  if (!node) return;
  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#0a0a0a',
  });
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
