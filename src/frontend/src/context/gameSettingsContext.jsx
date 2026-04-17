import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { DEFAULT_THEME } from '../game/themes';
import { useAuth } from './authContext';
import { apiJson, apiCall } from '../utils/apiClient';

const STORAGE_KEY = 'pong_settings';
const DEBOUNCE_MS = 500;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

const GameSettingsContext = createContext(null);

export function GameSettingsProvider({ children }) {
  const { auth, isAuthReady } = useAuth();
  const stored = loadFromStorage();

  const [theme, setThemeState] = useState(stored?.theme ?? DEFAULT_THEME);
  const [ballSpeedMultiplier, setBallSpeedState] = useState(stored?.ballSpeedMultiplier ?? 1.0);
  const debounceRef = useRef(null);

  // Load from API when auth becomes available
  useEffect(() => {
    if (!isAuthReady || !auth?.access_token) return;
    apiJson('/api/users/preferences')
      .then(prefs => {
        const t = prefs.theme ?? DEFAULT_THEME;
        const s = prefs.ball_speed_multiplier ?? 1.0;
        setThemeState(t);
        setBallSpeedState(s);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: t, ballSpeedMultiplier: s }));
      })
      .catch(() => {}); // keep localStorage values on API failure
  }, [isAuthReady, auth?.access_token]);

  // Persist: localStorage immediately, API debounced
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, ballSpeedMultiplier }));

    if (!auth?.access_token) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      apiCall('/api/users/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, ball_speed_multiplier: ballSpeedMultiplier }),
      }).catch(() => {});
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [theme, ballSpeedMultiplier]);

  function setTheme(t) { setThemeState(t); }
  function setBallSpeedMultiplier(v) { setBallSpeedState(v); }

  return (
    <GameSettingsContext.Provider value={{ theme, ballSpeedMultiplier, setTheme, setBallSpeedMultiplier }}>
      {children}
    </GameSettingsContext.Provider>
  );
}

export function useGameSettings() {
  const ctx = useContext(GameSettingsContext);
  if (!ctx) throw new Error('useGameSettings must be inside GameSettingsProvider');
  return ctx;
}
