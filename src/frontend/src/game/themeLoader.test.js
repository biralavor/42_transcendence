import { loadThemeImages } from './themeLoader';
import { THEMES } from './themes';

beforeEach(() => {
  global.Image = class {
    set src(_) { this.onload && this.onload(); }
  };
});

test('classic theme returns all-null images', async () => {
  const images = await loadThemeImages(THEMES.classic);
  expect(images.background).toBeNull();
  expect(images.ball).toBeNull();
  expect(images.paddleLeft).toBeNull();
  expect(images.paddleRight).toBeNull();
});

test('non-classic theme returns Image objects for all assets', async () => {
  const images = await loadThemeImages(THEMES.wood);
  expect(images.background).toBeTruthy();
  expect(images.ball).toBeTruthy();
  expect(images.paddleLeft).toBeTruthy();
  expect(images.paddleRight).toBeTruthy();
});

test('returned object has exactly: background, ball, paddleLeft, paddleRight', async () => {
  const images = await loadThemeImages(THEMES.classic);
  expect(Object.keys(images).sort()).toEqual(['background', 'ball', 'paddleLeft', 'paddleRight']);
});
