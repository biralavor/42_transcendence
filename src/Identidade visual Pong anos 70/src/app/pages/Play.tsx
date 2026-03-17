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

          {/* Arcade Control Panel */}
          <div 
            className="mt-8"
            style={{
              background: 'linear-gradient(180deg, #8d8d8d 0%, #6d6d6d 100%)',
              border: '6px solid #3e2723',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)',
              padding: '2rem',
            }}
          >
            <div className="grid grid-cols-3 gap-8 items-center max-w-4xl mx-auto">
              {/* Player 1 Control */}
              <div className="flex flex-col items-center">
                <div 
                  style={{ 
                    fontFamily: 'Righteous, cursive',
                    fontSize: '1.5rem',
                    color: '#3e2723',
                    letterSpacing: '0.15rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  PLAYER 1
                </div>
                {/* Arcade Knob */}
                <div
                  style={{
                    width: '140px',
                    height: '140px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 30% 30%, #6d4c41, #3e2723)',
                    border: '8px solid #3e2723',
                    boxShadow: 'inset 0 -4px 12px rgba(0, 0, 0, 0.6), 0 6px 12px rgba(0, 0, 0, 0.4)',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                >
                  {/* Yellow indicator */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '12px',
                      height: '50px',
                      background: '#f4d03f',
                      boxShadow: '0 0 8px rgba(244, 208, 63, 0.8)',
                    }}
                  />
                  {/* Center screw */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#4a4a4a',
                      border: '2px solid #2a2a2a',
                    }}
                  />
                </div>
                <div 
                  className="mt-3"
                  style={{ 
                    fontFamily: 'VT323, monospace',
                    fontSize: '1.2rem',
                    color: '#3e2723',
                  }}
                >
                  W / S
                </div>
              </div>

              {/* Insert Coin Center */}
              <div className="flex flex-col items-center">
                <div
                  style={{
                    background: '#3e2723',
                    border: '4px solid #2a2a2a',
                    padding: '1.5rem 3rem',
                    textAlign: 'center',
                  }}
                >
                  <div 
                    style={{ 
                      fontFamily: 'Righteous, cursive',
                      fontSize: '2rem',
                      color: '#8d8d8d',
                      letterSpacing: '0.2rem',
                    }}
                  >
                    INSERT COIN
                  </div>
                  {/* Coin slot */}
                  <div
                    className="mx-auto mt-3"
                    style={{
                      width: '100px',
                      height: '6px',
                      background: '#1a1410',
                      border: '2px solid #0a0a0a',
                    }}
                  />
                </div>
                {/* Screws */}
                <div className="flex gap-16 mt-4">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle at 30% 30%, #6d6d6d, #3e2723)',
                        border: '2px solid #2a2a2a',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Player 2 Control */}
              <div className="flex flex-col items-center">
                <div 
                  style={{ 
                    fontFamily: 'Righteous, cursive',
                    fontSize: '1.5rem',
                    color: '#3e2723',
                    letterSpacing: '0.15rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  PLAYER 2
                </div>
                {/* Arcade Knob */}
                <div
                  style={{
                    width: '140px',
                    height: '140px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 30% 30%, #6d4c41, #3e2723)',
                    border: '8px solid #3e2723',
                    boxShadow: 'inset 0 -4px 12px rgba(0, 0, 0, 0.6), 0 6px 12px rgba(0, 0, 0, 0.4)',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                >
                  {/* Yellow indicator */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '12px',
                      height: '50px',
                      background: '#f4d03f',
                      boxShadow: '0 0 8px rgba(244, 208, 63, 0.8)',
                    }}
                  />
                  {/* Center screw */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#4a4a4a',
                      border: '2px solid #2a2a2a',
                    }}
                  />
                </div>
                <div 
                  className="mt-3"
                  style={{ 
                    fontFamily: 'VT323, monospace',
                    fontSize: '1.2rem',
                    color: '#3e2723',
                  }}
                >
                  ↑ / ↓
                </div>
              </div>
            </div>

            {/* Bottom screws */}
            <div className="flex justify-around mt-6 max-w-4xl mx-auto">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 30% 30%, #4a4a4a, #2a2a2a)',
                    border: '2px solid #1a1a1a',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Copyright Footer */}
          <div 
            className="mt-4 text-center"
            style={{ 
              fontFamily: 'VT323, monospace',
              fontSize: '1.1rem',
              color: '#f4d03f',
            }}
          >
            © 1972 ATARI INCORPORATED
          </div>
        </div>
      </div>
    </div>
  );
}
