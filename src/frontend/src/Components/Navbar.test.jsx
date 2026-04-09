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

    it('bell badge includes DM unread count when user has unread DMs', () => {
        useNotifications.mockReturnValue({ unreadCount: 2 })
        useUnread.mockReturnValue({ unreadCounts: { 'DM-1-2': 3 } })
        renderNavbar()
        expect(screen.getByTestId('bell-badge')).toHaveTextContent('5')
    })

    it('bell badge shows DM unread count alone when no system notifications', () => {
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

    it('does not show DM badge on Chat link (bell handles DM count)', () => {
        useUnread.mockReturnValue({ unreadCounts: { 'DM-1-2': 2, 'DM-1-3': 1 } })
        renderNavbar()
        expect(screen.queryByTestId('dm-badge')).toBeNull()
    })
})
