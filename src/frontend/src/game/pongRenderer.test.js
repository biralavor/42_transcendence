import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  widthRatio,
  heightRatio,
  aspectRatio,
  CanvasGameContext,
  render,
} from './pongRenderer.js'
import {
  makeContextSpy,
  makeCanvasStub,
  makeGameState,
  stubGetComputedStyle,
} from './__test-harness__/rendererMock.js'

describe('pongRenderer — module constants', () => {
  it('widthRatio is 160 (the design width unit)', () => {
    expect(widthRatio).toBe(160)
  })

  it('heightRatio is 90 (the design height unit)', () => {
    expect(heightRatio).toBe(90)
  })

  it('aspectRatio matches widthRatio / heightRatio', () => {
    expect(aspectRatio).toBe(widthRatio / heightRatio)
  })
})

describe('pongRenderer — CanvasGameContext getters', () => {
  let cssSpy
  beforeEach(() => { cssSpy = stubGetComputedStyle() })
  afterEach(() => { cssSpy.mockRestore() })

  it('width and height pass through from the canvas', () => {
    const canvas = makeCanvasStub({ width: 1280, height: 720 })
    const ctx = new CanvasGameContext(canvas, makeContextSpy())
    expect(ctx.width).toBe(1280)
    expect(ctx.height).toBe(720)
  })

  it('widthScale = canvas.width / widthRatio', () => {
    const canvas = makeCanvasStub({ width: 1600, height: 900 })
    const ctx = new CanvasGameContext(canvas, makeContextSpy())
    expect(ctx.widthScale).toBe(1600 / 160)
  })

  it('heightScale = canvas.height / heightRatio', () => {
    const canvas = makeCanvasStub({ width: 1600, height: 900 })
    const ctx = new CanvasGameContext(canvas, makeContextSpy())
    expect(ctx.heightScale).toBe(900 / 90)
  })

  it('exposes widthRatio and heightRatio as the module constants', () => {
    const canvas = makeCanvasStub()
    const ctx = new CanvasGameContext(canvas, makeContextSpy())
    expect(ctx.widthRatio).toBe(widthRatio)
    expect(ctx.heightRatio).toBe(heightRatio)
  })

  it('primaryColor reads the --primary CSS variable from the canvas', () => {
    const canvas = makeCanvasStub({ cssVars: { '--primary': '#deadbe' } })
    const ctx = new CanvasGameContext(canvas, makeContextSpy())
    expect(ctx.primaryColor).toBe('#deadbe')
  })

  it('crtWhite reads the --crt-white CSS variable from the canvas', () => {
    const canvas = makeCanvasStub({ cssVars: { '--crt-white': '#ffffff' } })
    const ctx = new CanvasGameContext(canvas, makeContextSpy())
    expect(ctx.crtWhite).toBe('#ffffff')
  })
})

describe('pongRenderer.render — background branch', () => {
  let cssSpy
  beforeEach(() => { cssSpy = stubGetComputedStyle() })
  afterEach(() => { cssSpy.mockRestore() })

  function setupRender({ themeImages = null, themeKey = '' } = {}) {
    const canvas = makeCanvasStub()
    const renderingCtx = makeContextSpy()
    const ctx = new CanvasGameContext(canvas, renderingCtx)
    render(ctx, makeGameState(), () => false, themeImages, themeKey)
    return renderingCtx
  }

  it('calls reset() exactly once at the start of every render', () => {
    const renderingCtx = setupRender()
    expect(renderingCtx.reset).toHaveBeenCalledTimes(1)
  })

  it('draws the background image when themeImages.background is provided', () => {
    const bgImage = { __id: 'bg' }
    const renderingCtx = setupRender({
      themeImages: { background: bgImage, ball: null, paddleLeft: null, paddleRight: null },
    })
    const bgCalls = renderingCtx.drawImage.mock.calls.filter(
      ([img]) => img === bgImage
    )
    expect(bgCalls.length).toBe(1)
  })

  it('does not draw a background image when themeImages is null', () => {
    const renderingCtx = setupRender({ themeImages: null })
    expect(renderingCtx.drawImage).not.toHaveBeenCalled()
  })
})

