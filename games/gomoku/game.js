const size = 15;
const board = document.querySelector('#board');
const turn = document.querySelector('#turn');
const positions = new Uint8Array(size * size);
const cells = [];
const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
const sides = ['', '黑棋', '白棋'];
let player = 1;
let moves = 0;
let finished = false;
let focusIndex = 112;
let profile = lobbyPlayer.read().active;
lobbyPlayer.visit('gomoku');

function label(index) {
  return `第 ${Math.floor(index / size) + 1} 列，第 ${index % size + 1} 行，${sides[positions[index]] || '空位'}`;
}

function setFocus(index) {
  cells[focusIndex].tabIndex = -1;
  focusIndex = index;
  cells[index].tabIndex = 0;
}

function winningCells(index) {
  const row = Math.floor(index / size);
  const column = index % size;
  const wins = new Set();
  for (const [dx, dy] of directions) {
    const line = [index];
    for (const sign of [-1, 1]) {
      let x = column + dx * sign;
      let y = row + dy * sign;
      while (x >= 0 && x < size && y >= 0 && y < size && positions[y * size + x] === player) {
        line.push(y * size + x);
        x += dx * sign;
        y += dy * sign;
      }
    }
    if (line.length >= 5) for (const member of line) wins.add(member);
  }
  return wins;
}

function play(index) {
  if (finished || positions[index]) return;
  positions[index] = player;
  moves++;
  const cell = cells[index];
  cell.dataset.stone = player;
  cell.setAttribute('aria-label', label(index));
  setFocus(index);
  const winning = winningCells(index);
  if (winning.size || moves === positions.length) {
    finished = true;
    for (const member of winning) cells[member].dataset.win = '';
    turn.textContent = winning.size ? sides[player] + '獲勝！' : '平局';
    lobbyPlayer.complete('gomoku', 'first', undefined, profile);
    return;
  }
  player = 3 - player;
  turn.textContent = '輪到' + sides[player];
}

for (let index = 0; index < positions.length; index++) {
  const cell = document.createElement('button');
  cell.className = 'cell';
  cell.type = 'button';
  cell.tabIndex = index === focusIndex ? 0 : -1;
  cell.setAttribute('aria-label', label(index));
  cell.addEventListener('click', () => play(index));
  cells.push(cell);
}
board.append(...cells);
board.addEventListener('keydown', event => {
  const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (!arrow) return;
  event.preventDefault();
  const [dx, dy] = arrow;
  const x = Math.max(0, Math.min(size - 1, focusIndex % size + dx));
  const y = Math.max(0, Math.min(size - 1, Math.floor(focusIndex / size) + dy));
  setFocus(y * size + x);
  cells[focusIndex].focus();
});
document.querySelector('#reset').addEventListener('click', () => {
  positions.fill(0);
  for (const [index, cell] of cells.entries()) {
    delete cell.dataset.stone;
    delete cell.dataset.win;
    cell.setAttribute('aria-label', label(index));
  }
  finished = false;
  player = 1;
  moves = 0;
  profile = lobbyPlayer.read().active;
  setFocus(112);
  turn.textContent = '輪到黑棋';
});
