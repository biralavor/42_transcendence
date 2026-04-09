import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NavbarComponent from './Navbar'

vi.mock('../context/authContext', () => ({ useAuth: vi.fn() }))
import { useAuth } from '../context/authContext'

vi.mock('../context/notificationContext', () => ({ useNotifications: vi.fn() }))
import { useNotifications } from '../context/notificationContext'

vi.mock('../context/unreadContext', () => ({ useUnread: vi.fn() }))
import { useUnread } from '../context/unreadContext'

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

    it('bell badge reflects system notifications only — DMs do not contribute', () => {
        useNotifications.mockReturnValue({ unreadCount: 2 })
        useUnread.mockReturnValue({ unreadCounts: { 'DM-1-2': 3 } })
        renderNavbar()
        // badge must show 2, not 5 (DMs must not be double-counted in bell)
        expect(screen.getByTestId('bell-badge')).toHaveTextContent('2')
    })

    it('hides bell badge when system unreadCount is 0 even if DMs exist', () => {
        useUnread.mockReturnValue({ unreadCounts: { 'DM-1-2': 5 } })
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

    it('shows DM badge on Chat link when there are unread DMs', () => {
        useUnread.mockReturnValue({ unreadCounts: { 'DM-1-2': 2, 'DM-1-3': 1 } })
        renderNavbar()
        expect(screen.getByTestId('dm-badge')).toHaveTextContent('3')
    })

    it('hides DM badge on Chat link when no unread DMs', () => {
        renderNavbar()
        expect(screen.queryByTestId('dm-badge')).toBeNull()
    })
})
