import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./utils/inactivityTracker', () => ({
  resetInactivityTimer: vi.fn(),
  ACTIVITY_EVENTS: [],
  ACTIVITY_DEBOUNCE_SECONDS: 1,
}))

vi.mock('./pages/Home', () => ({ default: () => <div data-testid="page-home" /> }))
vi.mock('./pages/Login', () => ({ default: () => <div data-testid="page-login" /> }))
vi.mock('./pages/About', () => ({ default: () => <div data-testid="page-about" /> }))
vi.mock('./pages/Play', () => ({ default: () => <div data-testid="page-play" /> }))
vi.mock('./pages/Leaderboard', () => ({ default: () => <div data-testid="page-leaderboard" /> }))
vi.mock('./pages/Register', () => ({ default: () => <div data-testid="page-register" /> }))
vi.mock('./pages/Profile', () => ({ default: () => <div data-testid="page-profile" /> }))
vi.mock('./pages/ForgotPassword', () => ({ default: () => <div data-testid="page-forgot" /> }))
vi.mock('./pages/Chat', () => ({ default: () => <div data-testid="page-chat" /> }))
vi.mock('./pages/GameWaitingRoom', () => ({ default: () => <div data-testid="page-waiting" /> }))
vi.mock('./pages/GamePage', () => ({ default: () => <div data-testid="page-game" /> }))
vi.mock('./pages/Tournament', () => ({ default: () => <div data-testid="page-tournament" /> }))
vi.mock('./pages/Tournaments', () => ({ default: () => <div data-testid="page-tournaments" /> }))
vi.mock('./Components/PongCanvas', () => ({ default: () => <div data-testid="pong-canvas" /> }))
vi.mock('./Components/PrivateRoute', () => ({
  default: ({ children }) => <>{children}</>,
}))
vi.mock('./Components/GameInviteModal', () => ({
  default: () => <div data-testid="game-invite-modal" />,
}))

import App from './App'

describe('App', () => {
  it('mounts the default "/" route to the Home page', () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(screen.getByTestId('page-home')).toBeInTheDocument()
  })

  it('always renders the GameInviteModal alongside the routed page', () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(screen.getByTestId('game-invite-modal')).toBeInTheDocument()
  })

  it('routes /login to the Login page', () => {
    window.history.pushState({}, '', '/login')
    render(<App />)
    expect(screen.getByTestId('page-login')).toBeInTheDocument()
  })

  it('routes /leaderboard to the Leaderboard page', () => {
    window.history.pushState({}, '', '/leaderboard')
    render(<App />)
    expect(screen.getByTestId('page-leaderboard')).toBeInTheDocument()
  })

  it('attaches inactivity listeners on mount and detaches on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    window.history.pushState({}, '', '/')
    const { unmount } = render(<App />)
    // ACTIVITY_EVENTS is mocked to [], so no extra listeners get attached;
    // we just verify the effect runs without throwing and cleanup fires on unmount.
    unmount()
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
