document.addEventListener('DOMContentLoaded', () => {
  const mainToggleBtn = document.getElementById('mainToggleBtn');
  const btnIcon = document.getElementById('btnIcon');
  const btnText = document.getElementById('btnText');
  const statusPill = document.getElementById('statusPill');
  const btnUserDeniz = document.getElementById('btnUserDeniz');
  const btnUserNehir = document.getElementById('btnUserNehir');
  const roomIdInput = document.getElementById('roomId');

  let isEnabled = false;
  let selectedUser = 'Deniz';

  function updateUI() {
    if (isEnabled) {
      mainToggleBtn.className = 'main-toggle-btn stop';
      btnIcon.textContent = '⏹️';
      btnText.textContent = "DuoParty'yi Kapat";
      statusPill.className = 'status-pill active';
      statusPill.textContent = 'Açık';
    } else {
      mainToggleBtn.className = 'main-toggle-btn start';
      btnIcon.textContent = '▶️';
      btnText.textContent = "DuoParty'yi Başlat";
      statusPill.className = 'status-pill inactive';
      statusPill.textContent = 'Kapalı';
    }

    if (selectedUser === 'Deniz') {
      btnUserDeniz.classList.add('active');
      btnUserNehir.classList.remove('active');
    } else {
      btnUserNehir.classList.add('active');
      btnUserDeniz.classList.remove('active');
    }
  }

  function saveAndNotify() {
    const roomId = roomIdInput.value.trim() || 'deniz-nehir';
    chrome.storage.sync.set({ isEnabled, userName: selectedUser, roomId }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'SETTINGS_UPDATED' }).catch(() => {});
        }
      });
    });
  }

  chrome.storage.sync.get(['isEnabled', 'userName', 'roomId'], (items) => {
    isEnabled = items.isEnabled === true;
    selectedUser = items.userName || 'Deniz';
    roomIdInput.value = items.roomId || 'deniz-nehir';
    updateUI();
  });

  mainToggleBtn.addEventListener('click', () => {
    isEnabled = !isEnabled;
    updateUI();
    saveAndNotify();
  });

  btnUserDeniz.addEventListener('click', () => {
    selectedUser = 'Deniz';
    updateUI();
    saveAndNotify();
  });

  btnUserNehir.addEventListener('click', () => {
    selectedUser = 'Nehir';
    updateUI();
    saveAndNotify();
  });

  roomIdInput.addEventListener('change', () => {
    saveAndNotify();
  });
});
