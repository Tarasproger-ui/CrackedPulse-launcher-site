const nicknameText = document.querySelector('#nicknameText');
const nicknameInput = document.querySelector('#nicknameInput');
const statusText = document.querySelector('#statusText');
const playButton = document.querySelector('#playButton');
const nickModal = document.querySelector('#nickModal');
const settingsModal = document.querySelector('#settingsModal');
const installDirInput = document.querySelector('#installDirInput');
const gameRootInput = document.querySelector('#gameRootInput');
const memoryInput = document.querySelector('#memoryInput');
const closeAfterLaunchInput = document.querySelector('#closeAfterLaunchInput');
const memoryText = document.querySelector('#memoryText');
const folderState = document.querySelector('#folderState');
const installProgress = document.querySelector('#installProgress');
const installProgressText = document.querySelector('#installProgressText');
const installProgressBar = document.querySelector('#installProgressBar');

let state = {
  nickname: 'YTArturWayUa',
  installDir: '',
  gameRoot: '',
  memoryMb: 4096,
  validGameRoot: false,
  closeAfterLaunch: false
};

function cleanNick(value) {
  return String(value || '').trim().replace(/[^A-Za-z0-9_]/g, '').slice(0, 16) || 'YTArturWayUa';
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle('error', isError);
}

function render(nextState) {
  state = { ...state, ...nextState };
  state.nickname = cleanNick(state.nickname);
  nicknameText.textContent = state.nickname;
  nicknameInput.value = state.nickname;
  installDirInput.value = state.installDir || '';
  gameRootInput.value = state.gameRoot || '';
  memoryInput.value = state.memoryMb;
  closeAfterLaunchInput.checked = Boolean(state.closeAfterLaunch);
  memoryText.textContent = `${state.memoryMb} MB`;
  folderState.textContent = state.validGameRoot ? 'Готово' : 'Треба скачати';
  folderState.classList.toggle('bad', !state.validGameRoot);
}

function showModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function hideModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function setInstallProgress(payload) {
  installProgress.classList.remove('hidden');
  installProgressText.textContent = payload.message || 'Скачування...';
  installProgressBar.style.width = `${Math.max(0, Math.min(100, payload.percent || 0))}%`;
  if (payload.phase === 'done') {
    setTimeout(() => installProgress.classList.add('hidden'), 900);
  }
}

document.querySelector('#minimizeButton').addEventListener('click', () => window.crackedPulse.minimize());
document.querySelector('#closeButton').addEventListener('click', () => window.crackedPulse.close());

document.querySelector('#accountButton').addEventListener('click', () => showModal(nickModal));
document.querySelector('#nickButton').addEventListener('click', () => showModal(nickModal));
document.querySelector('#cancelNickButton').addEventListener('click', () => hideModal(nickModal));

document.querySelector('#settingsButton').addEventListener('click', () => showModal(settingsModal));
document.querySelector('#saveSettingsButton').addEventListener('click', async () => {
  const saved = await window.crackedPulse.saveSettings({
    installDir: installDirInput.value,
    gameRoot: gameRootInput.value,
    memoryMb: Number(memoryInput.value),
    closeAfterLaunch: closeAfterLaunchInput.checked
  });
  render(saved);
  hideModal(settingsModal);
  setStatus(saved.validGameRoot ? 'Налаштування збережено' : 'Налаштування збережено, Minecraft ще не скачаний', false);
});

document.querySelector('#chooseInstallButton').addEventListener('click', async () => {
  const chosen = await window.crackedPulse.chooseInstallDir();
  if (chosen) render(chosen);
});

document.querySelector('#saveNickButton').addEventListener('click', async () => {
  const saved = await window.crackedPulse.saveSettings({ nickname: nicknameInput.value });
  render(saved);
  hideModal(nickModal);
  setStatus(`Нік збережено: ${saved.nickname}`);
});

nicknameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') document.querySelector('#saveNickButton').click();
  if (event.key === 'Escape') hideModal(nickModal);
});

playButton.addEventListener('click', async () => {
  playButton.disabled = true;
  setStatus(state.validGameRoot ? 'Запускаю Minecraft...' : 'Minecraft не знайдено, скачую...');
  const result = await window.crackedPulse.launchGame(state.nickname);
  if (result.nickname || result.gameRoot) render(result);
  setStatus(result.message, !result.ok);
  if (!result.ok) playButton.disabled = false;
});

window.crackedPulse.onInstallProgress(setInstallProgress);

window.crackedPulse.onGameStopped(() => {
  playButton.disabled = false;
  setStatus('Minecraft закрито');
});

window.crackedPulse.getState().then(render);
