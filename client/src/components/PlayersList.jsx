import React from 'react';

function PlayersList({ players, currentDrawerIndex, currentUserId, hostId }) {
  // Sort players by score descending
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="players-list-container">
      <div className="players-list-header">
        <h3>👥 Players ({players.length})</h3>
      </div>
      <ul className="players-list">
        {sortedPlayers.map((player) => {
          const isDrawer = players[currentDrawerIndex]?.id === player.id;
          const isMe = currentUserId === player.id;
          const isHost = hostId === player.id;
          const initial = player.username ? player.username.charAt(0).toUpperCase() : '?';

          return (
            <li 
              key={player.id} 
              className={`player-item ${isMe ? 'is-me' : ''} ${player.disconnected ? 'disconnected' : ''} ${player.guessed ? 'guessed' : ''}`}
            >
              <div className="player-info">
                <span className="player-rank">#{sortedPlayers.findIndex(p => p.id === player.id) + 1}</span>
                <span className="player-avatar-circle">{initial}</span>
                <div className="player-name-wrapper">
                  <span className="player-name">
                    {player.username}
                  </span>
                  <div className="player-badges-row">
                    {isMe && <span className="player-badge you-badge">⭐ You</span>}
                    {isHost && <span className="player-badge host-badge">👑 Host</span>}
                    {isDrawer && <span className="player-badge drawer-badge">✏️ Drawing</span>}
                    {player.guessed && <span className="player-badge guessed-badge">✅ Guessed</span>}
                  </div>
                </div>
              </div>
              <span className="player-score">{player.score} pts</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default PlayersList;
