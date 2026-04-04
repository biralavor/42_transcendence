import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import InactivityWarning from './InactivityWarning';
import * as inactivityTracker from '../utils/inactivityTracker';

vi.mock('../utils/inactivityTracker', () => ({
    getTimeUntilLogout: vi.fn()
}));

describe('InactivityWarning', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        inactivityTracker.getTimeUntilLogout.mockReturnValue(300000); // 5 minutes
    });

    afterEach(() => {
    vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should render the modal with correct remaining time', () => {
        render(<InactivityWarning onStayLoggedIn={vi.fn()} onLogoutNow={vi.fn()} />);
        expect(screen.getByText(/Are you still there\?/i)).toBeInTheDocument();
        expect(screen.getByText('300')).toBeInTheDocument();
    });

    it('should update remaining time every second', () => {
        render(<InactivityWarning onStayLoggedIn={vi.fn()} onLogoutNow={vi.fn()} />);

        inactivityTracker.getTimeUntilLogout.mockReturnValue(299000);
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(screen.getByText('299')).toBeInTheDocument();
    });

    it('should call onStayLoggedIn when Stay Logged In is clicked', () => {
        const onStayLoggedIn = vi.fn();
        render(<InactivityWarning onStayLoggedIn={onStayLoggedIn} onLogoutNow={vi.fn()} />);
        fireEvent.click(screen.getByText(/Stay Logged In/i));
        expect(onStayLoggedIn).toHaveBeenCalledOnce();
    });

    it('should call onLogoutNow when Log Out Now is clicked', () => {
        const onLogoutNow = vi.fn();
        render(<InactivityWarning onStayLoggedIn={vi.fn()} onLogoutNow={onLogoutNow} />);
        fireEvent.click(screen.getByText(/Log Out Now/i));
        expect(onLogoutNow).toHaveBeenCalledOnce();
    });
});