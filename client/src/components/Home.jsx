import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MusicDesignModal from './MusicDesignModal';
import toast from 'react-hot-toast';

function Home() {
  const [username, setUsername] = useState(() => localStorage.getItem('username') || '');
  const [roomId, setRoomId] = useState('');
  const [showMusicModal, setShowMusicModal] = useState(false);
  const navigate = useNavigate();

  const createRoom = () => {
    if (!username.trim()) {
      toast.error('Please enter a display name first!');
      return;
    }
    const newRoomId = Math.random().toString(36).substring(2, 8);
    localStorage.setItem('username', username.trim());
    navigate(`/room/${newRoomId}`);
  };

  const joinRoom = () => {
    if (!username.trim()) {
      toast.error('Please enter a display name first!');
      return;
    }
    if (!roomId.trim()) {
      toast.error('Please enter a room code!');
      return;
    }
    localStorage.setItem('username', username.trim());
    navigate(`/room/${roomId.trim()}`);
  };

  return (
    <div className="home-container">
      <div className="card">
        <div className="home-badge">🎨 Collaborative Multiplayer Game</div>
        <h1 className="title">Draw & Guess!</h1>
        <p className="subtitle">Real-time Pictionary with rooms, instant canvas sync & sound effects</p>

        {/* Display Name Input with Avatar Preview */}
        <div className="input-group">
          <label className="input-field-label">👤 Choose Your Player Name:</label>
          <div className="player-input-wrapper">
            <span className="player-avatar-preview">
              {username.trim() ? username.trim().charAt(0).toUpperCase() : '🎨'}
            </span>
            <input
              type="text"
              placeholder="Enter Your Display Name (e.g. Alex)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input player-name-input"
              maxLength={20}
              autoFocus
            />
          </div>
          {username.trim() && (
            <div className="player-preview-pill">
              <span>Ready as: <strong>{username.trim()}</strong></span>
            </div>
          )}
        </div>
        
        <div className="actions">
          <button onClick={createRoom} className="btn primary-btn">
            ✨ Create Private Room
          </button>
          
          <div className="divider"><span>OR JOIN EXISTING</span></div>
          
          <div className="join-group">
            <input
              type="text"
              placeholder="Room Code (e.g. 8x2k1a)"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="input short-input"
            />
            <button onClick={joinRoom} className="btn secondary-btn">
              Join Room
            </button>
          </div>
        </div>

        <div className="home-footer-actions">
          <button 
            onClick={() => setShowMusicModal(true)} 
            className="doc-link-btn"
          >
            🎧 Collaborative Music Architecture & System Design
          </button>
        </div>
      </div>

      <MusicDesignModal isOpen={showMusicModal} onClose={() => setShowMusicModal(false)} />
    </div>
  );
}

export default Home;
