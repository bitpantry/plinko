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

let balance = 10000;
let ball = { x: 0, y: 0, row: 0, index: startIndex };
let dropping = false;
let targetX = 0;
let targetY = 0;
let currentWager = 0;
const multipliers = [0, 0.5, 0.8, 1, 10, 1, 0.8, 0.5, 0];

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

function playWin() {
  playTone(800, 1, 'sine');
}

function playLose() {
  playTone(200, 0.8, 'sawtooth');
}

function slotX(i) {
  return horizontalSpacing * (i + 1);
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

  // draw ball
  if (dropping || ball.row > 0) {
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
  ball = { x: slotX(startIndex), y: 10, row: 0, index: startIndex };
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
  ball = { x: slotX(startIndex), y: 10, row: 0, index: startIndex };
  targetX = ball.x;
  targetY = rowY(0);
  dropping = true;
}

function update() {
  if (dropping) {
    const speed = 5;
    const dx = targetX - ball.x;
    const dy = targetY - ball.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < speed) {
      ball.x = targetX;
      ball.y = targetY;
      playPlink();
      ball.row++;
      if (ball.row > rows) {
        // landed in slot
        const multiplier = multipliers[ball.index];
        const payout = currentWager * multiplier;
        balance += payout;
        balanceSpan.textContent = balance.toFixed(2);
        if (multiplier > 1) {
          playWin();
        } else if (multiplier === 1) {
          playPlink();
        } else {
          playLose();
        }
        dropping = false;
      } else {
        // choose direction
        const dir = Math.random() < 0.5 ? -1 : 1;
        ball.index = Math.max(0, Math.min(rows, ball.index + dir));
        targetX = slotX(ball.index);
        targetY = rowY(ball.row);
      }
    } else {
      ball.x += (dx / dist) * speed;
      ball.y += (dy / dist) * speed;
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
