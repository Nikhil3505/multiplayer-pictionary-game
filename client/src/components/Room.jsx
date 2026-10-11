import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Canvas from './Canvas';
import Chat from './Chat';
import PlayersList from './PlayersList';
import MusicDesignModal from './MusicDesignModal';
import ReplayViewer from './ReplayViewer';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { soundManager } from '../utils/soundManager';

const SOCKET_URL = 'http://localhost:3001';

function Room() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [username, setUsername] = useState('');
  const [isMuted, setIsMuted] = useState(soundManager.isMuted());
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [showReplayModal, setShowReplayModal] = useState(false);
  const [customWordsInput, setCustomWordsInput] = useState('');
  const [mobileTab, setMobileTab] = useState('chat'); // 'chat' or 'players'
  
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (!storedUsername) {
      navigate('/');
      return;
    }
    setUsername(storedUsername);

    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join_room', { roomId: id, username: storedUsername });
    });

    newSocket.on('room_state', (state) => {
      setRoomState(state);
    });

    newSocket.on('time_tick', ({ timeRemaining, wordHints }) => {
      setRoomState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          timeRemaining,
          wordHints: wordHints !== undefined && wordHints !== '' ? wordHints : prev.wordHints
        };
      });
    });

    newSocket.on('guess_correct', (data) => {
      soundManager.playCorrectGuess();
      toast.success(`${data.username} guessed the word! 🎉`, { icon: '🎯', duration: 3000 });
    });

    return () => {
      newSocket.off('connect');
      newSocket.off('room_state');
      newSocket.off('time_tick');
      newSocket.off('guess_correct');
      newSocket.disconnect();
    };
  }, [id, navigate]);

  const prevStatusRef = useRef(roomState?.status);
  const prevTimeRef = useRef(roomState?.timeRemaining);

  // Audio Effects on Timer Ticking
  useEffect(() => {
    if (!roomState) return;
    
    // Only tick when timeRemaining decreases
    if (prevTimeRef.current !== roomState.timeRemaining) {
      prevTimeRef.current = roomState.timeRemaining;

      if (roomState.status === 'drawing' || roomState.status === 'word_selection') {
        if (roomState.timeRemaining <= 5 && roomState.timeRemaining > 0) {
          if (roomState.timeRemaining <= 3) {
            soundManager.playUrgentTick();
          } else {
            soundManager.playTick();
          }
        } else if (roomState.timeRemaining === 0) {
          soundManager.playTimesUp();
        }
      }
    }
  }, [roomState?.timeRemaining, roomState?.status]);

  // Round / Game Over Transitions & Confetti
  useEffect(() => {
    if (roomState?.status && roomState.status !== prevStatusRef.current) {
      if (roomState.status === 'game_over') {
        soundManager.playFanfare();
        confetti({
          particleCount: 250,
          spread: 100,
          origin: { y: 0.6 }
        });
        toast.success('Game Over! Final scores are in! 🏆', { duration: 5000 });
      } else if (roomState.status === 'word_selection') {
        toast('New round starting! Drawer is choosing a word...', { icon: '🎨' });
      } else if (roomState.status === 'drawing') {
        toast('Drawing has begun! Make your guesses!', { icon: '✏️' });
      }
      prevStatusRef.current = roomState.status;
    }
  }, [roomState?.status]);

  const toggleSound = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
    toast(muted ? 'Sound Muted 🔇' : 'Sound Enabled 🔊', { duration: 1500 });
  };

  if (!socket || !roomState) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Connecting to room {id}...</p>
      </div>
    );
  }

  const isHost = roomState.host === socket.id;
  const isDrawing = roomState.currentDrawerIndex !== -1 && roomState.players[roomState.currentDrawerIndex]?.id === socket.id;

  const startGame = () => {
    socket.emit('start_game', { roomId: id });
  };

  const handleCustomWordsChange = (e) => {
    const val = e.target.value;
    setCustomWordsInput(val);
    const parsed = val.split(',').map(w => w.trim()).filter(Boolean);
    socket.emit('update_settings', { roomId: id, settings: { customWords: parsed } });
  };

  // Sort players by score for podium
  const sortedPlayers = [...roomState.players].sort((a, b) => b.score - a.score);

  return (
    <div className="room-container">
      {/* Top Header Bar */}
      <header className="top-bar">
        <div className="room-info">
          <h2>
            Room Code: 
            <span 
              className="highlight-code" 
              onClick={() => {
                navigator.clipboard.writeText(id);
                toast.success('Room code copied to clipboard!');
              }} 
              title="Click to copy room code"
            >
              {id} 📋
            </span>
          </h2>
          <span className="round-badge">
            Round {roomState.currentRound} / {roomState.settings.rounds}
          </span>
          <div className="player-identity-pill" title="Your player profile in this room">
            <span className="identity-dot"></span>
            <span>You: <strong>{username}</strong> {isHost ? '👑' : ''}</span>
          </div>
        </div>

        <div className="game-status">
          {roomState.status === 'waiting' && isHost && (
            <div className="host-settings">
              <div className="settings-fields">
                <label className="setting-label">
                  <span>Rounds:</span>
                  <input 
                    type="number" 
                    min="1" 
                    max="10" 
                    value={roomState.settings.rounds} 
                    onChange={(e) => socket.emit('update_settings', { roomId: id, settings: { rounds: parseInt(e.target.value) || 1 } })} 
                    className="settings-input number-input" 
                  />
                </label>
                <label className="setting-label">
                  <span>Draw Time (s):</span>
                  <input 
                    type="number" 
                    min="30" 
                    max="180" 
                    value={roomState.settings.drawTime} 
                    onChange={(e) => socket.emit('update_settings', { roomId: id, settings: { drawTime: parseInt(e.target.value) || 30 } })} 
                    className="settings-input number-input" 
                  />
                </label>
                <label className="setting-label custom-words-label">
                  <span>Custom Words:</span>
                  <input 
                    type="text" 
                    placeholder="e.g. guitar, robot, pizza (comma separated)" 
                    value={customWordsInput} 
                    onChange={handleCustomWordsChange}
                    className="settings-input custom-words-input" 
                  />
                </label>
              </div>
              <button 
                onClick={startGame} 
                className="btn primary-btn start-btn" 
                disabled={roomState.players.length < 2}
              >
                {roomState.players.length < 2 ? 'Need 2+ Players to Start' : 'Start Game'}
              </button>
            </div>
          )}

          {roomState.status === 'waiting' && !isHost && (
            <div className="waiting-host-pill">
              ⏳ Waiting for host to start ({roomState.players.length} player{roomState.players.length !== 1 ? 's' : ''} in room)
            </div>
          )}

          {roomState.status !== 'waiting' && (
            <div className="timer-info">
              <span className={`time-badge ${roomState.timeRemaining <= 5 ? 'urgent' : ''}`}>
                ⏱️ {roomState.timeRemaining}s
              </span>
              <span className="word-hint">
                {roomState.wordHints || (isDrawing ? roomState.currentWord : '')}
              </span>
            </div>
          )}

          {/* Audio toggle & Music Architecture modal button */}
          <div className="header-controls">
            <button 
              onClick={toggleSound} 
              className={`control-btn sound-btn ${isMuted ? 'muted' : ''}`}
              title="Toggle sound effects"
            >
              {isMuted ? '🔇 Sound OFF' : '🔊 Sound ON'}
            </button>
            <button 
              onClick={() => setShowMusicModal(true)} 
              className="control-btn music-btn"
              title="View Question 2 System Design Document"
            >
              🎧 Music Logic Doc
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Playing Area */}
      <main className="main-content">
        {/* Left Sidebar: Players */}
        <aside className={`sidebar left-sidebar ${mobileTab === 'players' ? 'mobile-visible' : 'mobile-hidden'}`}>
          <PlayersList 
            players={roomState.players} 
            currentDrawerIndex={roomState.currentDrawerIndex} 
            currentUserId={socket.id}
            hostId={roomState.host}
          />
        </aside>
        
        {/* Center: Canvas Area */}
        <section className="canvas-area">
          {/* Game Over Modal with Olympic Winner Podium & Actions */}
          {roomState.status === 'game_over' ? (
            <div className="overlay-backdrop">
              <div className="overlay-card game-over-card">
                <h2 className="game-over-title">🏆 Game Over! 🏆</h2>
                <p className="game-over-subtitle">Final Standings & Scores</p>

                <div className="podium-container">
                  {/* Rank 2 (Left) */}
                  {sortedPlayers[1] && (
                    <div className="podium-card rank-2">
                      <span className="medal">🥈</span>
                      <span className="podium-name" title={sortedPlayers[1].username}>{sortedPlayers[1].username}</span>
                      <span className="podium-score">{sortedPlayers[1].score} pts</span>
                    </div>
                  )}

                  {/* Rank 1 (Center - Elevated) */}
                  {sortedPlayers[0] && (
                    <div className="podium-card rank-1">
                      <span className="medal">🥇</span>
                      <span className="podium-name" title={sortedPlayers[0].username}>{sortedPlayers[0].username}</span>
                      <span className="podium-score">{sortedPlayers[0].score} pts</span>
                    </div>
                  )}

                  {/* Rank 3 (Right) */}
                  {sortedPlayers[2] && (
                    <div className="podium-card rank-3">
                      <span className="medal">🥉</span>
                      <span className="podium-name" title={sortedPlayers[2].username}>{sortedPlayers[2].username}</span>
                      <span className="podium-score">{sortedPlayers[2].score} pts</span>
                    </div>
                  )}
                </div>

                <div className="game-over-actions">
                  {roomState.gameHistory && roomState.gameHistory.length > 0 && (
                    <button 
                      onClick={() => setShowReplayModal(true)} 
                      className="btn secondary-btn replay-action-btn"
                    >
                      🎬 Watch Drawing Replay
                    </button>
                  )}

                  {isHost ? (
                    <button 
                      onClick={startGame} 
                      className="btn primary-btn play-again-btn"
                      disabled={roomState.players.length < 2}
                    >
                      🎮 Play Again
                    </button>
                  ) : (
                    <div className="guest-waiting-box">
                      <span>Waiting for host ({roomState.players.find(p => p.id === roomState.host)?.username || 'Host'}) to restart...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : roomState.status === 'word_selection' ? (
            <div className="overlay-backdrop">
              <div className="overlay-card word-select-card">
                {isDrawing ? (
                  <>
                    <h3>🎨 Choose a word to draw!</h3>
                    <p className="word-select-subtitle">Select one of the 3 choices below to start your turn:</p>
                    <div className="word-choices">
                      {roomState.wordChoices?.map(word => (
                        <button 
                          key={word} 
                          onClick={() => socket.emit('select_word', { roomId: id, word })} 
                          className="word-btn"
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <h3>⏳ Choosing a word...</h3>
                    <p className="word-select-subtitle">
                      <strong>{roomState.players[roomState.currentDrawerIndex]?.username}</strong> is selecting a word. Get ready to guess!
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : roomState.status === 'round_end' ? (
            <div className="overlay-backdrop">
              <div className="overlay-card round-end-card">
                <h3>🔔 Round Ended!</h3>
                <p>The secret word was: <strong className="revealed-word">{roomState.currentWord || 'revealed soon'}</strong></p>
                <span className="round-next-hint">Next turn begins in {roomState.timeRemaining}s...</span>
              </div>
            </div>
          ) : null}
          
          <Canvas socket={socket} roomId={id} isDrawing={isDrawing && roomState.status === 'drawing'} />
        </section>
        
        {/* Right Sidebar: Chat */}
        <aside className={`sidebar right-sidebar ${mobileTab === 'chat' ? 'mobile-visible' : 'mobile-hidden'}`}>
          <Chat socket={socket} roomId={id} />
        </aside>
      </main>

      {/* Mobile Tab Switcher (Visible on screens < 960px) */}
      <nav className="mobile-tab-bar" aria-label="Mobile View Switcher">
        <button 
          className={`mobile-tab-btn ${mobileTab === 'chat' ? 'active' : ''}`}
          onClick={() => setMobileTab('chat')}
        >
          💬 Chat & Guesses
        </button>
        <button 
          className={`mobile-tab-btn ${mobileTab === 'players' ? 'active' : ''}`}
          onClick={() => setMobileTab('players')}
        >
          👥 Scores ({roomState.players.length})
        </button>
      </nav>

      {/* Music Streaming Architecture & Logic Modal */}
      <MusicDesignModal isOpen={showMusicModal} onClose={() => setShowMusicModal(false)} />

      {/* Stroke-by-Stroke Drawing Replay Modal */}
      {showReplayModal && (
        <ReplayViewer 
          gameHistory={roomState.gameHistory} 
          onClose={() => setShowReplayModal(false)} 
        />
      )}
    </div>
  );
}

export default Room;
