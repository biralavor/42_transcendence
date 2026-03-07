import { Link } from 'react-router';

export function NotFound() {
  return (
    <div 
      className="min-h-screen flex items-center justify-center px-8"
      style={{ background: 'linear-gradient(180deg, #5d4037 0%, #3e2723 100%)' }}
    >
      <div className="text-center">
        <div
          style={{
            background: '#f4d03f',
            border: '8px solid #3e2723',
            boxShadow: '12px 12px 0px #1a1410',
            padding: '4rem 3rem',
            maxWidth: '600px',
          }}
        >
          {/* 404 */}
          <div 
            style={{ 
              fontFamily: 'Bungee, cursive',
              fontSize: '8rem',
              color: '#3e2723',
              marginBottom: '1rem',
              letterSpacing: '0.5rem',
              textShadow: '4px 4px 0px rgba(0, 0, 0, 0.2)',
            }}
          >
            404
          </div>

          {/* Message */}
          <h1 
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '2rem',
              color: '#3e2723',
              marginBottom: '1rem',
              letterSpacing: '0.15rem',
            }}
          >
            GAME OVER
          </h1>

          <p style={{ 
            fontFamily: 'VT323, monospace', 
            fontSize: '1.5rem', 
            color: '#3e2723',
            marginBottom: '3rem',
            lineHeight: '1.5',
          }}>
            A página que você procura não foi encontrada.<br />
            Parece que a bola saiu da tela!
          </p>

          {/* Divider */}
          <div 
            className="mb-3"
            style={{ 
              height: '3px',
              background: 'repeating-linear-gradient(90deg, #3e2723 0px, #3e2723 20px, transparent 20px, transparent 40px)',
            }} 
          />

          {/* Back Button */}
          <Link to="/">
            <button
              style={{
                fontFamily: 'Righteous, cursive',
                fontSize: '1.5rem',
                letterSpacing: '0.15rem',
                padding: '1.2rem 3rem',
                background: '#3e2723',
                color: '#f4d03f',
                border: '4px solid #3e2723',
                boxShadow: '6px 6px 0px #1a1410',
                cursor: 'pointer',
                transition: 'transform 0.1s',
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translate(3px, 3px)';
                e.currentTarget.style.boxShadow = '3px 3px 0px #1a1410';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translate(0, 0)';
                e.currentTarget.style.boxShadow = '6px 6px 0px #1a1410';
              }}
            >
              VOLTAR AO INÍCIO
            </button>
          </Link>

          {/* Insert Coin */}
          <div className="mt-6">
            <p 
              className="animate-pulse"
              style={{ 
                fontFamily: 'VT323, monospace',
                fontSize: '1.3rem',
                color: '#3e2723',
              }}
            >
              INSERT COIN TO CONTINUE
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
