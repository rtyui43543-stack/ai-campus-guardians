/** Artwork-space coordinates keep the name inside the plaque at every viewport size. */
export const CARD_LAYOUT = Object.freeze({
  width: 1024, height: 1536, titleX: 512, titleY: 1446,
  titleSize: 64, titleMaxWidth: 540,
  titleColor: '#fff0aa', titleOutline: '#062a30',
});

/** Native composition adds the same editable title to the downloaded PNG, fully offline. */
export async function composeUltimateCard(art: Blob, name: string, signal: AbortSignal): Promise<Blob> {
  if (signal.aborted) throw new DOMException('下載已取消。', 'AbortError');
  const bitmap = await createImageBitmap(art);
  try {
    await document.fonts.ready;
    if (signal.aborted) throw new DOMException('下載已取消。', 'AbortError');
    const canvas = document.createElement('canvas');
    canvas.width = CARD_LAYOUT.width;
    canvas.height = CARD_LAYOUT.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('無法準備收藏卡圖片。');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    context.font = `900 ${CARD_LAYOUT.titleSize}px "Noto Sans TC Variable", "Noto Sans TC", sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 2;
    context.strokeStyle = CARD_LAYOUT.titleOutline;
    context.fillStyle = CARD_LAYOUT.titleColor;
    context.strokeText(name, CARD_LAYOUT.titleX, CARD_LAYOUT.titleY, CARD_LAYOUT.titleMaxWidth);
    context.fillText(name, CARD_LAYOUT.titleX, CARD_LAYOUT.titleY, CARD_LAYOUT.titleMaxWidth);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('無法準備收藏卡圖片。')), 'image/png'));
    if (signal.aborted) throw new DOMException('下載已取消。', 'AbortError');
    return png;
  } finally { bitmap.close(); }
}
