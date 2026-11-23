# Ferrie Games

- `portal/`：come to play 遊戲大廳，使用原生 HTML、CSS 和 JavaScript。
- `games/2048/`：2048 的前端、Worker API、建置程式及資料庫遷移。
- 新遊戲放在 `games/<遊戲名稱>/`，發佈後在 `portal/games.js` 登記名稱、封面、遊戲網址和分類。一款遊戲可以有多個分類。

## 開發

入口頁可直接開啟 `portal/index.html` 預覽。

2048 以 Node.js 執行建置：

```sh
cd games/2048
node build.mjs
node --check dist/server/index.js
```

2048 的部署產物為 `dist/server/index.js`。Worker 需要名為 `DB` 的 D1 資料庫綁定，遷移檔在 `drizzle/`。現有部署的資料庫由原網站保管。
