export function HowToPlay() {
  return (
    <div className="min-h-screen" style={{ background: '#f0f0e8' }}>
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
          COMO JOGAR
        </h1>
        <p style={{ 
          fontFamily: 'VT323, monospace', 
          fontSize: '1.8rem', 
          color: '#f0f0e8',
          maxWidth: '800px',
          margin: '0 auto',
        }}>
          Aprenda tudo sobre o jogo em minutos
        </p>
      </section>

      <div className="max-w-5xl mx-auto px-8 py-16">
        {/* Rules */}
        <section className="mb-16">
          <div
            style={{
              background: '#f4d03f',
              border: '5px solid #3e2723',
              boxShadow: '10px 10px 0px #3e2723',
              padding: '3rem',
            }}
          >
            <h2 
              style={{ 
                fontFamily: 'Righteous, cursive',
                fontSize: '2.5rem',
                color: '#3e2723',
                marginBottom: '2rem',
                letterSpacing: '0.15rem',
              }}
            >
              REGRAS DO JOGO
            </h2>
            
            <div className="space-y-4">
              <div className="flex gap-4">
                <div 
                  style={{ 
                    fontFamily: 'Bungee, cursive',
                    fontSize: '2rem',
                    color: '#3e2723',
                    minWidth: '50px',
                  }}
                >
                  01
                </div>
                <p style={{ 
                  fontFamily: 'VT323, monospace', 
                  fontSize: '1.4rem', 
                  color: '#3e2723',
                  lineHeight: '1.6',
                }}>
                  O objetivo é fazer a bola passar pela raquete do adversário
                </p>
              </div>

              <div className="flex gap-4">
                <div 
                  style={{ 
                    fontFamily: 'Bungee, cursive',
                    fontSize: '2rem',
                    color: '#3e2723',
                    minWidth: '50px',
                  }}
                >
                  02
                </div>
                <p style={{ 
                  fontFamily: 'VT323, monospace', 
                  fontSize: '1.4rem', 
                  color: '#3e2723',
                  lineHeight: '1.6',
                }}>
                  Cada ponto marcado adiciona 1 ao seu placar
                </p>
              </div>

              <div className="flex gap-4">
                <div 
                  style={{ 
                    fontFamily: 'Bungee, cursive',
                    fontSize: '2rem',
                    color: '#3e2723',
                    minWidth: '50px',
                  }}
                >
                  03
                </div>
                <p style={{ 
                  fontFamily: 'VT323, monospace', 
                  fontSize: '1.4rem', 
                  color: '#3e2723',
                  lineHeight: '1.6',
                }}>
                  O primeiro jogador a atingir 11 pontos vence a partida
                </p>
              </div>

              <div className="flex gap-4">
                <div 
                  style={{ 
                    fontFamily: 'Bungee, cursive',
                    fontSize: '2rem',
                    color: '#3e2723',
                    minWidth: '50px',
                  }}
                >
                  04
                </div>
                <p style={{ 
                  fontFamily: 'VT323, monospace', 
                  fontSize: '1.4rem', 
                  color: '#3e2723',
                  lineHeight: '1.6',
                }}>
                  A velocidade da bola aumenta conforme os rallies continuam
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Controls */}
        <section className="mb-16">
          <h2 
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '2.5rem',
              color: '#3e2723',
              marginBottom: '3rem',
              letterSpacing: '0.15rem',
              textAlign: 'center',
            }}
          >
            CONTROLES
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Player 1 Controls */}
            <div
              style={{
                background: 'linear-gradient(145deg, #6d4c41, #5d4037)',
                border: '5px solid #3e2723',
                boxShadow: '8px 8px 0px #3e2723',
                padding: '2.5rem',
              }}
            >
              <h3 
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '2rem',
                  color: '#f4d03f',
                  marginBottom: '2rem',
                  letterSpacing: '0.1rem',
                  textAlign: 'center',
                }}
              >
                JOGADOR 1
              </h3>

              <div className="space-y-4">
                <div 
                  className="flex items-center justify-between p-4"
                  style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '3px solid #3e2723',
                  }}
                >
                  <span style={{ 
                    fontFamily: 'VT323, monospace',
                    fontSize: '1.5rem',
                    color: '#f0f0e8',
                  }}>
                    Mover para cima
                  </span>
                  <div 
                    style={{ 
                      fontFamily: 'Bungee, cursive',
                      fontSize: '1.5rem',
                      color: '#f4d03f',
                      background: '#3e2723',
                      padding: '0.5rem 1.5rem',
                      border: '2px solid #f4d03f',
                    }}
                  >
                    W
                  </div>
                </div>

                <div 
                  className="flex items-center justify-between p-4"
                  style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '3px solid #3e2723',
                  }}
                >
                  <span style={{ 
                    fontFamily: 'VT323, monospace',
                    fontSize: '1.5rem',
                    color: '#f0f0e8',
                  }}>
                    Mover para baixo
                  </span>
                  <div 
                    style={{ 
                      fontFamily: 'Bungee, cursive',
                      fontSize: '1.5rem',
                      color: '#f4d03f',
                      background: '#3e2723',
                      padding: '0.5rem 1.5rem',
                      border: '2px solid #f4d03f',
                    }}
                  >
                    S
                  </div>
                </div>
              </div>
            </div>

            {/* Player 2 Controls */}
            <div
              style={{
                background: 'linear-gradient(145deg, #6d4c41, #5d4037)',
                border: '5px solid #3e2723',
                boxShadow: '8px 8px 0px #3e2723',
                padding: '2.5rem',
              }}
            >
              <h3 
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '2rem',
                  color: '#f4d03f',
                  marginBottom: '2rem',
                  letterSpacing: '0.1rem',
                  textAlign: 'center',
                }}
              >
                JOGADOR 2
              </h3>

              <div className="space-y-4">
                <div 
                  className="flex items-center justify-between p-4"
                  style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '3px solid #3e2723',
                  }}
                >
                  <span style={{ 
                    fontFamily: 'VT323, monospace',
                    fontSize: '1.5rem',
                    color: '#f0f0e8',
                  }}>
                    Mover para cima
                  </span>
                  <div 
                    style={{ 
                      fontFamily: 'Bungee, cursive',
                      fontSize: '1.5rem',
                      color: '#f4d03f',
                      background: '#3e2723',
                      padding: '0.5rem 1.5rem',
                      border: '2px solid #f4d03f',
                    }}
                  >
                    ↑
                  </div>
                </div>

                <div 
                  className="flex items-center justify-between p-4"
                  style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '3px solid #3e2723',
                  }}
                >
                  <span style={{ 
                    fontFamily: 'VT323, monospace',
                    fontSize: '1.5rem',
                    color: '#f0f0e8',
                  }}>
                    Mover para baixo
                  </span>
                  <div 
                    style={{ 
                      fontFamily: 'Bungee, cursive',
                      fontSize: '1.5rem',
                      color: '#f4d03f',
                      background: '#3e2723',
                      padding: '0.5rem 1.5rem',
                      border: '2px solid #f4d03f',
                    }}
                  >
                    ↓
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tips */}
        <section className="mb-16">
          <h2 
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '2.5rem',
              color: '#3e2723',
              marginBottom: '3rem',
              letterSpacing: '0.15rem',
              textAlign: 'center',
            }}
          >
            DICAS PRO
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: 'ANTECIPE O MOVIMENTO',
                tip: 'Observe a trajetória da bola e posicione sua raquete com antecedência.',
              },
              {
                title: 'VARIE O ÂNGULO',
                tip: 'Rebater a bola em diferentes partes da raquete altera sua direção.',
              },
              {
                title: 'CONTROLE O CENTRO',
                tip: 'Mantenha sua raquete próxima ao centro para alcançar ambos os lados rapidamente.',
              },
              {
                title: 'PRATIQUE A TIMING',
                tip: 'O timing perfeito é a diferença entre iniciantes e mestres.',
              },
            ].map((item, index) => (
              <div
                key={index}
                style={{
                  background: index % 2 === 0 ? '#f4d03f' : '#6d4c41',
                  border: '4px solid #3e2723',
                  boxShadow: '6px 6px 0px #3e2723',
                  padding: '2rem',
                }}
              >
                <h3 
                  style={{ 
                    fontFamily: 'Righteous, cursive',
                    fontSize: '1.3rem',
                    color: '#3e2723',
                    marginBottom: '1rem',
                    letterSpacing: '0.1rem',
                  }}
                >
                  {item.title}
                </h3>
                <p style={{ 
                  fontFamily: 'VT323, monospace', 
                  fontSize: '1.3rem', 
                  color: '#3e2723',
                  lineHeight: '1.5',
                }}>
                  {item.tip}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Game Modes */}
        <section>
          <div
            style={{
              background: 'linear-gradient(145deg, #6d4c41, #5d4037)',
              border: '5px solid #3e2723',
              boxShadow: '10px 10px 0px #3e2723',
              padding: '3rem',
            }}
          >
            <h2 
              style={{ 
                fontFamily: 'Righteous, cursive',
                fontSize: '2.5rem',
                color: '#f4d03f',
                marginBottom: '2rem',
                letterSpacing: '0.15rem',
                textAlign: 'center',
              }}
            >
              MODOS DE JOGO
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div 
                  style={{ 
                    fontFamily: 'Bungee, cursive',
                    fontSize: '3rem',
                    color: '#f4d03f',
                    marginBottom: '1rem',
                  }}
                >
                  VS
                </div>
                <h3 
                  style={{ 
                    fontFamily: 'Righteous, cursive',
                    fontSize: '1.5rem',
                    color: '#f0f0e8',
                    marginBottom: '0.5rem',
                    letterSpacing: '0.1rem',
                  }}
                >
                  LOCAL
                </h3>
                <p style={{ 
                  fontFamily: 'VT323, monospace', 
                  fontSize: '1.2rem', 
                  color: '#f0f0e8',
                }}>
                  Jogue contra um amigo no mesmo computador
                </p>
              </div>

              <div className="text-center">
                <div 
                  style={{ 
                    fontFamily: 'Bungee, cursive',
                    fontSize: '3rem',
                    color: '#f4d03f',
                    marginBottom: '1rem',
                  }}
                >
                  🤖
                </div>
                <h3 
                  style={{ 
                    fontFamily: 'Righteous, cursive',
                    fontSize: '1.5rem',
                    color: '#f0f0e8',
                    marginBottom: '0.5rem',
                    letterSpacing: '0.1rem',
                  }}
                >
                  VS CPU
                </h3>
                <p style={{ 
                  fontFamily: 'VT323, monospace', 
                  fontSize: '1.2rem', 
                  color: '#f0f0e8',
                }}>
                  Desafie a inteligência artificial
                </p>
              </div>

              <div className="text-center">
                <div 
                  style={{ 
                    fontFamily: 'Bungee, cursive',
                    fontSize: '3rem',
                    color: '#f4d03f',
                    marginBottom: '1rem',
                  }}
                >
                  🌐
                </div>
                <h3 
                  style={{ 
                    fontFamily: 'Righteous, cursive',
                    fontSize: '1.5rem',
                    color: '#f0f0e8',
                    marginBottom: '0.5rem',
                    letterSpacing: '0.1rem',
                  }}
                >
                  ONLINE
                </h3>
                <p style={{ 
                  fontFamily: 'VT323, monospace', 
                  fontSize: '1.2rem', 
                  color: '#f0f0e8',
                }}>
                  Compete contra jogadores globalmente
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
