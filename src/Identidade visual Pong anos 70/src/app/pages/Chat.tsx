import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router';

interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: Date;
}

const mockMessages: Message[] = [
  { id: '1', user: 'PLAYER_42', text: 'Alguém quer jogar?', timestamp: new Date(Date.now() - 1000 * 60 * 5) },
  { id: '2', user: 'ARCADE_KING', text: 'Eu! Acabei de passar de level 10', timestamp: new Date(Date.now() - 1000 * 60 * 3) },
  { id: '3', user: 'PONG_MASTER', text: 'Tô online agora, bora!', timestamp: new Date(Date.now() - 1000 * 60 * 1) },
];

export function Chat() {
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
              ? 'Usuários anônimos não podem acessar o chat. Crie uma conta para conversar com outros jogadores!'
              : 'Você precisa estar logado para acessar o chat!'
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
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      const message: Message = {
        id: Date.now().toString(),
        user: 'YOU',
        text: newMessage,
        timestamp: new Date(),
      };
      setMessages([...messages, message]);
      setNewMessage('');
    }
  };

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div 
      className="min-h-screen p-8"
      style={{ background: 'linear-gradient(180deg, #5d4037 0%, #3e2723 100%)' }}
    >
      <div className="max-w-6xl mx-auto">
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
          <h1 
            style={{ 
              fontFamily: 'Bungee, cursive',
              fontSize: '3rem',
              color: '#3e2723',
              letterSpacing: '0.3rem',
              textAlign: 'center',
            }}
          >
            ARCADE CHAT
          </h1>
        </div>

        {/* Chat Container */}
        <div
          style={{
            background: '#3e2723',
            border: '6px solid #3e2723',
            boxShadow: '8px 8px 0px #1a1410',
          }}
        >
          {/* Chat Screen (CRT Style) */}
          <div
            style={{
              background: '#1a1410',
              border: '4px solid #0a0a0a',
              minHeight: '500px',
              maxHeight: '500px',
              overflowY: 'auto',
              padding: '1.5rem',
              position: 'relative',
            }}
          >
            {/* Scanlines Effect */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'repeating-linear-gradient(0deg, rgba(240, 240, 232, 0.03) 0px, rgba(240, 240, 232, 0.03) 2px, transparent 2px, transparent 4px)',
              }}
            />

            {/* Messages */}
            <div className="space-y-4 relative z-10">
              {messages.map((msg) => (
                <div key={msg.id}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span 
                      style={{ 
                        fontFamily: 'Righteous, cursive',
                        fontSize: '1rem',
                        color: msg.user === 'YOU' ? '#f4d03f' : '#8d8d8d',
                        letterSpacing: '0.1rem',
                      }}
                    >
                      {msg.user}
                    </span>
                    <span 
                      style={{ 
                        fontFamily: 'VT323, monospace',
                        fontSize: '0.9rem',
                        color: '#8d8d8d',
                      }}
                    >
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <div 
                    style={{ 
                      fontFamily: 'VT323, monospace',
                      fontSize: '1.3rem',
                      color: '#f0f0e8',
                      textShadow: '0 0 8px rgba(240, 240, 232, 0.5)',
                      paddingLeft: '0.5rem',
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage}>
            <div
              style={{
                background: '#5d4037',
                padding: '1.5rem',
                borderTop: '4px solid #3e2723',
              }}
            >
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="DIGITE SUA MENSAGEM..."
                  style={{
                    flex: 1,
                    background: '#1a1410',
                    border: '4px solid #3e2723',
                    padding: '0.75rem 1rem',
                    fontFamily: 'VT323, monospace',
                    fontSize: '1.3rem',
                    color: '#f0f0e8',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.target.style.border = '4px solid #f4d03f';
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '4px solid #3e2723';
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: '#f4d03f',
                    border: '4px solid #3e2723',
                    boxShadow: '4px 4px 0px #3e2723',
                    padding: '0.75rem 2rem',
                    fontFamily: 'Righteous, cursive',
                    fontSize: '1.1rem',
                    color: '#3e2723',
                    letterSpacing: '0.1rem',
                    cursor: 'pointer',
                    transition: 'transform 0.1s',
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'translate(4px, 4px)';
                    e.currentTarget.style.boxShadow = '0px 0px 0px #3e2723';
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
                  ENVIAR
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Online Users */}
        <div
          className="mt-6"
          style={{
            background: '#5d4037',
            border: '4px solid #3e2723',
            boxShadow: '6px 6px 0px #3e2723',
            padding: '1.5rem',
          }}
        >
          <h2 
            style={{ 
              fontFamily: 'Righteous, cursive',
              fontSize: '1.3rem',
              color: '#f4d03f',
              letterSpacing: '0.1rem',
              marginBottom: '1rem',
            }}
          >
            JOGADORES ONLINE: 237
          </h2>
          <div className="flex flex-wrap gap-3">
            {['ARCADE_KING', 'PONG_MASTER', 'PLAYER_42', 'RETRO_PRO', 'PIXEL_HERO', 'GAME_WIZARD'].map((player) => (
              <div
                key={player}
                style={{
                  background: '#3e2723',
                  border: '2px solid #f4d03f',
                  padding: '0.5rem 1rem',
                }}
              >
                <span 
                  style={{ 
                    fontFamily: 'VT323, monospace',
                    fontSize: '1.2rem',
                    color: '#f0f0e8',
                  }}
                >
                  {player}
                </span>
                <span 
                  style={{ 
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    background: '#4caf50',
                    borderRadius: '50%',
                    marginLeft: '0.5rem',
                    boxShadow: '0 0 8px #4caf50',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
