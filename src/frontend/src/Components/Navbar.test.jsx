import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NavbarComponent from './Navbar'

vi.mock('../context/authContext', () => ({ useAuth: vi.fn() }))
import { useAuth } from '../context/authContext'

// Mock the useUser hook
const mockUseUser = vi.fn()
vi.mock('../context/userContext', () => ({
  useUser: () => mockUseUser(),
  UserProvider: ({ children }) => <>{children}</>,
}))

vi.mock('../context/notificationContext', () => ({ useNotifications: vi.fn() }))
import { useNotifications } from '../context/notificationContext'

vi.mock('../context/unreadContext', () => ({ useUnread: vi.fn() }))
import { useUnread } from '../context/unreadContext'

// Mock apiCall so the admin-detection useEffect doesn't leak a real fetch promise
// after tests tear down (which used to crash with "useAuth is undefined" on late re-renders).
vi.mock('../utils/apiClient', () => ({ apiCall: vi.fn() }))
import { apiCall } from '../utils/apiClient'

vi.mock('./NotificationPanel', () => ({
    default: ({ onClose }) => (
        <div data-testid="notif-panel">
            <button onClick={onClose}>close-panel</button>
        </div>
    ),
}))

function renderNavbar() {
    return render(<MemoryRouter><NavbarComponent /></MemoryRouter>)
}

describe('Navbar — bell and DM badge', () => {
    beforeEach(() => {
        useAuth.mockReturnValue({ isAuthenticated: true, logout: vi.fn() })
        
        useNotifications.mockReturnValue({ unreadCount: 0 })
        useUnread.mockReturnValue({ unreadCounts: {} })
        mockUseUser.mockReturnValue({
          user: { id: 1, username: 'Alice' },
          token: 'fake-token',
        })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('shows bell button when authenticated', () => {
        renderNavbar()
        expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument()
    })

    it('does not show bell button when unauthenticated', () => {
        useAuth.mockReturnValue({ isAuthenticated: false, logout: vi.fn() })
        renderNavbar()
        expect(screen.queryByRole('button', { name: /notifications/i })).toBeNull()
    })

    it('hides bell badge when unreadCount is 0', () => {
        renderNavbar()
        expect(screen.queryByTestId('bell-badge')).toBeNull()
    })

    it('shows bell badge with correct count when unreadCount > 0', () => {
        useNotifications.mockReturnValue({ unreadCount: 5 })
        renderNavbar()
        expect(screen.getByTestId('bell-badge')).toHaveTextContent('5')
    })

    it('bell badge sums system notifications and DM unreads', () => {
        useNotifications.mockReturnValue({ unreadCount: 2 })
        useUnread.mockReturnValue({ unreadCounts: { 'DM-1-2': 3 } })
        renderNavbar()
        expect(screen.getByTestId('bell-badge')).toHaveTextContent('5')
    })

    it('bell badge shows DM count alone when no system notifications', () => {
        useUnread.mockReturnValue({ unreadCounts: { 'DM-1-2': 1, 'DM-1-3': 2 } })
        renderNavbar()
        expect(screen.getByTestId('bell-badge')).toHaveTextContent('3')
    })

    it('hides bell badge when both system and DM unreads are 0', () => {
        renderNavbar()
        expect(screen.queryByTestId('bell-badge')).toBeNull()
    })

    it('opens NotificationPanel on bell click', () => {
        renderNavbar()
        fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
        expect(screen.getByTestId('notif-panel')).toBeInTheDocument()
    })

    it('closes NotificationPanel when onClose fires', () => {
        renderNavbar()
        fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
        fireEvent.click(screen.getByText('close-panel'))
        expect(screen.queryByTestId('notif-panel')).toBeNull()
    })

    it('does not show DM badge on Chat link (bell is the sole unread indicator)', () => {
        useUnread.mockReturnValue({ unreadCounts: { 'DM-1-2': 2, 'DM-1-3': 1 } })
        renderNavbar()
        expect(screen.queryByTestId('dm-badge')).toBeNull()
    })

    it('debounces user search and renders dropdown results', async () => {
        vi.useFakeTimers()

        // Branch on URL: /auth/me from admin-detection returns non-admin; search returns alice.
        apiCall.mockImplementation((url) => {
            if (typeof url === 'string' && url.includes('/api/users/search')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        results: [{ id: 7, username: 'alice', avatar_url: '/avatars/alice.png' }],
                        total: 1,
                        page: 1,
                        per_page: 5,
                    }),
                })
            }
            return Promise.resolve({ ok: true, json: async () => ({ is_admin: false }) })
        })

        renderNavbar()
        fireEvent.click(screen.getByRole('button', { name: /open user search/i }))
        const searchInput = screen.getByRole('searchbox', { name: /search users/i })

        fireEvent.focus(searchInput)
        fireEvent.change(searchInput, {
            target: { value: 'ali' },
        })

        expect(apiCall).not.toHaveBeenCalledWith(
            expect.stringContaining('/api/users/search'),
            expect.anything(),
        )

        await act(async () => {
            vi.advanceTimersByTime(300)
        })

        vi.useRealTimers()

        await waitFor(() => {
            expect(apiCall).toHaveBeenCalledWith(
                '/api/users/search?q=ali&page=1&per_page=5&sort=username',
                expect.objectContaining({ signal: expect.any(AbortSignal) })
            )
        })

        expect(await screen.findByText('alice')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /see all results/i })).toHaveAttribute('href', '/search?q=ali')
    })

    it('shows the search toggle and hides the input by default', () => {
        renderNavbar()
        expect(
            screen.getByRole('button', { name: /open user search/i })
        ).toBeInTheDocument()
        expect(
            screen.queryByRole('searchbox', { name: /search users/i })
        ).not.toBeInTheDocument()
    })

    it('clicking the toggle reveals the input and auto-focuses it', async () => {
        renderNavbar()
        const toggle = screen.getByRole('button', { name: /open user search/i })

        fireEvent.click(toggle)

        const input = await screen.findByRole('searchbox', { name: /search users/i })
        expect(input).toBeInTheDocument()
        await waitFor(() => {
            expect(document.activeElement).toBe(input)
        })
        expect(
            screen.queryByRole('button', { name: /open user search/i })
        ).not.toBeInTheDocument()
    })

    it('pressing Escape in the input closes the search and restores the toggle', async () => {
        renderNavbar()
        fireEvent.click(screen.getByRole('button', { name: /open user search/i }))

        const input = await screen.findByRole('searchbox', { name: /search users/i })
        fireEvent.change(input, { target: { value: 'al' } })
        fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' })

        await waitFor(() => {
            expect(
                screen.queryByRole('searchbox', { name: /search users/i })
            ).not.toBeInTheDocument()
        })
        expect(
            screen.getByRole('button', { name: /open user search/i })
        ).toBeInTheDocument()
    })
})
