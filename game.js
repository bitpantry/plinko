const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const wagerInput = document.getElementById('wager');
const balanceSpan = document.getElementById('balance');
const resetBtn = document.getElementById('resetBtn');
const boardContainer = document.getElementById('boardContainer');
const confettiCanvas = document.getElementById('confetti');
const confettiCtx = confettiCanvas.getContext('2d');

// fewer rows to reduce peg density
const rows = 8;
const startIndex = Math.floor(rows / 2); // center start
const verticalSpacing = canvas.height / (rows + 2);
const laneSpacing = canvas.width / (rows + 1);
const pegSpacing = laneSpacing * 1.2; // slightly wider peg layout
const pegRadius = 5;
const ballRadius = 6;
const baseGravity = 0.25;
let currentGravity = baseGravity;
const maxHSpeed = 3;
// Heavy steel ball and dampened pins means very little bounce
const bounceDamping = 0.5; // slightly more bounce off the pins

let balance = 10000;
let ball = { x: 0, y: 0, vx: 0, vy: 0 };
let dropping = false;
let exiting = false;
let currentWager = 0;
const confettiPieces = [];
let celebrating = false;
const pegs = [];
const multipliers = [5, 3, 1.5, 1, 0.5, 1, 1.5, 3, 5];

for (let r = 0; r < rows; r++) {
  const rowWidth = r * pegSpacing;
  const startX = (canvas.width - rowWidth) / 2;
  for (let c = 0; c <= r; c++) {
    const x = startX + c * pegSpacing;
    const y = rowY(r);
    pegs.push({ x, y });
  }
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, duration, type='sine') {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playPlink() {
  playTone(600 + Math.random() * 200, 0.1, 'triangle');
}

function playSequence(notes, duration, gap, type) {
  notes.forEach((n, i) => {
    setTimeout(() => playTone(n, duration, type), i * (duration + gap));
  });
}

function playWin() {
  playSequence([880, 988, 1047, 1175], 0.15, 0.05, 'square');
}

function playLose() {
  playSequence([220, 196, 174, 164], 0.2, 0.05, 'sawtooth');
}

function startCelebration() {
  celebrating = true;
  boardContainer.classList.add('win');
  confettiPieces.length = 0;
  for (let i = 0; i < 100; i++) {
    confettiPieces.push({
      x: Math.random() * confettiCanvas.width,
      y: -Math.random() * 50,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 3 + 2,
      size: Math.random() * 4 + 2,
      color: `hsl(${Math.random() * 360},100%,50%)`,
      life: 120
    });
  }
}

function updateConfetti() {
  if (!celebrating) return;
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettiPieces.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.life--;
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(p.x, p.y, p.size, p.size);
  });
  for (let i = confettiPieces.length - 1; i >= 0; i--) {
    if (confettiPieces[i].life <= 0 || confettiPieces[i].y > confettiCanvas.height) {
      confettiPieces.splice(i, 1);
    }
  }
  if (confettiPieces.length === 0) {
    celebrating = false;
    boardContainer.classList.remove('win');
  }
}

function slotX(i) {
  return laneSpacing * (i + 1);
}

function laneCenter(i) {
  return laneSpacing * i + laneSpacing / 2;
}

function rowY(r) {
  return verticalSpacing * (r + 1);
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // draw pegs
  pegs.forEach((peg) => {
    ctx.beginPath();
    ctx.arc(peg.x, peg.y, pegRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  });
  // draw slot lines
  ctx.strokeStyle = '#555';
  for (let i = 0; i <= rows; i++) {
    const x = slotX(i);
    ctx.beginPath();
    ctx.moveTo(x, rowY(rows));
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.stroke();

  // lane multipliers
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = '12px Arial';
  multipliers.forEach((m, i) => {
    const x = laneCenter(i);
    ctx.fillText(m + 'x', x, canvas.height - 5);
  });

  // draw ball
  if (dropping) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0f0';
    ctx.fill();
  }
}

function resetGame() {
  balance = 10000;
  balanceSpan.textContent = balance.toFixed(2);
  dropping = false;
  exiting = false;
  celebrating = false;
  confettiPieces.length = 0;
  boardContainer.classList.remove('win');
  ball = { x: laneCenter(startIndex), y: 10, vx: 0, vy: 0 };
  drawBoard();
}

function startDrop() {
  if (dropping) return;
  const wager = parseFloat(wagerInput.value);
  if (isNaN(wager) || wager <= 0) {
    alert('Enter a valid wager');
    return;
  }
  if (wager > balance) {
    alert('Insufficient balance');
    return;
  }
  currentWager = wager;
  balance -= wager; // take the bet
  balanceSpan.textContent = balance.toFixed(2);
  // slight randomization for drop position and speed
  const offset = (Math.random() - 0.5) * laneSpacing * 0.4;
  const initialVX = (Math.random() - 0.5) * 1;
  ball = {
    x: laneCenter(startIndex) + offset,
    y: 10,
    vx: initialVX,
    vy: 0
  };
  currentGravity = baseGravity * (1 + (Math.random() - 0.5) * 0.1);
  dropping = true;
  exiting = false;
}

function update() {
  if (dropping) {
    ball.vy += currentGravity;
    ball.x += ball.vx;
    ball.y += ball.vy;

    // collide with pegs
    for (const peg of pegs) {
      const dx = ball.x - peg.x;
      const dy = ball.y - peg.y;
      const dist = Math.hypot(dx, dy);
      const minDist = ballRadius + pegRadius;
      if (dist < minDist) {
        const nx = dx / dist;
        const ny = dy / dist;
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx -= 2 * dot * nx;
          ball.vy -= 2 * dot * ny;
          // dampen the bounce significantly
          ball.vx *= bounceDamping;
          ball.vy *= bounceDamping;
          if (Math.abs(ball.vx) < 0.05) {
            ball.vx += (Math.random() < 0.5 ? -1 : 1) * 0.2;
          }
          ball.x = peg.x + nx * minDist;
          ball.y = peg.y + ny * minDist;
          playPlink();
        }
      }
    }

    // keep inside board
    if (ball.x < ballRadius) {
      ball.x = ballRadius;
      ball.vx = Math.abs(ball.vx) * 0.5;
    } else if (ball.x > canvas.width - ballRadius) {
      ball.x = canvas.width - ballRadius;
      ball.vx = -Math.abs(ball.vx) * 0.5;
    }
    ball.vx = Math.max(-maxHSpeed, Math.min(maxHSpeed, ball.vx));

    // check bottom
    if (ball.y + ballRadius >= canvas.height) {
      ball.y = canvas.height - ballRadius;
      const lane = Math.max(0, Math.min(rows, Math.floor(ball.x / laneSpacing)));
      const multiplier = multipliers[lane];
      const payout = currentWager * multiplier;
      balance += payout;
      balanceSpan.textContent = balance.toFixed(2);
      if (multiplier >= 1) {
        playWin();
        startCelebration();
      } else {
        playLose();
      }
      dropping = false;
      exiting = true;
      ball.vy = 5;
    }
  }
  if (exiting) {
    ball.y += ball.vy;
    if (ball.y - ballRadius > canvas.height) {
      exiting = false;
    }
  }
  drawBoard();
  updateConfetti();
  requestAnimationFrame(update);
}

resetBtn.addEventListener('click', resetGame);

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    startDrop();
  }
});

resetGame();
update();
