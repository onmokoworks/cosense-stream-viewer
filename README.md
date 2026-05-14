# Cosense Stream TL

複数のCosense（Scrapbox）プロジェクトの更新を一つのタイムラインで閲覧できるビューアです。

## 機能

- 複数プロジェクトのページ更新を時系列で表示
- 各ページの更新から30分以内の行のみ表示
- 自動更新（30秒/1分/3分/5分）
- プロジェクトごとのカラーラベル
- 一括編集パネル（プロジェクトIDの一括追加・置換）
- サイドバーの開閉
- サイドバーにD&Dでプロジェクト追加対応

## 使い方

1. サイドバーの入力欄にCosenseのプロジェクトIDを入力して追加
2. 「更新」ボタンでタイムラインを読み込み
3. 「自動更新」をオンにすると定期的に再読込

### プロジェクトIDの入力について

先頭に `/` が付いている場合や `[]` で囲まれている場合は自動的に除去されます。

例: `/my-project` `[my-project]` `[/my-project]` → すべて `my-project` として扱われる

## 開発

```sh
node server.js
```

http://localhost:3456 で起動。

https://cosense-stream-tl.pages.dev にデプロイされています。

## 構成

```
public/
  index.html   — HTML
  app.js       — フロントエンドロジック
  style.css    — スタイル
functions/api/stream/[project].js — Cloudflare Pages Function（APIプロキシ）
server.js     — ローカル開発サーバ
```
