import { Link } from 'react-router';

export function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section 
        className="relative py-24 px-8 text-center overflow-hidden"
        style={{ 
          background: 'linear-gradient(180deg, #5d4037 0%, #4e342e 100%)',
        }}
      >
        {/* Scanlines effect */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            background: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.1) 0px, rgba(0, 0, 0, 0.1) 2px, transparent 2px, transparent 4px)',
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 
            style={{ 
              fontFamily: 'Bungee, cursive',
              fontSize: '5rem',
              color: '#f4d03f',
              marginBottom: '1.5rem',
              letterSpacing: '0.4rem',
              textShadow: '4px 4px 0px rgba(0, 0, 0, 0.3)',
            }}
          >
            O CLÁSSICO RETORNA
          </h1>
          
          <p style={{ 
            fontFamily: 'VT323, monospace', 
            fontSize: '2rem', 
            color: '#f0f0e8', 
            marginBottom: '3rem',
            lineHeight: '1.5',
          }}>
            Reviva a experiência arcade original dos anos 70.<br />
            Desafie seus amigos no jogo que iniciou tudo.
          </p>

          <div className="flex gap-6 justify-center">
            <Link to="/play">
              <button
                style={{
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.5rem',
                  letterSpacing: '0.15rem',
                  padding: '1.2rem 3rem',
                  background: '#f4d03f',
                  color: '#3e2723',
                  border: '4px solid #3e2723',
                  boxShadow: '8px 8px 0px #3e2723',
                  cursor: 'pointer',
                  transition: 'transform 0.1s',
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translate(4px, 4px)';
                  e.currentTarget.style.boxShadow = '4px 4px 0px #3e2723';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translate(0, 0)';
                  e.currentTarget.style.boxShadow = '8px 8px 0px #3e2723';
                }}
              >
                JOGAR AGORA
              </button>
            </Link>

            <Link to="/how-to-play">
              <button
                style={{
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.5rem',
                  letterSpacing: '0.15rem',
                  padding: '1.2rem 3rem',
                  background: 'transparent',
                  color: '#f0f0e8',
                  border: '4px solid #f4d03f',
                  boxShadow: '8px 8px 0px #f4d03f',
                  cursor: 'pointer',
                  transition: 'transform 0.1s',
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translate(4px, 4px)';
                  e.currentTarget.style.boxShadow = '4px 4px 0px #f4d03f';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translate(0, 0)';
                  e.currentTarget.style.boxShadow = '8px 8px 0px #f4d03f';
                }}
              >
                COMO JOGAR
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-8" style={{ background: '#f0f0e8' }}>
        <div className="max-w-7xl mx-auto">
          <h2 
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '3rem',
              color: '#3e2723',
              textAlign: 'center',
              marginBottom: '4rem',
              letterSpacing: '0.2rem',
            }}
          >
            POR QUE JOGAR PONG?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div
              style={{
                background: '#f4d03f',
                border: '4px solid #3e2723',
                boxShadow: '8px 8px 0px #3e2723',
                padding: '2.5rem',
                textAlign: 'center',
              }}
            >
              <div 
                style={{ 
                  fontFamily: 'Bungee, cursive',
                  fontSize: '3rem',
                  color: '#3e2723',
                  marginBottom: '1rem',
                }}
              >
                1972
              </div>
              <h3 
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.5rem',
                  color: '#3e2723',
                  marginBottom: '1rem',
                  letterSpacing: '0.1rem',
                }}
              >
                CLÁSSICO ORIGINAL
              </h3>
              <p style={{ 
                fontFamily: 'VT323, monospace', 
                fontSize: '1.3rem', 
                color: '#3e2723',
                lineHeight: '1.5',
              }}>
                O primeiro jogo de arcade de sucesso comercial da história. Autêntico e nostálgico.
              </p>
            </div>

            {/* Feature 2 */}
            <div
              style={{
                background: '#f4d03f',
                border: '4px solid #3e2723',
                boxShadow: '8px 8px 0px #3e2723',
                padding: '2.5rem',
                textAlign: 'center',
              }}
            >
              <div 
                style={{ 
                  fontFamily: 'Bungee, cursive',
                  fontSize: '3rem',
                  color: '#3e2723',
                  marginBottom: '1rem',
                }}
              >
                2P
              </div>
              <h3 
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.5rem',
                  color: '#3e2723',
                  marginBottom: '1rem',
                  letterSpacing: '0.1rem',
                }}
              >
                MULTIPLAYER
              </h3>
              <p style={{ 
                fontFamily: 'VT323, monospace', 
                fontSize: '1.3rem', 
                color: '#3e2723',
                lineHeight: '1.5',
              }}>
                Desafie seus amigos em partidas épicas. Modo local e online disponível.
              </p>
            </div>

            {/* Feature 3 */}
            <div
              style={{
                background: '#f4d03f',
                border: '4px solid #3e2723',
                boxShadow: '8px 8px 0px #3e2723',
                padding: '2.5rem',
                textAlign: 'center',
              }}
            >
              <div 
                style={{ 
                  fontFamily: 'Bungee, cursive',
                  fontSize: '3rem',
                  color: '#3e2723',
                  marginBottom: '1rem',
                }}
              >
                ∞
              </div>
              <h3 
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.5rem',
                  color: '#3e2723',
                  marginBottom: '1rem',
                  letterSpacing: '0.1rem',
                }}
              >
                DIVERSÃO INFINITA
              </h3>
              <p style={{ 
                fontFamily: 'VT323, monospace', 
                fontSize: '1.3rem', 
                color: '#3e2723',
                lineHeight: '1.5',
              }}>
                Simples de aprender, impossível de dominar. Cada partida é única e emocionante.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CRT Display Section */}
      <section 
        className="py-20 px-8"
        style={{ background: 'linear-gradient(180deg, #6d4c41 0%, #5d4037 100%)' }}
      >
        <div className="max-w-5xl mx-auto">
          <div
            style={{
              background: 'linear-gradient(145deg, #2a2a2a, #1a1410)',
              padding: '32px',
              border: '6px solid #3e2723',
              boxShadow: 'inset 0 6px 24px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div 
              className="relative"
              style={{
                background: '#1a1410',
                border: '4px solid #0a0a0a',
                padding: '3rem',
                boxShadow: 'inset 0 0 60px rgba(0, 0, 0, 0.9)',
              }}
            >
              {/* Scanlines */}
              <div 
                className="absolute inset-0 pointer-events-none z-20"
                style={{
                  background: 'repeating-linear-gradient(0deg, rgba(240, 240, 232, 0.03) 0px, rgba(240, 240, 232, 0.03) 2px, transparent 2px, transparent 4px)',
                }}
              />

              <div className="relative z-10 text-center">
                <h2 
                  style={{ 
                    fontFamily: 'Righteous, cursive',
                    fontSize: '2.5rem',
                    color: '#f0f0e8',
                    marginBottom: '2rem',
                    letterSpacing: '0.2rem',
                    textShadow: '0 0 20px rgba(240, 240, 232, 0.6)',
                  }}
                >
                  RANKING GLOBAL
                </h2>

                <div className="space-y-4 mb-6">
                  {[
                    { pos: 1, name: 'JOGADOR_PRO', score: 9999 },
                    { pos: 2, name: 'RETRO_KING', score: 8888 },
                    { pos: 3, name: 'PONG_MASTER', score: 7777 },
                  ].map((player) => (
                    <div 
                      key={player.pos}
                      className="flex justify-between items-center px-8 py-3"
                      style={{
                        background: 'rgba(240, 240, 232, 0.1)',
                        border: '2px solid #f0f0e8',
                      }}
                    >
                      <span style={{ 
                        fontFamily: 'VT323, monospace', 
                        fontSize: '2rem', 
                        color: '#f4d03f',
                        textShadow: '0 0 10px rgba(244, 208, 63, 0.8)',
                      }}>
                        #{player.pos}
                      </span>
                      <span style={{ 
                        fontFamily: 'VT323, monospace', 
                        fontSize: '1.8rem', 
                        color: '#f0f0e8',
                        textShadow: '0 0 10px rgba(240, 240, 232, 0.6)',
                      }}>
                        {player.name}
                      </span>
                      <span style={{ 
                        fontFamily: 'VT323, monospace', 
                        fontSize: '2rem', 
                        color: '#f0f0e8',
                        textShadow: '0 0 10px rgba(240, 240, 232, 0.6)',
                      }}>
                        {player.score}
                      </span>
                    </div>
                  ))}
                </div>

                <Link to="/ranking">
                  <button
                    style={{
                      fontFamily: 'Righteous, cursive',
                      fontSize: '1.2rem',
                      letterSpacing: '0.15rem',
                      padding: '1rem 2.5rem',
                      background: '#f4d03f',
                      color: '#3e2723',
                      border: '3px solid #f0f0e8',
                      boxShadow: '0 0 20px rgba(244, 208, 63, 0.5)',
                      cursor: 'pointer',
                    }}
                  >
                    VER RANKING COMPLETO
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section 
        className="py-20 px-8 text-center"
        style={{ background: '#f4d03f', borderTop: '6px solid #3e2723' }}
      >
        <div className="max-w-3xl mx-auto">
          <h2 
            style={{ 
              fontFamily: 'Bungee, cursive',
              fontSize: '3.5rem',
              color: '#3e2723',
              marginBottom: '1.5rem',
              letterSpacing: '0.3rem',
            }}
          >
            PRONTO PARA JOGAR?
          </h2>
          
          <p style={{ 
            fontFamily: 'VT323, monospace', 
            fontSize: '1.8rem', 
            color: '#3e2723',
            marginBottom: '2.5rem',
            lineHeight: '1.5',
          }}>
            Crie sua conta gratuitamente e comece a competir com jogadores do mundo todo.
          </p>

          <Link to="/login">
            <button
              style={{
                fontFamily: 'Righteous, cursive',
                fontSize: '1.5rem',
                letterSpacing: '0.15rem',
                padding: '1.2rem 3.5rem',
                background: '#3e2723',
                color: '#f4d03f',
                border: '4px solid #3e2723',
                boxShadow: '8px 8px 0px rgba(0, 0, 0, 0.3)',
                cursor: 'pointer',
                transition: 'transform 0.1s',
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translate(4px, 4px)';
                e.currentTarget.style.boxShadow = '4px 4px 0px rgba(0, 0, 0, 0.3)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translate(0, 0)';
                e.currentTarget.style.boxShadow = '8px 8px 0px rgba(0, 0, 0, 0.3)';
              }}
            >
              COMEÇAR AGORA
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
