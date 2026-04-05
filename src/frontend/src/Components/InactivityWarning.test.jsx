import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import InactivityWarning from './InactivityWarning'
import * as inactivityTracker from '../utils/inactivityTracker'

vi.mock('../utils/inactivityTracker', () => ({
    getTimeUntilLogout: vi.fn()
}))

describe('InactivityWarning', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        inactivityTracker.getTimeUntilLogout.mockReturnValue(300000) // 5 minutes
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('should render the modal with correct remaining time', () => {
        render(<InactivityWarning onStayLoggedIn={vi.fn()} onLogoutNow={vi.fn()} />)
        expect(screen.getByText(/Are you still there\?/i)).toBeInTheDocument()
        expect(screen.getByText('300')).toBeInTheDocument()
    })

    it('should update remaining time every second', () => {
        render(<InactivityWarning onStayLoggedIn={vi.fn()} onLogoutNow={vi.fn()} />)

        inactivityTracker.getTimeUntilLogout.mockReturnValue(299000)
        act(() => {
            vi.advanceTimersByTime(1000)
        })

        expect(screen.getByText('299')).toBeInTheDocument()
    })

    it('should call onStayLoggedIn when Stay Logged In is clicked', () => {
        const onStayLoggedIn = vi.fn()
        render(<InactivityWarning onStayLoggedIn={onStayLoggedIn} onLogoutNow={vi.fn()} />)
        fireEvent.click(screen.getByText(/Stay Logged In/i))
        expect(onStayLoggedIn).toHaveBeenCalledOnce()
    })

    it('should call onLogoutNow when Log Out Now is clicked', () => {
        const onLogoutNow = vi.fn()
        render(<InactivityWarning onStayLoggedIn={vi.fn()} onLogoutNow={onLogoutNow} />)
        fireEvent.click(screen.getByText(/Log Out Now/i))
        expect(onLogoutNow).toHaveBeenCalledOnce()
    })

    // Accessibility Tests
    it('should have proper dialog role and accessible name', () => {
        const { container } = render(<InactivityWarning onStayLoggedIn={vi.fn()} onLogoutNow={vi.fn()} />)
        const dialog = container.querySelector('[role="dialog"]')
        expect(dialog).toHaveAttribute('role', 'dialog')
        expect(dialog).toHaveAttribute('aria-modal', 'true')
        expect(dialog).toHaveAttribute('aria-labelledby', 'inactivity-title')
    })

    it('should have accessible name via aria-labelledby', () => {
        render(<InactivityWarning onStayLoggedIn={vi.fn()} onLogoutNow={vi.fn()} />)
        const title = screen.getByText('Are you still there?')
        expect(title).toHaveAttribute('id', 'inactivity-title')
    })

    it('should call onStayLoggedIn when Escape key is pressed', () => {
        const onStayLoggedIn = vi.fn()
        render(<InactivityWarning onStayLoggedIn={onStayLoggedIn} onLogoutNow={vi.fn()} />)

        fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })

        expect(onStayLoggedIn).toHaveBeenCalledOnce()
    })

    it('should not trigger onStayLoggedIn for other keys', () => {
        const onStayLoggedIn = vi.fn()
        render(<InactivityWarning onStayLoggedIn={onStayLoggedIn} onLogoutNow={vi.fn()} />)

        fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' })

        expect(onStayLoggedIn).not.toHaveBeenCalled()
    })

    it('should focus Stay Logged In button on render (autoFocus)', () => {
        render(<InactivityWarning onStayLoggedIn={vi.fn()} onLogoutNow={vi.fn()} />)
        const stayButton = screen.getByText('Stay Logged In')
        expect(stayButton).toHaveFocus()
    })

    it('should have descriptive aria-labels on buttons', () => {
        render(<InactivityWarning onStayLoggedIn={vi.fn()} onLogoutNow={vi.fn()} />)
        const stayButton = screen.getByText('Stay Logged In')
        const logoutButton = screen.getByText('Log Out Now')

        expect(stayButton).toHaveAttribute('aria-label')
        expect(logoutButton).toHaveAttribute('aria-label')
        expect(stayButton.getAttribute('aria-label')).toContain('Escape')
    })

    it('should display Escape key hint to users', () => {
        render(<InactivityWarning onStayLoggedIn={vi.fn()} onLogoutNow={vi.fn()} />)
        // Check for visible hint text (may be split by <kbd> tag)
        const tipText = screen.getByText(/Press/)
        expect(tipText).toHaveTextContent('Press')
        expect(tipText).toHaveTextContent('dismiss')
        // Also verify the <kbd> tag with Escape is present
        expect(screen.getByText('Escape')).toBeInTheDocument()
    })

    it('should clean up event listener on unmount', () => {
        const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
        const { unmount } = render(<InactivityWarning onStayLoggedIn={vi.fn()} onLogoutNow={vi.fn()} />)

        unmount()

        expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    })
})