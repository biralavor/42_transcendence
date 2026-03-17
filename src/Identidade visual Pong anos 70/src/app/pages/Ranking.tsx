import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router';

export function Ranking() {
  const { isAuthenticated, isAnonymous } = useAuth();
  
  // Se não estiver autenticado ou for anônimo, mostrar mensagem
  if (!isAuthenticated || isAnonymous) {
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
            {isAnonymous 
              ? 'Usuários anônimos não podem ver o ranking. Crie uma conta para competir com outros jogadores!'
              : 'Você precisa estar logado para ver o ranking!'
            }
          </p>
          <Link to={isAnonymous ? "/register" : "/login"}>
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
              {isAnonymous ? 'CRIAR CONTA' : 'FAZER LOGIN'}
            </button>
          </Link>
        </div>
      </div>
    );
  }
  
  const topPlayers = [
    { pos: 1, name: 'JOGADOR_PRO', score: 9999, wins: 543, country: '🇧🇷' },
    { pos: 2, name: 'RETRO_KING', score: 8888, wins: 512, country: '🇺🇸' },
    { pos: 3, name: 'PONG_MASTER', score: 7777, wins: 489, country: '🇯🇵' },
    { pos: 4, name: 'ARCADE_LEGEND', score: 7654, wins: 467, country: '🇬🇧' },
    { pos: 5, name: 'PIXEL_WARRIOR', score: 7321, wins: 445, country: '🇫🇷' },
    { pos: 6, name: 'OLD_SCHOOL_99', score: 6999, wins: 423, country: '🇩🇪' },
    { pos: 7, name: 'RETRO_GAMER', score: 6543, wins: 401, country: '🇨🇦' },
    { pos: 8, name: 'PONG_CHAMPION', score: 6234, wins: 378, country: '🇦🇺' },
    { pos: 9, name: 'CLASSIC_PLAYER', score: 5987, wins: 356, country: '🇮🇹' },
    { pos: 10, name: 'ARCADE_HERO', score: 5654, wins: 334, country: '🇪🇸' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #5d4037 0%, #3e2723 100%)' }}>
      {/* Hero */}
      <section 
        className="py-20 px-8 text-center"
        style={{ 
          background: 'linear-gradient(180deg, #5d4037 0%, #4e342e 100%)',
          borderBottom: '6px solid #3e2723',
        }}
      >
        <h1 
          style={{ 
            fontFamily: 'Bungee, cursive',
            fontSize: '4rem',
            color: '#f4d03f',
            marginBottom: '1rem',
            letterSpacing: '0.3rem',
          }}
        >
          RANKING GLOBAL
        </h1>
        <p style={{ 
          fontFamily: 'VT323, monospace', 
          fontSize: '1.8rem', 
          color: '#f0f0e8',
          maxWidth: '800px',
          margin: '0 auto',
        }}>
          Os melhores jogadores do mundo
        </p>
      </section>

      <div className="max-w-6xl mx-auto px-8 py-16">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div
            style={{
              background: '#f4d03f',
              border: '4px solid #3e2723',
              boxShadow: '6px 6px 0px #3e2723',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <div 
              style={{ 
                fontFamily: 'Bungee, cursive',
                fontSize: '3rem',
                color: '#3e2723',
                marginBottom: '0.5rem',
              }}
            >
              1,234
            </div>
            <p style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '1.2rem',
              color: '#3e2723',
              letterSpacing: '0.1rem',
            }}>
              JOGADORES ATIVOS
            </p>
          </div>

          <div
            style={{
              background: '#f4d03f',
              border: '4px solid #3e2723',
              boxShadow: '6px 6px 0px #3e2723',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <div 
              style={{ 
                fontFamily: 'Bungee, cursive',
                fontSize: '3rem',
                color: '#3e2723',
                marginBottom: '0.5rem',
              }}
            >
              45,678
            </div>
            <p style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '1.2rem',
              color: '#3e2723',
              letterSpacing: '0.1rem',
            }}>
              PARTIDAS JOGADAS
            </p>
          </div>

          <div
            style={{
              background: '#f4d03f',
              border: '4px solid #3e2723',
              boxShadow: '6px 6px 0px #3e2723',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <div 
              style={{ 
                fontFamily: 'Bungee, cursive',
                fontSize: '3rem',
                color: '#3e2723',
                marginBottom: '0.5rem',
              }}
            >
              98
            </div>
            <p style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '1.2rem',
              color: '#3e2723',
              letterSpacing: '0.1rem',
            }}>
              PAÍSES
            </p>
          </div>
        </div>

        {/* Top 3 Podium */}
        <div className="mb-12">
          <h2 
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '2rem',
              color: '#3e2723',
              marginBottom: '2rem',
              letterSpacing: '0.15rem',
              textAlign: 'center',
            }}
          >
            TOP 3
          </h2>

          <div className="flex justify-center items-end gap-6 mb-12">
            {/* 2nd Place */}
            <div
              style={{
                background: 'linear-gradient(145deg, #9e9e9e, #7a7a7a)',
                border: '4px solid #3e2723',
                boxShadow: '6px 6px 0px #3e2723',
                padding: '2rem',
                width: '200px',
                textAlign: 'center',
              }}
            >
              <div 
                style={{ 
                  fontFamily: 'Bungee, cursive',
                  fontSize: '3rem',
                  color: '#3e2723',
                  marginBottom: '0.5rem',
                }}
              >
                2
              </div>
              <p style={{ 
                fontFamily: 'Righteous, cursive',
                fontSize: '1.2rem',
                color: '#3e2723',
                marginBottom: '0.5rem',
                letterSpacing: '0.1rem',
              }}>
                {topPlayers[1].name}
              </p>
              <p style={{ 
                fontFamily: 'VT323, monospace',
                fontSize: '2rem',
                color: '#3e2723',
              }}>
                {topPlayers[1].score}
              </p>
            </div>

            {/* 1st Place */}
            <div
              style={{
                background: 'linear-gradient(145deg, #f4d03f, #d4a817)',
                border: '5px solid #3e2723',
                boxShadow: '8px 8px 0px #3e2723',
                padding: '2.5rem',
                width: '220px',
                textAlign: 'center',
                transform: 'scale(1.1)',
              }}
            >
              <div 
                style={{ 
                  fontFamily: 'Bungee, cursive',
                  fontSize: '4rem',
                  color: '#3e2723',
                  marginBottom: '0.5rem',
                }}
              >
                👑
              </div>
              <p style={{ 
                fontFamily: 'Righteous, cursive',
                fontSize: '1.3rem',
                color: '#3e2723',
                marginBottom: '0.5rem',
                letterSpacing: '0.1rem',
              }}>
                {topPlayers[0].name}
              </p>
              <p style={{ 
                fontFamily: 'VT323, monospace',
                fontSize: '2.5rem',
                color: '#3e2723',
              }}>
                {topPlayers[0].score}
              </p>
            </div>

            {/* 3rd Place */}
            <div
              style={{
                background: 'linear-gradient(145deg, #cd7f32, #a85a1a)',
                border: '4px solid #3e2723',
                boxShadow: '6px 6px 0px #3e2723',
                padding: '2rem',
                width: '200px',
                textAlign: 'center',
              }}
            >
              <div 
                style={{ 
                  fontFamily: 'Bungee, cursive',
                  fontSize: '3rem',
                  color: '#3e2723',
                  marginBottom: '0.5rem',
                }}
              >
                3
              </div>
              <p style={{ 
                fontFamily: 'Righteous, cursive',
                fontSize: '1.2rem',
                color: '#3e2723',
                marginBottom: '0.5rem',
                letterSpacing: '0.1rem',
              }}>
                {topPlayers[2].name}
              </p>
              <p style={{ 
                fontFamily: 'VT323, monospace',
                fontSize: '2rem',
                color: '#3e2723',
              }}>
                {topPlayers[2].score}
              </p>
            </div>
          </div>
        </div>

        {/* Full Ranking Table */}
        <div
          style={{
            background: '#6d4c41',
            border: '5px solid #3e2723',
            boxShadow: '10px 10px 0px #3e2723',
            overflow: 'hidden',
          }}
        >
          {/* Table Header */}
          <div 
            className="grid grid-cols-5 gap-4 px-6 py-4"
            style={{
              background: '#f4d03f',
              borderBottom: '4px solid #3e2723',
            }}
          >
            {['POS', 'JOGADOR', 'PONTOS', 'VITÓRIAS', 'PAÍS'].map((header) => (
              <div 
                key={header}
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.1rem',
                  color: '#3e2723',
                  letterSpacing: '0.1rem',
                  textAlign: header === 'POS' ? 'center' : header === 'PAÍS' ? 'center' : 'left',
                }}
              >
                {header}
              </div>
            ))}
          </div>

          {/* Table Rows */}
          {topPlayers.map((player, index) => (
            <div 
              key={player.pos}
              className="grid grid-cols-5 gap-4 px-6 py-4"
              style={{
                background: index % 2 === 0 ? '#5d4037' : '#6d4c41',
                borderBottom: index < topPlayers.length - 1 ? '2px solid #3e2723' : 'none',
              }}
            >
              <div 
                style={{ 
                  fontFamily: 'Bungee, cursive',
                  fontSize: '1.5rem',
                  color: player.pos <= 3 ? '#f4d03f' : '#3e2723',
                  textAlign: 'center',
                }}
              >
                {player.pos}
              </div>
              <div 
                style={{ 
                  fontFamily: 'VT323, monospace',
                  fontSize: '1.4rem',
                  color: '#3e2723',
                }}
              >
                {player.name}
              </div>
              <div 
                style={{ 
                  fontFamily: 'VT323, monospace',
                  fontSize: '1.4rem',
                  color: '#3e2723',
                }}
              >
                {player.score}
              </div>
              <div 
                style={{ 
                  fontFamily: 'VT323, monospace',
                  fontSize: '1.4rem',
                  color: '#3e2723',
                }}
              >
                {player.wins}
              </div>
              <div 
                style={{ 
                  fontSize: '1.5rem',
                  textAlign: 'center',
                }}
              >
                {player.country}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
