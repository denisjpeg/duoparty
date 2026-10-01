// DuoParty Content Script (Deniz & Nehir Edition - Serverless P2P)

(() => {
  if (window.duoPartyInitialized) return;
  window.duoPartyInitialized = true;

  console.log('[DuoParty] Deniz & Nehir Özel Sürüm Başlatılıyor...');

  let config = {
    isEnabled: false,
    userName: 'Deniz',
    roomId: 'deniz-nehir'
  };

  // P2P State
  let peer = null;
  let dataConnection = null;
  let mediaCall = null;
  let myRole = null; // 'host' or 'guest'
  let isConnected = false;

  // Video State
  let videoElement = null;
  let isExternalAction = false;

  // Audio State
  let localStream = null;
  let remoteAudioElement = null;
  let isMicActive = false;
  let isMuted = false;
  let audioContext = null;
  let analyser = null;
  let micCheckInterval = null;

  // UI State
  let widgetContainer = null;

  function getExpectedPartnerName() {
    if (config.userName.toLowerCase() === 'deniz') {
      return 'Nehir';
    } else if (config.userName.toLowerCase() === 'nehir') {
      return 'Deniz';
    }
    return 'Partner';
  }

  // 1. Load Settings
  function loadSettings(callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['isEnabled', 'userName', 'roomId'], (items) => {
        config.isEnabled = items.isEnabled === true;
        config.userName = (items.userName || 'Deniz').trim();
        config.roomId = (items.roomId || 'deniz-nehir').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (callback) callback();
      });
    } else {
      if (callback) callback();
    }
  }

  // 2. Initialize UI (Only when isEnabled is true)
  function initUI() {
    if (!config.isEnabled) {
      removeUI();
      return;
    }

    if (document.getElementById('duoparty-widget-container')) {
      updateUserCards();
      return;
    }

    widgetContainer = document.createElement('div');
    widgetContainer.id = 'duoparty-widget-container';
    widgetContainer.innerHTML = `
      <div class="duoparty-widget" id="duoparty-widget">
        <div class="duoparty-header" id="duoparty-header">
          <div class="duoparty-title-area">
            <span class="duoparty-logo">🍿</span>
            <span class="duoparty-title">DuoParty</span>
            <span class="duoparty-badge disconnected" id="duoparty-status">
              <span class="dot"></span><span id="duoparty-status-text">Bağlanıyor...</span>
            </span>
          </div>
          <div class="duoparty-actions">
            <button class="duoparty-icon-btn" id="duoparty-min-btn" title="Küçült/Büyüt">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>
            </button>
            <button class="duoparty-icon-btn close-btn" id="duoparty-close-btn" title="Kapat (Tek Başına İzle)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        <div class="duoparty-body" id="duoparty-body">
          <div class="duoparty-users">
            <!-- Self -->
            <div class="duoparty-user-card" id="duoparty-card-self">
              <div class="duoparty-avatar-wrap">
                <div class="duoparty-speaking-ring" id="duoparty-ring-self"></div>
                <span id="duoparty-avatar-self">D</span>
              </div>
              <span class="duoparty-user-name" id="duoparty-name-self">Deniz</span>
              <span class="duoparty-user-status" id="duoparty-mic-status-self">🎤 Kapalı</span>
            </div>

            <!-- Partner -->
            <div class="duoparty-user-card partner" id="duoparty-card-partner">
              <div class="duoparty-avatar-wrap">
                <div class="duoparty-speaking-ring" id="duoparty-ring-partner"></div>
                <span id="duoparty-avatar-partner">N</span>
              </div>
              <span class="duoparty-user-name" id="duoparty-name-partner">Nehir Bekleniyor...</span>
              <span class="duoparty-user-status" id="duoparty-mic-status-partner">Bekleniyor...</span>
            </div>
          </div>

          <div class="duoparty-banner" id="duoparty-banner">
            Oda: <strong style="margin-left: 4px; color: #fff;">${config.roomId}</strong>
          </div>

          <div class="duoparty-controls">
            <button class="duoparty-btn duoparty-btn-mic muted" id="duoparty-mic-btn">
              <span id="duoparty-mic-icon">🎙️</span>
              <span id="duoparty-mic-btn-text">Sesi Başlat</span>
            </button>
            <button class="duoparty-btn duoparty-btn-sync" id="duoparty-sync-btn" title="Videoyu Eşitle">
              🔄 Eşitle
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(widgetContainer);

    // Audio tag for partner's voice
    if (!remoteAudioElement) {
      remoteAudioElement = document.createElement('audio');
      remoteAudioElement.id = 'duoparty-remote-audio';
      remoteAudioElement.autoplay = true;
      document.body.appendChild(remoteAudioElement);
    }

    setupWidgetEvents(widgetContainer);
    updateUserCards();
  }

  function removeUI() {
    const existing = document.getElementById('duoparty-widget-container');
    if (existing) {
      existing.remove();
    }
    widgetContainer = null;
  }

  function setupWidgetEvents(container) {
    const header = document.getElementById('duoparty-header');
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = container.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      container.style.right = 'auto';
      container.style.left = `${initialLeft}px`;
      container.style.top = `${initialTop}px`;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      container.style.left = `${Math.max(10, Math.min(window.innerWidth - 310, initialLeft + dx))}px`;
      container.style.top = `${Math.max(10, Math.min(window.innerHeight - 100, initialTop + dy))}px`;
    }

    function onMouseUp() {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    // Minimize toggle
    document.getElementById('duoparty-min-btn').addEventListener('click', () => {
      document.getElementById('duoparty-widget').classList.toggle('minimized');
    });

    // Close button (Completely closes DuoParty and enables Solo mode)
    document.getElementById('duoparty-close-btn').addEventListener('click', () => {
      config.isEnabled = false;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ isEnabled: false });
      }
      disconnectP2P();
      stopVoiceChat();
      removeUI();
      console.log('[DuoParty] Kapatıldı (Tek Başına İzleme Modu).');
    });

    // Mic Toggle
    document.getElementById('duoparty-mic-btn').addEventListener('click', () => {
      if (!isMicActive) {
        startVoiceChat();
      } else {
        toggleMute();
      }
    });

    // Resync Button
    document.getElementById('duoparty-sync-btn').addEventListener('click', () => {
      if (videoElement && isConnected && dataConnection) {
        dataConnection.send({
          type: 'SYNC',
          action: videoElement.paused ? 'PAUSE' : 'PLAY',
          time: videoElement.currentTime,
          sender: config.userName
        });
        showBanner('🔄 Eşitleme sinyali gönderildi');
      }
    });
  }

  function updateUserCards() {
    const nameSelf = document.getElementById('duoparty-name-self');
    const avatarSelf = document.getElementById('duoparty-avatar-self');
    const namePartner = document.getElementById('duoparty-name-partner');
    const avatarPartner = document.getElementById('duoparty-avatar-partner');

    const myName = config.userName || 'Deniz';
    const partnerExpected = getExpectedPartnerName();

    if (nameSelf) nameSelf.textContent = myName;
    if (avatarSelf) avatarSelf.textContent = myName.charAt(0).toUpperCase();

    if (!isConnected) {
      if (namePartner) namePartner.textContent = `${partnerExpected} Bekleniyor...`;
      if (avatarPartner) avatarPartner.textContent = partnerExpected.charAt(0).toUpperCase();
    }
  }

  function setStatus(state, text) {
    const badge = document.getElementById('duoparty-status');
    const badgeText = document.getElementById('duoparty-status-text');
    if (!badge || !badgeText) return;
    badge.className = `duoparty-badge ${state}`;
    badgeText.textContent = text;
  }

  function showBanner(msg, isHighlight = true) {
    const banner = document.getElementById('duoparty-banner');
    if (!banner) return;
    banner.textContent = msg;
    if (isHighlight) {
      banner.classList.add('highlight');
      setTimeout(() => banner.classList.remove('highlight'), 2500);
    }
  }

  // 3. P2P Engine
  function initP2P() {
    if (!config.isEnabled) return;
    if (typeof Peer === 'undefined') {
      setTimeout(initP2P, 500);
      return;
    }

    disconnectP2P();

    const cleanRoom = (config.roomId || 'deniz-nehir').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    const hostId = `duoparty_${cleanRoom}_1`;
    const guestId = `duoparty_${cleanRoom}_2`;

    setStatus('connecting', 'Bağlanıyor...');

    try {
      peer = new Peer(hostId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      peer.on('open', () => {
        myRole = 'host';
        const partnerName = getExpectedPartnerName();
        setStatus('connecting', `${partnerName} Bekleniyor`);
        showBanner(`🍿 Oda: ${cleanRoom}`);
      });

      peer.on('connection', (conn) => {
        setupDataConnection(conn);
      });

      peer.on('call', (call) => {
        mediaCall = call;
        call.answer(localStream || undefined);
        call.on('stream', (remoteStream) => {
          attachRemoteAudio(remoteStream);
        });
      });

      peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          connectAsGuest(guestId, hostId);
        } else {
          console.warn('[DuoParty] Peer hatası:', err);
          setStatus('disconnected', 'Bağlantı Hatası');
        }
      });

      peer.on('disconnected', () => {
        if (peer && !peer.destroyed) peer.reconnect();
      });

    } catch (e) {
      console.error('[DuoParty] P2P başlatma hatası:', e);
    }
  }

  function connectAsGuest(guestId, hostId) {
    if (peer) peer.destroy();

    peer = new Peer(guestId, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('open', () => {
      myRole = 'guest';
      const conn = peer.connect(hostId, { reliable: true });
      setupDataConnection(conn);

      if (localStream) {
        const call = peer.call(hostId, localStream);
        call.on('stream', attachRemoteAudio);
        mediaCall = call;
      }
    });

    peer.on('call', (call) => {
      mediaCall = call;
      call.answer(localStream || undefined);
      call.on('stream', attachRemoteAudio);
    });

    peer.on('error', (err) => {
      console.warn('[DuoParty] Guest hatası:', err);
      setTimeout(initP2P, 4000);
    });
  }

  function setupDataConnection(conn) {
    dataConnection = conn;

    conn.on('open', () => {
      isConnected = true;
      setStatus('connected', 'Bağlandı');

      conn.send({
        type: 'USER_INFO',
        userName: config.userName
      });
    });

    conn.on('data', (data) => {
      handleIncomingData(data);
    });

    conn.on('close', () => {
      isConnected = false;
      const partnerExpected = getExpectedPartnerName();
      setStatus('connecting', `${partnerExpected} Ayrıldı`);
      showBanner(`👋 ${partnerExpected} ayrıldı`);
      resetPartnerCard();
    });

    conn.on('error', (err) => {
      console.warn('[DuoParty] DataConnection hatası:', err);
    });
  }

  function handleIncomingData(data) {
    switch (data.type) {
      case 'USER_INFO': {
        const partnerNameEl = document.getElementById('duoparty-name-partner');
        const partnerStatusEl = document.getElementById('duoparty-mic-status-partner');
        const avatarPartner = document.getElementById('duoparty-avatar-partner');
        const partnerName = data.userName || getExpectedPartnerName();

        if (partnerNameEl) partnerNameEl.textContent = partnerName;
        if (partnerStatusEl) partnerStatusEl.textContent = 'Bağlandı';
        if (avatarPartner) avatarPartner.textContent = partnerName.charAt(0).toUpperCase();
        showBanner(`❤️ ${partnerName} bağlandı!`);
        break;
      }

      case 'SYNC': {
        handleRemoteVideoSync(data);
        break;
      }

      case 'VOICE_STATUS': {
        const partnerStatus = document.getElementById('duoparty-mic-status-partner');
        if (data.isMuted) {
          if (partnerStatus) partnerStatus.textContent = '🔇 Susturuldu';
          setSpeakingRing('partner', false);
        } else {
          if (partnerStatus) partnerStatus.textContent = '🎤 Açık';
          setSpeakingRing('partner', data.isSpeaking);
        }
        break;
      }

      default:
        break;
    }
  }

  function disconnectP2P() {
    isConnected = false;
    if (dataConnection) {
      dataConnection.close();
      dataConnection = null;
    }
    if (peer) {
      peer.destroy();
      peer = null;
    }
  }

  // 4. Video Sync
  function getVideoElement() {
    return document.querySelector('video');
  }

  function setupVideoListeners() {
    const video = getVideoElement();
    if (!video || videoElement === video) return;
    videoElement = video;

    console.log('[DuoParty] Video yakalandı:', video);

    video.addEventListener('play', () => {
      if (isExternalAction || !isConnected || !dataConnection || !config.isEnabled) return;
      dataConnection.send({
        type: 'SYNC',
        action: 'PLAY',
        time: video.currentTime,
        sender: config.userName
      });
    });

    video.addEventListener('pause', () => {
      if (isExternalAction || !isConnected || !dataConnection || !config.isEnabled) return;
      dataConnection.send({
        type: 'SYNC',
        action: 'PAUSE',
        time: video.currentTime,
        sender: config.userName
      });
    });

    video.addEventListener('seeked', () => {
      if (isExternalAction || !isConnected || !dataConnection || !config.isEnabled) return;
      dataConnection.send({
        type: 'SYNC',
        action: 'SEEK',
        time: video.currentTime,
        sender: config.userName
      });
    });
  }

  function handleRemoteVideoSync(data) {
    const video = getVideoElement();
    if (!video || !config.isEnabled) return;

    isExternalAction = true;

    if (Math.abs(video.currentTime - data.time) > 0.6) {
      video.currentTime = data.time;
    }

    if (data.action === 'PLAY') {
      showBanner(`▶️ ${data.sender || 'Partner'} başlattı`);
      video.play().catch(e => console.warn(e));
    } else if (data.action === 'PAUSE') {
      showBanner(`⏸️ ${data.sender || 'Partner'} durdurdu`);
      video.pause();
    } else if (data.action === 'SEEK') {
      showBanner(`⏩ ${data.sender || 'Partner'} sardı (${Math.floor(data.time)}s)`);
    }

    setTimeout(() => {
      isExternalAction = false;
    }, 450);
  }

  // 5. Voice Chat Engine
  async function startVoiceChat() {
    try {
      showBanner('🎤 Mikrofon açılıyor...');
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      isMicActive = true;
      isMuted = false;

      const micBtn = document.getElementById('duoparty-mic-btn');
      const micBtnText = document.getElementById('duoparty-mic-btn-text');
      const micStatusSelf = document.getElementById('duoparty-mic-status-self');
      if (micBtn) micBtn.classList.remove('muted');
      if (micBtnText) micBtnText.textContent = 'Mikrofon Açık';
      if (micStatusSelf) micStatusSelf.textContent = '🎤 Açık';

      setupAudioAnalyzer(localStream);

      const cleanRoom = (config.roomId || 'deniz-nehir').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
      const targetId = myRole === 'guest' ? `duoparty_${cleanRoom}_1` : `duoparty_${cleanRoom}_2`;

      if (peer && isConnected) {
        const call = peer.call(targetId, localStream);
        if (call) {
          call.on('stream', attachRemoteAudio);
          mediaCall = call;
        }
      }

      showBanner('🎙️ Sesli sohbet aktif!');
    } catch (err) {
      console.error('[DuoParty] Mikrofon hatası:', err);
      showBanner('❌ Mikrofon izni veriniz!');
    }
  }

  function stopVoiceChat() {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    isMicActive = false;
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    if (micCheckInterval) clearInterval(micCheckInterval);
  }

  function toggleMute() {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !isMuted;
    });

    const micBtn = document.getElementById('duoparty-mic-btn');
    const micBtnText = document.getElementById('duoparty-mic-btn-text');
    const micStatusSelf = document.getElementById('duoparty-mic-status-self');

    if (isMuted) {
      if (micBtn) micBtn.classList.add('muted');
      if (micBtnText) micBtnText.textContent = 'Mikrofon Susturuldu';
      if (micStatusSelf) micStatusSelf.textContent = '🔇 Susturuldu';
    } else {
      if (micBtn) micBtn.classList.remove('muted');
      if (micBtnText) micBtnText.textContent = 'Mikrofon Açık';
      if (micStatusSelf) micStatusSelf.textContent = '🎤 Açık';
    }

    if (dataConnection && isConnected) {
      dataConnection.send({
        type: 'VOICE_STATUS',
        isMuted: isMuted,
        isSpeaking: false
      });
    }
  }

  function attachRemoteAudio(stream) {
    if (remoteAudioElement) {
      remoteAudioElement.srcObject = stream;
      remoteAudioElement.play().catch(e => console.warn('Audio play hatası:', e));
    }
  }

  function setupAudioAnalyzer(stream) {
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
          setSpeakingRing('self', false);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const avgVolume = sum / bufferLength;
        const isSpeaking = avgVolume > 18;

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          setSpeakingRing('self', isSpeaking);
          if (dataConnection && isConnected) {
            dataConnection.send({
              type: 'VOICE_STATUS',
              isMuted: isMuted,
              isSpeaking: isSpeaking
            });
          }
        }
      }, 150);
    } catch (e) {
      console.warn('[DuoParty] Analyzer hatası:', e);
    }
  }

  function setSpeakingRing(target, isSpeaking) {
    const ring = document.getElementById(`duoparty-ring-${target}`);
    const card = document.getElementById(`duoparty-card-${target}`);
    if (ring && card) {
      if (isSpeaking) {
        card.classList.add('speaking');
      } else {
        card.classList.remove('speaking');
      }
    }
  }

  function resetPartnerCard() {
    const partnerName = document.getElementById('duoparty-name-partner');
    const partnerStatus = document.getElementById('duoparty-mic-status-partner');
    const avatarPartner = document.getElementById('duoparty-avatar-partner');
    const partnerExpected = getExpectedPartnerName();

    if (partnerName) partnerName.textContent = `${partnerExpected} Bekleniyor...`;
    if (partnerStatus) partnerStatus.textContent = 'Çevrimdışı';
    if (avatarPartner) avatarPartner.textContent = partnerExpected.charAt(0).toUpperCase();
    setSpeakingRing('partner', false);
  }

  // 6. Observers & Message Handlers
  function setupObservers() {
    window.addEventListener('yt-navigate-finish', () => {
      if (config.isEnabled) setupVideoListeners();
    });

    const observer = new MutationObserver(() => {
      if (config.isEnabled && (!videoElement || !document.contains(videoElement))) {
        setupVideoListeners();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'SETTINGS_UPDATED') {
        loadSettings(() => {
          if (!config.isEnabled) {
            disconnectP2P();
            stopVoiceChat();
            removeUI();
          } else {
            initUI();
            setupVideoListeners();
            initP2P();
          }
        });
        sendResponse({ success: true });
      }
    });
  }

  // Start Everything
  loadSettings(() => {
    if (config.isEnabled) {
      initUI();
      setupVideoListeners();
      setupObservers();
      initP2P();
    } else {
      setupObservers();
    }
  });
})();
