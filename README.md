# Ferrie Games

- `portal/`：遊戲入口網站，使用原生 HTML/CSS。
- `games/2048/`：2048 的前端、Worker API、建置程式及資料庫遷移。
- 新遊戲放在 `games/<遊戲名稱>/`，發佈後在 `portal/index.html` 加入卡片和遊戲網址。

## 開發

入口頁可直接開啟 `portal/index.html` 預覽。

2048 以 Node.js 執行建置：

```sh
cd games/2048
node build.mjs
node --check dist/server/index.js
```

2048 的部署產物為 `dist/server/index.js`。Worker 需要名為 `DB` 的 D1 資料庫綁定，遷移檔在 `drizzle/`。現有部署的資料庫由原網站保管。
