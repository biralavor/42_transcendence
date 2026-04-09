import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NotificationPanel from './NotificationPanel'

vi.mock('../context/notificationContext', () => ({
    useNotifications: vi.fn(),
}))
import { useNotifications } from '../context/notificationContext'

const MOCK_NOTIFS = [
    { id: 1, type: 'friend_request', message: 'Alice sent you a friend request', read: false },
    { id: 2, type: 'friend_request_accepted', message: 'Bob accepted your request', read: true },
]

const defaultCtx = () => ({
    notifications: MOCK_NOTIFS,
    unreadCount: 1,
    fetchNotifications: vi.fn().mockResolvedValue(undefined),
    markRead: vi.fn().mockResolvedValue(undefined),
    markAllRead: vi.fn().mockResolvedValue(undefined),
    removeNotification: vi.fn().mockResolvedValue(undefined),
    setInviteVisible: vi.fn(),
})

beforeEach(() => {
    useNotifications.mockReturnValue(defaultCtx())
})

describe('NotificationPanel', () => {
    it('renders all notification messages', () => {
        render(<NotificationPanel onClose={vi.fn()} />)
        expect(screen.getByText('Alice sent you a friend request')).toBeInTheDocument()
        expect(screen.getByText('Bob accepted your request')).toBeInTheDocument()
    })

    it('unread items have notif-panel__item--unread class', () => {
        render(<NotificationPanel onClose={vi.fn()} />)
        const items = screen.getAllByRole('listitem')
        expect(items[0].classList.contains('notif-panel__item--unread')).toBe(true)
        expect(items[1].classList.contains('notif-panel__item--unread')).toBe(false)
    })

    it('clicking an unread notification calls markRead with its id', () => {
        const markRead = vi.fn().mockResolvedValue(undefined)
        useNotifications.mockReturnValue({ ...defaultCtx(), markRead })
        render(<NotificationPanel onClose={vi.fn()} />)
        fireEvent.click(screen.getAllByRole('listitem')[0])
        expect(markRead).toHaveBeenCalledWith(1)
    })

    it('clicking a read notification does NOT call markRead', () => {
        const markRead = vi.fn()
        useNotifications.mockReturnValue({ ...defaultCtx(), markRead })
        render(<NotificationPanel onClose={vi.fn()} />)
        fireEvent.click(screen.getAllByRole('listitem')[1])
        expect(markRead).not.toHaveBeenCalled()
    })

    it('"Mark all as read" button calls markAllRead', () => {
        const markAllRead = vi.fn().mockResolvedValue(undefined)
        useNotifications.mockReturnValue({ ...defaultCtx(), markAllRead })
        render(<NotificationPanel onClose={vi.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: /mark all as read/i }))
        expect(markAllRead).toHaveBeenCalledOnce()
    })

    it('calls fetchNotifications on mount', () => {
        const fetchNotifications = vi.fn().mockResolvedValue(undefined)
        useNotifications.mockReturnValue({ ...defaultCtx(), fetchNotifications })
        render(<NotificationPanel onClose={vi.fn()} />)
        expect(fetchNotifications).toHaveBeenCalledOnce()
    })

    it('shows empty state when notifications list is empty', () => {
        useNotifications.mockReturnValue({ ...defaultCtx(), notifications: [] })
        render(<NotificationPanel onClose={vi.fn()} />)
        expect(screen.getByText(/no notifications/i)).toBeInTheDocument()
    })
})
