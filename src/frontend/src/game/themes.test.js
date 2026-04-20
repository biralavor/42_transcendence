import { THEMES, DEFAULT_THEME } from './themes';

test('DEFAULT_THEME is "classic"', () => {
  expect(DEFAULT_THEME).toBe('classic');
});

test('classic theme has all-null assets', () => {
  const t = THEMES.classic;
  expect(t.background).toBeNull();
  expect(t.ball).toBeNull();
  expect(t.paddleLeft).toBeNull();
  expect(t.paddleRight).toBeNull();
  expect(t.thumbnail).toBeNull();
});

test('every theme has required keys', () => {
  const REQUIRED = ['label', 'background', 'ball', 'paddleLeft', 'paddleRight', 'thumbnail'];
  for (const [key, theme] of Object.entries(THEMES)) {
    for (const k of REQUIRED) {
      expect(theme).toHaveProperty(k);
    }
  }
});

test('non-classic themes have string asset paths starting with /themes/', () => {
  for (const [key, theme] of Object.entries(THEMES)) {
    if (key === 'classic') continue;
    expect(typeof theme.background).toBe('string');
    expect(theme.background.startsWith('/themes/')).toBe(true);
    expect(typeof theme.ball).toBe('string');
    expect(typeof theme.paddleLeft).toBe('string');
    expect(typeof theme.paddleRight).toBe('string');
    expect(typeof theme.thumbnail).toBe('string');
  }
});
