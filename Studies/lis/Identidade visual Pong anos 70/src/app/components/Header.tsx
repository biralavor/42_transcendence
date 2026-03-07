import { Link, useLocation } from 'react-router';

export function Header() {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <header 
      className="flex justify-between items-center px-8 py-6"
      style={{ 
        background: '#f4d03f', 
        borderBottom: '6px solid #3e2723',
        boxShadow: '0 4px 0 rgba(0, 0, 0, 0.2)',
      }}
    >
      <Link to="/" style={{ textDecoration: 'none' }}>
        <div style={{ 
          fontFamily: 'Bungee, cursive', 
          fontSize: '2.5rem', 
          color: '#3e2723', 
          letterSpacing: '0.3rem',
          textShadow: '3px 3px 0px rgba(0, 0, 0, 0.15)',
        }}>
          PONG
        </div>
      </Link>
      
      <nav className="flex gap-8">
        {[
          { name: 'HOME', path: '/' },
          { name: 'JOGAR', path: '/play' },
          { name: 'RANKING', path: '/ranking' },
          { name: 'COMO JOGAR', path: '/how-to-play' },
          { name: 'SOBRE', path: '/about' },
          { name: 'LOGIN', path: '/login' },
        ].map((item) => (
          <Link
            key={item.path}
            to={item.path}
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '1.1rem',
              color: isActive(item.path) ? '#3e2723' : '#5d4037',
              letterSpacing: '0.1rem',
              textDecoration: 'none',
              padding: '0.5rem 1rem',
              borderBottom: isActive(item.path) ? '3px solid #3e2723' : '3px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {item.name}
          </Link>
        ))}
      </nav>
    </header>
  );
}
