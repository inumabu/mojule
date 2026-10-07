# 🏗️ アーキテクチャ

```text
Browser / CLI
     │ HTTP / SSE
     ▼
Express API ── shared validation / contracts
     ├── Auth + RBAC
     ├── Recipe runner ── Module registry ── LLM adapter
     ├── Job queue / Run history
     └── Atomic JSON stores（将来 SQL / Redis へ置換可能）
```

## 🧱 設計原則

- `shared/` を API と UI の契約の正本にする
- LLM 接続をアダプターとして分離し、デモモードを維持する
- 単一プロセスの JSON ストアを、将来の共有 DB / Redis に置換可能にする
- 認証、権限、入力検証は UI ではなく API を信頼境界とする
- 新しいモジュールは Manifest、入力ポート、出力ポート、ハンドラー、テストを一組で追加する
