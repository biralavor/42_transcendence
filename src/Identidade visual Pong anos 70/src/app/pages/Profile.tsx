import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router';
import { Camera } from 'lucide-react';

export function Profile() {
  const { user, isAuthenticated, isAnonymous, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || '');
  const [previewImage, setPreviewImage] = useState(user?.profileImage || '');

  // Se não estiver autenticado, redirecionar
  if (!isAuthenticated) {
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
            Você precisa estar logado para acessar as configurações!
          </p>
          <Link to="/login">
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
              FAZER LOGIN
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // Se for usuário anônimo, mostrar mensagem especial
  if (isAnonymous) {
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
            MODO ANÔNIMO
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
            Usuários anônimos não podem editar perfil. Crie uma conta para ter acesso completo!
          </p>
          <Link to="/register">
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
              CRIAR CONTA
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      username,
      email,
      profileImage: previewImage,
    });
    
    // Feedback visual
    alert('PERFIL ATUALIZADO COM SUCESSO!');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div 
      className="min-h-screen p-8"
      style={{ background: 'linear-gradient(180deg, #5d4037 0%, #3e2723 100%)' }}
    >
      <div className="max-w-4xl mx-auto">
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
            PERFIL
          </h1>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left Column - Profile Picture */}
            <div className="md:col-span-1">
              <div
                style={{
                  background: '#5d4037',
                  border: '4px solid #3e2723',
                  boxShadow: '6px 6px 0px #3e2723',
                  padding: '2rem',
                }}
              >
                <h3 
                  style={{ 
                    fontFamily: 'Righteous, cursive',
                    fontSize: '1.2rem',
                    color: '#f4d03f',
                    letterSpacing: '0.1rem',
                    marginBottom: '1.5rem',
                    textAlign: 'center',
                  }}
                >
                  FOTO DE PERFIL
                </h3>
                
                {/* Image Preview */}
                <div 
                  className="relative mx-auto mb-4"
                  style={{
                    width: '200px',
                    height: '200px',
                    border: '4px solid #3e2723',
                    background: '#3e2723',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {previewImage ? (
                    <img 
                      src={previewImage} 
                      alt="Profile" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover' 
                      }}
                    />
                  ) : (
                    <div 
                      style={{ 
                        fontFamily: 'VT323, monospace',
                        fontSize: '4rem',
                        color: '#f4d03f',
                      }}
                    >
                      👤
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <label
                  htmlFor="profile-upload"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    width: '100%',
                    background: '#f4d03f',
                    border: '4px solid #3e2723',
                    boxShadow: '4px 4px 0px #3e2723',
                    padding: '1rem',
                    fontFamily: 'Righteous, cursive',
                    fontSize: '1rem',
                    color: '#3e2723',
                    letterSpacing: '0.1rem',
                    cursor: 'pointer',
                  }}
                >
                  <Camera size={20} />
                  ALTERAR FOTO
                </label>
                <input
                  id="profile-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />

                {/* Stats */}
                <div 
                  className="mt-6 pt-6"
                  style={{ 
                    borderTop: '2px solid #3e2723',
                  }}
                >
                  <div className="mb-3">
                    <div 
                      style={{ 
                        fontFamily: 'Righteous, cursive',
                        fontSize: '0.9rem',
                        color: '#f4d03f',
                        letterSpacing: '0.1rem',
                        marginBottom: '0.25rem',
                      }}
                    >
                      PONTOS TOTAIS
                    </div>
                    <div 
                      style={{ 
                        fontFamily: 'VT323, monospace',
                        fontSize: '2rem',
                        color: '#f0f0e8',
                        lineHeight: '1',
                      }}
                    >
                      {user?.points.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - User Info */}
            <div className="md:col-span-2">
              <div
                style={{
                  background: '#5d4037',
                  border: '4px solid #3e2723',
                  boxShadow: '6px 6px 0px #3e2723',
                  padding: '2rem',
                }}
              >
                <h3 
                  style={{ 
                    fontFamily: 'Righteous, cursive',
                    fontSize: '1.2rem',
                    color: '#f4d03f',
                    letterSpacing: '0.1rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  INFORMAÇÕES DA CONTA
                </h3>

                {/* Username */}
                <div className="mb-6">
                  <label 
                    htmlFor="username"
                    style={{ 
                      display: 'block',
                      fontFamily: 'Righteous, cursive',
                      fontSize: '0.9rem',
                      color: '#f4d03f',
                      letterSpacing: '0.05rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    NOME DE USUÁRIO
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#3e2723',
                      border: '4px solid #3e2723',
                      padding: '1rem',
                      fontFamily: 'VT323, monospace',
                      fontSize: '1.3rem',
                      color: '#f0f0e8',
                    }}
                  />
                </div>

                {/* Email */}
                <div className="mb-6">
                  <label 
                    htmlFor="email"
                    style={{ 
                      display: 'block',
                      fontFamily: 'Righteous, cursive',
                      fontSize: '0.9rem',
                      color: '#f4d03f',
                      letterSpacing: '0.05rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    E-MAIL
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#3e2723',
                      border: '4px solid #3e2723',
                      padding: '1rem',
                      fontFamily: 'VT323, monospace',
                      fontSize: '1.3rem',
                      color: '#f0f0e8',
                    }}
                  />
                </div>

                {/* Save Button */}
                <button
                  type="submit"
                  style={{
                    width: '100%',
                    background: '#f4d03f',
                    border: '4px solid #3e2723',
                    boxShadow: '4px 4px 0px #3e2723',
                    padding: '1rem',
                    fontFamily: 'Righteous, cursive',
                    fontSize: '1.2rem',
                    color: '#3e2723',
                    letterSpacing: '0.1rem',
                    cursor: 'pointer',
                    marginBottom: '1rem',
                  }}
                >
                  SALVAR ALTERAÇÕES
                </button>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    background: '#c62828',
                    border: '4px solid #3e2723',
                    boxShadow: '4px 4px 0px #3e2723',
                    padding: '1rem',
                    fontFamily: 'Righteous, cursive',
                    fontSize: '1.2rem',
                    color: '#f0f0e8',
                    letterSpacing: '0.1rem',
                    cursor: 'pointer',
                  }}
                >
                  SAIR DA CONTA
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
