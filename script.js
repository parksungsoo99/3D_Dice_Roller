document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const diceBoard = document.getElementById('dice-board');
  const diceCountInput = document.getElementById('dice-count');
  const btnDec = document.getElementById('btn-dec');
  const btnInc = document.getElementById('btn-inc');
  const rollButton = document.getElementById('roll-button');
  const colorDots = document.querySelectorAll('.color-dot');
  const soundToggle = document.getElementById('sound-toggle');
  
  // Stats Elements
  const statSum = document.getElementById('stat-sum');
  const statAvg = document.getElementById('stat-avg');
  const statTotalRolls = document.getElementById('stat-total-rolls');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history');

  // App State
  let diceCount = parseInt(diceCountInput.value);
  let isRolling = false;
  let totalRollsCount = 0;
  let diceColorTheme = 'neon-blue';
  
  // Color presets mapping
  const colorGlows = {
    'neon-blue': 'rgba(0, 242, 254, 0.35)',
    'neon-purple': 'rgba(157, 78, 221, 0.35)',
    'neon-pink': 'rgba(255, 0, 127, 0.35)',
    'neon-amber': 'rgba(255, 170, 0, 0.35)',
    'neon-emerald': 'rgba(0, 245, 212, 0.35)'
  };

  // 3D Rotations for each dice face (X, Y)
  const faceRotations = {
    1: { x: 0, y: 0 },
    6: { x: 180, y: 0 },
    2: { x: -90, y: 0 },
    5: { x: 90, y: 0 },
    3: { x: 0, y: -90 },
    4: { x: 0, y: 90 }
  };

  // Sound Synthesis (Web Audio API)
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playRollSound() {
    if (!soundToggle.checked) return;
    initAudio();
    if (!audioCtx) return;

    // Create noise source for roll/shake
    const bufferSize = audioCtx.sampleRate * 0.8; // 0.8 seconds
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    // Lowpass Filter for "shuffling" sound
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.6);

    // Envelope for shake sound
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.2);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.7);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    noise.start();

    // Play landing impact sound after 0.8s (end of roll animation)
    setTimeout(() => {
      if (soundToggle.checked) {
        playImpactSound();
      }
    }, 850);
  }

  function playImpactSound() {
    if (!audioCtx) return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  }

  // HTML template generator for a 3D Dice
  function createDiceHTML() {
    return `
      <div class="dice-wrapper">
        <div class="dice" style="transform: rotateX(0deg) rotateY(0deg);">
          <div class="face face-1">
            <div class="dot"></div>
          </div>
          <div class="face face-2">
            <div class="dot"></div>
            <div class="dot"></div>
          </div>
          <div class="face face-3">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
          </div>
          <div class="face face-4">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
          </div>
          <div class="face face-5">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
          </div>
          <div class="face face-6">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
          </div>
        </div>
      </div>
    `;
  }

  // Update Dice elements in the board
  function renderDiceBoard() {
    diceBoard.innerHTML = '';
    for (let i = 0; i < diceCount; i++) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = createDiceHTML();
      const diceElement = tempDiv.firstElementChild;
      
      // Setup click on individual dice to roll it independently if wanted
      diceElement.addEventListener('click', () => {
        if (!isRolling) {
          rollIndividualDice(diceElement.querySelector('.dice'));
        }
      });
      
      diceBoard.appendChild(diceElement);
    }
  }

  // Set active color theme
  function setTheme(colorThemeName) {
    diceColorTheme = colorThemeName;
    const colorValue = getComputedStyle(document.documentElement).getPropertyValue(`--${colorThemeName}`).trim();
    const glowValue = colorGlows[colorThemeName];

    document.documentElement.style.setProperty('--theme-color', colorValue);
    document.documentElement.style.setProperty('--theme-color-glow', glowValue);

    // Update active state in dots
    colorDots.forEach(dot => {
      if (dot.getAttribute('data-color') === colorThemeName) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  // Roll All Dice
  function rollAllDice() {
    if (isRolling) return;
    isRolling = true;
    rollButton.disabled = true;

    playRollSound();

    const diceElements = diceBoard.querySelectorAll('.dice');
    const results = [];

    diceElements.forEach((dice) => {
      // 1. Generate random target face (1-6)
      const targetFace = Math.floor(Math.random() * 6) + 1;
      results.push(targetFace);

      // 2. Clear rolling animations classes
      dice.classList.remove('rolling');
      void dice.offsetWidth; // Trigger reflow to restart animation

      // 3. Compute rotation animation target
      // Add multiple rotations (360 * random spins) for realistic tumble
      const spinsX = (Math.floor(Math.random() * 3) + 3) * 360; 
      const spinsY = (Math.floor(Math.random() * 3) + 3) * 360; 
      const baseRotation = faceRotations[targetFace];
      
      const targetX = baseRotation.x + spinsX;
      const targetY = baseRotation.y + spinsY;
      
      // Inline style variable for keyframe target
      dice.style.setProperty('--target-transform', `rotateX(${targetX}deg) rotateY(${targetY}deg)`);
      dice.classList.add('rolling');

      // Keep inline rotation state so it stays oriented after animation finishes
      setTimeout(() => {
        dice.style.transform = `rotateX(${baseRotation.x}deg) rotateY(${baseRotation.y}deg)`;
      }, 1200);
    });

    // Handle end of roll animation sequence
    setTimeout(() => {
      isRolling = false;
      rollButton.disabled = false;
      updateRollStats(results);
    }, 1200);
  }

  // Roll single/individual dice when clicked directly
  function rollIndividualDice(dice) {
    isRolling = true;
    playRollSound();

    const targetFace = Math.floor(Math.random() * 6) + 1;
    dice.classList.remove('rolling');
    void dice.offsetWidth;

    const spinsX = (Math.floor(Math.random() * 3) + 3) * 360; 
    const spinsY = (Math.floor(Math.random() * 3) + 3) * 360; 
    const baseRotation = faceRotations[targetFace];
    const targetX = baseRotation.x + spinsX;
    const targetY = baseRotation.y + spinsY;

    dice.style.setProperty('--target-transform', `rotateX(${targetX}deg) rotateY(${targetY}deg)`);
    dice.classList.add('rolling');

    setTimeout(() => {
      dice.style.transform = `rotateX(${baseRotation.x}deg) rotateY(${baseRotation.y}deg)`;
      isRolling = false;
      updateRollStats([targetFace]);
    }, 1200);
  }

  // Statistics and log calculation
  function updateRollStats(results) {
    totalRollsCount++;
    statTotalRolls.textContent = totalRollsCount;

    const sum = results.reduce((acc, curr) => acc + curr, 0);
    const avg = (sum / results.length).toFixed(1);

    statSum.textContent = sum;
    statAvg.textContent = avg;

    addHistoryItem(results, sum);
  }

  // Add roll item to history UI list
  function addHistoryItem(results, sum) {
    const emptyMsg = historyList.querySelector('.empty-message');
    if (emptyMsg) {
      emptyMsg.remove();
    }

    const time = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const li = document.createElement('li');
    li.className = 'history-item';

    const diceValuesHTML = results
      .map(val => `<span class="history-dice-val">${val}</span>`)
      .join('');

    li.innerHTML = `
      <div class="history-details">
        <div class="history-dice-values">${diceValuesHTML}</div>
        <span class="history-sum">(합계: ${sum})</span>
      </div>
      <span class="history-time">${time}</span>
    `;

    historyList.insertBefore(li, historyList.firstChild);

    // Keep history at maximum 10 items to prevent overflow
    if (historyList.children.length > 10) {
      historyList.lastElementChild.remove();
    }
  }

  // Controls Event Listeners
  btnDec.addEventListener('click', () => {
    if (diceCount > 1) {
      diceCount--;
      diceCountInput.value = diceCount;
      renderDiceBoard();
    }
  });

  btnInc.addEventListener('click', () => {
    if (diceCount < 6) {
      diceCount++;
      diceCountInput.value = diceCount;
      renderDiceBoard();
    }
  });

  rollButton.addEventListener('click', rollAllDice);

  // Keyboard shortcut (Space key to roll)
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      // Prevent screen scroll behavior
      e.preventDefault();
      rollAllDice();
    }
  });

  // Color picker events
  colorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      setTheme(dot.getAttribute('data-color'));
    });
  });

  // Clear History Event
  clearHistoryBtn.addEventListener('click', () => {
    historyList.innerHTML = '<li class="empty-message">아직 굴린 기록이 없습니다.</li>';
    statSum.textContent = '-';
    statAvg.textContent = '-';
    totalRollsCount = 0;
    statTotalRolls.textContent = '0';
  });

  // Initial setup
  renderDiceBoard();
  setTheme('neon-blue');
});
