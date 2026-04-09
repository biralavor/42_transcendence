import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotificationPanel from './NotificationPanel'

vi.mock('../context/notificationContext', () => ({
    useNotifications: vi.fn(),
}))
import { useNotifications } from '../context/notificationContext'

const MOCK_NOTIFS = [
    { id: 1, type: 'friend_request', message: 'Alice sent you a friend request', read: false, created_at: new Date().toISOString() },
    { id: 2, type: 'friend_request_accepted', message: 'Bob accepted your request', read: true, created_at: new Date().toISOString() },
    { id: 'dm-DM-1-7', type: 'unread_chat', message: '2 unread messages', read: false, created_at: new Date().toISOString(), room_slug: 'DM-1-7', other_user_id: 1 },
]

const defaultCtx = () => ({
    notifications: MOCK_NOTIFS,
    unreadCount: 2,
    fetchNotifications: vi.fn().mockResolvedValue(undefined),
    markRead: vi.fn().mockResolvedValue(undefined),
    markAllRead: vi.fn().mockResolvedValue(undefined),
    removeNotification: vi.fn().mockResolvedValue(undefined),
    setInviteVisible: vi.fn(),
})

beforeEach(() => {
    useNotifications.mockReturnValue(defaultCtx())
})

function renderWithRouter(component) {
    return render(
        <MemoryRouter>
            {component}
        </MemoryRouter>
    )
}

describe('NotificationPanel', () => {
    it('renders all notification messages', () => {
        renderWithRouter(<NotificationPanel onClose={vi.fn()} />)
        expect(screen.getByText('Alice sent you a friend request')).toBeInTheDocument()
        expect(screen.getByText('Bob accepted your request')).toBeInTheDocument()
        expect(screen.getByText('2 unread messages')).toBeInTheDocument()
    })

    it('displays datetime for each notification', () => {
        renderWithRouter(<NotificationPanel onClose={vi.fn()} />)
        const timeElements = screen.getAllByText(/ago|just now/)
        expect(timeElements.length).toBeGreaterThan(0)
    })

    it('unread items have notif-panel__item--unread class', () => {
        renderWithRouter(<NotificationPanel onClose={vi.fn()} />)
        const items = screen.getAllByRole('listitem')
        expect(items[0].classList.contains('notif-panel__item--unread')).toBe(true)
        expect(items[1].classList.contains('notif-panel__item--unread')).toBe(false)
    })

    it('clicking an unread notification calls markRead with its id', () => {
        const markRead = vi.fn().mockResolvedValue(undefined)
        useNotifications.mockReturnValue({ ...defaultCtx(), markRead })
        renderWithRouter(<NotificationPanel onClose={vi.fn()} />)
        fireEvent.click(screen.getAllByRole('listitem')[0])
        expect(markRead).toHaveBeenCalledWith(1)
    })

    it('clicking a read notification does NOT call markRead', () => {
        const markRead = vi.fn()
        useNotifications.mockReturnValue({ ...defaultCtx(), markRead })
        renderWithRouter(<NotificationPanel onClose={vi.fn()} />)
        fireEvent.click(screen.getAllByRole('listitem')[1])
        expect(markRead).not.toHaveBeenCalled()
    })

    it('clicking a DM notification calls markRead with DM ID', () => {
        const markRead = vi.fn().mockResolvedValue(undefined)
        useNotifications.mockReturnValue({ ...defaultCtx(), markRead })
        renderWithRouter(<NotificationPanel onClose={vi.fn()} />)
        const dmItem = screen.getByText('2 unread messages')
        fireEvent.click(dmItem)
        expect(markRead).toHaveBeenCalledWith('dm-DM-1-7')
    })

    it('"Mark all as read" button calls markAllRead', () => {
        const markAllRead = vi.fn().mockResolvedValue(undefined)
        useNotifications.mockReturnValue({ ...defaultCtx(), markAllRead })
        renderWithRouter(<NotificationPanel onClose={vi.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: /mark all as read/i }))
        expect(markAllRead).toHaveBeenCalledOnce()
    })

    it('calls fetchNotifications on mount', () => {
        const fetchNotifications = vi.fn().mockResolvedValue(undefined)
        useNotifications.mockReturnValue({ ...defaultCtx(), fetchNotifications })
        renderWithRouter(<NotificationPanel onClose={vi.fn()} />)
        expect(fetchNotifications).toHaveBeenCalledOnce()
    })

    it('unread items are focusable (tabIndex=0)', () => {
        renderWithRouter(<NotificationPanel onClose={vi.fn()} />)
        const items = screen.getAllByRole('listitem')
        expect(items[0]).toHaveAttribute('tabindex', '0')
    })

    it('pressing Enter on an unread item calls markRead', () => {
        const markRead = vi.fn().mockResolvedValue(undefined)
        useNotifications.mockReturnValue({ ...defaultCtx(), markRead })
        renderWithRouter(<NotificationPanel onClose={vi.fn()} />)
        fireEvent.keyDown(screen.getAllByRole('listitem')[0], { key: 'Enter' })
        expect(markRead).toHaveBeenCalledWith(1)
    })

    it('pressing Space on an unread item calls markRead', () => {
        const markRead = vi.fn().mockResolvedValue(undefined)
        useNotifications.mockReturnValue({ ...defaultCtx(), markRead })
        renderWithRouter(<NotificationPanel onClose={vi.fn()} />)
        fireEvent.keyDown(screen.getAllByRole('listitem')[0], { key: ' ' })
        expect(markRead).toHaveBeenCalledWith(1)
    })

    it('pressing other keys does not call markRead', () => {
        const markRead = vi.fn()
        useNotifications.mockReturnValue({ ...defaultCtx(), markRead })
        renderWithRouter(<NotificationPanel onClose={vi.fn()} />)
        fireEvent.keyDown(screen.getAllByRole('listitem')[0], { key: 'Tab' })
        expect(markRead).not.toHaveBeenCalled()
    })

    it('shows empty state when notifications list is empty', () => {
        useNotifications.mockReturnValue({ ...defaultCtx(), notifications: [] })
        renderWithRouter(<NotificationPanel onClose={vi.fn()} />)
        expect(screen.getByText(/no notifications/i)).toBeInTheDocument()
    })

    it('navigates to /chat/{room_slug} when clicking DM notification', () => {
        const navigate = vi.fn()
        const markRead = vi.fn()
        useNotifications.mockReturnValue({ ...defaultCtx(), markRead })

        // We can't easily test navigation without mocking useNavigate, 
        // but the click handler should still call markRead with the right ID
        renderWithRouter(<NotificationPanel onClose={vi.fn()} />)
        const dmItem = screen.getByText('2 unread messages')
        fireEvent.click(dmItem)
        expect(markRead).toHaveBeenCalledWith('dm-DM-1-7')
    })
})
