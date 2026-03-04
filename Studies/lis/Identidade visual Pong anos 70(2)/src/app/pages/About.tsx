export function About() {
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
          SOBRE O PONG
        </h1>
        <p style={{ 
          fontFamily: 'VT323, monospace', 
          fontSize: '1.8rem', 
          color: '#f0f0e8',
          maxWidth: '800px',
          margin: '0 auto',
        }}>
          A história do jogo que revolucionou a indústria
        </p>
      </section>

      <div className="max-w-5xl mx-auto px-8 py-16">
        {/* History Section */}
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
              A HISTÓRIA
            </h2>
            
            <div className="space-y-4">
              <p style={{ 
                fontFamily: 'VT323, monospace', 
                fontSize: '1.4rem', 
                color: '#3e2723',
                lineHeight: '1.6',
              }}>
                Pong foi um dos primeiros jogos de arcade criado pela Atari e lançado em 1972. 
                Desenvolvido por Allan Alcorn como um projeto de treinamento, o jogo se tornou 
                um fenômeno cultural e comercial inesperado.
              </p>
              
              <p style={{ 
                fontFamily: 'VT323, monospace', 
                fontSize: '1.4rem', 
                color: '#3e2723',
                lineHeight: '1.6',
              }}>
                Com sua mecânica simples mas viciante, Pong simulava tênis de mesa em uma tela 
                bidimensional. Dois jogadores controlavam raquetes verticais movendo-as para 
                cima e para baixo para rebater uma bola quadrada.
              </p>
              
              <p style={{ 
                fontFamily: 'VT323, monospace', 
                fontSize: '1.4rem', 
                color: '#3e2723',
                lineHeight: '1.6',
              }}>
                O sucesso de Pong ajudou a estabelecer a indústria de videogames e provou que 
                jogos eletrônicos podiam ser comercialmente viáveis. Hoje, é considerado um 
                dos jogos mais influentes de todos os tempos.
              </p>
            </div>
          </div>
        </section>

        {/* Timeline */}
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
            LINHA DO TEMPO
          </h2>

          <div className="space-y-6">
            {[
              { year: '1972', event: 'Lançamento do Pong arcade original', desc: 'Primeiro jogo comercialmente bem-sucedido' },
              { year: '1975', event: 'Pong doméstico para TV', desc: 'Vendeu mais de 150.000 unidades' },
              { year: '1977', event: 'Lançamento do Atari 2600', desc: 'Pong incluso como jogo padrão' },
              { year: '2026', event: 'Pong Web Revival', desc: 'Versão moderna mantendo a essência retro' },
            ].map((item, index) => (
              <div
                key={index}
                className="flex gap-6"
                style={{
                  background: index % 2 === 0 ? '#f4d03f' : 'white',
                  border: '4px solid #3e2723',
                  boxShadow: '6px 6px 0px #3e2723',
                  padding: '2rem',
                }}
              >
                <div 
                  style={{ 
                    fontFamily: 'Bungee, cursive',
                    fontSize: '2.5rem',
                    color: '#3e2723',
                    minWidth: '120px',
                  }}
                >
                  {item.year}
                </div>
                <div>
                  <h3 
                    style={{ 
                      fontFamily: 'Righteous, cursive',
                      fontSize: '1.5rem',
                      color: '#3e2723',
                      marginBottom: '0.5rem',
                      letterSpacing: '0.1rem',
                    }}
                  >
                    {item.event}
                  </h3>
                  <p style={{ 
                    fontFamily: 'VT323, monospace', 
                    fontSize: '1.3rem', 
                    color: '#3e2723',
                  }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Fun Facts */}
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
            CURIOSIDADES
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: 'PRIMEIRO PROTÓTIPO',
                fact: 'O primeiro protótipo de Pong foi instalado em um bar na Califórnia e quebrou após alguns dias porque estava cheio de moedas!',
              },
              {
                title: 'SOM ICÔNICO',
                fact: 'Os sons do jogo foram criados usando circuitos analógicos simples, mas se tornaram tão icônicos quanto o próprio jogo.',
              },
              {
                title: 'INFLUÊNCIA MASSIVA',
                fact: 'Pong inspirou centenas de clones e ajudou a criar toda uma indústria que hoje vale bilhões de dólares.',
              },
              {
                title: 'SIMPLICIDADE',
                fact: 'O código original tinha apenas alguns chips de circuito integrado - nada de processadores complexos!',
              },
            ].map((item, index) => (
              <div
                key={index}
                style={{
                  background: 'linear-gradient(145deg, #6d4c41, #5d4037)',
                  border: '4px solid #3e2723',
                  boxShadow: '6px 6px 0px #3e2723',
                  padding: '2rem',
                }}
              >
                <h3 
                  style={{ 
                    fontFamily: 'Righteous, cursive',
                    fontSize: '1.3rem',
                    color: '#f4d03f',
                    marginBottom: '1rem',
                    letterSpacing: '0.1rem',
                  }}
                >
                  {item.title}
                </h3>
                <p style={{ 
                  fontFamily: 'VT323, monospace', 
                  fontSize: '1.3rem', 
                  color: '#f0f0e8',
                  lineHeight: '1.5',
                }}>
                  {item.fact}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Team Section */}
        <section>
          <div
            style={{
              background: '#f4d03f',
              border: '5px solid #3e2723',
              boxShadow: '10px 10px 0px #3e2723',
              padding: '3rem',
              textAlign: 'center',
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
              NOSSA MISSÃO
            </h2>
            
            <p style={{ 
              fontFamily: 'VT323, monospace', 
              fontSize: '1.5rem', 
              color: '#3e2723',
              lineHeight: '1.6',
              maxWidth: '700px',
              margin: '0 auto',
            }}>
              Preservar e compartilhar a magia dos jogos clássicos de arcade com uma nova 
              geração de jogadores. Mantemos a essência retro enquanto aproveitamos a 
              tecnologia moderna para criar a melhor experiência possível.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
