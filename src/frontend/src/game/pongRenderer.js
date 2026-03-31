import { GameState } from "./pongEngine";

export const widthRatio = 160;
export const heightRatio = 90;
export const aspectRatio = (widthRatio/heightRatio);

/**
 * For string based color follow reference
 * https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value
 * @typedef {(string|CanvasGradient|CanvasPattern)} Color
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
 */
export function render(canvasContext, gameState, isKickoff) {
  const renderingCanvas = canvasContext.rendering2d;
  const player1 = gameState.player1;
  const player2 = gameState.player2;
  const ball = gameState.ball;
  const score = gameState.score;

  const fontSize = canvasContext.widthScale * 16;
  renderingCanvas.reset();

  renderingCanvas.strokeStyle = canvasContext.primaryColor;
  renderingCanvas.lineWidth = 6;
  renderingCanvas.strokeRect(0, 0,
                             widthRatio * canvasContext.widthScale,
                             heightRatio * canvasContext.heightScale);

  renderingCanvas.fillStyle = canvasContext.crtWhite;
  renderingCanvas.strokeStyle = canvasContext.crtWhite;
  renderingCanvas.lineWidth = 2;
  renderingCanvas.font = `bold ${fontSize}px Bungee, sans-serif`
  renderingCanvas.fillText(`${score.player1}`,
                           35 * canvasContext.widthScale,
                           15 * canvasContext.heightScale, fontSize * 10);

  renderingCanvas.fillText(`${score.player2}`,
                           115 * canvasContext.widthScale,
                           15 * canvasContext.heightScale, fontSize * 10);

  const borderRadius = 8;
  renderingCanvas.beginPath();
  renderingCanvas.roundRect(1, 1,
                             widthRatio * canvasContext.widthScale - 2,
                            heightRatio * canvasContext.heightScale - 2,
                            borderRadius);
  renderingCanvas.stroke();

  const midfieldStripSize = player1.size;
  const midfieldStripXPos =
        ((widthRatio / 2)  - (midfieldStripSize.width / 2))
        * canvasContext.widthScale;
  for (let i = midfieldStripSize.height / 2;
       i < heightRatio ;
       i += 2* midfieldStripSize.height) {

    renderingCanvas.fillRect(
      midfieldStripXPos,
      i  * canvasContext.heightScale,
      midfieldStripSize.width  * canvasContext.widthScale,
      midfieldStripSize.height * canvasContext.heightScale);
  }

  renderingCanvas.fillStyle = player1.color;
  renderingCanvas.fillRect(player1.position.x  * canvasContext.widthScale,
                           player1.position.y  * canvasContext.heightScale,
                           player1.size.width  * canvasContext.widthScale,
                           player1.size.height * canvasContext.heightScale);

  renderingCanvas.fillStyle = player2.color;
  renderingCanvas.fillRect(player2.position.x  * canvasContext.widthScale,
                           player2.position.y  * canvasContext.heightScale,
                           player2.size.width  * canvasContext.widthScale,
                           player2.size.height * canvasContext.heightScale);


  if (isKickoff())
    return ;

  renderingCanvas.fillStyle = ball.color;
  renderingCanvas.fillRect(ball.position.x  * canvasContext.widthScale,
                           ball.position.y  * canvasContext.heightScale,
                           ball.size.width  * canvasContext.widthScale,
                           ball.size.height * canvasContext.heightScale);
}
