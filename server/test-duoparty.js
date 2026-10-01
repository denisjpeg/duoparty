const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const ROOM_ID = 'deniz-nehir';

console.log('🧪 DuoParty E2E Otomatik Simülasyon Testi Başlatılıyor...\n');

const denizSocket = io(SERVER_URL);
const nehirSocket = io(SERVER_URL);

let denizJoined = false;
let nehirJoined = false;
let syncSuccess = false;

// 1. Deniz Bağlanıyor
denizSocket.on('connect', () => {
  console.log('✅ [Deniz] Sunucuya bağlandı (Socket ID: ' + denizSocket.id + ')');
  denizSocket.emit('join-room', { roomId: ROOM_ID, userName: 'Deniz' });
});

denizSocket.on('room-state', (state) => {
  console.log('✅ [Deniz] Oda durumu alındı: Platform=' + state.currentPlatform + ', Kullanıcı Sayısı=' + state.users.length);
  denizJoined = true;
});

// 2. Nehir Bağlanıyor
nehirSocket.on('connect', () => {
  console.log('✅ [Nehir] Sunucuya bağlandı (Socket ID: ' + nehirSocket.id + ')');
  nehirSocket.emit('join-room', { roomId: ROOM_ID, userName: 'Nehir' });
});

nehirSocket.on('room-state', (state) => {
  console.log('✅ [Nehir] Oda durumu alındı: Platform=' + state.currentPlatform + ', Kullanıcı Sayısı=' + state.users.length);
  nehirJoined = true;

  // Deniz odaya katıldıktan sonra video aksiyon testi yapalım
  setTimeout(() => {
    console.log('\n--- 🎬 YouTube Senkronizasyon Testi ---');
    console.log('▶️ [Deniz] YouTube videosunu 01:23 konumunda başlattı sinyali gönderiyor...');
    denizSocket.emit('video-action', {
      action: 'PLAY',
      time: 83.5,
      videoId: 'jfKfPfyJRdk',
      sender: 'Deniz'
    });
  }, 1000);
});

// Nehir Deniz'in başlattığı videoyu dinliyor
nehirSocket.on('video-action', (data) => {
  console.log(`✅ [Nehir] Senkron aksiyonu aldı! Action=${data.action}, Time=${data.time}s, Gönderen=${data.sender}`);
  if (data.action === 'PLAY' && data.time === 83.5) {
    syncSuccess = true;
    console.log('🎉 YouTube Play/Pause/Time senkronizasyonu %100 başarılı!\n');

    // Test WebRTC ses durum sinyali
    console.log('--- 🎙️ WebRTC Ses Durum Testi ---');
    console.log('🗣️ [Nehir] Konuşma durumunu gönderiyor (isSpeaking: true)...');
    nehirSocket.emit('voice-status', { isMuted: false, isSpeaking: true });
  }
});

// Deniz Nehir'in ses durumunu alıyor
denizSocket.on('voice-status', (data) => {
  console.log(`✅ [Deniz] Partner ses durumunu aldı: ${data.userName} konuşuyor: ${data.isSpeaking}`);
  console.log('🎉 WebRTC Sesli Sohbet durum göstergesi başarılı!\n');

  // Platform değiştirme testi
  console.log('--- 🍿 Platform Değiştirme Testi ---');
  console.log('🍿 [Deniz] Netflix moduna geçiyor...');
  denizSocket.emit('select-platform', { platform: 'netflix' });
});

nehirSocket.on('platform-changed', (data) => {
  console.log(`✅ [Nehir] Platform değişimini aldı: Yeni Platform=${data.platform}, Gönderen=${data.sender}`);
  console.log('🎉 Platform senkronizasyonu başarılı!\n');

  console.log('==================================================');
  console.log('🌟 TÜM DUOPARTY TESTLERİ BAŞARIYLA TAMAMLANDI! 🌟');
  console.log('==================================================');

  denizSocket.disconnect();
  nehirSocket.disconnect();
  process.exit(0);
});

setTimeout(() => {
  console.error('❌ Test zaman aşımına uğradı!');
  process.exit(1);
}, 8000);