describe('pongRenderer.render — paddle branch', () => {
  let cssSpy
  beforeEach(() => { cssSpy = stubGetComputedStyle() })
  afterEach(() => { cssSpy.mockRestore() })

  function setupRender({ themeImages = null } = {}) {
    const canvas = makeCanvasStub()
    const renderingCtx = makeContextSpy()
    const ctx = new CanvasGameContext(canvas, renderingCtx)
    render(ctx, makeGameState(), () => false, themeImages, '')
    return renderingCtx
  }

  it('uses drawImage(paddleLeft) when themeImages.paddleLeft is set', () => {
    const paddle = { __id: 'paddle-left' }
    const renderingCtx = setupRender({
      themeImages: { background: null, ball: null, paddleLeft: paddle, paddleRight: null },
    })
    const paddleCalls = renderingCtx.drawImage.mock.calls.filter(
      ([img]) => img === paddle
    )
    expect(paddleCalls.length).toBe(1)
  })

  it('uses drawImage(paddleRight) when themeImages.paddleRight is set', () => {
    const paddle = { __id: 'paddle-right' }
    const renderingCtx = setupRender({
      themeImages: { background: null, ball: null, paddleLeft: null, paddleRight: paddle },
    })
    const paddleCalls = renderingCtx.drawImage.mock.calls.filter(
      ([img]) => img === paddle
    )
    expect(paddleCalls.length).toBe(1)
  })

  it('falls back to fillRect for paddles when no theme images', () => {
    const renderingCtx = setupRender({ themeImages: null })
    expect(renderingCtx.drawImage).not.toHaveBeenCalled()
    expect(renderingCtx.fillRect.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})

describe('pongRenderer.render — ball theming', () => {
  let cssSpy
  beforeEach(() => { cssSpy = stubGetComputedStyle() })
  afterEach(() => { cssSpy.mockRestore() })

  function setupRender({ themeImages = null, themeKey = '' } = {}) {
    const canvas = makeCanvasStub()
    const renderingCtx = makeContextSpy()
    const ctx = new CanvasGameContext(canvas, renderingCtx)
    render(ctx, makeGameState(), () => false, themeImages, themeKey)
    return renderingCtx
  }

  it('neon-pong: draws ball as fillRect (no drawImage)', () => {
    const renderingCtx = setupRender({ themeKey: 'neon-pong' })
    expect(renderingCtx.drawImage).not.toHaveBeenCalled()
    expect(renderingCtx.fillRect).toHaveBeenCalled()
  })

  it('neon-two-paddle: draws ball as fillRect + strokeRect (outline)', () => {
    const renderingCtx = setupRender({ themeKey: 'neon-two-paddle' })
    expect(renderingCtx.strokeRect.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(renderingCtx.drawImage).not.toHaveBeenCalled()
  })

  it('neon-central-paddle: draws ball as fillRect + strokeRect (outline)', () => {
    const renderingCtx = setupRender({ themeKey: 'neon-central-paddle' })
    expect(renderingCtx.strokeRect.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(renderingCtx.drawImage).not.toHaveBeenCalled()
  })

  it('themeImages.ball: drawImage is used for the ball', () => {
    const ballImg = { __id: 'ball' }
    const renderingCtx = setupRender({
      themeImages: { background: null, ball: ballImg, paddleLeft: null, paddleRight: null },
      themeKey: 'classic',
    })
    const ballCalls = renderingCtx.drawImage.mock.calls.filter(
      ([img]) => img === ballImg
    )
    expect(ballCalls.length).toBe(1)
  })

  it('default (no theme, no images): falls back to fillRect with ball.color', () => {
    const renderingCtx = setupRender({ themeKey: '', themeImages: null })
    expect(renderingCtx.drawImage).not.toHaveBeenCalled()
    expect(renderingCtx.fillRect).toHaveBeenCalled()
  })
})

describe('pongRenderer.render — kickoff and neon score', () => {
  let cssSpy
  beforeEach(() => { cssSpy = stubGetComputedStyle() })
  afterEach(() => { cssSpy.mockRestore() })

  it('kickoff=true: ball draw is skipped (drawImage not called for ball image)', () => {
    const ballImg = { __id: 'ball-img' }
    const canvas = makeCanvasStub()
    const renderingCtx = makeContextSpy()
    const ctx = new CanvasGameContext(canvas, renderingCtx)
    render(
      ctx,
      makeGameState(),
      () => true,
      { background: null, ball: ballImg, paddleLeft: null, paddleRight: null },
      ''
    )
    const ballCalls = renderingCtx.drawImage.mock.calls.filter(
      ([img]) => img === ballImg
    )
    expect(ballCalls.length).toBe(0)
  })

  it('kickoff=true: paddles are still drawn', () => {
    const paddleImg = { __id: 'paddle' }
    const canvas = makeCanvasStub()
    const renderingCtx = makeContextSpy()
    const ctx = new CanvasGameContext(canvas, renderingCtx)
    render(
      ctx,
      makeGameState(),
      () => true,
      { background: null, ball: null, paddleLeft: paddleImg, paddleRight: paddleImg },
      ''
    )
    const paddleCalls = renderingCtx.drawImage.mock.calls.filter(
      ([img]) => img === paddleImg
    )
    expect(paddleCalls.length).toBe(2)
  })

  it('neon-pong: scores get both fillText and strokeText (rainbow outline)', () => {
    const canvas = makeCanvasStub()
    const renderingCtx = makeContextSpy()
    const ctx = new CanvasGameContext(canvas, renderingCtx)
    render(ctx, makeGameState({ score: { player1: 5, player2: 7 } }), () => false, null, 'neon-pong')
    expect(renderingCtx.fillText).toHaveBeenCalledTimes(2)
    expect(renderingCtx.strokeText).toHaveBeenCalledTimes(2)
  })

  it('non-neon theme: scores get fillText only, no strokeText', () => {
    const canvas = makeCanvasStub()
    const renderingCtx = makeContextSpy()
    const ctx = new CanvasGameContext(canvas, renderingCtx)
    render(ctx, makeGameState(), () => false, null, 'classic')
    expect(renderingCtx.fillText).toHaveBeenCalledTimes(2)
    expect(renderingCtx.strokeText).not.toHaveBeenCalled()
  })

  it('neon-pong: createLinearGradient is called for the rainbow stroke', () => {
    const canvas = makeCanvasStub()
    const renderingCtx = makeContextSpy()
    const ctx = new CanvasGameContext(canvas, renderingCtx)
    render(ctx, makeGameState(), () => false, null, 'neon-pong')
    expect(renderingCtx.createLinearGradient).toHaveBeenCalled()
  })
})
