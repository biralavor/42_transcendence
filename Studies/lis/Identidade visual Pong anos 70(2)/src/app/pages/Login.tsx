import { Link } from 'react-router';
import { useState } from 'react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-16 px-8"
      style={{ background: 'linear-gradient(180deg, #5d4037 0%, #3e2723 100%)' }}
    >
      <div className="w-full max-w-md">
        {/* Card Container */}
        <div
          style={{
            background: '#f4d03f',
            border: '6px solid #3e2723',
            boxShadow: '12px 12px 0px #1a1410',
            padding: '3rem',
          }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 
              style={{ 
                fontFamily: 'Bungee, cursive',
                fontSize: '3rem',
                color: '#3e2723',
                marginBottom: '0.5rem',
                letterSpacing: '0.2rem',
              }}
            >
              LOGIN
            </h1>
            <p style={{ 
              fontFamily: 'VT323, monospace', 
              fontSize: '1.4rem', 
              color: '#3e2723',
            }}>
              Entre para continuar jogando
            </p>
          </div>

          {/* Form */}
          <form className="space-y-6">
            {/* Email */}
            <div>
              <label 
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.1rem',
                  color: '#3e2723',
                  letterSpacing: '0.1rem',
                  display: 'block',
                  marginBottom: '0.5rem',
                }}
              >
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                style={{
                  fontFamily: 'VT323, monospace',
                  fontSize: '1.3rem',
                  width: '100%',
                  padding: '0.8rem 1rem',
                  background: '#f0f0e8',
                  color: '#3e2723',
                  border: '3px solid #3e2723',
                  outline: 'none',
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label 
                style={{ 
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.1rem',
                  color: '#3e2723',
                  letterSpacing: '0.1rem',
                  display: 'block',
                  marginBottom: '0.5rem',
                }}
              >
                SENHA
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  fontFamily: 'VT323, monospace',
                  fontSize: '1.3rem',
                  width: '100%',
                  padding: '0.8rem 1rem',
                  background: '#f0f0e8',
                  color: '#3e2723',
                  border: '3px solid #3e2723',
                  outline: 'none',
                }}
              />
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="remember"
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer',
                }}
              />
              <label 
                htmlFor="remember"
                style={{ 
                  fontFamily: 'VT323, monospace',
                  fontSize: '1.2rem',
                  color: '#3e2723',
                  cursor: 'pointer',
                }}
              >
                Lembrar de mim
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              style={{
                fontFamily: 'Righteous, cursive',
                fontSize: '1.3rem',
                letterSpacing: '0.15rem',
                width: '100%',
                padding: '1rem',
                background: '#3e2723',
                color: '#f4d03f',
                border: '4px solid #3e2723',
                boxShadow: '6px 6px 0px #1a1410',
                cursor: 'pointer',
                transition: 'transform 0.1s',
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.currentTarget.style.transform = 'translate(3px, 3px)';
                e.currentTarget.style.boxShadow = '3px 3px 0px #1a1410';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translate(0, 0)';
                e.currentTarget.style.boxShadow = '6px 6px 0px #1a1410';
              }}
            >
              ENTRAR
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div style={{ flex: 1, height: '2px', background: '#3e2723' }} />
            <span style={{ fontFamily: 'VT323, monospace', fontSize: '1.2rem', color: '#3e2723' }}>
              OU
            </span>
            <div style={{ flex: 1, height: '2px', background: '#3e2723' }} />
          </div>

          {/* Register Link */}
          <div className="text-center">
            <p style={{ fontFamily: 'VT323, monospace', fontSize: '1.3rem', color: '#3e2723', marginBottom: '0.5rem' }}>
              Não tem uma conta?
            </p>
            <Link to="/register">
              <button
                style={{
                  fontFamily: 'Righteous, cursive',
                  fontSize: '1.2rem',
                  letterSpacing: '0.15rem',
                  width: '100%',
                  padding: '1rem',
                  background: 'transparent',
                  color: '#3e2723',
                  border: '3px solid #3e2723',
                  boxShadow: '6px 6px 0px #3e2723',
                  cursor: 'pointer',
                  transition: 'transform 0.1s',
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
                CRIAR CONTA
              </button>
            </Link>
          </div>

          {/* Forgot Password */}
          <div className="mt-4 text-center">
            <a 
              href="#"
              style={{ 
                fontFamily: 'VT323, monospace',
                fontSize: '1.2rem',
                color: '#5d4037',
                textDecoration: 'underline',
              }}
            >
              Esqueceu a senha?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
