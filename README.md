# mojuleagent

**知識・機能・推論をモジュール化し、組み合わせでAIを設計する独立型エージェント。**

特定のプラットフォームや専用SDKに依存しない、最小構成のMVPです。

## 🚀 起動

```bash
pnpm install
cp .env.example .env
pnpm dev
```

`http://localhost:3000` を開いてください。`OPENAI_API_KEY`が空でもローカルデモモードで動作します。

## 🤖 LLM接続

OpenAI互換のHTTP APIを利用します。

```dotenv
MOJULE_LLM_ENABLED=true
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

キーはサーバー側だけで使用し、ブラウザへ送信しません。

LLM接続は明示的なオプトインです。キーが環境に存在するだけでは外部へ送信しません。

## 🧱 構成

- `server/index.ts`: Expressサーバー、`/api/health`と`/api/ask`
- `server/llm.ts`: OpenAI互換APIとローカルデモの切り替え
- `client/src/App.tsx`: モジュール一覧とレシピ実行UI
- `client/src/style.css`: UIデザイン

## 🧪 コマンド

```bash
pnpm dev
pnpm check
pnpm test
pnpm build
pnpm start
```

## 本番運用

本番では`pnpm build`後に`NODE_ENV=production pnpm start`を実行します。`GET /api/health`をロードバランサーのヘルスチェックに使用できます。APIは1リクエスト1MB、メッセージ12,000文字、レシピ24ノード、同一IPあたり毎分60回の制限を設けています。コンテナは非rootユーザーで実行されます。

## 設計

現在の標準レシピは次の直列構成です。

```text
input.message → ai.respond → output.markdown
```

今後、知識検索、検証、外部ツール、レシピ保存、GUIノード接続をモジュールとして追加します。

MIT License

## モジュール実行API

- `GET /api/modules`: 登録済みManifestと標準レシピを返す
- `POST /api/run`: `{ "message": "質問" }` を標準レシピで実行する
- `POST /api/ask`: 後方互換用の簡易エンドポイント

`server/modules.ts`のレジストリへManifestとハンドラーを追加することで、新しい知識・変換・ツールモジュールを組み込めます。各実行結果にはモジュールごとの入力、出力、実行時間が含まれます。

## レシピ保存API

- `GET /api/recipes`: 保存済みレシピ一覧
- `POST /api/recipes`: レシピを原子的なJSONストアへ保存
- `GET /api/recipes/:id`: レシピ取得
- `PUT /api/recipes/:id`: レシピ更新
- `DELETE /api/recipes/:id`: レシピ削除
- `POST /api/recipes/:id/run`: 保存済みレシピを実行
- `POST /api/recipes/validate`: 保存前にポート接続を検証

デフォルトの保存先は`data/recipes.json`です。別の永続ボリュームを使う場合は`RECIPES_FILE`で変更できます。将来のSQLストア移行を想定し、HTTP層とストア層を分離しています。

保存・実行前には、ノードID、登録済みモジュール、必須入力ポート、レシピ長を検証します。接続不備は`422 INVALID_RECIPE_CONNECTIONS`として返します。

ブラウザのRecipe Builderからもレシピ名を付けて保存でき、Saved Recipesから読み込めます。ノードの上下移動、削除、Marketplaceからの追加にも対応しています。

## 実行履歴API

- `GET /api/runs`: 最新100件の実行履歴
- `GET /api/runs?recipeId=my-recipe`: レシピ別履歴
- `GET /api/runs/:id`: 実行ID別の詳細（各ステップの入出力を含む）

保存先は`RUN_HISTORY_FILE`で変更できます。履歴はデフォルトで最新100件に制限します。

ブラウザのRun Historyから過去の実行を選択すると、実行ID、実行モード、各ステップの処理時間と出力を確認できます。

## 非同期ジョブAPI

- `POST /api/jobs`: レシピをバックグラウンド実行（`202`）
- `GET /api/jobs`: ジョブ一覧
- `GET /api/jobs/:id`: `queued`、`running`、`completed`、`failed`、`cancelled`を取得
- `GET /api/jobs/:id/events`: SSEで進捗イベントを購読
- `POST /api/jobs/:id/cancel`: キュー待ちジョブをキャンセル
- `POST /api/jobs/:id/retry`: 失敗または完了済みジョブを再実行

現在のジョブキューは単一プロセス向けです。複数ワーカーへ拡張する際は、`jobs.ts`のストアをRedisや共有DBへ置き換えます。

ジョブには`progress.percent`、`progress.stage`、`progress.message`が含まれます。失敗時は`INVALID_RECIPE`、`UPSTREAM_ERROR`、`CANCELLED`の構造化エラーを返します。

## ローカル認証

- `POST /api/auth/register`: ユーザーとワークスペースを作成
- `POST /api/auth/login`: セッションCookieを発行
- `POST /api/auth/logout`: セッションを破棄
- `GET /api/auth/me`: 現在のユーザーを取得
- `GET /api/workspace`: 現在のワークスペースと権限を取得

認証はデフォルトでは任意です。セルフホスト環境で保護を有効にする場合は`AUTH_REQUIRED=true`を設定すると、レシピ・実行履歴・ジョブAPIにログインが必要になります。パスワードは平文保存せず、scryptハッシュとHttpOnlyセッションCookieを使用します。

### ロール権限

`AUTH_REQUIRED=true`では、操作ごとに以下の権限を適用します。

| 操作 | owner | editor | viewer |
| --- | --- | --- | --- |
| レシピ閲覧・実行・履歴閲覧 | ○ | ○ | ○ |
| レシピ作成・編集 | ○ | ○ | × |
| レシピ削除 | ○ | × | × |

権限不足は`403 FORBIDDEN`、未ログインは`401 AUTH_REQUIRED`として返します。匿名デモモードでは既存互換性のためRBACを適用しません。

### メンバー管理API

- `GET /api/workspace/members`: メンバー一覧
- `POST /api/workspace/invitations`: ownerがeditor／viewerを招待
- `POST /api/auth/accept-invite`: 招待トークンを使って参加し、パスワードを設定
- `PATCH /api/workspace/members/:id`: ownerがロール変更
- `DELETE /api/workspace/members/:id`: ownerがメンバー削除

招待トークンの有効期限は7日です。現在はメール送信サービスを接続していないため、開発環境では招待APIのレスポンスにトークンを返します。本番ではメール配信アダプターへ置き換える前提です。

### APIキー

- `POST /api/workspace/api-keys`: ownerがキーを発行
- `GET /api/workspace/api-keys`: 発行済みキーのメタデータ一覧
- `DELETE /api/workspace/api-keys/:id`: ownerがキーを失効

発行時だけ表示されるキーを外部クライアントで次のように使用します。

```bash
curl -H "Authorization: Bearer mj_..." http://localhost:3000/api/workspace
```

保存されるのはSHA-256ハッシュのみで、一覧APIから生キーは再表示できません。キーを紛失した場合は失効して再発行してください。

## APIドキュメント

- `GET /api/openapi.json`: OpenAPI 3.1仕様
- `GET /api/docs`: ブラウザで確認できるエンドポイント一覧

OpenAPI仕様には、認証、RBAC、レシピ、実行履歴、非同期ジョブ、SSE進捗、メンバー、APIキーのエンドポイントを収録しています。CLIやSDK生成の入力として利用できます。

## レシピビルダー

画面のModule Registryからモジュールを「追加」すると、Recipe Builderへ実行順に追加されます。追加したノードは削除・初期化でき、`text.context`を含むレシピではコンテキストも編集できます。実行時には各ステップのモジュールIDと処理時間を確認できます。

## エコシステム

- [Marketplace](https://github.com/mojuleagent/mojule-marketplace): Manifestカタログと公開方針
- [CLI](https://github.com/mojuleagent/mojule-cli): `health`、`modules`、`run`コマンド
- [Sample Modules](https://github.com/mojuleagent/mojule-sample-modules): 要約、キーワード抽出、用語集コンテキスト

コアのMarketplace APIは`text.summarize`、`text.keyword-extract`、`knowledge.glossary`を実行可能なサンプルとして登録しています。

## 📚 開発管理文書

- [開発ガイド](DEVELOPMENT.md)
- [貢献ガイド](CONTRIBUTING.md)
- [テスト方針](TESTING.md)
- [セキュリティ](SECURITY.md)
- [アーキテクチャ](ARCHITECTURE.md)
- [リリース手順](RELEASE.md)
- [ロードマップ](ROADMAP.md)
- [変更履歴](CHANGELOG.md)


## 🧪 一括検証

テスト・Lint・セキュリティ監査・Buildをまとめて実行します。

```sh
pnpm verify
```
