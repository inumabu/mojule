# 🚀 リリース手順

1. `CHANGELOG.md` と `package.json` のバージョンを確認します。
2. `pnpm install --frozen-lockfile` を実行します。
3. `pnpm check && pnpm test && pnpm build` を実行します。
4. `.env`、認証設定、永続ストアの場所を確認します。
5. 非 root コンテナと `/api/health` を確認します。
6. リリース後に匿名モード、認証モード、レシピ実行、ジョブ API を確認します。

`data/recipes.json`、実行履歴、ジョブ状態のバックアップ方針をデプロイ環境ごとに記録してください。
