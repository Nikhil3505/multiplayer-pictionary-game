import { getRandomWords } from './words.js';

// Map of roomId -> roomData
const rooms = new Map();

// Map of socketId -> { roomId, userId }
const socketMap = new Map();

// Abuse protection rate limiters
const strokeRateLimits = new Map();
const chatRateLimits = new Map();

const STROKE_LIMIT = 50; // max 50 strokes per second
const CHAT_LIMIT = 5; // max 5 messages per 3 seconds


export function handleConnection(io, socket) {
  console.log('New connection:', socket.id);

  socket.on('join_room', ({ roomId, username }) => {
    // Leave previous rooms
    Array.from(socket.rooms).forEach(room => {
      if (room !== socket.id) socket.leave(room);
    });

    socket.join(roomId);
    socketMap.set(socket.id, { roomId, userId: socket.id });

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        host: socket.id,
        settings: {
          rounds: 3,
          drawTime: 80,
          customWords: []
        },
        players: [],
        status: 'waiting', // waiting, word_selection, drawing, round_end, game_over
        currentRound: 0,
        currentDrawerIndex: -1,
        currentWord: '',
        wordChoices: [],
        wordHints: '',
        timeRemaining: 0,
        timerInterval: null,
        correctGuessers: new Set(),
        canvasState: [],
        gameHistory: [], // To replay at the end
        messages: [] // Rate limiting could be done here, but let's just keep track of some chat
      });
    }

    const room = rooms.get(roomId);
    
    // Check if player is rejoining
    const existingPlayer = room.players.find(p => p.username === username && p.disconnected);
    if (existingPlayer) {
      existingPlayer.id = socket.id;
      existingPlayer.disconnected = false;
      clearTimeout(existingPlayer.disconnectTimer);
    } else {
      room.players.push({
        id: socket.id,
        username,
        score: 0,
        disconnected: false
      });
    }

    if (!room.players.find(p => p.id === room.host)) {
        room.host = room.players[0].id;
    }

    broadcastRoomState(io, roomId);
    
    if (room.status === 'drawing' || room.status === 'word_selection') {
      socket.emit('canvas_sync', room.canvasState);
    }
  });

  socket.on('update_settings', ({ roomId, settings }) => {
    const room = rooms.get(roomId);
    if (room && room.host === socket.id && room.status === 'waiting') {
      room.settings = { ...room.settings, ...settings };
      broadcastRoomState(io, roomId);
    }
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const isHost = room.host === socket.id;
    const canStart = (room.status === 'waiting' || room.status === 'game_over') && room.players.length >= 2;
    if (isHost && canStart) {
      room.status = 'word_selection';
      room.currentRound = 1;
      room.currentDrawerIndex = 0;
      room.players.forEach(p => p.score = 0);
      room.correctGuessers = new Set();
      room.canvasState = [];
      room.gameHistory = [];
      io.to(roomId).emit('clear_canvas');
      startTurn(io, room);
    }
  });

  socket.on('select_word', ({ roomId, word }) => {
    const room = rooms.get(roomId);
    const currentDrawer = room.players[room.currentDrawerIndex];
    
    if (room && room.status === 'word_selection' && currentDrawer && currentDrawer.id === socket.id) {
      if (room.wordChoices.includes(word)) {
        room.currentWord = word;
        room.status = 'drawing';
        room.timeRemaining = room.settings.drawTime;
        room.correctGuessers = new Set();
        room.canvasState = [];
        room.gameHistory.push({ round: room.currentRound, drawer: currentDrawer.username, word, strokes: [] });
        
        // Generate initial hints (e.g. _ _ _ _ _)
        room.wordHints = word.replace(/[a-zA-Z]/g, '_');
        
        broadcastRoomState(io, roomId);
        
        if (room.timerInterval) clearInterval(room.timerInterval);
        
        room.timerInterval = setInterval(() => {
          room.timeRemaining--;
          
          // Reveal hint logic (basic: reveal a character every (drawTime/3) seconds)
          if (room.timeRemaining === Math.floor(room.settings.drawTime * 0.66) || 
              room.timeRemaining === Math.floor(room.settings.drawTime * 0.33)) {
             revealHint(room);
          }

          if (room.timeRemaining <= 0) {
            endTurn(io, room);
          } else {
            io.to(roomId).emit('time_tick', { timeRemaining: room.timeRemaining, wordHints: room.wordHints });
          }
        }, 1000);
      }
    }
  });

  socket.on('draw_stroke', ({ roomId, stroke }) => {
    // Basic rate limit
    const now = Date.now();
    const limits = strokeRateLimits.get(socket.id) || { count: 0, lastReset: now };
    if (now - limits.lastReset > 1000) { limits.count = 0; limits.lastReset = now; }
    limits.count++;
    strokeRateLimits.set(socket.id, limits);
    if (limits.count > STROKE_LIMIT) return; // Drop stroke if spamming

    // Validate stroke payload (either fill action or coordinate stroke)
    if (!stroke) return;
    if (stroke.type === 'fill') {
      if (!stroke.color || typeof stroke.color !== 'string') return;
    } else {
      if (typeof stroke.x0 !== 'number' || typeof stroke.y0 !== 'number') return;
    }

    const room = rooms.get(roomId);
    const currentDrawer = room.players[room.currentDrawerIndex];
    if (room && room.status === 'drawing' && currentDrawer && currentDrawer.id === socket.id) {
        room.canvasState.push(stroke);
        if (room.gameHistory.length > 0) {
            room.gameHistory[room.gameHistory.length - 1].strokes.push({...stroke, time: room.settings.drawTime - room.timeRemaining});
        }
        // Broadcast to everyone else
        socket.to(roomId).emit('draw_stroke', stroke);
    }
  });
  
  socket.on('clear_canvas', ({ roomId }) => {
    const room = rooms.get(roomId);
    const currentDrawer = room.players[room.currentDrawerIndex];
    if (room && room.status === 'drawing' && currentDrawer && currentDrawer.id === socket.id) {
        room.canvasState = [];
        if (room.gameHistory.length > 0) {
            room.gameHistory[room.gameHistory.length - 1].strokes.push({type: 'clear', time: room.settings.drawTime - room.timeRemaining});
        }
        io.to(roomId).emit('clear_canvas');
    }
  });

  socket.on('undo_stroke', ({ roomId }) => {
      const room = rooms.get(roomId);
      const currentDrawer = room.players[room.currentDrawerIndex];
      if (room && room.status === 'drawing' && currentDrawer && currentDrawer.id === socket.id) {
          if (room.canvasState.length > 0) {
              const lastStroke = room.canvasState[room.canvasState.length - 1];
              const targetId = lastStroke.strokeId;
              if (targetId) {
                  room.canvasState = room.canvasState.filter(s => s.strokeId !== targetId);
              } else {
                  room.canvasState.pop();
              }
              if (room.gameHistory.length > 0) {
                  room.gameHistory[room.gameHistory.length - 1].strokes.push({type: 'undo', time: room.settings.drawTime - room.timeRemaining});
              }
              io.to(roomId).emit('canvas_sync', room.canvasState);
              io.to(roomId).emit('stroke_undone');
          }
      }
  });

  socket.on('send_message', ({ roomId, message }) => {
    if (!message || typeof message !== 'string' || message.length > 150) return; // length limit

    const now = Date.now();
    const limits = chatRateLimits.get(socket.id) || { count: 0, lastReset: now };
    if (now - limits.lastReset > 3000) { limits.count = 0; limits.lastReset = now; }
    limits.count++;
    chatRateLimits.set(socket.id, limits);
    if (limits.count > CHAT_LIMIT) {
        socket.emit('system_message', { text: "Sending messages too fast!", type: 'error' });
        return;
    }

    const room = rooms.get(roomId);
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const currentDrawer = room.players[room.currentDrawerIndex];

    if (room.status === 'drawing' && currentDrawer && currentDrawer.id !== socket.id && !room.correctGuessers.has(socket.id)) {
      const msgLower = message.trim().toLowerCase();
      const wordLower = room.currentWord.toLowerCase();
      
      if (msgLower === wordLower) {
        // Correct guess
        room.correctGuessers.add(socket.id);
        
        // Calculate points based on time remaining
        const points = Math.floor((room.timeRemaining / room.settings.drawTime) * 400) + 100;
        player.score += points;
        
        // Give drawer some points too
        if (currentDrawer) {
            currentDrawer.score += 50; 
        }

        io.to(roomId).emit('system_message', { text: `${player.username} guessed the word!`, type: 'success' });
        io.to(roomId).emit('guess_correct', { username: player.username });
        
        // Check if everyone guessed
        if (room.correctGuessers.size >= room.players.filter(p => !p.disconnected).length - 1) { // -1 for drawer
          endTurn(io, room);
        } else {
            broadcastRoomState(io, roomId);
        }
        return;
      } else {
          // Check for close guess (Levenshtein distance 1 or 2)
          if (isCloseGuess(msgLower, wordLower)) {
              socket.emit('system_message', { text: `'${message}' is close!`, type: 'warning' });
              return; // Don't broadcast close guess to others, or just let it through but notify them?
              // The requirements say "Players who guess right can't reveal the word in chat. Near-misses show "close!" to the person who guessed."
              // We'll still send the message to everyone, but send the "close" message to the user.
          }
      }
    }
    
    // If they already guessed correctly, don't let them say the word
    if (room.correctGuessers.has(socket.id) || (currentDrawer && currentDrawer.id === socket.id)) {
        if (message.toLowerCase().includes(room.currentWord.toLowerCase())) {
            socket.emit('system_message', {text: "You can't type the word!", type: 'error'});
            return;
        }
    }

    io.to(roomId).emit('chat_message', { username: player.username, text: message });
  });

  socket.on('disconnect', () => {
    const info = socketMap.get(socket.id);
    if (info) {
      const room = rooms.get(info.roomId);
      if (room) {
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          player.disconnected = true;
          
          // Reassign host if host left
          if (room.host === socket.id) {
              const nextHost = room.players.find(p => !p.disconnected);
              if (nextHost) {
                  room.host = nextHost.id;
              }
          }

          player.disconnectTimer = setTimeout(() => {
            // Remove completely after 30 seconds
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
              room.players.splice(playerIndex, 1);
            }
            if (room.players.every(p => p.disconnected)) {
                // Delete room if empty
                if (room.timerInterval) clearInterval(room.timerInterval);
                rooms.delete(room.id);
            } else {
                 broadcastRoomState(io, room.id);
            }
          }, 30000);

          // If it was their turn and they disconnected, end turn gracefully
          const currentDrawer = room.players[room.currentDrawerIndex];
          if (room.status === 'drawing' || room.status === 'word_selection') {
              if (currentDrawer && currentDrawer.id === socket.id) {
                  endTurn(io, room, true); // End turn, drawer left
              }
          }
          
          broadcastRoomState(io, room.id);
        }
      }
      socketMap.delete(socket.id);
    }
  });
}

