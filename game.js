const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const wagerInput = document.getElementById('wager');
const balanceSpan = document.getElementById('balance');
const resetBtn = document.getElementById('resetBtn');

const rows = 8;
const startIndex = Math.floor(rows / 2); // center start
const verticalSpacing = canvas.height / (rows + 2);
const horizontalSpacing = canvas.width / (rows + 1);
const pegRadius = 5;
const ballRadius = 6;
const gravity = 0.25;
const maxHSpeed = 3;

let balance = 10000;
let ball = { x: 0, y: 0, vx: 0, vy: 0 };
let dropping = false;
let exiting = false;
let currentWager = 0;
const pegs = [];
const multipliers = [10, 5, 2, 1, 0.5, 1, 2, 5, 10];

for (let r = 0; r < rows; r++) {
  const offset = (rows - r) / 2;
  for (let c = 0; c <= r; c++) {
    const x = horizontalSpacing * (c + offset + 1);
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

function slotX(i) {
  return horizontalSpacing * (i + 1);
}

function laneCenter(i) {
  return horizontalSpacing * i + horizontalSpacing / 2;
}

function rowY(r) {
  return verticalSpacing * (r + 1);
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // draw pegs
  for (let r = 0; r < rows; r++) {
    const offset = (rows - r) / 2;
    for (let c = 0; c <= r; c++) {
      const x = horizontalSpacing * (c + offset + 1);
      const y = rowY(r);
      ctx.beginPath();
      ctx.arc(x, y, pegRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }
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
  ball = { x: laneCenter(startIndex), y: 10, vx: 0, vy: 0 };
  dropping = true;
  exiting = false;
}

function update() {
  if (dropping) {
    ball.vy += gravity;
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
          ball.vx *= 0.6;
          ball.vy *= 0.6;
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
      const lane = Math.max(0, Math.min(rows, Math.floor(ball.x / horizontalSpacing)));
      const multiplier = multipliers[lane];
      const payout = currentWager * multiplier;
      balance += payout;
      balanceSpan.textContent = balance.toFixed(2);
      if (multiplier >= 1) {
        playWin();
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
