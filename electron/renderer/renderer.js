const nicknameText = document.querySelector('#nicknameText');
const nicknameInput = document.querySelector('#nicknameInput');
const statusText = document.querySelector('#statusText');
const playButton = document.querySelector('#playButton');
const nickModal = document.querySelector('#nickModal');
const settingsModal = document.querySelector('#settingsModal');
const gameRootInput = document.querySelector('#gameRootInput');
const memoryInput = document.querySelector('#memoryInput');
const memoryText = document.querySelector('#memoryText');
const folderState = document.querySelector('#folderState');

let state = {
  nickname: 'YTArturWayUa',
  gameRoot: '',
  memoryMb: 4096,
  validGameRoot: false
};

function cleanNick(value) {
  return String(value || '').trim().replace(/[^A-Za-z0-9_]/g, '').slice(0, 16) || 'YTArturWayUa';
}

function shortPath(value) {
  if (!value) return 'Не вибрано';
  return value.length > 28 ? `...${value.slice(-25)}` : value;
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
  gameRootInput.value = state.gameRoot || '';
  memoryInput.value = state.memoryMb;
  memoryText.textContent = `${state.memoryMb} MB`;
  folderState.textContent = state.validGameRoot ? 'Готово' : 'Перевір папку';
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

document.querySelector('#minimizeButton').addEventListener('click', () => window.crackedPulse.minimize());
document.querySelector('#closeButton').addEventListener('click', () => window.crackedPulse.close());

document.querySelector('#accountButton').addEventListener('click', () => showModal(nickModal));
document.querySelector('#nickButton').addEventListener('click', () => showModal(nickModal));
document.querySelector('#cancelNickButton').addEventListener('click', () => hideModal(nickModal));

document.querySelector('#settingsButton').addEventListener('click', () => showModal(settingsModal));
document.querySelector('#saveSettingsButton').addEventListener('click', async () => {
  const saved = await window.crackedPulse.saveSettings({
    gameRoot: gameRootInput.value,
    memoryMb: Number(memoryInput.value)
  });
  render(saved);
  hideModal(settingsModal);
  setStatus(saved.validGameRoot ? 'Налаштування збережено' : 'Папка не схожа на CrackedPulse-RunOnly', !saved.validGameRoot);
});

document.querySelector('#chooseRootButton').addEventListener('click', async () => {
  const chosen = await window.crackedPulse.chooseGameRoot();
  if (chosen) render(chosen);
});

document.querySelector('#openRootButton').addEventListener('click', () => window.crackedPulse.openGameRoot());

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
  setStatus('Запускаю Minecraft...');
  const result = await window.crackedPulse.launchGame(state.nickname);
  if (result.nickname) render({ nickname: result.nickname });
  setStatus(result.message, !result.ok);
  if (!result.ok) playButton.disabled = false;
});

window.crackedPulse.onGameStopped(() => {
  playButton.disabled = false;
  setStatus('Minecraft закрито');
});

window.crackedPulse.getState().then(render);
