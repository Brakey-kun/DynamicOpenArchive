'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isLogin) {
        if (!username || !password) {
          throw new Error('Please enter both username and password');
        }
        
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Login failed');
        }
        
        localStorage.setItem('userSession', JSON.stringify({
          token: data.token,
          username: data.user.username,
          isAdmin: data.user.isAdmin
        }));
        // Persist admin flag locally for UI and route guards
        if (data.user.isAdmin) {
          try { localStorage.setItem('adminAuthenticated', 'true'); } catch {}
        }
        
        onClose();
        window.location.reload();
      } else {
        if (!username || !password || !email) {
          throw new Error('Please fill in all fields');
        }
        
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, email, password }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Registration failed');
        }
        
        localStorage.setItem('userSession', JSON.stringify({
          token: data.token,
          username: data.user.username,
          isAdmin: data.user.isAdmin
        }));
        
        onClose();
        window.location.reload();
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-button" onClick={onClose}>×</button>
        
        <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>
        
        <div className="toggle-form">
          <button onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        
        .modal-content {
          background-color: #1e1e1e;
          padding: 30px;
          border-radius: 8px;
          width: 90%;
          max-width: 400px;
          position: relative;
          color: white;
        }
        
        .close-button {
          position: absolute;
          top: -40px;
          right: 0;
          background: none;
          border: none;
          font-size: 32px;  
          cursor: pointer;
          color: rgba(255, 255, 255, 0.7);
          padding: 0;
          line-height: 1;
          text-shadow: 0 0 3px rgba(0, 0, 0, 0.5);
        }
        
        .close-button:hover {
          color: white;
        }
        
        h2 {
          margin-top: 0;
          margin-bottom: 20px;
          text-align: center;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
        }
        
        input {
          width: 100%;
          padding: 10px;
          border: 1px solid #444;
          border-radius: 4px;
          background-color: #333;
          color: white;
        }
        
        button {
          width: 100%;
          padding: 10px;
          background-color: #4a90e2;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
        }
        
        button:hover {
          background-color: #357ab8;
        }
        
        button:disabled {
          background-color: #555;
          cursor: not-allowed;
        }
        
        .error-message {
          color: #ff6b6b;
          margin-bottom: 15px;
          text-align: center;
        }
        
        .toggle-form {
          margin-top: 20px;
          text-align: center;
        }
        
        .toggle-form button {
          background: none;
          border: none;
          color: #4a90e2;
          cursor: pointer;
          padding: 0;
        }
        
        .toggle-form button:hover {
          text-decoration: underline;
          background: none;
        }
      `}</style>
    </div>
  );
}