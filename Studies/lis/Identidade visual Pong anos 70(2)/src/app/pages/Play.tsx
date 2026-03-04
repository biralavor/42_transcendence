export function Play() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Game Container */}
      <div 
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: 'linear-gradient(180deg, #5d4037 0%, #3e2723 100%)' }}
      >
        <div className="w-full max-w-6xl">
          {/* CRT Screen Container */}
          <div
            style={{
              background: 'linear-gradient(145deg, #2a2a2a, #1a1410)',
              padding: '32px',
              border: '8px solid #3e2723',
              boxShadow: 'inset 0 6px 24px rgba(0, 0, 0, 0.8), 0 8px 16px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* CRT Screen Bezel */}
            <div 
              className="relative"
              style={{
                background: '#1a1410',
                border: '4px solid #0a0a0a',
                boxShadow: 'inset 0 0 60px rgba(0, 0, 0, 0.9)',
              }}
            >
              {/* Scanlines Effect */}
              <div 
                className="absolute inset-0 pointer-events-none z-20"
                style={{
                  background: 'repeating-linear-gradient(0deg, rgba(240, 240, 232, 0.03) 0px, rgba(240, 240, 232, 0.03) 2px, transparent 2px, transparent 4px)',
                }}
              />

              {/* CRT Glow */}
              <div 
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                  boxShadow: 'inset 0 0 80px rgba(240, 240, 232, 0.15)',
                }}
              />

              {/* Game Screen */}
              <div className="relative p-12" style={{ aspectRatio: '16/9' }}>
                {/* Score Display */}
                <div className="flex justify-between items-center mb-8 px-12">
                  <div>
                    <div 
                      style={{ 
                        fontFamily: 'Righteous, cursive',
                        fontSize: '1.8rem',
                        color: '#f0f0e8',
                        textShadow: '0 0 15px rgba(240, 240, 232, 0.6)',
                        marginBottom: '0.5rem',
                        letterSpacing: '0.2rem',
                      }}
                    >
                      PLAYER 1
                    </div>
                    <div 
                      style={{ 
                        fontFamily: 'VT323, monospace',
                        fontSize: '6rem',
                        color: '#f0f0e8',
                        textShadow: '0 0 25px rgba(240, 240, 232, 0.9)',
                        lineHeight: '1',
                      }}
                    >
                      0
                    </div>
                  </div>
                  <div>
                    <div 
                      style={{ 
                        fontFamily: 'Righteous, cursive',
                        fontSize: '1.8rem',
                        color: '#f0f0e8',
                        textShadow: '0 0 15px rgba(240, 240, 232, 0.6)',
                        marginBottom: '0.5rem',
                        letterSpacing: '0.2rem',
                      }}
                    >
                      PLAYER 2
                    </div>
                    <div 
                      style={{ 
                        fontFamily: 'VT323, monospace',
                        fontSize: '6rem',
                        color: '#f0f0e8',
                        textShadow: '0 0 25px rgba(240, 240, 232, 0.9)',
                        lineHeight: '1',
                      }}
                    >
                      0
                    </div>
                  </div>
                </div>

                {/* Playing Field */}
                <div className="relative" style={{ height: '360px' }}>
                  {/* Center Dashed Line */}
                  <div 
                    className="absolute top-0 left-1/2 h-full w-1 -translate-x-1/2"
                    style={{
                      background: 'repeating-linear-gradient(0deg, #f0f0e8 0px, #f0f0e8 16px, transparent 16px, transparent 32px)',
                      opacity: 0.4,
                      boxShadow: '0 0 10px rgba(240, 240, 232, 0.5)',
                    }}
                  />

                  {/* Left Paddle */}
                  <div 
                    className="absolute top-1/2 -translate-y-1/2"
                    style={{
                      left: '50px',
                      width: '14px',
                      height: '100px',
                      background: '#f0f0e8',
                      boxShadow: '0 0 20px rgba(240, 240, 232, 1), 0 0 40px rgba(240, 240, 232, 0.5)',
                    }}
                  />

                  {/* Right Paddle */}
                  <div 
                    className="absolute top-1/2 -translate-y-1/2"
                    style={{
                      right: '50px',
                      width: '14px',
                      height: '100px',
                      background: '#f0f0e8',
                      boxShadow: '0 0 20px rgba(240, 240, 232, 1), 0 0 40px rgba(240, 240, 232, 0.5)',
                    }}
                  />

                  {/* Ball */}
                  <div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{
                      width: '18px',
                      height: '18px',
                      background: '#f0f0e8',
                      boxShadow: '0 0 25px rgba(240, 240, 232, 1), 0 0 50px rgba(240, 240, 232, 0.7)',
                    }}
                  />

                  {/* Start Message */}
                  <div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
                    style={{ marginTop: '100px' }}
                  >
                    <p 
                      className="animate-pulse"
                      style={{ 
                        fontFamily: 'Righteous, cursive',
                        fontSize: '2rem',
                        color: '#f0f0e8',
                        textShadow: '0 0 20px rgba(240, 240, 232, 0.8)',
                        letterSpacing: '0.2rem',
                      }}
                    >
                      PRESS SPACE TO START
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Controls Info */}
          <div className="grid grid-cols-2 gap-8 mt-8">
            <div
              style={{
                background: '#f4d03f',
                border: '4px solid #3e2723',
                boxShadow: '6px 6px 0px #3e2723',
                padding: '1.5rem',
                textAlign: 'center',
              }}
            >
              <h3 
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.3rem',
                  color: '#3e2723',
                  marginBottom: '0.5rem',
                  letterSpacing: '0.1rem',
                }}
              >
                PLAYER 1
              </h3>
              <p style={{ 
                fontFamily: 'VT323, monospace',
                fontSize: '1.5rem',
                color: '#3e2723',
              }}>
                W / S
              </p>
            </div>

            <div
              style={{
                background: '#f4d03f',
                border: '4px solid #3e2723',
                boxShadow: '6px 6px 0px #3e2723',
                padding: '1.5rem',
                textAlign: 'center',
              }}
            >
              <h3 
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.3rem',
                  color: '#3e2723',
                  marginBottom: '0.5rem',
                  letterSpacing: '0.1rem',
                }}
              >
                PLAYER 2
              </h3>
              <p style={{ 
                fontFamily: 'VT323, monospace',
                fontSize: '1.5rem',
                color: '#3e2723',
              }}>
                ↑ / ↓
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
