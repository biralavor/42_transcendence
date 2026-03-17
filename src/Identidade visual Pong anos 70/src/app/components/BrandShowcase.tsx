export function BrandShowcase() {
  return (
    <div className="min-h-screen p-12" style={{ background: '#f0f0e8' }}>
      {/* Header */}
      <div className="text-center mb-16">
        <h1 
          style={{ 
            fontFamily: 'Bungee, cursive',
            fontSize: '4rem',
            color: '#3e2723',
            letterSpacing: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          PONG
        </h1>
        <p style={{ fontFamily: 'Righteous, cursive', fontSize: '1.2rem', color: '#5d4037', letterSpacing: '0.2rem' }}>
          IDENTIDADE VISUAL
        </p>
      </div>

      <div className="max-w-7xl mx-auto space-y-16">
        {/* Color Palette */}
        <section>
          <h2 
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '2rem',
              color: '#3e2723',
              marginBottom: '2rem',
              letterSpacing: '0.1rem',
            }}
          >
            Paleta de Cores
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div>
              <div 
                className="h-32 mb-3"
                style={{ 
                  background: '#f4d03f',
                  border: '3px solid #3e2723',
                  boxShadow: '4px 4px 0px #3e2723',
                }}
              />
              <p style={{ fontFamily: 'Righteous, cursive', fontSize: '0.9rem', color: '#3e2723' }}>Amarelo Arcade</p>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.1rem', color: '#5d4037' }}>#f4d03f</p>
            </div>
            <div>
              <div 
                className="h-32 mb-3"
                style={{ 
                  background: '#3e2723',
                  border: '3px solid #3e2723',
                  boxShadow: '4px 4px 0px #3e2723',
                }}
              />
              <p style={{ fontFamily: 'Righteous, cursive', fontSize: '0.9rem', color: '#3e2723' }}>Marrom Escuro</p>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.1rem', color: '#5d4037' }}>#3e2723</p>
            </div>
            <div>
              <div 
                className="h-32 mb-3"
                style={{ 
                  background: '#5d4037',
                  border: '3px solid #3e2723',
                  boxShadow: '4px 4px 0px #3e2723',
                }}
              />
              <p style={{ fontFamily: 'Righteous, cursive', fontSize: '0.9rem', color: '#3e2723' }}>Madeira</p>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.1rem', color: '#5d4037' }}>#5d4037</p>
            </div>
            <div>
              <div 
                className="h-32 mb-3"
                style={{ 
                  background: '#f0f0e8',
                  border: '3px solid #3e2723',
                  boxShadow: '4px 4px 0px #3e2723',
                }}
              />
              <p style={{ fontFamily: 'Righteous, cursive', fontSize: '0.9rem', color: '#3e2723' }}>CRT Branco</p>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.1rem', color: '#5d4037' }}>#f0f0e8</p>
            </div>
            <div>
              <div 
                className="h-32 mb-3"
                style={{ 
                  background: '#1a1410',
                  border: '3px solid #3e2723',
                  boxShadow: '4px 4px 0px #3e2723',
                }}
              />
              <p style={{ fontFamily: 'Righteous, cursive', fontSize: '0.9rem', color: '#3e2723' }}>Tela CRT</p>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.1rem', color: '#5d4037' }}>#1a1410</p>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section>
          <h2 
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '2rem',
              color: '#3e2723',
              marginBottom: '2rem',
              letterSpacing: '0.1rem',
            }}
          >
            Tipografia
          </h2>
          <div className="space-y-6 p-8" style={{ background: '#6d4c41', border: '3px solid #3e2723' }}>
            <div>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '0.9rem', color: '#5d4037', marginBottom: '0.5rem' }}>
                Logo / Títulos Principais
              </p>
              <h1 style={{ fontFamily: 'Bungee, cursive', fontSize: '3rem', color: '#3e2723', letterSpacing: '0.3rem' }}>
                Bungee
              </h1>
            </div>
            <div>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '0.9rem', color: '#5d4037', marginBottom: '0.5rem' }}>
                Títulos Secundários / Botões
              </p>
              <h2 style={{ fontFamily: 'Righteous, cursive', fontSize: '2rem', color: '#3e2723', letterSpacing: '0.15rem' }}>
                Righteous
              </h2>
            </div>
            <div>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '0.9rem', color: '#5d4037', marginBottom: '0.5rem' }}>
                Números / Pontuação / Textos Retro
              </p>
              <h3 style={{ fontFamily: 'VT323, monospace', fontSize: '2rem', color: '#3e2723' }}>
                VT323 - 0123456789
              </h3>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section>
          <h2 
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '2rem',
              color: '#3e2723',
              marginBottom: '2rem',
              letterSpacing: '0.1rem',
            }}
          >
            Botões
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Primary Button */}
            <div>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.1rem', color: '#5d4037', marginBottom: '1rem' }}>
                Primário
              </p>
              <button
                style={{
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.2rem',
                  letterSpacing: '0.15rem',
                  padding: '1rem 2rem',
                  background: '#f4d03f',
                  color: '#3e2723',
                  border: '4px solid #3e2723',
                  boxShadow: '6px 6px 0px #3e2723',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translate(3px, 3px)';
                  e.currentTarget.style.boxShadow = '3px 3px 0px #3e2723';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translate(0, 0)';
                  e.currentTarget.style.boxShadow = '6px 6px 0px #3e2723';
                }}
              >
                JOGAR AGORA
              </button>
            </div>

            {/* Secondary Button */}
            <div>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.1rem', color: '#5d4037', marginBottom: '1rem' }}>
                Secundário
              </p>
              <button
                style={{
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.2rem',
                  letterSpacing: '0.15rem',
                  padding: '1rem 2rem',
                  background: '#5d4037',
                  color: '#f0f0e8',
                  border: '4px solid #3e2723',
                  boxShadow: '6px 6px 0px #3e2723',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translate(3px, 3px)';
                  e.currentTarget.style.boxShadow = '3px 3px 0px #3e2723';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translate(0, 0)';
                  e.currentTarget.style.boxShadow = '6px 6px 0px #3e2723';
                }}
              >
                RANKING
              </button>
            </div>

            {/* Outline Button */}
            <div>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.1rem', color: '#5d4037', marginBottom: '1rem' }}>
                Terciário
              </p>
              <button
                style={{
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.2rem',
                  letterSpacing: '0.15rem',
                  padding: '1rem 2rem',
                  background: 'transparent',
                  color: '#3e2723',
                  border: '4px solid #3e2723',
                  boxShadow: '6px 6px 0px #3e2723',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translate(3px, 3px)';
                  e.currentTarget.style.boxShadow = '3px 3px 0px #3e2723';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translate(0, 0)';
                  e.currentTarget.style.boxShadow = '6px 6px 0px #3e2723';
                }}
              >
                COMO JOGAR
              </button>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section>
          <h2 
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '2rem',
              color: '#3e2723',
              marginBottom: '2rem',
              letterSpacing: '0.1rem',
            }}
          >
            Cards e Containers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Arcade Style Card */}
            <div
              style={{
                background: '#f4d03f',
                border: '4px solid #3e2723',
                boxShadow: '8px 8px 0px #3e2723',
                padding: '2rem',
              }}
            >
              <h3 
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.5rem',
                  color: '#3e2723',
                  marginBottom: '1rem',
                  letterSpacing: '0.1rem',
                }}
              >
                Card Estilo Arcade
              </h3>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.3rem', color: '#3e2723', lineHeight: '1.4' }}>
                Use este estilo para destacar conteúdo principal, como placares, destaques ou calls-to-action importantes.
              </p>
            </div>

            {/* Wood Panel Card */}
            <div
              style={{
                background: 'linear-gradient(145deg, #6d4c41, #5d4037)',
                border: '4px solid #3e2723',
                boxShadow: '8px 8px 0px #3e2723',
                padding: '2rem',
              }}
            >
              <h3 
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.5rem',
                  color: '#f4d03f',
                  marginBottom: '1rem',
                  letterSpacing: '0.1rem',
                }}
              >
                Card Painel Madeira
              </h3>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.3rem', color: '#f0f0e8', lineHeight: '1.4' }}>
                Perfeito para seções de informação, tutoriais ou áreas com conteúdo secundário.
              </p>
            </div>
          </div>
        </section>

        {/* Score Display */}
        <section>
          <h2 
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '2rem',
              color: '#3e2723',
              marginBottom: '2rem',
              letterSpacing: '0.1rem',
            }}
          >
            Elementos de Jogo
          </h2>
          <div
            style={{
              background: '#1a1410',
              border: '4px solid #3e2723',
              padding: '3rem',
              textAlign: 'center',
            }}
          >
            <div className="flex justify-around items-center max-w-2xl mx-auto">
              <div>
                <p style={{ fontFamily: 'Righteous, cursive', fontSize: '1.2rem', color: '#f0f0e8', marginBottom: '1rem', letterSpacing: '0.15rem' }}>
                  JOGADOR 1
                </p>
                <p style={{ fontFamily: 'VT323, monospace', fontSize: '5rem', color: '#f0f0e8', textShadow: '0 0 20px rgba(240, 240, 232, 0.8)' }}>
                  15
                </p>
              </div>
              <div style={{ fontFamily: 'Bungee, cursive', fontSize: '2rem', color: '#f4d03f' }}>
                VS
              </div>
              <div>
                <p style={{ fontFamily: 'Righteous, cursive', fontSize: '1.2rem', color: '#f0f0e8', marginBottom: '1rem', letterSpacing: '0.15rem' }}>
                  JOGADOR 2
                </p>
                <p style={{ fontFamily: 'VT323, monospace', fontSize: '5rem', color: '#f0f0e8', textShadow: '0 0 20px rgba(240, 240, 232, 0.8)' }}>
                  12
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Decorative Elements */}
        <section>
          <h2 
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '2rem',
              color: '#3e2723',
              marginBottom: '2rem',
              letterSpacing: '0.1rem',
            }}
          >
            Elementos Decorativos
          </h2>
          <div className="space-y-6">
            {/* Divider 1 */}
            <div className="flex items-center gap-4">
              <div style={{ flex: 1, height: '4px', background: '#3e2723' }} />
              <div style={{ fontFamily: 'Bungee, cursive', fontSize: '1.5rem', color: '#3e2723' }}>★</div>
              <div style={{ flex: 1, height: '4px', background: '#3e2723' }} />
            </div>

            {/* Divider 2 - Dashed */}
            <div 
              style={{ 
                height: '4px',
                background: 'repeating-linear-gradient(90deg, #3e2723 0px, #3e2723 20px, transparent 20px, transparent 40px)',
              }} 
            />

            {/* Corner Frame */}
            <div className="relative p-8" style={{ border: '4px solid #3e2723' }}>
              <div className="absolute top-0 left-0 w-6 h-6" style={{ borderTop: '4px solid #f4d03f', borderLeft: '4px solid #f4d03f' }} />
              <div className="absolute top-0 right-0 w-6 h-6" style={{ borderTop: '4px solid #f4d03f', borderRight: '4px solid #f4d03f' }} />
              <div className="absolute bottom-0 left-0 w-6 h-6" style={{ borderBottom: '4px solid #f4d03f', borderLeft: '4px solid #f4d03f' }} />
              <div className="absolute bottom-0 right-0 w-6 h-6" style={{ borderBottom: '4px solid #f4d03f', borderRight: '4px solid #f4d03f' }} />
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.3rem', color: '#3e2723', textAlign: 'center' }}>
                Use este frame para destacar conteúdo especial
              </p>
            </div>
          </div>
        </section>

        {/* Layout Example */}
        <section>
          <h2 
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '2rem',
              color: '#3e2723',
              marginBottom: '2rem',
              letterSpacing: '0.1rem',
            }}
          >
            Exemplo de Layout de Site
          </h2>
          <div style={{ border: '4px solid #3e2723', overflow: 'hidden' }}>
            {/* Header */}
            <div 
              className="flex justify-between items-center px-8 py-6"
              style={{ background: '#f4d03f', borderBottom: '4px solid #3e2723' }}
            >
              <div style={{ fontFamily: 'Bungee, cursive', fontSize: '2rem', color: '#3e2723', letterSpacing: '0.2rem' }}>
                PONG
              </div>
              <nav className="flex gap-6">
                {['JOGAR', 'RANKING', 'SOBRE'].map((item) => (
                  <a 
                    key={item}
                    style={{ 
                      fontFamily: 'Righteous, cursive',
                      fontSize: '1.1rem',
                      color: '#3e2723',
                      letterSpacing: '0.1rem',
                      cursor: 'pointer',
                    }}
                  >
                    {item}
                  </a>
                ))}
              </nav>
            </div>

            {/* Hero Section */}
            <div 
              className="text-center py-16 px-8"
              style={{ background: 'linear-gradient(180deg, #5d4037 0%, #4e342e 100%)' }}
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
                O CLÁSSICO RETORNA
              </h1>
              <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.5rem', color: '#f0f0e8', marginBottom: '2rem' }}>
                Reviva a experiência arcade original dos anos 70
              </p>
              <button
                style={{
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.3rem',
                  letterSpacing: '0.15rem',
                  padding: '1.2rem 3rem',
                  background: '#f4d03f',
                  color: '#3e2723',
                  border: '4px solid #3e2723',
                  boxShadow: '6px 6px 0px #3e2723',
                  cursor: 'pointer',
                }}
              >
                COMEÇAR A JOGAR
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
