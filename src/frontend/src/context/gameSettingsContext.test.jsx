import { describe, it, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { GameSettingsProvider, useGameSettings } from './gameSettingsContext';

vi.mock('../utils/apiClient', () => ({
  apiJson: vi.fn(),
  apiCall: vi.fn(),
}));

vi.mock('./authContext', () => ({
  useAuth: () => ({ auth: null, isAuthReady: true }),
}));

import { apiJson, apiCall } from '../utils/apiClient';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

const wrapper = ({ children }) => <GameSettingsProvider>{children}</GameSettingsProvider>;

test('defaults to classic theme and 1.0 speed when nothing stored', () => {
  const { result } = renderHook(() => useGameSettings(), { wrapper });
  expect(result.current.theme).toBe('classic');
  expect(result.current.ballSpeedMultiplier).toBe(1.0);
});

test('loads persisted settings from localStorage on mount', () => {
  localStorage.setItem('pong_settings', JSON.stringify({ theme: 'wood', ballSpeedMultiplier: 1.5 }));
  const { result } = renderHook(() => useGameSettings(), { wrapper });
  expect(result.current.theme).toBe('wood');
  expect(result.current.ballSpeedMultiplier).toBe(1.5);
});

test('setTheme updates state and localStorage', () => {
  const { result } = renderHook(() => useGameSettings(), { wrapper });
  act(() => result.current.setTheme('neon-pong'));
  expect(result.current.theme).toBe('neon-pong');
  expect(JSON.parse(localStorage.getItem('pong_settings')).theme).toBe('neon-pong');
});

test('setBallSpeedMultiplier updates state and localStorage', () => {
  const { result } = renderHook(() => useGameSettings(), { wrapper });
  act(() => result.current.setBallSpeedMultiplier(0.75));
  expect(result.current.ballSpeedMultiplier).toBe(0.75);
  expect(JSON.parse(localStorage.getItem('pong_settings')).ballSpeedMultiplier).toBe(0.75);
});

test('does not call API when user is not authenticated', () => {
  renderHook(() => useGameSettings(), { wrapper });
  expect(apiJson).not.toHaveBeenCalled();
});