function startTurn(io, room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  
  // Skip disconnected players
  while (room.players[room.currentDrawerIndex]?.disconnected) {
       room.currentDrawerIndex++;
       if (room.currentDrawerIndex >= room.players.length) {
           room.currentDrawerIndex = 0;
           room.currentRound++;
       }
  }

  if (room.currentRound > room.settings.rounds) {
    room.status = 'game_over';
    broadcastRoomState(io, room.id);
    return;
  }

  room.status = 'word_selection';
  
  // Combine custom words and default words
  let pool = room.settings.customWords && room.settings.customWords.length > 0 ? room.settings.customWords : undefined;
  room.wordChoices = getRandomWords(3, pool);
  room.currentWord = '';
  room.wordHints = '';
  room.canvasState = [];
  
  room.timeRemaining = 15; // 15 seconds to pick a word
  
  broadcastRoomState(io, room.id);

  room.timerInterval = setInterval(() => {
    room.timeRemaining--;
    if (room.timeRemaining <= 0) {
       clearInterval(room.timerInterval);
       const randomWord = room.wordChoices[Math.floor(Math.random() * room.wordChoices.length)];
       room.currentWord = randomWord;
       startDrawing(io, room);
    } else {
       io.to(room.id).emit('time_tick', { timeRemaining: room.timeRemaining, wordHints: '' });
    }
  }, 1000);
}

