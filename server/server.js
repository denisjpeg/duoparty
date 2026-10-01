const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// CORS ayarları
app.use(cors());

// Statik frontend dosyalarını servis et
app.use(express.static(path.join(__dirname, '../client')));

// Socket.io sunucusu
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Aktif odalar ve durumlar
// roomId -> { users: [], currentPlatform: 'youtube', videoState: {...}, screenShareHost: null }
const rooms = new Map();

function getOrCreateRoom(roomId) {
  const cleanId = (roomId || 'deniz-nehir').toLowerCase().trim();
  if (!rooms.has(cleanId)) {
    rooms.set(cleanId, {
      id: cleanId,
      users: [],
      currentPlatform: 'youtube', // 'youtube' veya 'netflix'
      videoState: {
        videoId: 'dQw4w9WgXcQ', // Varsayılan başlangıç videosu
        status: 'PAUSED',
        currentTime: 0,
        updatedAt: Date.now(),
        sender: 'Sistem'
      },
      screenShareHost: null
    });
  }
  return rooms.get(cleanId);
}

io.on('connection', (socket) => {
  let currentRoomId = null;
  let currentUserName = null;

  console.log(`[Socket] Yeni bağlantı: ${socket.id}`);

  // 1. Odaya Katılma
  socket.on('join-room', ({ roomId, userName }) => {
    currentRoomId = (roomId || 'deniz-nehir').toLowerCase().trim();
    currentUserName = (userName || 'Misafir').trim();

    socket.join(currentRoomId);
    const room = getOrCreateRoom(currentRoomId);

    // Kullanıcıyı odaya ekle veya güncelle
    const existingUserIndex = room.users.findIndex(u => u.id === socket.id);
    const userInfo = {
      id: socket.id,
      name: currentUserName,
      joinedAt: Date.now(),
      isMuted: false,
      isSpeaking: false
    };

    if (existingUserIndex >= 0) {
      room.users[existingUserIndex] = userInfo;
    } else {
      room.users.push(userInfo);
    }

    console.log(`[Oda: ${currentRoomId}] ${currentUserName} odaya katıldı. Toplam: ${room.users.length}`);

    // Yeni kullanıcıya mevcut oda durumunu gönder
    socket.emit('room-state', {
      roomId: currentRoomId,
      currentPlatform: room.currentPlatform,
      videoState: room.videoState,
      users: room.users,
      screenShareHost: room.screenShareHost,
      yourId: socket.id
    });

    // Odadaki diğer kişiye yeni kullanıcının katıldığını bildir
    socket.to(currentRoomId).emit('user-joined', {
      user: userInfo,
      users: room.users
    });
  });

  // 2. Platform Değiştirme (YouTube vs Netflix)
  socket.on('select-platform', ({ platform }) => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);
    room.currentPlatform = platform; // 'youtube' | 'netflix'

    console.log(`[Oda: ${currentRoomId}] Platform seçildi: ${platform} (${currentUserName})`);

    io.to(currentRoomId).emit('platform-changed', {
      platform,
      sender: currentUserName
    });
  });

  // 3. Video Oynatma / Durdurma / Sarma Senkronizasyonu
  socket.on('video-action', (data) => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);

    const { action, time, videoId } = data;
    room.videoState = {
      videoId: videoId !== undefined ? videoId : room.videoState.videoId,
      status: action === 'PLAY' ? 'PLAYING' : action === 'PAUSE' ? 'PAUSED' : room.videoState.status,
      currentTime: time !== undefined ? time : room.videoState.currentTime,
      updatedAt: Date.now(),
      sender: currentUserName
    };

    // Diğer kullanıcıya anında ilet
    socket.to(currentRoomId).emit('video-action', {
      action,
      time: room.videoState.currentTime,
      videoId: room.videoState.videoId,
      sender: currentUserName
    });
  });

  // 4. Anlık Senkron İsteği
  socket.on('request-sync', () => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);
    socket.emit('sync-state', {
      videoState: room.videoState,
      platform: room.currentPlatform
    });
  });

  // 5. WebRTC Sesli Sohbet Sinyalleşmesi
  socket.on('voice-signal', ({ targetId, signal }) => {
    if (targetId) {
      io.to(targetId).emit('voice-signal', {
        senderId: socket.id,
        signal
      });
    } else if (currentRoomId) {
      socket.to(currentRoomId).emit('voice-signal', {
        senderId: socket.id,
        signal
      });
    }
  });

  // 6. WebRTC Ses Durumu (Konuşuyor / Sessizde)
  socket.on('voice-status', ({ isMuted, isSpeaking }) => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);
    const user = room.users.find(u => u.id === socket.id);
    if (user) {
      user.isMuted = isMuted;
      user.isSpeaking = isSpeaking;
    }

    socket.to(currentRoomId).emit('voice-status', {
      userId: socket.id,
      userName: currentUserName,
      isMuted,
      isSpeaking
    });
  });

  // 7. WebRTC Netflix Ekran / Sekme Paylaşımı Sinyalleşmesi
  socket.on('screen-signal', ({ targetId, signal }) => {
    if (targetId) {
      io.to(targetId).emit('screen-signal', {
        senderId: socket.id,
        signal
      });
    } else if (currentRoomId) {
      socket.to(currentRoomId).emit('screen-signal', {
        senderId: socket.id,
        signal
      });
    }
  });

  socket.on('screen-share-status', ({ isSharing }) => {
    if (!currentRoomId) return;
    const room = getOrCreateRoom(currentRoomId);
    room.screenShareHost = isSharing ? socket.id : null;

    io.to(currentRoomId).emit('screen-share-status', {
      isSharing,
      hostId: room.screenShareHost,
      hostName: currentUserName
    });
  });

  // 8. Bağlantı Kopması
  socket.on('disconnect', () => {
    console.log(`[Socket] Ayrıldı: ${socket.id} (${currentUserName})`);
    if (currentRoomId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId);
      room.users = room.users.filter(u => u.id !== socket.id);

      if (room.screenShareHost === socket.id) {
        room.screenShareHost = null;
        io.to(currentRoomId).emit('screen-share-status', {
          isSharing: false,
          hostId: null,
          hostName: currentUserName
        });
      }

      socket.to(currentRoomId).emit('user-left', {
        userId: socket.id,
        userName: currentUserName,
        users: room.users
      });

      if (room.users.length === 0) {
        // Oda boşsa 30 dakika sonra temizleme zamanlayıcısı kurulabilir
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🎬 DuoParty Sunucusu Aktif!`);
  console.log(`🌐 Web Adresi: http://localhost:${PORT}`);
  console.log(`💑 Özel Oda: deniz-nehir`);
  console.log(`===============================================`);
});
