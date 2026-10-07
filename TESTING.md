# 🧪 テスト方針

## ✅ 必須チェック

- `pnpm check`: TypeScript 型検査
- `pnpm test`: Node スモークテスト
- `pnpm build`: Vite と Express バンドル

## 🔍 重点境界

- レシピのノード数、ID、ポート接続の検証
- API キーのハッシュ保存と再表示不可
- `AUTH_REQUIRED=true` の認証・RBAC
- ジョブの `queued` / `running` / `completed` / `failed` / `cancelled`
- LLM 無効時のローカルデモ動作
- 1MB リクエスト、12,000 文字、毎分レート制限

## 🔜 次の強化

- API 契約テスト
- ブラウザ E2E
- 共有ストアを使った複数ワーカーのジョブテスト