function startDrawing(io, room) {
     room.status = 'drawing';
     room.timeRemaining = room.settings.drawTime;
     room.correctGuessers = new Set();
     room.canvasState = [];
     room.wordHints = room.currentWord.replace(/[a-zA-Z]/g, '_');
     room.gameHistory.push({ round: room.currentRound, drawer: room.players[room.currentDrawerIndex].username, word: room.currentWord, strokes: [] });

     broadcastRoomState(io, room.id);
     
     if (room.timerInterval) clearInterval(room.timerInterval);
     room.timerInterval = setInterval(() => {
        room.timeRemaining--;
        // Hints
        if (room.timeRemaining === Math.floor(room.settings.drawTime * 0.66) || 
            room.timeRemaining === Math.floor(room.settings.drawTime * 0.33)) {
            revealHint(room);
        }
        if (room.timeRemaining <= 0) {
            endTurn(io, room);
        } else {
            io.to(room.id).emit('time_tick', { timeRemaining: room.timeRemaining, wordHints: room.wordHints });
        }
    }, 1000);
}

function revealHint(room) {
    const wordArray = room.currentWord.split('');
    const hintArray = room.wordHints.split('');
    const unrevealed = [];
    for (let i = 0; i < wordArray.length; i++) {
        if (wordArray[i] !== ' ' && hintArray[i] === '_') {
            unrevealed.push(i);
        }
    }
    if (unrevealed.length > 0) {
        const randomIndex = unrevealed[Math.floor(Math.random() * unrevealed.length)];
        hintArray[randomIndex] = wordArray[randomIndex];
        room.wordHints = hintArray.join('');
    }
}

