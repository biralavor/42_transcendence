// src/frontend/src/pages/Profile.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Profile from './Profile'

let mockAuth = { access_token: 'fake-token' }
vi.mock('../context/authContext', () => ({
  useAuth: () => ({ auth: mockAuth }),
}))

vi.mock('../context/notificationContext', () => ({
  useNotifications: () => ({ achievementQueue: [], dismissAchievement: vi.fn() }),
}))

vi.mock('../Components/Navbar', () => ({
  default: () => <div data-testid="navbar" />,
}))

vi.mock('../Components/GameSettings', () => ({
  default: () => <div data-testid="game-settings" />,
}))

vi.mock('../Components/FriendsSidebar', () => ({
  default: () => <div data-testid="friends-sidebar" />,
}))

vi.mock('../utils/avatarFilter', () => ({
  getAvatarFilter: vi.fn(() => 'none'),
}))

const FAKE_OBJECT_URL = 'blob:fake-object-url'

function makeImageFile({
  name = 'avatar.png',
  type = 'image/png',
  size = 1024,
} = {}) {
  const file = new File([new Uint8Array(1)], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function mockProfileBoot({ avatarUrl = '/uploads/avatars/1.png' } = {}) {
  // Order matches Profile's effect:
  // 1) GET /api/users/auth/me
  // 2) GET /api/users/profile/{id}
  // 3) GET /api/game/matches/history?player_id={id}
  // 4) GET /api/game/leaderboard?player_id={id}&limit=1
  // 5) GET /api/game/xp/{id}          (fired after core profile loads)
  // 6) GET /api/game/achievements/{id} (fired after core profile loads)
  vi.spyOn(global, 'fetch')
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1, username: 'alice' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 1,
          username: 'alice',
          display_name: 'Alice',
          dark_mode: false,
          avatar_url: avatarUrl,
          bio: '',
          status: 'online',
          created_at: '2026-01-01',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [],
          summary: { player_id: 1, wins: 0, losses: 0, total_matches: 0 },
          total: 0,
          page: 1,
          per_page: 10,
          last_page: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          player_stats: {
            player_id: 1,
            rank: 1,
            wins: 0,
            losses: 0,
            total_matches: 0,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    // XP response (loaded after core profile)
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ user_id: 1, xp: 25, level: 1, xp_in_level: 25, xp_to_next_level: 100 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    // Achievements response (loaded after core profile)
    .mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )
}

function renderProfile() {
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>
  )
}

function renderProfileRoute(initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/profile/:profileUserId" element={<Profile />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Profile avatar UI', () => {
  let restoreCreateObjectURL
  let restoreRevokeObjectURL

  beforeEach(() => {
    mockAuth = { access_token: 'fake-token' }
    sessionStorage.clear()
    localStorage.clear()
    sessionStorage.setItem('access_token', 'fake-token')
    sessionStorage.setItem('refresh_token', 'fake-refresh')
    sessionStorage.setItem('token_type', 'bearer')

    const hadCreate = 'createObjectURL' in URL
    const hadRevoke = 'revokeObjectURL' in URL
    const origCreate = URL.createObjectURL
    const origRevoke = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => FAKE_OBJECT_URL)
    URL.revokeObjectURL = vi.fn()
    restoreCreateObjectURL = () => {
      if (hadCreate) URL.createObjectURL = origCreate
      else delete URL.createObjectURL
    }
    restoreRevokeObjectURL = () => {
      if (hadRevoke) URL.revokeObjectURL = origRevoke
      else delete URL.revokeObjectURL
    }
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    restoreCreateObjectURL?.()
    restoreRevokeObjectURL?.()
  })

  it('renders Change avatar and Remove buttons after profile loads', async () => {
    mockProfileBoot()
    renderProfile()

    expect(
      await screen.findByRole('button', { name: /change avatar/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^remove$/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /confirm upload/i })
    ).not.toBeInTheDocument()
  })

  it('disables Remove when current avatar is the placeholder', async () => {
    mockProfileBoot({ avatarUrl: null })
    renderProfile()

    const removeBtn = await screen.findByRole('button', { name: /^remove$/i })
    expect(removeBtn).toBeDisabled()
  })

  it('shows error toast for non-image MIME and does not upload', async () => {
    mockProfileBoot()
    renderProfile()

    await screen.findByRole('button', { name: /change avatar/i })
    const fileInput = screen.getByLabelText(/choose avatar image/i)

    const fetchSpy = global.fetch
    const callsBefore = fetchSpy.mock.calls.length

    fireEvent.change(fileInput, {
      target: { files: [makeImageFile({ type: 'text/plain', name: 'note.txt' })] },
    })

    expect(
      await screen.findByText(/only jpeg, png, or webp images are allowed/i)
    ).toBeInTheDocument()
    expect(fetchSpy.mock.calls.length).toBe(callsBefore)
    expect(
      screen.queryByRole('button', { name: /confirm upload/i })
    ).not.toBeInTheDocument()
  })

  it('shows error toast when file exceeds 2 MB', async () => {
    mockProfileBoot()
    renderProfile()

    await screen.findByRole('button', { name: /change avatar/i })
    const fileInput = screen.getByLabelText(/choose avatar image/i)

    fireEvent.change(fileInput, {
      target: {
        files: [makeImageFile({ size: 2 * 1024 * 1024 + 1 })],
      },
    })

    expect(
      await screen.findByText(/maximum size is 2 mb/i)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /confirm upload/i })
    ).not.toBeInTheDocument()
  })

  it('shows preview with Confirm/Cancel after picking a valid image', async () => {
    mockProfileBoot()
    renderProfile()

    await screen.findByRole('button', { name: /change avatar/i })
    const fileInput = screen.getByLabelText(/choose avatar image/i)

    fireEvent.change(fileInput, {
      target: { files: [makeImageFile()] },
    })

    expect(
      await screen.findByRole('button', { name: /confirm upload/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /change avatar/i })
    ).not.toBeInTheDocument()

    const img = screen.getByAltText(/user avatar/i)
    expect(img).toHaveAttribute('src', FAKE_OBJECT_URL)
  })

  it('Cancel clears the preview and revokes the object URL', async () => {
    mockProfileBoot()
    renderProfile()

    await screen.findByRole('button', { name: /change avatar/i })
    const fileInput = screen.getByLabelText(/choose avatar image/i)
    fireEvent.change(fileInput, { target: { files: [makeImageFile()] } })

    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))

    expect(
      await screen.findByRole('button', { name: /change avatar/i })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(FAKE_OBJECT_URL)
    })
  })

  it('Confirm upload posts FormData and updates avatar on success', async () => {
    mockProfileBoot()
    renderProfile()

    await screen.findByRole('button', { name: /change avatar/i })
    const fileInput = screen.getByLabelText(/choose avatar image/i)
    fireEvent.change(fileInput, { target: { files: [makeImageFile()] } })

    const fetchSpy = global.fetch
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ avatar_url: '/uploads/avatars/1.png' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    fireEvent.click(await screen.findByRole('button', { name: /confirm upload/i }))

    await waitFor(() => {
      expect(screen.getByText(/avatar updated/i)).toBeInTheDocument()
    })

    const uploadCall = fetchSpy.mock.calls.find(
      ([url, opts]) => url === '/api/users/avatar' && opts?.method === 'POST'
    )
    expect(uploadCall).toBeDefined()
    const [, options] = uploadCall
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('file')).toBeInstanceOf(File)
    // Browser must set the multipart Content-Type itself; we should not pass one.
    expect(options.headers?.['Content-Type']).toBeUndefined()
    expect(options.headers?.Authorization).toMatch(/^Bearer /)

    // After success, preview is gone and the avatar src includes the cache buster
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /confirm upload/i })
      ).not.toBeInTheDocument()
    })
    const img = screen.getByAltText(/user avatar/i)
    expect(img.getAttribute('src')).toMatch(/\/uploads\/avatars\/1\.png\?v=\d+/)
  })

  it('shows error toast when upload returns non-OK', async () => {
    mockProfileBoot()
    renderProfile()

    await screen.findByRole('button', { name: /change avatar/i })
    const fileInput = screen.getByLabelText(/choose avatar image/i)
    fireEvent.change(fileInput, { target: { files: [makeImageFile()] } })

    global.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'File exceeds 2 MB limit' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    fireEvent.click(await screen.findByRole('button', { name: /confirm upload/i }))

    expect(
      await screen.findByText(/file exceeds 2 mb limit/i)
    ).toBeInTheDocument()
    // Still in preview state so user can retry
    expect(
      screen.getByRole('button', { name: /confirm upload/i })
    ).toBeInTheDocument()
  })

  it('Remove sends DELETE and reverts avatar to placeholder', async () => {
    mockProfileBoot()
    renderProfile()

    const removeBtn = await screen.findByRole('button', { name: /^remove$/i })

    global.fetch.mockResolvedValueOnce(new Response(null, { status: 204 }))

    fireEvent.click(removeBtn)

    await waitFor(() => {
      expect(screen.getByText(/avatar removed/i)).toBeInTheDocument()
    })

    const deleteCall = global.fetch.mock.calls.find(
      ([url, opts]) => url === '/api/users/avatar' && opts?.method === 'DELETE'
    )
    expect(deleteCall).toBeDefined()
    expect(deleteCall[1].headers?.Authorization).toMatch(/^Bearer /)

    const img = screen.getByAltText(/user avatar/i)
    expect(img.getAttribute('src')).toMatch(/avatar_placeholder\.jpg/)
    // Remove button should now be disabled (placeholder = nothing to remove)
    expect(screen.getByRole('button', { name: /^remove$/i })).toBeDisabled()
  })
})

