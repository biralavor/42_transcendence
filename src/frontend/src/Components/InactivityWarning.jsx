import { useState, useEffect } from 'react';
import { getTimeUntilLogout } from '../utils/inactivityTracker';

export default function InactivityWarning({ onStayLoggedIn, onLogoutNow }) {
    const [secondsLeft, setSecondsLeft] = useState(() => Math.floor(getTimeUntilLogout() / 1000));

    useEffect(() => {
        const interval = setInterval(() => {
            const ms = getTimeUntilLogout();
            setSecondsLeft(Math.floor(ms / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div
            className="modal-backdrop"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="arcade-card text-center"
                style={{ maxWidth: '400px', width: '90%', background: 'var(--arcade-bg, #1a1a2e)', border: '1px solid var(--arcade-border, #444)', padding: '2rem', borderRadius: '8px' }}
            >
                <h3 className="arcade-title mb-3 text-white">Are you still there?</h3>
                <p className="arcade-copy mb-4 text-light">
                    You will be logged out in <strong>{secondsLeft}</strong> seconds due to inactivity.
                </p>
                <div className="d-flex justify-content-center gap-3 mt-4">
                    <button className="arcade-btn arcade-btn-secondary" onClick={onLogoutNow}>
                        Log Out Now
                    </button>
                    <button className="arcade-btn arcade-btn-primary" onClick={onStayLoggedIn} autoFocus>
                        Stay Logged In
                    </button>
                </div>
            </div>
        </div>
    );
}