import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router';

interface PowerUp {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
  owned: boolean;
}

const powerUps: PowerUp[] = [
  {
    id: '1',
    name: 'SUPER SPEED',
    description: 'Aumenta a velocidade da sua raquete em 50%',
    cost: 500,
    icon: '⚡',
    owned: false,
  },
  {
    id: '2',
    name: 'MEGA PADDLE',
    description: 'Aumenta o tamanho da raquete temporariamente',
    cost: 750,
    icon: '▮',
    owned: false,
  },
  {
    id: '3',
    name: 'SLOW BALL',
    description: 'Reduz a velocidade da bola do oponente',
    cost: 600,
    icon: '🐌',
    owned: true,
  },
  {
    id: '4',
    name: 'MULTI BALL',
    description: 'Adiciona uma segunda bola no jogo',
    cost: 1000,
    icon: '●●',
    owned: false,
  },
  {
    id: '5',
    name: 'SHIELD',
    description: 'Protege seu gol por 10 segundos',
    cost: 800,
    icon: '🛡️',
    owned: false,
  },
  {
    id: '6',
    name: 'TELEPORT',
    description: 'Move sua raquete instantaneamente',
    cost: 900,
    icon: '✦',
    owned: false,
  },
  {
    id: '7',
    name: 'CURVE SHOT',
    description: 'Adiciona efeito de curva na bola',
    cost: 700,
    icon: '↪',
    owned: false,
  },
  {
    id: '8',
    name: 'FREEZE',
    description: 'Congela a raquete do oponente por 3s',
    cost: 1200,
    icon: '❄️',
    owned: false,
  },
];

