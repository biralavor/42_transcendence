function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

/**
 * Preloads all images for a theme entry.
 * @param {{ background: string|null, ball: string|null, paddleLeft: string|null, paddleRight: string|null }} themeEntry
 * @returns {Promise<{ background: HTMLImageElement|null, ball: HTMLImageElement|null, paddleLeft: HTMLImageElement|null, paddleRight: HTMLImageElement|null }>}
 */
export async function loadThemeImages(themeEntry) {
  const load = (src) => src ? loadImage(src) : Promise.resolve(null);
  const [background, ball, paddleLeft, paddleRight] = await Promise.all([
    load(themeEntry.background),
    load(themeEntry.ball),
    load(themeEntry.paddleLeft),
    load(themeEntry.paddleRight),
  ]);
  return { background, ball, paddleLeft, paddleRight };
}
