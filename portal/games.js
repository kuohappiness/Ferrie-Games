const categories = [
  { id: 'puzzle', name: '益智休閒', icon: '◆' },
  { id: 'board', name: '棋類對弈', icon: '棋' },
  { id: 'world', name: '開放世界', icon: '◈' },
  { id: 'action', name: '3D 槍戰', icon: '◎' },
  { id: 'blocks', name: '方塊世界', icon: '▦' },
  { id: 'driving', name: '開車與航海', icon: '⛵' },
  { id: 'challenge', name: '3D 挑戰', icon: '▲' },
];

const games = [
  {
    id: '2048',
    name: '2048',
    categories: ['puzzle'],
    keywords: ['數字', '合併', '方塊'],
    description: '合併相同數字，挑戰你的最高分。',
    url: 'https://kuo-2048.family-kuo.chatgpt.site/',
    cover: ['2', '4', '8', '2048'],
  },
  {
    id: 'rolling-ball',
    name: '浮空滾球',
    categories: ['challenge'],
    keywords: ['3D', '滾球', '窄橋', '手把'],
    description: '在浮空窄橋上控制小球，挑戰兩條賽道的最快時間。',
    url: '../games/rolling-ball/',
    cover: [],
  },
  {
    id: 'gomoku',
    name: '五子棋',
    categories: ['board'],
    keywords: ['雙人', '棋盤', '黑白棋'],
    description: '同一台裝置輪流下棋，率先連成五顆就獲勝。',
    url: '../games/gomoku/',
    cover: [],
  },
];
