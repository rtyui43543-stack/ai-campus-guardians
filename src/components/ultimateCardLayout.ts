/** Artwork-space coordinates keep the name inside the plaque at every viewport size. */
export const CARD_LAYOUT = Object.freeze({
  width: 1024, height: 1536,
  titleColor: '#fff0aa', titleOutline: '#062a30',
});

export const CARD_TITLE_FONT = '"Noto Sans TC Variable", "Noto Sans TC", sans-serif';

export interface CardPlaque {
  readonly artPath: string;
  /** Empty centre of the painted plaque, clear of the gold border and ornaments. */
  readonly safeX: number;
  readonly safeY: number;
  readonly safeWidth: number;
  readonly safeHeight: number;
  readonly titleSize: number;
}

/** Audited against all twelve original illustrations, rather than one shared plaque position. */
export const CARD_PLAQUES: Readonly<Record<string, CardPlaque>> = Object.freeze({
  '守護城堡': { artPath: '/art/ultimate-1-v1.webp', safeX: 240, safeY: 1422, safeWidth: 544, safeHeight: 72, titleSize: 60 },
  '雷霆索引': { artPath: '/art/ultimate-2-v1.webp', safeX: 240, safeY: 1402, safeWidth: 544, safeHeight: 76, titleSize: 64 },
  '萬葉歸位': { artPath: '/art/ultimate-3-v1.webp', safeX: 240, safeY: 1378, safeWidth: 544, safeHeight: 72, titleSize: 64 },
  '鏡界破偽': { artPath: '/art/ultimate-4-v1.webp', safeX: 240, safeY: 1380, safeWidth: 544, safeHeight: 76, titleSize: 64 },
  '智慧火鳳': { artPath: '/art/ultimate-5-v1.webp', safeX: 240, safeY: 1410, safeWidth: 544, safeHeight: 68, titleSize: 60 },
  '寒晶冰矛': { artPath: '/art/ultimate-6-ice-v2.webp', safeX: 240, safeY: 1402, safeWidth: 544, safeHeight: 76, titleSize: 64 },
  '天穹守護城': { artPath: '/art/ultimate-advanced-1-v1.webp', safeX: 240, safeY: 1402, safeWidth: 544, safeHeight: 76, titleSize: 64 },
  '萬卷雷霆陣': { artPath: '/art/ultimate-advanced-2-v1.webp', safeX: 240, safeY: 1402, safeWidth: 544, safeHeight: 76, titleSize: 64 },
  '森羅歸位界': { artPath: '/art/ultimate-advanced-3-v1.webp', safeX: 240, safeY: 1402, safeWidth: 544, safeHeight: 76, titleSize: 64 },
  '千鏡破偽陣': { artPath: '/art/ultimate-advanced-4-v1.webp', safeX: 240, safeY: 1402, safeWidth: 544, safeHeight: 76, titleSize: 64 },
  '智慧烈焰鳳': { artPath: '/art/ultimate-advanced-5-v1.webp', safeX: 240, safeY: 1402, safeWidth: 544, safeHeight: 76, titleSize: 64 },
  '極寒冰龍': { artPath: '/art/ultimate-advanced-6-ice-v2.webp', safeX: 240, safeY: 1402, safeWidth: 544, safeHeight: 76, titleSize: 64 },
});

export function getUltimateCardLayout(name: string) {
  const plaque = CARD_PLAQUES[name];
  if (!plaque) throw new Error(`收藏卡「${name}」尚未設定文字排版。`);
  const titleMaxWidth = plaque.safeWidth - 16;
  // Every current title fits at its audited size; longer future labels can shrink without stretching.
  const titleSize = Math.min(plaque.titleSize, titleMaxWidth / Math.max(1, Array.from(name).length));
  const titleX = plaque.safeX + plaque.safeWidth / 2;
  const titleCenterY = plaque.safeY + plaque.safeHeight / 2;
  // Noto Sans TC's ideograph ink is approximately .88em above and .12em below the alphabetic baseline.
  // Both SVG and Canvas use this explicit baseline, avoiding their different "central"/"middle" rules.
  const titleY = titleCenterY + titleSize * .38;
  return { ...CARD_LAYOUT, ...plaque, titleX, titleY, titleCenterY, titleSize, titleMaxWidth };
}

/** Native composition adds the same editable title to the downloaded PNG, fully offline. */
export async function composeUltimateCard(art: Blob, name: string, signal: AbortSignal): Promise<Blob> {
  if (signal.aborted) throw new DOMException('下載已取消。', 'AbortError');
  const layout = getUltimateCardLayout(name);
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
    await document.fonts.load(`900 ${layout.titleSize}px ${CARD_TITLE_FONT}`, name);
    if (signal.aborted) throw new DOMException('下載已取消。', 'AbortError');
    context.font = `900 ${layout.titleSize}px ${CARD_TITLE_FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    context.lineWidth = 2;
    context.strokeStyle = CARD_LAYOUT.titleOutline;
    context.fillStyle = CARD_LAYOUT.titleColor;
    context.strokeText(name, layout.titleX, layout.titleY, layout.titleMaxWidth);
    context.fillText(name, layout.titleX, layout.titleY, layout.titleMaxWidth);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('無法準備收藏卡圖片。')), 'image/png'));
    if (signal.aborted) throw new DOMException('下載已取消。', 'AbortError');
    return png;
  } finally { bitmap.close(); }
}
