import { Link } from 'react-router';

export function Footer() {
  return (
    <footer 
      className="mt-auto"
      style={{ 
        background: 'linear-gradient(180deg, #5d4037 0%, #3e2723 100%)',
        borderTop: '6px solid #3e2723',
      }}
    >
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Logo e descrição */}
          <div className="md:col-span-2">
            <div style={{ 
              fontFamily: 'Bungee, cursive', 
              fontSize: '2rem', 
              color: '#f4d03f', 
              letterSpacing: '0.2rem',
              marginBottom: '1rem',
            }}>
              PONG
            </div>
            <p style={{ 
              fontFamily: 'VT323, monospace', 
              fontSize: '1.3rem', 
              color: '#f0f0e8',
              lineHeight: '1.5',
              maxWidth: '400px',
            }}>
              O clássico jogo de arcade dos anos 70. Reviva a nostalgia e desafie seus amigos nesta experiência retro autêntica.
            </p>
          </div>

          {/* Links rápidos */}
          <div>
            <h3 style={{ 
              fontFamily: 'Righteous, cursive', 
              fontSize: '1.2rem', 
              color: '#f4d03f',
              marginBottom: '1rem',
              letterSpacing: '0.1rem',
            }}>
              LINKS
            </h3>
            <ul className="space-y-2">
              {['HOME', 'JOGAR', 'RANKING', 'SOBRE'].map((item) => (
                <li key={item}>
                  <Link
                    to={item === 'HOME' ? '/' : `/${item.toLowerCase().replace(' ', '-')}`}
                    style={{ 
                      fontFamily: 'VT323, monospace',
                      fontSize: '1.2rem',
                      color: '#f0f0e8',
                      textDecoration: 'none',
                    }}
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Redes sociais */}
          <div>
            <h3 style={{ 
              fontFamily: 'Righteous, cursive', 
              fontSize: '1.2rem', 
              color: '#f4d03f',
              marginBottom: '1rem',
              letterSpacing: '0.1rem',
            }}>
              SOCIAL
            </h3>
            <ul className="space-y-2">
              {['TWITTER', 'DISCORD', 'YOUTUBE'].map((item) => (
                <li key={item}>
                  <a
                    href="#"
                    style={{ 
                      fontFamily: 'VT323, monospace',
                      fontSize: '1.2rem',
                      color: '#f0f0e8',
                      textDecoration: 'none',
                    }}
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divisor */}
        <div 
          style={{ 
            height: '2px',
            background: 'repeating-linear-gradient(90deg, #f4d03f 0px, #f4d03f 20px, transparent 20px, transparent 40px)',
            marginBottom: '2rem',
          }} 
        />

        {/* Copyright */}
        <div className="text-center">
          <p style={{ 
            fontFamily: 'Righteous, cursive', 
            fontSize: '0.9rem', 
            color: '#f4d03f',
            letterSpacing: '0.15rem',
          }}>
            © 1972-2026 ATARI INC. - TODOS OS DIREITOS RESERVADOS
          </p>
          <p style={{ 
            fontFamily: 'VT323, monospace', 
            fontSize: '1.1rem', 
            color: '#f0f0e8',
            marginTop: '0.5rem',
          }}>
            MADE WITH ♥ FOR ARCADE LOVERS
          </p>
        </div>
      </div>
    </footer>
  );
}
