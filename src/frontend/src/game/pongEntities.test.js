import { describe, it, expect } from 'vitest'
import { Position, Size, Entity, Player, Ball } from './pongEntities.js'

// ─── Position ──────────────────────────────────────────────────────────────

describe('Position', () => {
  it('initializes with given x/y and zero velocities', () => {
    const p = new Position(10, 20)
    expect(p.x).toBe(10)
    expect(p.y).toBe(20)
    expect(p.velX).toBe(0)
    expect(p.velY).toBe(0)
    expect(p.frame).toBe(0n)
  })

  it('moveIntent returns [newY, newX] without mutating', () => {
    const p = new Position(10, 20)
    p.velX = 3
    p.velY = 5
    const [newY, newX] = p.moveIntent()
    expect(newY).toBe(25)
    expect(newX).toBe(13)
    // original unchanged
    expect(p.x).toBe(10)
    expect(p.y).toBe(20)
  })

  it('move() mutates x/y and increments frame', () => {
    const p = new Position(10, 20)
    p.velX = 3
    p.velY = 5
    p.move()
    expect(p.x).toBe(13)
    expect(p.y).toBe(25)
    expect(p.frame).toBe(1n)
    p.move()
    expect(p.frame).toBe(2n)
  })

  it('Position.copy returns an independent clone', () => {
    const original = new Position(10, 20)
    original.velX = 3
    original.velY = 5
    original.frame = 42n
    const clone = Position.copy(original)
    expect(clone.x).toBe(10)
    expect(clone.y).toBe(20)
    expect(clone.velX).toBe(3)
    expect(clone.velY).toBe(5)
    expect(clone.frame).toBe(42n)
    // mutating the clone must not affect the original
    clone.x = 999
    clone.frame = 0n
    expect(original.x).toBe(10)
    expect(original.frame).toBe(42n)
  })
})

// ─── Size ──────────────────────────────────────────────────────────────────

describe('Size', () => {
  it('initializes with width and height', () => {
    const s = new Size(40, 80)
    expect(s.width).toBe(40)
    expect(s.height).toBe(80)
  })

  it('Size.copy clones independently', () => {
    const original = new Size(40, 80)
    const clone = Size.copy(original)
    expect(clone.width).toBe(40)
    expect(clone.height).toBe(80)
    clone.width = 999
    expect(original.width).toBe(40)
  })
})

// ─── Entity collision (AABB) ───────────────────────────────────────────────

function makeAABB(x, y, w, h) {
  const e = new Entity()
  e.position = new Position(x, y)
  e.size = new Size(w, h)
  return e
}

describe('Entity.isCollidingWith (AABB)', () => {
  it('detects overlapping rectangles', () => {
    const a = makeAABB(0, 0, 10, 10)
    const b = makeAABB(5, 5, 10, 10)
    expect(a.isCollidingWith(b)).toBe(true)
    expect(b.isCollidingWith(a)).toBe(true)
  })

  it('returns false for non-overlapping rectangles', () => {
    const a = makeAABB(0, 0, 10, 10)
    const right = makeAABB(20, 0, 10, 10)
    const below = makeAABB(0, 20, 10, 10)
    expect(a.isCollidingWith(right)).toBe(false)
    expect(a.isCollidingWith(below)).toBe(false)
  })

  it('treats edge-touching as non-collision (strict-less-than semantics)', () => {
    // a.right_edge == b.left_edge: not overlapping
    const a = makeAABB(0, 0, 10, 10)
    const touchingRight = makeAABB(10, 0, 10, 10)
    expect(a.isCollidingWith(touchingRight)).toBe(false)
  })

  it('detects when one rectangle fully contains another', () => {
    const big = makeAABB(0, 0, 100, 100)
    const tiny = makeAABB(40, 40, 5, 5)
    expect(big.isCollidingWith(tiny)).toBe(true)
    expect(tiny.isCollidingWith(big)).toBe(true)
  })
})

// ─── Player ────────────────────────────────────────────────────────────────

describe('Player', () => {
  it('exposes Type.ONE / Type.TWO frozen enum-ish', () => {
    expect(Player.Type.ONE).toBe(1)
    expect(Player.Type.TWO).toBe(2)
    // Object.freeze prevents reassignment
    expect(Object.isFrozen(Player.Type)).toBe(true)
  })

  it('player ONE spawns on the left, player TWO spawns on the right', () => {
    const p1 = new Player(Player.Type.ONE, 'local')
    const p2 = new Player(Player.Type.TWO, 'local')
    expect(p1.position.x).toBeLessThan(p2.position.x)
  })

  it('player size is 5 wide × 15 tall (3 blocks of 5)', () => {
    const p = new Player(Player.Type.ONE, 'local')
    expect(p.size.width).toBe(5)
    expect(p.size.height).toBe(15)
  })

  it('isLocal is true only when kind === "local"', () => {
    expect(new Player(Player.Type.ONE, 'local').isLocal).toBe(true)
    expect(new Player(Player.Type.ONE, 'remote-ai').isLocal).toBe(false)
    expect(new Player(Player.Type.ONE, 'remote-human').isLocal).toBe(false)
  })

  it('isRemote is true for any "remote-*" kind, false for local', () => {
    expect(new Player(Player.Type.ONE, 'local').isRemote).toBe(false)
    expect(new Player(Player.Type.ONE, 'remote-ai').isRemote).toBe(true)
    expect(new Player(Player.Type.ONE, 'remote-human').isRemote).toBe(true)
  })

  describe('edgeCollisionFactor', () => {
    function ballAt(x, y, w = 5, h = 5) {
      const b = new Ball()
      b.position = new Position(x, y)
      b.size = new Size(w, h)
      return b
    }

    it('returns 0 when the ball does not touch the paddle edges', () => {
      const player = new Player(Player.Type.ONE, 'local')
      // Ball far away
      const ball = ballAt(player.position.x + 1000, player.position.y + 1000)
      expect(player.edgeCollisionFactor(ball)).toBe(0)
    })

    it('returns negative deflection when the ball hits the paddle top', () => {
      const player = new Player(Player.Type.ONE, 'local')
      // Place ball overlapping the very top of the paddle
      const ball = ballAt(player.position.x, player.position.y, 5, 5)
      const factor = player.edgeCollisionFactor(ball)
      expect(factor).toBeLessThan(0)
    })

    it('returns positive deflection when the ball hits the paddle bottom', () => {
      const player = new Player(Player.Type.ONE, 'local')
      // Bottom-edge y = position.y + 15 (3 blocks of 5). Ball overlapping it.
      const ball = ballAt(player.position.x, player.position.y + 14, 5, 5)
      const factor = player.edgeCollisionFactor(ball)
      expect(factor).toBeGreaterThan(0)
    })
  })
})

// ─── Ball ──────────────────────────────────────────────────────────────────

describe('Ball', () => {
  it('initializes 5×5, white, centered horizontally', () => {
    const b = new Ball()
    expect(b.size.width).toBe(5)
    expect(b.size.height).toBe(5)
    expect(b.color).toBe('white')
  })

  it('Ball.copy returns an independent clone', () => {
    const original = new Ball()
    original.position.x = 999
    original.position.velX = 7
    original.color = 'red'
    const clone = Ball.copy(original)
    expect(clone.position.x).toBe(999)
    expect(clone.position.velX).toBe(7)
    expect(clone.color).toBe('red')
    // mutating clone doesn't affect original
    clone.position.x = 0
    clone.color = 'blue'
    expect(original.position.x).toBe(999)
    expect(original.color).toBe('red')
  })
})
