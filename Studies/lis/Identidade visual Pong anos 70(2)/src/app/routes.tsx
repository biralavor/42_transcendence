import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Ranking } from './pages/Ranking';
import { HowToPlay } from './pages/HowToPlay';
import { Play } from './pages/Play';
import { NotFound } from './pages/NotFound';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: 'about', Component: About },
      { path: 'login', Component: Login },
      { path: 'register', Component: Register },
      { path: 'ranking', Component: Ranking },
      { path: 'how-to-play', Component: HowToPlay },
      { path: 'play', Component: Play },
      { path: '*', Component: NotFound },
    ],
  },
]);
