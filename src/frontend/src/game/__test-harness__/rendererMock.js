import { vi } from 'vitest'

export function makeContextSpy() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    shadowColor: '',
    shadowBlur: 0,
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    reset: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  }
}

export function makeCanvasStub({ width = 800, height = 450, cssVars = {} } = {}) {
  const resolved = {
    '--primary': '#00ff00',
    '--crt-white': '#f5f5f5',
    ...cssVars,
  }
  return {
    width,
    height,
    __cssVars: resolved,
  }
}

export function makeGameState(overrides = {}) {
  const base = {
    player1: {
      position: { x: 5, y: 40 },
      size: { width: 2, height: 12 },
      color: '#aaa',
    },
    player2: {
      position: { x: 153, y: 40 },
      size: { width: 2, height: 12 },
      color: '#bbb',
    },
    ball: {
      position: { x: 80, y: 45 },
      size: { width: 2, height: 2 },
      color: '#fff',
    },
    score: {
      player1: 0,
      player2: 0,
    },
  }
  return { ...base, ...overrides }
}

export function stubGetComputedStyle() {
  return vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => ({
    getPropertyValue: (key) => (el.__cssVars && el.__cssVars[key]) || '',
  }))
}
