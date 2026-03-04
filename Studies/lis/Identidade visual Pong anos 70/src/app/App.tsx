export default function App() {
  return (
    <div className="size-full relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #f4d03f 0%, #f4d03f 60%, #5d4037 60%, #5d4037 100%)' }}>
      {/* Top Yellow Section */}
      <div className="relative h-[60%] flex flex-col items-center justify-center" style={{ background: '#f4d03f', borderBottom: '12px solid #3e2723' }}>
        {/* PONG Logo */}
        <div className="text-center mb-8">
          <h1 
            style={{ 
              fontFamily: 'Bungee, cursive',
              fontSize: '8rem',
              color: '#3e2723',
              letterSpacing: '0.5rem',
              textShadow: '6px 6px 0px rgba(0, 0, 0, 0.15)',
            }}
          >
            PONG
          </h1>
          <div 
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '1.5rem',
              color: '#5d4037',
              letterSpacing: '0.3rem',
              marginTop: '0.5rem',
            }}
          >
            THE ORIGINAL ARCADE GAME
          </div>
        </div>

        {/* CRT Screen Container */}
        <div 
          className="relative"
          style={{
            width: '85%',
            maxWidth: '1200px',
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Wood Panel with Controls */}
      <div 
        className="relative h-[40%] flex flex-col items-center justify-center"
        style={{
          background: 'linear-gradient(180deg, #6d4c41 0%, #5d4037 50%, #4e342e 100%)',
        }}
      >
        {/* Control Panel */}
        <div 
          className="relative p-10 mb-8"
          style={{
            width: '90%',
            maxWidth: '900px',
            background: 'linear-gradient(145deg, #9e9e9e, #7a7a7a)',
            border: '4px solid #4a4a4a',
            boxShadow: 'inset 0 3px 12px rgba(0, 0, 0, 0.4), 0 6px 16px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Screws */}
          <div className="absolute top-3 left-3 w-3 h-3 rounded-full" style={{ background: '#4a4a4a', boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.6)' }} />
          <div className="absolute top-3 right-3 w-3 h-3 rounded-full" style={{ background: '#4a4a4a', boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.6)' }} />
          <div className="absolute bottom-3 left-3 w-3 h-3 rounded-full" style={{ background: '#4a4a4a', boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.6)' }} />
          <div className="absolute bottom-3 right-3 w-3 h-3 rounded-full" style={{ background: '#4a4a4a', boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.6)' }} />

          <div className="grid grid-cols-3 gap-16 items-center">
            {/* Player 1 Controls */}
            <div className="text-center">
              <div 
                className="mb-4"
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.3rem',
                  color: '#3e2723',
                  letterSpacing: '0.15rem',
                }}
              >
                PLAYER 1
              </div>
              {/* Knob */}
              <div className="flex justify-center">
                <div 
                  className="relative"
                  style={{
                    width: '90px',
                    height: '90px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 35%, #6d4c41, #4e342e)',
                    border: '5px solid #3e2723',
                    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.5), inset 0 -3px 10px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <div 
                    className="absolute top-2 left-1/2 w-1.5 h-6 -translate-x-1/2"
                    style={{ background: '#f4d03f' }}
                  />
                </div>
              </div>
            </div>

            {/* Insert Coin Section */}
            <div className="text-center">
              <div 
                className="mb-4"
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.8rem',
                  color: '#3e2723',
                  letterSpacing: '0.15rem',
                }}
              >
                INSERT COIN
              </div>
              <div 
                className="mx-auto"
                style={{
                  width: '80px',
                  height: '6px',
                  background: '#3e2723',
                  boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.6)',
                }}
              />
            </div>

            {/* Player 2 Controls */}
            <div className="text-center">
              <div 
                className="mb-4"
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.3rem',
                  color: '#3e2723',
                  letterSpacing: '0.15rem',
                }}
              >
                PLAYER 2
              </div>
              {/* Knob */}
              <div className="flex justify-center">
                <div 
                  className="relative"
                  style={{
                    width: '90px',
                    height: '90px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 35%, #6d4c41, #4e342e)',
                    border: '5px solid #3e2723',
                    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.5), inset 0 -3px 10px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <div 
                    className="absolute top-2 left-1/2 w-1.5 h-6 -translate-x-1/2"
                    style={{ background: '#f4d03f' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-center">
          <div 
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '0.9rem',
              color: '#f4d03f',
              opacity: 0.8,
              letterSpacing: '0.2rem',
            }}
          >
            © 1972 ATARI INCORPORATED
          </div>
        </div>
      </div>
    </div>
  );
}
