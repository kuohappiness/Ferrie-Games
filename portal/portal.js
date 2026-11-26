const sidebar = document.querySelector('#sidebar');
const query = document.querySelector('#query');
const menu = document.querySelector('#menu');
const hero = document.querySelector('.hero');
const catalog = document.querySelector('#catalog');
const recent = document.querySelector('#recent');
const roadmap = document.querySelector('#roadmap');
const preferences = document.querySelector('#preferences');
const theme = document.querySelector('#theme');
const mobile = matchMedia('(max-width: 760px)');
const categoryOptions = [{ id: 'all', name: '全部遊戲', icon: '▦' }, ...categories];

function readSetting(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Search and gameplay links also work when storage is unavailable.
  }
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}

function categoryLink(category, className = '') {
  const link = element('a', className, category.name);
  link.href = category.id === 'all' ? '#all' : '#' + category.id;
  return link;
}

function selectedCategory() {
  return categoryOptions.find(category => '#' + category.id === location.hash) ?? categoryOptions[0];
}

function card(game) {
  const link = element('a', 'game');
  link.href = game.url;
  link.dataset.game = game.id;
  const cover = element('div', 'cover');
  cover.setAttribute('aria-hidden', 'true');
  for (const tile of game.cover) cover.append(element('span', '', tile));
  const details = element('div', 'details');
  details.append(element('h3', '', game.name), element('p', '', game.description));
  link.append(cover, details);
  return link;
}

function showGames(container, title, items) {
  const heading = element('div', 'section-heading');
  heading.append(element('h2', '', title));
  container.append(heading);
  if (!items.length) {
    container.append(element('p', 'empty', query.value.trim() ? '沒有符合的遊戲。' : '這個分類的遊戲還在準備中。'));
    const plan = roadmap.querySelector('a[href="#' + selectedCategory().id + '"] p');
    if (!query.value.trim() && plan) container.append(element('p', 'category-plan', plan.textContent));
    return;
  }
  const grid = element('div', 'grid');
  grid.append(...items.map(card));
  container.append(grid);
}

function render() {
  const active = selectedCategory();
  const term = query.value.trim().toLowerCase();
  const isHome = active.id === 'all' && !term;
  hero.hidden = !isHome;
  roadmap.hidden = !isHome;
  for (const anchor of sidebar.querySelectorAll('a')) {
    if (anchor.hash === '#' + active.id) anchor.setAttribute('aria-current', 'page');
    else anchor.removeAttribute('aria-current');
  }

  const { active: playerId, players } = lobbyPlayer.read();
  const history = players[playerId].recent;
  const played = history.map(id => games.find(game => game.id === id)).filter(Boolean);
  applyShopTheme(players[playerId]);
  recent.hidden = !isHome;
  recent.replaceChildren();
  if (isHome) {
    if (played.length) showGames(recent, '再玩一次', played.slice(0, 4));
    else recent.append(element('h2', 'section-heading', '再玩一次'),
      element('p', 'empty', '玩過的遊戲會顯示在這裡。'));
  }

  catalog.replaceChildren();
  if (isHome) {
    showGames(catalog, '所有遊戲', games);
    return;
  }
  const matching = games.filter(game => {
    const inCategory = active.id === 'all' || game.categories.includes(active.id);
    const names = [game.name, ...game.keywords, ...categories.filter(category => game.categories.includes(category.id)).map(category => category.name)];
    return inCategory && names.some(name => name.toLowerCase().includes(term));
  });
  showGames(catalog, term ? '搜尋結果' : active.name, matching);
}

function setMenu(open) {
  sidebar.hidden = !open;
  menu.setAttribute('aria-expanded', String(open));
}

for (const category of categoryOptions) {
  const link = categoryLink(category);
  const icon = element('span', 'nav-icon', category.icon);
  icon.setAttribute('aria-hidden', 'true');
  link.prepend(icon);
  sidebar.append(link);
}

menu.addEventListener('click', () => setMenu(sidebar.hidden));
mobile.addEventListener('change', () => setMenu(!mobile.matches));
sidebar.addEventListener('click', event => {
  if (!event.target.closest('a')) return;
  query.value = '';
  if (mobile.matches) setMenu(false);
  if (location.hash === event.target.closest('a').hash) render();
});
document.querySelector('.roadmap-link').addEventListener('click', () => {
  query.value = '';
  if (mobile.matches) setMenu(false);
  if (location.hash === '#roadmap') {
    render();
    roadmap.scrollIntoView();
  }
});
window.addEventListener('hashchange', () => {
  render();
  if (location.hash === '#roadmap') roadmap.scrollIntoView();
  else if (location.hash) window.scrollTo(0, 0);
});
window.addEventListener('pageshow', render);
query.addEventListener('input', render);
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-game]');
  if (link) lobbyPlayer.visit(link.dataset.game);
});
document.querySelector('#settings').addEventListener('click', () => preferences.showModal());
theme.value = readSetting('come-to-play:theme') ?? 'light';
if (!theme.value) theme.value = 'light';
document.documentElement.dataset.theme = theme.value;
theme.addEventListener('change', () => {
  document.documentElement.dataset.theme = theme.value;
  writeSetting('come-to-play:theme', theme.value);
});
function applyShopTheme(player) {
  document.documentElement.dataset.shopTheme = player.theme;
}

