# CCNA Ping-t風 完全学習プラットフォーム (CCNA Mastery Platform)

Cisco CCNA (200-301) の全641問（選択問題・ドラッグ＆ドロップ566問 + 実機シミュレーション75問）を完全収録した、Ping-t風の学習システムです。

`questions_fixed.json` を直接読み込み、**GitHub + Vercel** へ1クリックで公開・デプロイできるように設計されています。

---

## 🚀 主な機能・特徴

1. **直接データソース (`questions_fixed.json`) 採用**:
   - 構文エラーをすべて修正した検証済みデータ（641問）を `src/data/questions_fixed.json` から直接バンドル読み込み。
   - 外部データベース不要で超高速動作（オフライン対応・ゼロレイテンシ）。
2. **Ping-t風 3段階メダル学習システム**:
   - **未出題**: グレー
   - **銅メダル (Bronze)**: 1回正解
   - **銀メダル (Silver)**: 1回正解（累計）
   - **金メダル (Gold)**: 2回連続正解（完全習得）
   - 間違えると銅メダルに戻る厳格な定着メカニズム。
3. **Cisco IOS CLIシミュレーション実機演習 (75問)**:
   - ルータ・スイッチのプロンプト (`Router>`, `Router#`, `Router(config)#`, `Switch(config-if)#`) を忠実に再現。
   - `show ip route`, `show vlan brief`, `show ip interface brief`, `ping` などの検証コマンドと自動判定。
4. **CCNA 6大ドメイン & 収録PDF別ドリル**:
   - ネットワーク基礎、ネットワークアクセス、IP接続性、IPサービス、セキュリティ基礎、自動化とプログラマビリティの分野別演習。
   - 元のPDFパート別（Part 11〜16、シミュレーション演習）の集中ドリル。
5. **本番形式 模擬試験モード (Mock Exam)**:
   - 制限時間90分・全60問のランダム出題。
   - 得点率（合格基準 825/1000点相当・82.5%以上）判定と詳細な解説レビュー。
6. **検索・ブックマーク・ミス問題復習・ノート機能**:
   - コマンド出力や解説文も含めたインクリメンタル全文検索。
   - 苦手な問題へのオリジナル学習メモ保存。
7. **JSONエクスポート/インポート**:
   - `questions_fixed.json` のダウンロード。
   - 学習履歴（メダル、正答数、ブックマーク、メモ）を含む完全バックアップ・リストア。

---

## 🛠 GitHub へのプッシュ手順

```bash
# 1. ローカルリポジトリの初期化
git init

# 2. ファイルをステージング
git add .

# 3. コミットを作成
git commit -m "feat: complete CCNA learning platform with questions_fixed.json"

# 4. メインブランチに切り替え
git branch -M main

# 5. GitHub リポジトリをリモートに追加（URLをご自身のリポジトリに変更してください）
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY_NAME>.git

# 6. GitHub へプッシュ
git push -u origin main
```

---

## ☁️ Vercel での公開・デプロイ手順

本プロジェクトは **Vercel** へのデプロイに最適化されています（`vercel.json` 付属）。

### 手順（約1分で完了）:

1. [Vercel](https://vercel.com) にログインします。
2. **「Add New...」** > **「Project」** を選択します。
3. 先ほどプッシュした GitHub リポジトリを選択（Import）します。
4. プロジェクト設定が表示されます（自動検出されます）:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. 環境変数の設定は**不要**です（すべてフロントエンドで完結して動作します）。
6. **「Deploy」** ボタンをクリックします。

数秒〜十数秒でビルドが完了し、公開URL（`https://<project-name>.vercel.app`）が発行されます！

---

## 📁 プロジェクト構成

```
├── public/
│   ├── questions_fixed.json     # 静的ダウンロード用JSONファイル (641問)
│   └── questions.json           # 静的ダウンロード用予備
├── src/
│   ├── data/
│   │   ├── questions_fixed.json # アプリが直接インポートする全641問データ
│   │   ├── database_manifest.json
│   │   └── index.ts             # データ読み込み・カテゴリ/パート集計定義
│   ├── types/
│   │   └── question.ts          # QuestionItem, UserProgressRecord 等の型定義
│   ├── hooks/
│   │   └── useStudyState.ts     # 学習進捗、LocalStorage、エクスポート/インポート
│   ├── components/
│   │   ├── Dashboard.tsx        # メインダッシュボード & メダル進捗画面
│   │   ├── Header.tsx           # ナビゲーションバー & JSONダウンロード
│   │   ├── QuestionCard.tsx     # 選択・D&D問題カード (Ping-t風)
│   │   ├── SimulationSandbox.tsx# Cisco IOS CLIシミュレータ
│   │   ├── MockExamView.tsx     # 模擬試験モード
│   │   ├── SearchModal.tsx      # 全文検索モーダル
│   │   └── DataManagementModal.tsx # データ管理・エクスポート/インポート
│   ├── App.tsx                  # メインアプリケーションコンポーネント
│   └── main.tsx
├── vercel.json                  # Vercel SPAルーティング・キャッシュヘッダー設定
├── package.json
└── vite.config.ts
```

---

## 💻 ローカル開発環境の起動

```bash
# 依存パッケージのインストール
npm install

# 開発サーバー起動 (http://localhost:3000)
npm run dev

# プロダクションビルド検証
npm run build

# 型チェック
npm run lint
```
