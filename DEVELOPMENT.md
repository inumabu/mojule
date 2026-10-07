# 🛠️ 開発ガイド

## 🧭 構成

- `client/`: React + Vite の UI
- `server/`: Express API、認証、レシピ、ジョブ、LLM 接続
- `shared/`: クライアントとサーバーで共有する型・バリデーション
- `test/`: Node のスモークテスト

外部入力は Express の入口で検証し、LLM やファイルストアはサーバー側だけから利用します。

## 🚀 ローカル起動

```bash
pnpm install
cp .env.example .env
pnpm dev
```

PowerShell:

```powershell
pnpm install
Copy-Item .env.example .env
pnpm dev
```

## ✅ 変更時の確認

```bash
pnpm check
pnpm test
pnpm build
```

API、認証、レシピ、ジョブ、ファイル保存を変更した場合は、関連する構造化エラーと権限境界も確認してください。