setMenu(!mobile.matches);
render();

const panel = document.querySelector('#player-panel');
const panelTitle = document.querySelector('#player-title');
const panelContent = document.querySelector('#player-content');
const feedback = document.querySelector('#player-feedback');
const panelTitles = { account: '帳號', records: '遊戲紀錄', shop: '商城' };

function savePanel(success, type) {
  if (success) {
    render();
    showPanel(type);
  } else feedback.textContent = '此瀏覽器無法儲存變更。';
}

function accountPanel(data) {
  const help = element('p', 'panel-note', '大廳的玩家檔案儲存在這台裝置。你可以切換玩家，各自保存紀錄與外觀。');
  const select = element('select');
  select.setAttribute('aria-label', '目前玩家');
  for (const [id, player] of Object.entries(data.players)) select.add(new Option(player.name, id));
  select.value = data.active;
  select.addEventListener('change', () => savePanel(lobbyPlayer.select(select.value), 'account'));

  const form = element('form', 'profile-create');
  const name = element('input');
  name.placeholder = '玩家暱稱';
  name.setAttribute('aria-label', '新玩家暱稱');
  name.maxLength = 20;
  name.required = true;
  const add = element('button', 'play', '建立玩家');
  form.append(name, add);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const nickname = name.value.trim();
    if (!nickname) {
      feedback.textContent = '請輸入玩家暱稱。';
      return;
    }
    if (Object.values(data.players).some(player => player.name === nickname)) {
      feedback.textContent = '這個暱稱已經有玩家使用。';
      return;
    }
    savePanel(lobbyPlayer.create(nickname), 'account');
  });
  const signIn = element('a', 'panel-link', '前往 2048 的登入與好友功能');
  signIn.href = games.find(game => game.id === '2048').url;
  panelContent.append(help, select, form, signIn);
}

function recordsPanel(player) {
  panelContent.append(element('p', 'panel-note', player.name + '的本機紀錄'));
  const list = element('ul', 'record-list');
  const labels = { 'rolling-ball:0': '薄荷天橋', 'rolling-ball:1': '日落迴廊', gomoku: '五子棋完局', 'taipei-drive': '台北街頭送達' };
  for (const [key, label] of Object.entries(labels)) {
    const score = player.scores[key];
    if (typeof score === 'number') list.append(element('li', '', label + ' · ' +
      (key === 'gomoku' ? score + ' 局' : key === 'taipei-drive' ? score + ' 趟' : score.toFixed(2) + ' 秒')));
  }
  if (!list.childElementCount) list.append(element('li', '', '完賽、下完一局棋或完成送貨後，就會顯示紀錄。'));
  const signIn = element('a', 'panel-link', '到 2048 查看最高分與排行榜');
  signIn.href = games.find(game => game.id === '2048').url;
  panelContent.append(list, signIn);
}

function shopPanel(player) {
  const balance = lobbyPlayer.points(player);
  panelContent.append(
    element('p', 'balance', '遊戲點數 ' + balance),
    element('p', 'panel-note', '首次完成滾球關卡、完成一局五子棋或送達一處目的地，各得 1 點，可兌換大廳配色。'),
  );
  for (const { id, name, price } of [{ id: '', name: '預設配色', price: 0 }, ...lobbyPlayer.items]) {
    const current = id === player.theme;
    const owned = !id || player.owned.includes(id);
    const row = element('div', 'shop-row');
    row.append(element('span', '', name));
    const button = element('button', 'play', current ? '使用中' : owned ? '套用' : price + ' 點兌換');
    button.disabled = current || (!owned && balance < price);
    if (!owned && balance < price) button.textContent = '需要 ' + price + ' 點';
    button.addEventListener('click', () => savePanel(lobbyPlayer.useTheme(id), 'shop'));
    row.append(button);
    panelContent.append(row);
  }
}

function showPanel(type) {
  const data = lobbyPlayer.read();
  const player = data.players[data.active];
  panelTitle.textContent = panelTitles[type];
  panelContent.replaceChildren();
  feedback.textContent = '';
  if (type === 'account') accountPanel(data);
  if (type === 'records') recordsPanel(player);
  if (type === 'shop') shopPanel(player);
  if (!panel.open) panel.showModal();
}

document.querySelectorAll('[data-panel]').forEach(button => {
  button.addEventListener('click', () => showPanel(button.dataset.panel));
});
