const sidebar = document.querySelector('#sidebar');
const query = document.querySelector('#query');
const menu = document.querySelector('#menu');
const hero = document.querySelector('.hero');
const catalog = document.querySelector('#catalog');
const recent = document.querySelector('#recent');
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

function showGames(container, title, items, category) {
  const heading = element('div', 'section-heading');
  heading.append(element('h2', '', title));
  if (category) {
    const link = categoryLink(category, 'see-all');
    link.textContent = '看全部';
    link.setAttribute('aria-label', '看全部' + category.name);
    heading.append(link);
  }
  container.append(heading);
  if (!items.length) {
    container.append(element('p', 'empty', query.value.trim() ? '沒有符合的遊戲。' : '這個分類的遊戲還在準備中。'));
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
  for (const anchor of sidebar.querySelectorAll('a')) {
    if (anchor.hash === '#' + active.id) anchor.setAttribute('aria-current', 'page');
    else anchor.removeAttribute('aria-current');
  }

  const lastPlayed = games.find(game => game.id === readSetting('come-to-play:recent'));
  recent.hidden = !isHome || !lastPlayed;
  recent.replaceChildren();
  if (!recent.hidden) showGames(recent, '繼續玩', [lastPlayed]);

  catalog.replaceChildren();
  if (isHome) {
    for (const category of categories) {
      const items = games.filter(game => game.categories.includes(category.id));
      if (items.length) showGames(catalog, category.name, items.slice(0, 4), category);
    }
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
  render();
});
window.addEventListener('hashchange', render);
window.addEventListener('pageshow', render);
query.addEventListener('input', render);
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-game]');
  if (link) writeSetting('come-to-play:recent', link.dataset.game);
});
document.querySelector('#settings').addEventListener('click', () => preferences.showModal());
theme.value = readSetting('come-to-play:theme') ?? 'light';
if (!theme.value) theme.value = 'light';
document.documentElement.dataset.theme = theme.value;
theme.addEventListener('change', () => {
  document.documentElement.dataset.theme = theme.value;
  writeSetting('come-to-play:theme', theme.value);
});
setMenu(!mobile.matches);
render();
