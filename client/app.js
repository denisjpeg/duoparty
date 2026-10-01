// DuoParty Client Application — Deniz & Nehir Özel Sineması 🍿

(() => {
  // --- STATE ---
  let socket = null;
  let currentUser = 'Deniz';
  let currentRoom = 'deniz-nehir';
  let currentPlatform = 'youtube'; // 'youtube' | 'netflix'
  let isRoomJoined = false;

  // YouTube State
  let ytPlayer = null;
  let isYtReady = false;
  let isRemoteAction = false;
  let pendingVideoId = null;
  let timeUpdateInterval = null;

  // WebRTC Voice Chat State
  let voiceLocalStream = null;
  let voicePeer = null;
  let isMicActive = false;
  let isMuted = false;
  let audioContext = null;
  let analyser = null;
  let micCheckInterval = null;

  // WebRTC Netflix Screen Share State
  let screenLocalStream = null;
  let screenPeer = null;
  let isScreenSharing = false;

  // ICE Servers Configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // --- DOM ELEMENTS ---
  const el = {
    loginModal: document.getElementById('login-modal'),
    loginForm: document.getElementById('login-form'),
    roomInput: document.getElementById('room-input'),
    userChips: document.querySelectorAll('.user-chip'),
    
    platformModal: document.getElementById('platform-modal'),
    platformCards: document.querySelectorAll('.platform-choice-card'),
    btnSwitchPlatform: document.getElementById('btn-switch-platform'),
    currentPlatformIcon: document.getElementById('current-platform-icon'),
    currentPlatformName: document.getElementById('current-platform-name'),

    cinemaRoom: document.getElementById('cinema-room'),
    displayRoomId: document.getElementById('display-room-id'),
    connectionStatus: document.getElementById('connection-status'),
    statusText: document.getElementById('status-text'),
    myAvatar: document.getElementById('my-avatar'),
    myName: document.getElementById('my-name'),

    // YouTube
    youtubeStage: document.getElementById('youtube-stage'),
    ytUrlInput: document.getElementById('yt-url-input'),
    btnLoadYt: document.getElementById('btn-load-yt'),
    btnPlayPause: document.getElementById('btn-play-pause'),
    iconPlayPause: document.getElementById('icon-play-pause'),
    btnResync: document.getElementById('btn-resync'),
    ytCurrentTime: document.getElementById('yt-current-time'),
    ytDuration: document.getElementById('yt-duration'),
    btnFullscreenYt: document.getElementById('btn-fullscreen-yt'),
    quickPresets: document.querySelectorAll('.preset-pill'),
    ytNotice: document.getElementById('yt-overlay-notice'),

    // Netflix
    netflixStage: document.getElementById('netflix-stage'),
    btnStartScreenShare: document.getElementById('btn-start-screenshare'),
    screenShareBtnText: document.getElementById('screenshare-btn-text'),
    remoteScreenVideo: document.getElementById('remote-screen-video'),
    screenPlaceholder: document.getElementById('screen-share-placeholder'),
    screenShareHostInfo: document.getElementById('screen-share-host-info'),
    btnFullscreenNetflix: document.getElementById('btn-fullscreen-netflix'),

    // Voice Chat
    voiceBadge: document.getElementById('voice-connection-badge'),
    btnToggleMic: document.getElementById('btn-toggle-mic'),
    micBtnIcon: document.getElementById('mic-btn-icon'),
    micBtnLabel: document.getElementById('mic-btn-label'),
    sliderPartnerVolume: document.getElementById('slider-partner-volume'),
    partnerVolumeVal: document.getElementById('partner-volume-val'),
    remoteVoiceAudio: document.getElementById('remote-voice-audio'),

    // User Cards
    cardDeniz: document.getElementById('voice-user-deniz'),
    stateDeniz: document.getElementById('state-deniz'),
    micIconDeniz: document.getElementById('mic-icon-deniz'),
    
    cardNehir: document.getElementById('voice-user-nehir'),
    stateNehir: document.getElementById('state-nehir'),
    micIconNehir: document.getElementById('mic-icon-nehir'),

    // Logs & Toasts
    activityLog: document.getElementById('activity-log'),
    toastContainer: document.getElementById('toast-container')
  };

  // --- INITIALIZATION ---
  function init() {
    setupUserSelectionEvents();
    setupSocket();
    setupYouTubeApi();
    setupEventListeners();
  }

  // 1. User Selection & Form Submit
  function setupUserSelectionEvents() {
    el.userChips.forEach(chip => {
      chip.addEventListener('click', () => {
        el.userChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentUser = chip.getAttribute('data-user');
      });
    });

    el.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      currentRoom = el.roomInput.value.trim().toLowerCase() || 'deniz-nehir';
      
      el.displayRoomId.textContent = currentRoom;
      el.myName.textContent = currentUser;
      el.myAvatar.textContent = currentUser === 'Deniz' ? '👦' : '👧';

      el.loginModal.classList.add('hidden');
      el.platformModal.classList.remove('hidden');

      // Join Socket Room
      socket.emit('join-room', {
        roomId: currentRoom,
        userName: currentUser
      });

      isRoomJoined = true;
      addLog(`🔑 ${currentUser} olarak '${currentRoom}' odasına giriş yapıldı.`);
    });
  }

  // 2. Platform Selection
  el.platformCards.forEach(card => {
    card.addEventListener('click', () => {
      const selected = card.getAttribute('data-platform');
      setPlatform(selected, true);
      el.platformModal.classList.add('hidden');
      el.cinemaRoom.classList.remove('hidden');
    });
  });

  el.btnSwitchPlatform.addEventListener('click', () => {
    el.platformModal.classList.remove('hidden');
  });

  function setPlatform(platform, broadcast = false) {
    currentPlatform = platform;
    if (platform === 'youtube') {
      el.youtubeStage.classList.remove('hidden');
      el.netflixStage.classList.add('hidden');
      el.currentPlatformIcon.textContent = '🔴';
      el.currentPlatformName.textContent = 'YouTube';
    } else {
      el.youtubeStage.classList.add('hidden');
      el.netflixStage.classList.remove('hidden');
      el.currentPlatformIcon.textContent = '🍿';
      el.currentPlatformName.textContent = 'Netflix';
    }

    if (broadcast && socket && isRoomJoined) {
      socket.emit('select-platform', { platform });
    }
  }

  // 3. Socket.io Setup
  function setupSocket() {
    socket = io();

    socket.on('connect', () => {
      el.connectionStatus.className = 'status-badge connected';
      el.statusText.textContent = 'Bağlandı';
      if (isRoomJoined) {
        socket.emit('join-room', { roomId: currentRoom, userName: currentUser });
      }
    });

    socket.on('disconnect', () => {
      el.connectionStatus.className = 'status-badge connecting';
      el.statusText.textContent = 'Yeniden Bağlanıyor...';
    });

    socket.on('room-state', (data) => {
      console.log('[Room State]', data);
      setPlatform(data.currentPlatform || 'youtube', false);

      updateUserPresence(data.users);

      if (data.videoState && data.videoState.videoId) {
        loadYouTubeVideo(data.videoState.videoId, false, data.videoState.currentTime);
      }

      if (data.screenShareHost) {
        el.screenShareHostInfo.textContent = `Yayıncı ID: ${data.screenShareHost}`;
        el.screenPlaceholder.classList.add('hidden');
      }
    });

    socket.on('user-joined', (data) => {
      showToast(`❤️ ${data.user.name} odaya katıldı!`);
      addLog(`❤️ ${data.user.name} odaya bağlandı.`);
      updateUserPresence(data.users);

      // Otomatik WebRTC Ses Teklifi Başlat (Eğer mikrofonumuz açıksa)
      if (isMicActive && voiceLocalStream) {
        initVoiceWebRTC(true);
      }
    });

    socket.on('user-left', (data) => {
      showToast(`👋 ${data.userName} odadan ayrıldı.`);
      addLog(`👋 ${data.userName} ayrıldı.`);
      updateUserPresence(data.users);
      if (data.userName === 'Deniz') {
        el.cardDeniz.classList.remove('speaking');
        el.stateDeniz.textContent = 'Ayrıldı';
      } else {
        el.cardNehir.classList.remove('speaking');
        el.stateNehir.textContent = 'Ayrıldı';
      }
    });

    socket.on('platform-changed', ({ platform, sender }) => {
      showToast(`🎬 ${sender} ${platform.toUpperCase()} moduna geçti.`);
      addLog(`🎬 ${sender} platformu ${platform.toUpperCase()} olarak değiştirdi.`);
      setPlatform(platform, false);
      el.platformModal.classList.add('hidden');
      el.cinemaRoom.classList.remove('hidden');
    });

    // YouTube Sync Events
    socket.on('video-action', (data) => {
      handleRemoteVideoAction(data);
    });

    // Voice Chat WebRTC Signaling
    socket.on('voice-signal', async ({ senderId, signal }) => {
      handleVoiceSignal(signal);
    });

    socket.on('voice-status', ({ userName, isMuted: remoteMuted, isSpeaking }) => {
      const isDeniz = userName.toLowerCase() === 'deniz';
      const targetCard = isDeniz ? el.cardDeniz : el.cardNehir;
      const targetState = isDeniz ? el.stateDeniz : el.stateNehir;
      const targetMicIcon = isDeniz ? el.micIconDeniz : el.micIconNehir;

      if (remoteMuted) {
        targetCard.classList.remove('speaking');
        targetState.textContent = '🔇 Susturuldu';
        targetMicIcon.textContent = '🔇';
      } else {
        targetState.textContent = '🎤 Açık';
        targetMicIcon.textContent = '🎤';
        if (isSpeaking) {
          targetCard.classList.add('speaking');
        } else {
          targetCard.classList.remove('speaking');
        }
      }
    });

    // Netflix Screen Share WebRTC Signaling
    socket.on('screen-signal', async ({ senderId, signal }) => {
      handleScreenSignal(signal);
    });

    socket.on('screen-share-status', ({ isSharing, hostName }) => {
      if (isSharing) {
        showToast(`📺 ${hostName} Netflix ekranını paylaşıyor!`);
        addLog(`📺 ${hostName} ekran yayını başlattı.`);
        el.screenPlaceholder.classList.add('hidden');
        el.screenShareHostInfo.textContent = `${hostName} yayında`;
      } else {
        showToast(`⏹️ Ekran paylaşımı durduruldu.`);
        addLog(`⏹️ Ekran yayını sonlandırıldı.`);
        el.screenPlaceholder.classList.remove('hidden');
        el.screenShareHostInfo.textContent = 'Yayın bekleniyor...';
        el.remoteScreenVideo.srcObject = null;
      }
    });
  }

  function updateUserPresence(users) {
    const hasDeniz = users.some(u => u.name.toLowerCase() === 'deniz');
    const hasNehir = users.some(u => u.name.toLowerCase() === 'nehir');

    el.stateDeniz.textContent = hasDeniz ? '🟢 Odada' : 'Bekleniyor...';
    el.stateNehir.textContent = hasNehir ? '🟢 Odada' : 'Bekleniyor...';
  }

  // 4. YouTube Player API Setup
  function setupYouTubeApi() {
    window.onYouTubeIframeAPIReady = () => {
      console.log('[YouTube API] Hazır.');
      initYtPlayer('jfKfPfyJRdk'); // Başlangıç videosu
    };
  }

  function initYtPlayer(videoId) {
    if (ytPlayer) {
      ytPlayer.destroy();
    }

    ytPlayer = new YT.Player('yt-player-target', {
      height: '100%',
      width: '100%',
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        enablejsapi: 1
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange
      }
    });
  }

  function onPlayerReady(event) {
    isYtReady = true;
    console.log('[YouTube Player] Yüklendi ve hazır.');

    if (pendingVideoId) {
      loadYouTubeVideo(pendingVideoId, false);
      pendingVideoId = null;
    }

    // Zaman güncelleme döngüsü
    if (timeUpdateInterval) clearInterval(timeUpdateInterval);
    timeUpdateInterval = setInterval(updateTimeDisplay, 500);
  }

  function onPlayerStateChange(event) {
    if (isRemoteAction) return;

    const currentTime = ytPlayer.getCurrentTime();

    if (event.data === YT.PlayerState.PLAYING) {
      el.iconPlayPause.textContent = '⏸️';
      el.ytNotice.classList.add('hidden');
      socket.emit('video-action', {
        action: 'PLAY',
        time: currentTime,
        sender: currentUser
      });
      addLog(`▶️ ${currentUser} videoyu başlattı.`);
    } else if (event.data === YT.PlayerState.PAUSED) {
      el.iconPlayPause.textContent = '▶️';
      showNotice('⏸️ Video Durduruldu');
      socket.emit('video-action', {
        action: 'PAUSE',
        time: currentTime,
        sender: currentUser
      });
      addLog(`⏸️ ${currentUser} videoyu durdurdu.`);
    }
  }

  function handleRemoteVideoAction(data) {
    if (!ytPlayer || !isYtReady) return;

    isRemoteAction = true;
    const { action, time, videoId, sender } = data;

    if (action === 'LOAD_VIDEO' && videoId) {
      loadYouTubeVideo(videoId, false);
      showToast(`🎬 ${sender} yeni bir video açtı!`);
      addLog(`🎬 ${sender} yeni video yükledi: ${videoId}`);
    } else if (action === 'PLAY') {
      const current = ytPlayer.getCurrentTime();
      if (Math.abs(current - time) > 1.2) {
        ytPlayer.seekTo(time, true);
      }
      ytPlayer.playVideo();
      el.iconPlayPause.textContent = '⏸️';
      el.ytNotice.classList.add('hidden');
      showToast(`▶️ ${sender} başlattı`);
      addLog(`▶️ ${sender} başlattı (${formatTime(time)})`);
    } else if (action === 'PAUSE') {
      ytPlayer.pauseVideo();
      if (Math.abs(ytPlayer.getCurrentTime() - time) > 1.2) {
        ytPlayer.seekTo(time, true);
      }
      el.iconPlayPause.textContent = '▶️';
      showNotice(`⏸️ ${sender} durdurdu`);
      showToast(`⏸️ ${sender} durdurdu`);
      addLog(`⏸️ ${sender} durdurdu`);
    } else if (action === 'SEEK') {
      ytPlayer.seekTo(time, true);
      showToast(`⏩ ${sender} ${formatTime(time)} konumuna sardı`);
      addLog(`⏩ ${sender} sardı (${formatTime(time)})`);
    }

    setTimeout(() => {
      isRemoteAction = false;
    }, 600);
  }

  function loadYouTubeVideo(videoInput, broadcast = true, startTime = 0) {
    const videoId = extractYouTubeId(videoInput);
    if (!videoId) {
      showToast('❌ Geçersiz YouTube linki!');
      return;
    }

    if (!isYtReady) {
      pendingVideoId = videoId;
      return;
    }

    isRemoteAction = true;
    ytPlayer.loadVideoById({
      videoId: videoId,
      startSeconds: startTime
    });

    if (broadcast && socket) {
      socket.emit('video-action', {
        action: 'LOAD_VIDEO',
        videoId: videoId,
        time: startTime,
        sender: currentUser
      });
      showToast(`🎬 Yeni video yüklendi`);
    }

    setTimeout(() => {
      isRemoteAction = false;
    }, 800);
  }

  function extractYouTubeId(urlOrId) {
    if (!urlOrId) return null;
    const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : (urlOrId.length === 11 ? urlOrId : null);
  }

  function updateTimeDisplay() {
    if (!ytPlayer || !isYtReady || typeof ytPlayer.getCurrentTime !== 'function') return;
    const current = ytPlayer.getCurrentTime() || 0;
    const duration = ytPlayer.getDuration() || 0;
    el.ytCurrentTime.textContent = formatTime(current);
    el.ytDuration.textContent = formatTime(duration);
  }

  function formatTime(seconds) {
    const s = Math.floor(seconds || 0);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function showNotice(text) {
    el.ytNotice.querySelector('.overlay-text').textContent = text;
    el.ytNotice.classList.remove('hidden');
    setTimeout(() => {
      el.ytNotice.classList.add('hidden');
    }, 2500);
  }

  // 5. WebRTC Voice Chat Engine
  async function toggleMicrophone() {
    if (!isMicActive) {
      await startVoiceChat();
    } else {
      isMuted = !isMuted;
      if (voiceLocalStream) {
        voiceLocalStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
      }

      if (isMuted) {
        el.btnToggleMic.classList.add('btn-danger');
        el.btnToggleMic.classList.remove('btn-primary');
        el.micBtnIcon.textContent = '🔇';
        el.micBtnLabel.textContent = 'Sessize Alındı (Aç)';
        showToast('🔇 Mikrofonunuz sessize alındı.');
      } else {
        el.btnToggleMic.classList.remove('btn-danger');
        el.btnToggleMic.classList.add('btn-primary');
        el.micBtnIcon.textContent = '🎙️';
        el.micBtnLabel.textContent = 'Mikrofon Açık (Sustur)';
        showToast('🎙️ Mikrofonunuz açıldı.');
      }

      socket.emit('voice-status', {
        isMuted: isMuted,
        isSpeaking: false
      });
    }
  }

  async function startVoiceChat() {
    try {
      showToast('🎤 Mikrofon izni isteniyor...');
      voiceLocalStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      isMicActive = true;
      isMuted = false;

      el.voiceBadge.className = 'badge-voice connected';
      el.voiceBadge.textContent = 'Sesli Sohbet Aktif';

      el.btnToggleMic.classList.remove('btn-primary');
      el.btnToggleMic.classList.add('btn-outline');
      el.micBtnIcon.textContent = '🎙️';
      el.micBtnLabel.textContent = 'Mikrofonu Kapat';

      setupVoiceAudioAnalyzer(voiceLocalStream);
      initVoiceWebRTC(true);

      showToast('🎉 Sesli sohbet bağlandı!');
      addLog(`🎙️ ${currentUser} sesli sohbete katıldı.`);

    } catch (err) {
      console.error('[Voice] Mikrofon erişim hatası:', err);
      showToast('❌ Mikrofon izni verilmedi!');
    }
  }

  function initVoiceWebRTC(isInitiator) {
    if (voicePeer) {
      voicePeer.close();
    }

    voicePeer = new RTCPeerConnection(rtcConfig);

    if (voiceLocalStream) {
      voiceLocalStream.getTracks().forEach(track => {
        voicePeer.addTrack(track, voiceLocalStream);
      });
    }

    voicePeer.ontrack = (event) => {
      console.log('[Voice WebRTC] Karşı tarafın sesi alındı:', event.streams[0]);
      el.remoteVoiceAudio.srcObject = event.streams[0];
      el.remoteVoiceAudio.play().catch(e => console.warn('Ses oynatma uyarısı:', e));
    };

    voicePeer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('voice-signal', {
          signal: { candidate: event.candidate }
        });
      }
    };

    if (isInitiator) {
      voicePeer.onnegotiationneeded = async () => {
        try {
          const offer = await voicePeer.createOffer();
          await voicePeer.setLocalDescription(offer);
          socket.emit('voice-signal', {
            signal: { sdp: voicePeer.localDescription }
          });
        } catch (e) {
          console.error('[Voice Offer Error]', e);
        }
      };
    }
  }

  async function handleVoiceSignal(signal) {
    if (!voicePeer) {
      initVoiceWebRTC(false);
    }

    try {
      if (signal.sdp) {
        await voicePeer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === 'offer') {
          const answer = await voicePeer.createAnswer();
          await voicePeer.setLocalDescription(answer);
          socket.emit('voice-signal', {
            signal: { sdp: voicePeer.localDescription }
          });
        }
      } else if (signal.candidate) {
        await voicePeer.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.warn('[Voice Signal Error]', err);
    }
  }

  function setupVoiceAudioAnalyzer(stream) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let wasSpeaking = false;

      if (micCheckInterval) clearInterval(micCheckInterval);
      micCheckInterval = setInterval(() => {
        if (!isMicActive || isMuted) {
          setSpeakingAura(currentUser, false);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const avg = sum / bufferLength;
        const isSpeaking = avg > 14;

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          setSpeakingAura(currentUser, isSpeaking);
          socket.emit('voice-status', {
            isMuted,
            isSpeaking
          });
        }
      }, 140);
    } catch (e) {
      console.warn('Audio analyser hatası:', e);
    }
  }

  function setSpeakingAura(user, isSpeaking) {
    const isDeniz = user.toLowerCase() === 'deniz';
    const card = isDeniz ? el.cardDeniz : el.cardNehir;
    if (card) {
      if (isSpeaking) card.classList.add('speaking');
      else card.classList.remove('speaking');
    }
  }

  // 6. WebRTC Netflix Screen / Tab Share Engine
  async function toggleScreenShare() {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      await startScreenShare();
    }
  }

  async function startScreenShare() {
    try {
      screenLocalStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'browser'
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      isScreenSharing = true;
      el.screenShareBtnText.textContent = 'Paylaşımı Durdur ⏹️';
      el.btnStartScreenShare.classList.remove('btn-netflix');
      el.btnStartScreenShare.classList.add('btn-danger');

      el.remoteScreenVideo.srcObject = screenLocalStream;
      el.screenPlaceholder.classList.add('hidden');
      el.screenShareHostInfo.textContent = 'Siz yayınlıyorsunuz (Canlı)';

      socket.emit('screen-share-status', { isSharing: true });

      // Partner için WebRTC Screen Peer başlat
      initScreenWebRTC(true);

      // Kullanıcı tarayıcıdaki yerel "Paylaşımı Durdur" butonuna basarsa
      screenLocalStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      showToast('📺 Ekran paylaşımı başladı!');
      addLog(`📺 ${currentUser} Netflix ekranını canlı paylaşıyor.`);

    } catch (err) {
      console.warn('[Screen Share] İptal edildi veya hata:', err);
    }
  }

  function stopScreenShare() {
    if (screenLocalStream) {
      screenLocalStream.getTracks().forEach(t => t.stop());
      screenLocalStream = null;
    }
    isScreenSharing = false;
    el.screenShareBtnText.textContent = 'Netflix Sekmesini Paylaş';
    el.btnStartScreenShare.classList.add('btn-netflix');
    el.btnStartScreenShare.classList.remove('btn-danger');

    el.remoteScreenVideo.srcObject = null;
    el.screenPlaceholder.classList.remove('hidden');
    el.screenShareHostInfo.textContent = 'Yayın bekleniyor...';

    if (screenPeer) {
      screenPeer.close();
      screenPeer = null;
    }

    socket.emit('screen-share-status', { isSharing: false });
  }

  function initScreenWebRTC(isInitiator) {
    if (screenPeer) screenPeer.close();
    screenPeer = new RTCPeerConnection(rtcConfig);

    if (screenLocalStream) {
      screenLocalStream.getTracks().forEach(track => {
        screenPeer.addTrack(track, screenLocalStream);
      });
    }

    screenPeer.ontrack = (event) => {
      console.log('[Screen WebRTC] Karşı tarafın ekran yayını alındı:', event.streams[0]);
      el.remoteScreenVideo.srcObject = event.streams[0];
      el.screenPlaceholder.classList.add('hidden');
    };

    screenPeer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('screen-signal', { signal: { candidate: event.candidate } });
      }
    };

    if (isInitiator) {
      screenPeer.onnegotiationneeded = async () => {
        try {
          const offer = await screenPeer.createOffer();
          await screenPeer.setLocalDescription(offer);
          socket.emit('screen-signal', { signal: { sdp: screenPeer.localDescription } });
        } catch (e) {
          console.error('[Screen Offer Error]', e);
        }
      };
    }
  }

  async function handleScreenSignal(signal) {
    if (!screenPeer) {
      initScreenWebRTC(false);
    }

    try {
      if (signal.sdp) {
        await screenPeer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === 'offer') {
          const answer = await screenPeer.createAnswer();
          await screenPeer.setLocalDescription(answer);
          socket.emit('screen-signal', { signal: { sdp: screenPeer.localDescription } });
        }
      } else if (signal.candidate) {
        await screenPeer.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.warn('[Screen Signal Error]', err);
    }
  }

  // 7. General Event Listeners
  function setupEventListeners() {
    // Load YouTube Button & Enter key
    el.btnLoadYt.addEventListener('click', () => {
      const url = el.ytUrlInput.value.trim();
      if (url) loadYouTubeVideo(url, true);
    });

    el.ytUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const url = el.ytUrlInput.value.trim();
        if (url) loadYouTubeVideo(url, true);
      }
    });

    // Presets
    el.quickPresets.forEach(preset => {
      preset.addEventListener('click', () => {
        const videoId = preset.getAttribute('data-video');
        loadYouTubeVideo(videoId, true);
      });
    });

    // Play/Pause button
    el.btnPlayPause.addEventListener('click', () => {
      if (!ytPlayer || !isYtReady) return;
      const state = ytPlayer.getPlayerState();
      if (state === YT.PlayerState.PLAYING) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
    });

    // Resync Button
    el.btnResync.addEventListener('click', () => {
      if (!ytPlayer || !isYtReady) return;
      const time = ytPlayer.getCurrentTime();
      socket.emit('video-action', {
        action: 'SEEK',
        time: time,
        sender: currentUser
      });
      showToast('🔄 Eşitleme sinyali gönderildi!');
    });

    // Fullscreen YouTube
    el.btnFullscreenYt.addEventListener('click', () => {
      const elBox = document.getElementById('yt-player-target');
      if (elBox.requestFullscreen) elBox.requestFullscreen();
    });

    // Fullscreen Netflix
    el.btnFullscreenNetflix.addEventListener('click', () => {
      if (el.remoteScreenVideo.requestFullscreen) {
        el.remoteScreenVideo.requestFullscreen();
      }
    });

    // Screenshare Netflix Button
    el.btnStartScreenShare.addEventListener('click', toggleScreenShare);

    // Voice Mic Toggle
    el.btnToggleMic.addEventListener('click', toggleMicrophone);

    // Volume Slider
    el.sliderPartnerVolume.addEventListener('input', (e) => {
      const vol = e.target.value;
      el.partnerVolumeVal.textContent = `${vol}%`;
      el.remoteVoiceAudio.volume = vol / 100;
    });
  }

  // Helper Toast Notification
  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function addLog(msg) {
    const item = document.createElement('div');
    item.className = 'log-item';
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    item.innerHTML = `<span class="log-time">${timeStr}</span><span class="log-msg">${msg}</span>`;
    el.activityLog.appendChild(item);
    el.activityLog.scrollTop = el.activityLog.scrollHeight;
  }

  // Başlat
  window.addEventListener('DOMContentLoaded', init);
})();
