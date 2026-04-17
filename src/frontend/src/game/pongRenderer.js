

export const widthRatio = 160;
export const heightRatio = 90;
export const aspectRatio = (widthRatio/heightRatio);

/**
 * For string based color follow reference
 * https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value
 * @typedef {(string|CanvasGradient|CanvasPattern)} Color
 */

/**
 * @typedef {import("./pongEngine.js").GameState} GameState
 */


export class CanvasGameContext {

  /** @type {HTMLCanvasElement} */
  #canvas;
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {CanvasRenderingContext2D} renderingContext2d
   */
  constructor(canvas, renderingContext2d) {
    /** @type {CanvasRenderingContext2D} */
    this.rendering2d = renderingContext2d
    this.#canvas = canvas
  }

  /** @property {number} */
  get width() {
    return this.#canvas.width;
  }

  /** @property {number} */
  get height() {
    return this.#canvas.height;
  }

  /** @property {number} */
  get widthScale() {
    return this.#canvas.width / widthRatio;
  }

  /** @property {number} */
  get heightScale() {
    return this.#canvas.height / heightRatio;
  }

  /** @property {number} */
  get widthRatio() {
    return widthRatio;
  }

  /** @property {number} */
  get heightRatio() {
    return heightRatio;
  }

  /** @property {Color} */
  get primaryColor() {
    return getComputedStyle(this.#canvas).getPropertyValue('--primary');
  }

  /** @property {Color} */
  get crtWhite() {
    return getComputedStyle(this.#canvas).getPropertyValue('--crt-white');
  }
}

/**
 * @param {CanvasGameContext} canvasContext
 * @param {GameState} gameState
 * @param {() => boolean} isKickoff - returns true game is paused after goal
 * @param {{ background: HTMLImageElement|null, ball: HTMLImageElement|null, paddleLeft: HTMLImageElement|null, paddleRight: HTMLImageElement|null }|null} [themeImages]
 */
export function render(canvasContext, gameState, isKickoff, themeImages = null, themeKey = '') {
  const renderingCanvas = canvasContext.rendering2d;
  const player1 = gameState.player1;
  const player2 = gameState.player2;
  const ball = gameState.ball;
  const score = gameState.score;

  const fontSize = canvasContext.widthScale * 16;
  renderingCanvas.reset();

  const isNeon = themeKey.includes('neon');
  const isNeonPong = themeKey === 'neon-pong';

  // Background: image fills canvas, or canvas stays transparent (black by CSS)
  if (themeImages?.background) {
    renderingCanvas.drawImage(themeImages.background, 0, 0, canvasContext.width, canvasContext.height);
    renderingCanvas.fillStyle = 'rgba(0, 0, 0, 0.7)';
    renderingCanvas.fillRect(0, 0, canvasContext.width, canvasContext.height);
  }

  renderingCanvas.strokeStyle = canvasContext.primaryColor;
  renderingCanvas.lineWidth = 6;
  renderingCanvas.strokeRect(0, 0,
                             widthRatio * canvasContext.widthScale,
                             heightRatio * canvasContext.heightScale);

  // Score — neon glow + neon-pong rainbow outline
  if (isNeon) {
    renderingCanvas.shadowColor = '#00ffff';
    renderingCanvas.shadowBlur = 20;
  }
  renderingCanvas.fillStyle = isNeonPong ? '#000000' : canvasContext.crtWhite;
  renderingCanvas.lineWidth = 2;
  renderingCanvas.font = `bold ${fontSize}px Bungee, sans-serif`
  renderingCanvas.fillText(`${score.player1}`,
                           35 * canvasContext.widthScale,
                           15 * canvasContext.heightScale, fontSize * 10);
  renderingCanvas.fillText(`${score.player2}`,
                           115 * canvasContext.widthScale,
                           15 * canvasContext.heightScale, fontSize * 10);

  if (isNeonPong) {
    const grad = renderingCanvas.createLinearGradient(0, 0, canvasContext.width, 0);
    grad.addColorStop(0,    '#ff0000');
    grad.addColorStop(0.2,  '#ff9900');
    grad.addColorStop(0.4,  '#ffff00');
    grad.addColorStop(0.6,  '#00ff00');
    grad.addColorStop(0.8,  '#0066ff');
    grad.addColorStop(1,    '#8b00ff');
    renderingCanvas.strokeStyle = grad;
    renderingCanvas.lineWidth = 3;
    renderingCanvas.strokeText(`${score.player1}`,
                               35 * canvasContext.widthScale,
                               15 * canvasContext.heightScale, fontSize * 10);
    renderingCanvas.strokeText(`${score.player2}`,
                               115 * canvasContext.widthScale,
                               15 * canvasContext.heightScale, fontSize * 10);
  }

  if (isNeon) {
    renderingCanvas.shadowBlur = 0;
    renderingCanvas.shadowColor = 'transparent';
  }

  // Border
  renderingCanvas.fillStyle = canvasContext.crtWhite;
  renderingCanvas.strokeStyle = canvasContext.crtWhite;
  renderingCanvas.lineWidth = 2;
  const borderRadius = 8;
  renderingCanvas.beginPath();
  renderingCanvas.roundRect(1, 1,
                             widthRatio * canvasContext.widthScale - 2,
                            heightRatio * canvasContext.heightScale - 2,
                            borderRadius);
  renderingCanvas.stroke();

  // Midfield dashed line — neon glow
  const midfieldStripSize = player1.size;
  const midfieldStripXPos =
        ((widthRatio / 2)  - (midfieldStripSize.width / 2))
        * canvasContext.widthScale;
  if (isNeon) {
    renderingCanvas.shadowColor = '#00ffff';
    renderingCanvas.shadowBlur = 12;
  }
  for (let i = midfieldStripSize.height / 2;
       i < heightRatio ;
       i += 2* midfieldStripSize.height) {

    renderingCanvas.fillRect(
      midfieldStripXPos,
      i  * canvasContext.heightScale,
      midfieldStripSize.width  * canvasContext.widthScale,
      midfieldStripSize.height * canvasContext.heightScale);
  }
  if (isNeon) {
    renderingCanvas.shadowBlur = 0;
    renderingCanvas.shadowColor = 'transparent';
  }

  // Player 1 paddle
  const p1x = player1.position.x * canvasContext.widthScale;
  const p1y = player1.position.y * canvasContext.heightScale;
  const p1w = player1.size.width  * canvasContext.widthScale;
  const p1h = player1.size.height * canvasContext.heightScale;
  if (themeImages?.paddleLeft) {
    renderingCanvas.drawImage(themeImages.paddleLeft, p1x, p1y, p1w, p1h);
  } else {
    renderingCanvas.fillStyle = player1.color;
    renderingCanvas.fillRect(p1x, p1y, p1w, p1h);
  }

  // Player 2 paddle
  const p2x = player2.position.x * canvasContext.widthScale;
  const p2y = player2.position.y * canvasContext.heightScale;
  const p2w = player2.size.width  * canvasContext.widthScale;
  const p2h = player2.size.height * canvasContext.heightScale;
  if (themeImages?.paddleRight) {
    renderingCanvas.drawImage(themeImages.paddleRight, p2x, p2y, p2w, p2h);
  } else {
    renderingCanvas.fillStyle = player2.color;
    renderingCanvas.fillRect(p2x, p2y, p2w, p2h);
  }

  if (isKickoff())
    return;

  // Ball — per-theme glow overrides
  const bx = ball.position.x * canvasContext.widthScale;
  const by = ball.position.y * canvasContext.heightScale;
  const bw = ball.size.width  * canvasContext.widthScale;
  const bh = ball.size.height * canvasContext.heightScale;
  if (themeKey === 'neon-pong') {
    renderingCanvas.shadowColor = '#ff69b4';
    renderingCanvas.shadowBlur = 20;
    renderingCanvas.fillStyle = '#ff69b4';
    renderingCanvas.fillRect(bx, by, bw, bh);
    renderingCanvas.shadowBlur = 0;
    renderingCanvas.shadowColor = 'transparent';
  } else if (themeKey === 'neon-two-paddle') {
    renderingCanvas.shadowColor = '#00ffff';
    renderingCanvas.shadowBlur = 20;
    renderingCanvas.fillStyle = '#001a1a';
    renderingCanvas.fillRect(bx, by, bw, bh);
    renderingCanvas.strokeStyle = '#00ffff';
    renderingCanvas.lineWidth = 2;
    renderingCanvas.strokeRect(bx, by, bw, bh);
    renderingCanvas.shadowBlur = 0;
    renderingCanvas.shadowColor = 'transparent';
  } else if (themeKey === 'neon-central-paddle') {
    renderingCanvas.shadowColor = '#00ff41';
    renderingCanvas.shadowBlur = 20;
    renderingCanvas.fillStyle = '#001a00';
    renderingCanvas.fillRect(bx, by, bw, bh);
    renderingCanvas.strokeStyle = '#00ff41';
    renderingCanvas.lineWidth = 2;
    renderingCanvas.strokeRect(bx, by, bw, bh);
    renderingCanvas.shadowBlur = 0;
    renderingCanvas.shadowColor = 'transparent';
  } else if (themeImages?.ball) {
    renderingCanvas.drawImage(themeImages.ball, bx, by, bw, bh);
  } else {
    renderingCanvas.fillStyle = ball.color;
    renderingCanvas.fillRect(bx, by, bw, bh);
  }
}
