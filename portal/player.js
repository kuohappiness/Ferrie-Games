// Profiles and points are local to this browser. Games on the same origin share them.
const lobbyPlayer = (() => {
  const key = 'come-to-play:profiles';
  const blank = () => ({ recent: [], scores: {}, completed: [], owned: [], theme: '' });
  const get = name => {
    try { return localStorage.getItem(name); } catch { return null; }
  };
  function read() {
    try {
      const saved = JSON.parse(get(key));
      if (saved?.players?.guest && saved.players[saved.active]) return saved;
    } catch {
      // Fall back to a fresh guest profile.
    }
    const guest = { name: '訪客', ...blank() };
    const previous = get('come-to-play:recent');
    if (previous) guest.recent.push(previous);
    return { active: 'guest', players: { guest } };
  }
  function change(update) {
    const data = read();
    update(data, data.players[data.active]);
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }
  const items = [
    { id: 'mint', name: '薄荷綠', price: 1 },
    { id: 'peach', name: '蜜桃橘', price: 2 },
  ];
  const points = player => player.completed.length -
    items.filter(item => player.owned.includes(item.id)).reduce((sum, item) => sum + item.price, 0);

  return {
    read, points, items,
    create(name) {
      return change(data => {
        const id = crypto.randomUUID();
        data.players[id] = { name, ...blank() };
        data.active = id;
      });
    },
    select(id) {
      return change(data => { if (Object.hasOwn(data.players, id)) data.active = id; });
    },
    visit(id) {
      return change((data, player) => {
        player.recent = [id, ...player.recent.filter(previous => previous !== id)].slice(0, 8);
      });
    },
    complete(id, round, seconds, playerId) {
      return change((data, active) => {
        const player = data.players[playerId] ?? active;
        const achievement = id + ':' + round;
        if (!player.completed.includes(achievement)) player.completed.push(achievement);
        if (Number.isFinite(seconds)) {
          player.scores[achievement] = Math.min(player.scores[achievement] ?? Infinity, seconds);
        } else {
          player.scores[id] = (player.scores[id] ?? 0) + 1;
        }
      });
    },
    useTheme(id) {
      const item = items.find(option => option.id === id);
      return change((data, player) => {
        if (!item) {
          player.theme = '';
          return;
        }
        if (!player.owned.includes(id)) {
          if (points(player) < item.price) return;
          player.owned.push(id);
        }
        player.theme = id;
      });
    },
  };
})();