describe('Profile page (general)', () => {
  beforeEach(() => {
    mockAuth = { access_token: 'fake-token' }
    sessionStorage.clear()
    localStorage.clear()
    sessionStorage.setItem('access_token', 'fake-token')
    sessionStorage.setItem('refresh_token', 'fake-refresh')
    sessionStorage.setItem('token_type', 'bearer')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state before profile data resolves', () => {
    // No fetch mock — promise never resolves within this synchronous render
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => { }))
    renderProfile()
    expect(screen.getByText(/loading profile/i)).toBeInTheDocument()
  })

  it('shows "Not authenticated" when there is no access token', async () => {
    mockAuth = { access_token: null }
    renderProfile()
    expect(await screen.findByText(/not authenticated/i)).toBeInTheDocument()
  })

  it('shows error message when profile fetch fails', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1, username: 'alice' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))

    renderProfile()
    expect(await screen.findByText(/profile fetch failed: 500/i)).toBeInTheDocument()
  })

  it('renders display name, username and stats from fetched data', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 7, username: 'alice' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 7,
            username: 'alice',
            display_name: 'Alice the Brave',
            dark_mode: false,
            avatar_url: '/uploads/avatars/7.png',
            bio: 'hi there',
            status: 'online',
            created_at: '2026-01-01',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [],
            summary: { player_id: 7, wins: 8, losses: 2, total_matches: 10 },
            total: 0,
            page: 1,
            per_page: 10,
            last_page: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            player_stats: {
              player_id: 7,
              rank: 5,
              wins: 8,
              losses: 2,
              total_matches: 10,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

    renderProfile()
    expect(await screen.findByText('Alice the Brave')).toBeInTheDocument()
    expect(screen.getByText('@alice')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument() // wins
    expect(screen.getByText('10')).toBeInTheDocument() // total matches
    expect(screen.getByDisplayValue('hi there')).toBeInTheDocument()
  })

  it('falls back to username when display_name is empty', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1, username: 'solo' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 1,
            username: 'solo',
            display_name: '',
            dark_mode: false,
            avatar_url: null,
            bio: '',
            status: 'online',
            created_at: '2026-01-01',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [],
            summary: { player_id: 1, wins: 0, losses: 0, total_matches: 0 },
            total: 0,
            page: 1,
            per_page: 10,
            last_page: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            player_stats: {
              player_id: 1,
              rank: 1,
              wins: 0,
              losses: 0,
              total_matches: 0,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

    renderProfile()
    const heading = await screen.findByRole('heading', { name: 'solo' })
    expect(heading).toBeInTheDocument()
  })

  it('shows "No matches yet." when match history is empty', async () => {
    mockProfileBoot()
    renderProfile()
    expect(await screen.findByText(/no matches yet/i)).toBeInTheDocument()
  })

  it('renders match history rows when results are present', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1, username: 'alice' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 1,
            username: 'alice',
            display_name: 'Alice',
            dark_mode: false,
            avatar_url: null,
            bio: '',
            status: 'online',
            created_at: '2026-01-01',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                match_id: 100,
                opponent_id: 42,
                date: '2026-04-01T12:00:00Z',
                result: 'win',
                score: '3-1',
              },
              {
                match_id: 101,
                opponent_id: 99,
                date: '2026-04-02T12:00:00Z',
                result: 'loss',
                score: '0-3',
              },
            ],
            summary: { player_id: 1, wins: 1, losses: 1, total_matches: 2 },
            total: 2,
            page: 1,
            per_page: 10,
            last_page: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            player_stats: {
              player_id: 1,
              rank: 10,
              wins: 1,
              losses: 1,
              total_matches: 2,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

    renderProfile()
    expect(await screen.findByText('Player #42')).toBeInTheDocument()
    expect(screen.getByText('Player #99')).toBeInTheDocument()
    expect(screen.getByText('3-1')).toBeInTheDocument()
    expect(screen.getByText('0-3')).toBeInTheDocument()
    expect(screen.queryByText(/no matches yet/i)).not.toBeInTheDocument()
  })

  it('loads a route profile by user id and hides owner-only controls', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1, username: 'alice' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 7,
            username: 'bruno',
            display_name: 'Bruno',
            dark_mode: false,
            avatar_url: null,
            bio: 'visitor profile',
            status: 'online',
            created_at: '2026-01-01',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [],
            summary: { player_id: 7, wins: 2, losses: 1, total_matches: 3 },
            total: 0,
            page: 1,
            per_page: 10,
            last_page: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            player_stats: {
              player_id: 7,
              rank: 4,
              wins: 2,
              losses: 1,
              total_matches: 3,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ user_id: 7, xp: 50, level: 2, xp_in_level: 50, xp_to_next_level: 100 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      )

    renderProfileRoute('/profile/7')

    expect(await screen.findByRole('heading', { name: 'Bruno' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /change avatar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save profile/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('friends-sidebar')).not.toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/users/profile/7',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('Save profile sends PUT with display name, bio and dark mode', async () => {
    mockProfileBoot()
    renderProfile()

    const displayInput = await screen.findByLabelText(/display name/i)
    const bioInput = screen.getByLabelText(/^bio$/i)
    const darkToggle = screen.getByLabelText(/enable dark mode/i)

    fireEvent.change(displayInput, { target: { value: 'Renamed' } })
    fireEvent.change(bioInput, { target: { value: 'fresh bio' } })
    fireEvent.click(darkToggle)

    global.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => {
      expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument()
    })

    const putCall = global.fetch.mock.calls.find(
      ([url, opts]) =>
        url === '/api/users/profile/1' && opts?.method === 'PUT'
    )
    expect(putCall).toBeDefined()
    expect(JSON.parse(putCall[1].body)).toEqual({
      display_name: 'Renamed',
      bio: 'fresh bio',
      dark_mode: true,
    })
    expect(putCall[1].headers?.['Content-Type']).toBe('application/json')
  })

  it('shows failure message when Save profile request fails', async () => {
    mockProfileBoot()
    renderProfile()
    await screen.findByLabelText(/display name/i)

    global.fetch.mockResolvedValueOnce(new Response('nope', { status: 500 }))

    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    expect(
      await screen.findByText(/failed to save profile/i)
    ).toBeInTheDocument()
  })
})