export function Shop() {
  const { user, isAuthenticated } = useAuth();
  const [userPoints, setUserPoints] = useState(user?.points || 0);
  const [items, setItems] = useState(powerUps);

  const handlePurchase = (powerUp: PowerUp) => {
    if (userPoints >= powerUp.cost && !powerUp.owned) {
      setUserPoints(userPoints - powerUp.cost);
      setItems(items.map(item => 
        item.id === powerUp.id ? { ...item, owned: true } : item
      ));
    }
  };

  // Se não estiver autenticado, mostrar mensagem
  if (!isAuthenticated) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-8"
        style={{ background: 'linear-gradient(180deg, #5d4037 0%, #3e2723 100%)' }}
      >
        <div
          style={{
            background: '#f4d03f',
            border: '6px solid #3e2723',
            boxShadow: '8px 8px 0px #3e2723',
            padding: '3rem',
            maxWidth: '600px',
            textAlign: 'center',
          }}
        >
          <h2 
            style={{ 
              fontFamily: 'Bungee, cursive',
              fontSize: '2rem',
              color: '#3e2723',
              letterSpacing: '0.2rem',
              marginBottom: '1.5rem',
            }}
          >
            ACESSO RESTRITO
          </h2>
          <p 
            style={{ 
              fontFamily: 'VT323, monospace',
              fontSize: '1.4rem',
              color: '#3e2723',
              marginBottom: '2rem',
              lineHeight: '1.5',
            }}
          >
            Você precisa estar logado para acessar a loja de power-ups!
          </p>
          <Link to="/login">
            <button
              style={{
                background: '#3e2723',
                border: '4px solid #3e2723',
                boxShadow: '4px 4px 0px #3e2723',
                padding: '1rem 2rem',
                fontFamily: 'Righteous, cursive',
                fontSize: '1.2rem',
                color: '#f4d03f',
                letterSpacing: '0.1rem',
                cursor: 'pointer',
              }}
            >
              FAZER LOGIN
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen p-8"
      style={{ background: 'linear-gradient(180deg, #5d4037 0%, #3e2723 100%)' }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div
          style={{
            background: '#f4d03f',
            border: '6px solid #3e2723',
            boxShadow: '8px 8px 0px #3e2723',
            padding: '2rem',
            marginBottom: '2rem',
          }}
        >
          <div className="flex justify-between items-center flex-wrap gap-4">
            <h1 
              style={{ 
                fontFamily: 'Bungee, cursive',
                fontSize: '3rem',
                color: '#3e2723',
                letterSpacing: '0.3rem',
              }}
            >
              LOJA
            </h1>
            <div
              style={{
                background: '#3e2723',
                border: '4px solid #3e2723',
                padding: '1rem 2rem',
              }}
            >
              <div 
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '0.9rem',
                  color: '#f4d03f',
                  letterSpacing: '0.1rem',
                  marginBottom: '0.25rem',
                }}
              >
                SEUS PONTOS
              </div>
              <div 
                style={{ 
                  fontFamily: 'VT323, monospace',
                  fontSize: '2.5rem',
                  color: '#f0f0e8',
                  lineHeight: '1',
                }}
              >
                {userPoints.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div
          className="mb-6"
          style={{
            background: '#5d4037',
            border: '4px solid #3e2723',
            padding: '1.5rem',
          }}
        >
          <p 
            style={{ 
              fontFamily: 'VT323, monospace',
              fontSize: '1.3rem',
              color: '#f0f0e8',
              textAlign: 'center',
            }}
          >
            ⚠️ COMPRE POWER-UPS COM OS PONTOS CONQUISTADOS NAS SUAS VITÓRIAS! ⚠️
          </p>
        </div>

        {/* Power-ups Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((powerUp) => {
            const canAfford = userPoints >= powerUp.cost;
            const isOwned = powerUp.owned;

            return (
              <div
                key={powerUp.id}
                style={{
                  background: isOwned ? '#3e2723' : '#5d4037',
                  border: `4px solid ${isOwned ? '#f4d03f' : '#3e2723'}`,
                  boxShadow: '6px 6px 0px #3e2723',
                  padding: '1.5rem',
                  position: 'relative',
                  opacity: isOwned ? 0.7 : 1,
                }}
              >
                {/* Owned Badge */}
                {isOwned && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-12px',
                      right: '12px',
                      background: '#f4d03f',
                      border: '3px solid #3e2723',
                      padding: '0.25rem 0.75rem',
                    }}
                  >
                    <span 
                      style={{ 
                        fontFamily: 'Righteous, cursive',
                        fontSize: '0.8rem',
                        color: '#3e2723',
                        letterSpacing: '0.05rem',
                      }}
                    >
                      ADQUIRIDO
                    </span>
                  </div>
                )}

                {/* Icon */}
                <div 
                  className="flex justify-center items-center mb-4"
                  style={{
                    fontSize: '4rem',
                    height: '100px',
                  }}
                >
                  {powerUp.icon}
                </div>

                {/* Name */}
                <h3 
                  style={{ 
                    fontFamily: 'Righteous, cursive',
                    fontSize: '1.2rem',
                    color: '#f4d03f',
                    letterSpacing: '0.1rem',
                    marginBottom: '0.5rem',
                    textAlign: 'center',
                  }}
                >
                  {powerUp.name}
                </h3>

                {/* Description */}
                <p 
                  style={{ 
                    fontFamily: 'VT323, monospace',
                    fontSize: '1.1rem',
                    color: '#f0f0e8',
                    textAlign: 'center',
                    marginBottom: '1rem',
                    minHeight: '60px',
                  }}
                >
                  {powerUp.description}
                </p>

                {/* Cost */}
                <div 
                  className="text-center mb-3"
                  style={{ 
                    fontFamily: 'VT323, monospace',
                    fontSize: '1.8rem',
                    color: canAfford ? '#f4d03f' : '#c62828',
                  }}
                >
                  {powerUp.cost} PTS
                </div>

                {/* Buy Button */}
                <button
                  onClick={() => handlePurchase(powerUp)}
                  disabled={!canAfford || isOwned}
                  style={{
                    width: '100%',
                    background: isOwned ? '#8d8d8d' : (canAfford ? '#f4d03f' : '#6d4c41'),
                    border: '4px solid #3e2723',
                    boxShadow: '4px 4px 0px #3e2723',
                    padding: '0.75rem',
                    fontFamily: 'Righteous, cursive',
                    fontSize: '1rem',
                    color: '#3e2723',
                    letterSpacing: '0.1rem',
                    cursor: (canAfford && !isOwned) ? 'pointer' : 'not-allowed',
                    transition: 'transform 0.1s',
                    opacity: (canAfford && !isOwned) ? 1 : 0.6,
                  }}
                  onMouseDown={(e) => {
                    if (canAfford && !isOwned) {
                      e.currentTarget.style.transform = 'translate(4px, 4px)';
                      e.currentTarget.style.boxShadow = '0px 0px 0px #3e2723';
                    }
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'translate(0, 0)';
                    e.currentTarget.style.boxShadow = '4px 4px 0px #3e2723';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translate(0, 0)';
                    e.currentTarget.style.boxShadow = '4px 4px 0px #3e2723';
                  }}
                >
                  {isOwned ? 'JÁ POSSUI' : (canAfford ? 'COMPRAR' : 'SEM PONTOS')}
                </button>
              </div>
            );
          })}
        </div>

        {/* Bottom Info */}
        <div
          className="mt-8"
          style={{
            background: '#3e2723',
            border: '4px solid #3e2723',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <p 
            style={{ 
              fontFamily: 'VT323, monospace',
              fontSize: '1.2rem',
              color: '#f0f0e8',
            }}
          >
            💡 DICA: JOGUE MAIS PARTIDAS PARA GANHAR PONTOS E DESBLOQUEAR TODOS OS POWER-UPS!
          </p>
        </div>
      </div>
    </div>
  );
}