function endTurn(io, room, drawerLeft = false) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  
  room.status = 'round_end';
  io.to(room.id).emit('round_ended', { word: room.currentWord, drawerLeft });
  
  room.timeRemaining = 5;
  broadcastRoomState(io, room.id);
  
  room.timerInterval = setInterval(() => {
    room.timeRemaining--;
    if (room.timeRemaining <= 0) {
       clearInterval(room.timerInterval);
       
       room.currentDrawerIndex++;
       if (room.currentDrawerIndex >= room.players.length) {
         room.currentDrawerIndex = 0;
         room.currentRound++;
       }
       startTurn(io, room);
    } else {
         io.to(room.id).emit('time_tick', { timeRemaining: room.timeRemaining, wordHints: room.currentWord }); // Show full word
    }
  }, 1000);
}

function broadcastRoomState(io, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  // Create safe state (hide word, limit history size)
  const safeState = {
    id: room.id,
    host: room.host,
    settings: room.settings,
    players: room.players.map(p => ({
        id: p.id,
        username: p.username,
        score: p.score,
        disconnected: p.disconnected,
        guessed: room.correctGuessers.has(p.id)
    })),
    status: room.status,
    currentRound: room.currentRound,
    currentDrawerIndex: room.currentDrawerIndex,
    timeRemaining: room.timeRemaining,
    wordHints: room.wordHints,
    gameHistory: room.status === 'game_over' ? room.gameHistory : null // Only send full history at end
  };

  // Send to all players
  room.players.forEach(p => {
    const playerSocket = io.sockets.sockets.get(p.id);
    if (playerSocket) {
        // If this player is drawing and selecting word, send choices
        const isDrawing = room.currentDrawerIndex !== -1 && room.players[room.currentDrawerIndex].id === p.id;
        
        let personalState = { ...safeState };
        if (isDrawing && room.status === 'word_selection') {
            personalState.wordChoices = room.wordChoices;
        }
        if ((isDrawing || room.correctGuessers.has(p.id)) && room.status === 'drawing') {
            personalState.currentWord = room.currentWord;
        }
        
        playerSocket.emit('room_state', personalState);
    }
  });
}

// Basic Levenshtein distance
function isCloseGuess(guess, word) {
    if (Math.abs(guess.length - word.length) > 2) return false;
    if (guess.length <= 3 && guess !== word) return false; 
    
    let a = guess.toLowerCase();
    let b = word.toLowerCase();
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length] <= 2;
}
