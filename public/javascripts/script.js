(() => {
  const playZone = document.querySelector('.playZone');

  if (!playZone) {
    return;
  }

  const totalRounds = 20;
  const tickRate = 100;
  const wrongPenalty = 12;
  const correctBonus = 3;
  const correctScore = 10;
  const wrongScorePenalty = 5;
  const storageKey = 'speedie.bestScore';
  const mutedStorageKey = 'speedie.soundMuted';
  let intervalId;
  const assetBase = new URL('../', document.currentScript.src);

  const palette = [
    { name: 'red', value: '#ef4444' },
    { name: 'green', value: '#22c55e' },
    { name: 'blue', value: '#3b82f6' },
    { name: 'yellow', value: '#facc15' },
    { name: 'orange', value: '#f97316' },
    { name: 'indigo', value: '#4f46e5' },
    { name: 'violet', value: '#8b5cf6' },
    { name: 'pink', value: '#ec4899' },
    { name: 'teal', value: '#14b8a6' },
    { name: 'slate', value: '#475569' }
  ];

  const state = {
    started: false,
    paused: false,
    ended: false,
    round: 0,
    attempts: 0,
    streak: 0,
    bestStreak: 0,
    score: 0,
    timeLeft: 300,
    targetColor: null,
    muted: window.localStorage.getItem(mutedStorageKey) === 'true'
  };

  const boxes = Array.from(document.querySelectorAll('.clickBox'));
  const difficulty = document.querySelector('#difficultySelect');
  const startButton = document.querySelector('#startGame');
  const pauseButton = document.querySelector('#pauseGame');
  const restartButton = document.querySelector('#restartGame');
  const playAgainButton = document.querySelector('#playAgain');
  const soundToggle = document.querySelector('#soundToggle');
  const clockAudio = document.querySelector('#clock');

  state.timeLeft = getStartingTime();
  syncViewportHeight();

  difficulty.addEventListener('change', () => {
    if (state.started) {
      return;
    }

    state.timeLeft = getStartingTime();
    updateHud('Choose a difficulty, then start.');
  });

  startButton.addEventListener('click', startGame);
  pauseButton.addEventListener('click', togglePause);
  restartButton.addEventListener('click', restartGame);
  playAgainButton.addEventListener('click', restartGame);
  soundToggle.addEventListener('click', toggleSound);
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', handleViewportChange);

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
  }

  boxes.forEach((box) => {
    box.addEventListener('click', () => chooseBox(box));
  });

  document.addEventListener('keydown', (event) => {
    if (!state.started || state.ended) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 'p') {
      togglePause();
    }

    if (key === 'r') {
      restartGame();
    }
  });

  prepareBoard();
  updateSoundToggle();
  updateHud('Choose a difficulty, then start.');

  function startGame() {
    state.started = true;
    state.paused = false;
    state.ended = false;
    state.round = 0;
    state.attempts = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.score = 0;
    state.timeLeft = getStartingTime();

    document.body.classList.add('gameStarted');
    playZone.classList.add('gameLive');
    startButton.disabled = true;
    pauseButton.disabled = false;
    pauseButton.textContent = 'Pause';
    difficulty.disabled = true;

    nextRound();
    startTimer();
    playAudio(clockAudio, true);
    updateHud('Find the matching target.');
  }

  function prepareBoard() {
    boxes.forEach((box, index) => {
      paintBox(box, palette[index % palette.length]);
      box.disabled = true;
    });

    randomizePositions();
  }

  function nextRound() {
    const shuffledColors = shuffle([...palette]);
    const targetBox = boxes[randomNumber(0, boxes.length - 1)];
    const targetColor = shuffledColors[randomNumber(0, shuffledColors.length - 1)];
    const decoyColors = shuffle(palette.filter((color) => color.name !== targetColor.name));
    const wordColor = decoyColors[randomNumber(0, decoyColors.length - 1)];

    state.targetColor = targetColor.name;

    boxes.forEach((box, index) => {
      paintBox(box, decoyColors[index % decoyColors.length]);
      box.disabled = false;
    });

    paintBox(targetBox, targetColor);

    const key = document.querySelector('.key');
    key.textContent = wordColor.name;
    key.style.color = targetColor.value;
    key.dataset.color = targetColor.name;

    randomizePositions();
    updateHud();
  }

  function paintBox(box, color) {
    box.style.backgroundColor = color.value;
    box.dataset.color = color.name;
    box.setAttribute('aria-label', `${color.name} target`);
  }

  function chooseBox(box) {
    if (!state.started || state.paused || state.ended) {
      return;
    }

    state.attempts++;

    if (box.dataset.color === state.targetColor) {
      state.round++;
      state.streak++;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.timeLeft += correctBonus;
      state.score += correctScore;
      pulseBox(box, 'hit');
      pulseStat('.timeCount', 'gain');
      pulseStat('.scoreCount', 'gain');
      showStatDelta('.timeCount', `+${correctBonus}`, 'gain');
      showStatDelta('.scoreCount', `+${correctScore}`, 'gain');
      playAudio(new Audio(assetUrl('audio/correct.mp3')));

      if (state.round >= totalRounds) {
        winGame();
        return;
      }

      nextRound();
      updateHud('Nice. Keep moving.');
      return;
    }

    state.streak = 0;
    state.timeLeft = Math.max(0, state.timeLeft - wrongPenalty);
    state.score = Math.max(0, state.score - wrongScorePenalty);
    pulseBox(box, 'miss');
    pulseStat('.timeCount', 'loss');
    pulseStat('.scoreCount', 'loss');
    showStatDelta('.timeCount', `-${wrongPenalty}`, 'loss');
    showStatDelta('.scoreCount', `-${wrongScorePenalty}`, 'loss');
    playAudio(new Audio(assetUrl('audio/wrong.mp3')));
    updateHud('Wrong color. Refocus.');

    if (state.timeLeft <= 0) {
      loseGame();
    }
  }

  function randomizePositions() {
    const visibleWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const arenaWidth = Math.min(playZone.clientWidth, visibleWidth || playZone.clientWidth);
    const arenaHeight = playZone.clientHeight;
    const placed = [];

    boxes.forEach((box) => {
      const size = box.offsetWidth;
      const position = findOpenSpot(arenaWidth, arenaHeight, size, placed);

      placed.push({
        x: position.left,
        y: position.top,
        size
      });

      box.style.left = `${position.left}px`;
      box.style.top = `${position.top}px`;
    });
  }

  function handleViewportChange() {
    window.setTimeout(() => {
      syncViewportHeight();
      randomizePositions();
    }, 80);
  }

  function syncViewportHeight() {
    const visualHeight = window.visualViewport && window.visualViewport.height;
    const height = visualHeight || window.innerHeight || document.documentElement.clientHeight;
    document.documentElement.style.setProperty('--app-height', `${Math.floor(height)}px`);
  }

  function findOpenSpot(arenaWidth, arenaHeight, size, placed) {
    const inset = 12;
    const rightInset = 72;
    const maxX = Math.max(inset, arenaWidth - size - inset);
    const safeMaxX = Math.max(inset, maxX - rightInset);
    const maxY = Math.max(inset, arenaHeight - size - inset);
    let candidate = { left: inset, top: inset };
    let attempts = 0;

    while (attempts < 80) {
      candidate = {
        left: randomNumber(inset, safeMaxX),
        top: randomNumber(inset, maxY)
      };

      if (!overlaps(candidate, size, placed)) {
        return candidate;
      }

      attempts++;
    }

    return candidate;
  }

  function overlaps(candidate, size, placed) {
    return placed.some((box) => {
      const buffer = 12;
      return candidate.left < box.x + box.size + buffer &&
        candidate.left + size + buffer > box.x &&
        candidate.top < box.y + box.size + buffer &&
        candidate.top + size + buffer > box.y;
    });
  }

  function startTimer() {
    clearInterval(intervalId);
    intervalId = setInterval(() => {
      if (state.paused || state.ended) {
        return;
      }

      state.timeLeft--;
      updateHud();

      if (state.timeLeft <= 0) {
        loseGame();
      }
    }, tickRate);
  }

  function togglePause() {
    if (!state.started || state.ended) {
      return;
    }

    state.paused = !state.paused;
    pauseButton.textContent = state.paused ? 'Resume' : 'Pause';
    playZone.classList.toggle('isPaused', state.paused);

    if (state.paused) {
      pauseAudio(clockAudio);
      updateHud('Paused');
      return;
    }

    playAudio(clockAudio, true);
    updateHud('Back in motion.');
  }

  function winGame() {
    finishGame(true);
    const finalScore = calculateFinalScore();
    saveHighScore(finalScore);
    playAudio(document.querySelector('#win'));
    showResult('You won', `Final score ${finalScore}. Accuracy ${accuracy()}%. Best streak ${state.bestStreak}.`);
  }

  function loseGame() {
    finishGame(false);
    playAudio(document.querySelector('#boo'));
    showResult('Time is up', `You cleared ${state.round} of ${totalRounds} rounds with ${accuracy()}% accuracy.`);
  }

  function finishGame(didWin) {
    state.ended = true;
    state.paused = false;
    clearInterval(intervalId);
    stopAudio(clockAudio);
    boxes.forEach((box) => {
      box.disabled = true;
    });
    pauseButton.disabled = true;
    playZone.classList.remove('isPaused');
    playZone.classList.toggle('gameWon', didWin);
    updateHud(didWin ? 'Finished.' : 'Out of time.');
  }

  function showResult(title, message) {
    document.querySelector('#resultTitle').textContent = title;
    document.querySelector('.resultMessage').textContent = message;
    document.querySelector('.resultOverlay').hidden = false;
  }

  function updateHud(message) {
    const progress = Math.min(totalRounds, state.round);
    const progressPercent = (progress / totalRounds) * 100;

    setStatText('.timeCount', Math.max(0, state.timeLeft));
    setStatText('.scoreCount', state.score);
    setStatText('.roundCount', `${progress} / ${totalRounds}`);
    setStatText('.streakCount', state.streak);
    document.querySelector('.statusText').textContent = message || 'Click the box matching the word color.';
    document.querySelector('.progressFill').style.width = `${progressPercent}%`;
  }

  function calculateFinalScore() {
    return state.score + Math.max(0, state.timeLeft);
  }

  function accuracy() {
    if (state.attempts === 0) {
      return 100;
    }

    return Math.round((state.round / state.attempts) * 100);
  }

  function getStartingTime() {
    return parseInt(difficulty.value, 10) || 300;
  }

  function getHighScore() {
    return parseInt(window.localStorage.getItem(storageKey), 10) || 0;
  }

  function saveHighScore(score) {
    if (score > getHighScore()) {
      window.localStorage.setItem(storageKey, score);
    }
  }

  function restartGame() {
    window.location.reload();
  }

  function toggleSound() {
    state.muted = !state.muted;
    window.localStorage.setItem(mutedStorageKey, String(state.muted));
    updateSoundToggle();

    if (state.muted) {
      stopAudio(clockAudio);
      return;
    }

    if (state.started && !state.paused && !state.ended) {
      playAudio(clockAudio, true);
    }
  }

  function updateSoundToggle() {
    soundToggle.setAttribute('aria-pressed', String(state.muted));
    soundToggle.setAttribute('aria-label', state.muted ? 'Turn sound on' : 'Mute sound');
    soundToggle.title = state.muted ? 'Turn sound on' : 'Mute sound';
  }

  function pulseBox(box, className) {
    box.classList.remove('hit', 'miss');
    window.setTimeout(() => {
      box.classList.add(className);
    }, 0);
  }

  function pulseStat(selector, className) {
    const stat = document.querySelector(selector);

    if (!stat) {
      return;
    }

    stat.classList.remove('gain', 'loss');
    window.setTimeout(() => {
      stat.classList.add(className);
    }, 0);
  }

  function showStatDelta(selector, text, className) {
    const statValue = document.querySelector(selector);

    if (!statValue) {
      return;
    }

    const delta = document.createElement('span');
    delta.className = `statDelta ${className}`;
    delta.textContent = text;
    statValue.appendChild(delta);

    window.setTimeout(() => {
      delta.remove();
    }, 1400);
  }

  function setStatText(selector, value) {
    const stat = document.querySelector(selector);
    const valueNode = stat && stat.querySelector('.statValue');

    if (valueNode) {
      valueNode.textContent = value;
      return;
    }

    if (stat) {
      stat.textContent = value;
    }
  }

  function shuffle(items) {
    for (let index = items.length - 1; index > 0; index--) {
      const swapIndex = randomNumber(0, index);
      const temp = items[index];
      items[index] = items[swapIndex];
      items[swapIndex] = temp;
    }

    return items;
  }

  function randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function playAudio(audio, loop) {
    if (!audio || state.muted) {
      return;
    }

    audio.loop = Boolean(loop);
    audio.currentTime = 0;
    audio.play().catch(() => undefined);
  }

  function pauseAudio(audio) {
    if (audio) {
      audio.pause();
    }
  }

  function stopAudio(audio) {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  function assetUrl(path) {
    return new URL(path, assetBase).href;
  }
})();
