# デバッグログ実装完了報告

## 概要

クリック処理の論理を把握するため、詳細なデバッグログを4つの主要ファイルに追加しました。

## 変更されたファイル

### 1. **c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/game.js**

**関数:** `_handleCardClick` (行番号 997-1037)

**追加されたログ:**

1. **行 1001:** `Card Click:` - クリックイベントの基本情報
   - owner, zone, cardId, index
   - currentPhase, turnPlayer, isProcessing

2. **行 1013:** `BLOCKED: isProcessing = true` - 処理中のためブロック

3. **行 1019:** `BLOCKED: Player turn, CPU card clicked` - プレイヤーターン中にCPUカードをクリック

4. **行 1022:** `INFO: Info display allowed for CPU active/bench` - CPUのアクティブ/ベンチの情報表示許可

5. **行 1030:** `BLOCKED: CPU turn, Player card clicked` - CPUターン中にプレイヤーカードをクリック

6. **行 1036:** `ALLOWED: Click allowed, processing...` - クリックが許可され、処理開始

### 2. **c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/view.js**

**関数:** `_makeSlotClickable` (行番号 1755-1778)

**追加されたログ:**

1. **行 1762:** `SLOT CLICKED (view.js):` - スロットクリック情報
   - owner, zone, index
   - hasCard (カードの有無)
   - cardId

### 3. **c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/three/interaction.js**

**関数:** `_handleMouseDown` (行番号 159-182)

**追加されたログ:**

1. **行 169:** `THREE.JS MOUSE DOWN:` - 3Dオブジェクトとのマウスインタラクション
   - objectType, owner, isDraggable
   - currentPlayer

2. **行 180:** `DRAG BLOCKED: Wrong turn` - ターンが違うためドラッグブロック
   - owner, currentPlayer

### 4. **c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/view/board-event-handler.js**

**既存のログ (変更なし):**

- 行 41: `BoardEventHandler: click received`
- 行 44: `BoardEventHandler: disabled, ignoring`
- 行 50: `BoardEventHandler: found slot?`
- 行 53: `BoardEventHandler: no card-slot found in target chain`
- 行 62: `BoardEventHandler: clickInfo`

## ログのフロー

```
ユーザーがカードをクリック
    ↓
[BoardEventHandler._handleClick]
    - "click received"
    - "found slot?"
    - "clickInfo"
    ↓
[View._makeSlotClickable イベントリスナー]
    - "SLOT CLICKED (view.js):"
    ↓
[Game._handleCardClick]
    - "Card Click:" (初期情報)
    - 検証チェック:
      - "BLOCKED: isProcessing = true" または
      - "BLOCKED: Player turn, CPU card clicked" または
      - "INFO: Info display allowed" または
      - "BLOCKED: CPU turn, Player card clicked" または
      - "ALLOWED: Click allowed, processing..."
    ↓
[フェーズ固有のハンドラー]
```

## ログプレフィックスの意味

| プレフィックス | 意味 | ファイル |
|-------------|------|--------|
| `Card Click:` | 初期クリック情報 | game.js |
| `BLOCKED:` | アクションがブロックされた | game.js / interaction.js |
| `INFO:` | 追加情報 | game.js |
| `ALLOWED:` | アクションが許可された | game.js |
| `SLOT CLICKED:` | DOMスロットがクリックされた | view.js |
| `THREE.JS MOUSE DOWN:` | 3Dオブジェクトとのインタラクション | interaction.js |
| `DRAG BLOCKED:` | 3Dドラッグがブロックされた | interaction.js |
| `BoardEventHandler:` | 低レベルイベント処理 | board-event-handler.js |

## テスト手順

### 1. 開発サーバーを起動

```bash
npm start
# または
node server.js
```

### 2. ブラウザで開く

- http://localhost:3000 にアクセス
- F12 キーを押して開発者ツールを開く
- Console タブを選択

### 3. テストシナリオ

#### a) プレイヤーターン中に自分のカードをクリック

**期待されるログ:**
```
BoardEventHandler: click received
BoardEventHandler: found slot?
BoardEventHandler: clickInfo {owner: "player", ...}
SLOT CLICKED (view.js): {owner: "player", ...}
Card Click: {owner: "player", ..., turnPlayer: "player"}
ALLOWED: Click allowed, processing...
```

#### b) プレイヤーターン中にCPUのカードをクリック

**期待されるログ:**
```
SLOT CLICKED (view.js): {owner: "cpu", ...}
Card Click: {owner: "cpu", ..., turnPlayer: "player"}
BLOCKED: Player turn, CPU card clicked {zone: "active"}
```

#### c) CPUターン中にプレイヤーのカードをクリック

**期待されるログ:**
```
SLOT CLICKED (view.js): {owner: "player", ...}
Card Click: {owner: "player", ..., turnPlayer: "cpu"}
BLOCKED: CPU turn, Player card clicked
```

#### d) 処理中にクリック

**期待されるログ:**
```
Card Click: {..., isProcessing: true}
BLOCKED: isProcessing = true
```

#### e) プレイヤーターン中に3Dカードをドラッグ

**期待されるログ:**
```
THREE.JS MOUSE DOWN: {objectType: "card", owner: "player", currentPlayer: "player"}
(ドラッグ続行)
```

#### f) CPUターン中に3Dカードをドラッグしようとする

**期待されるログ:**
```
THREE.JS MOUSE DOWN: {objectType: "card", owner: "player", currentPlayer: "cpu"}
DRAG BLOCKED: Wrong turn {owner: "player", currentPlayer: "cpu"}
```

## ログに含まれる情報

| フィールド | 意味 |
|-----------|------|
| `owner` | カードの所有者 ("player" または "cpu") |
| `zone` | カードの場所 ("hand", "active", "bench", "deck", "prize") |
| `cardId` | カードの一意識別子 |
| `index` | ゾーン内の位置 (例: ベンチスロット 0-4) |
| `currentPhase` | 現在のゲームフェーズ (例: "PLAYER_MAIN", "SETUP") |
| `turnPlayer` | 現在のターンプレイヤー ("player" または "cpu") |
| `isProcessing` | ゲームが現在処理中かどうか |

## トラブルシューティング

### ログが表示されない場合

1. ブラウザのコンソールが開いているか確認
2. ログレベルのフィルターを確認 (Info レベルを表示)
3. ブラウザのキャッシュをクリアしてリロード
4. サーバーが変更後に再起動されたか確認

### クリックが反応しない場合

ログを確認:

1. `BoardEventHandler: click received` が表示されるか?
   - いいえ → クリックイベントがハンドラーに到達していない

2. `SLOT CLICKED (view.js)` が表示されるか?
   - いいえ → スロットがクリックリスナーで正しく設定されていない

3. `Card Click:` が表示されるか?
   - いいえ → cardClickHandler が正しく接続されていない

4. `BLOCKED:` メッセージが表示されるか?
   - はい → ブロックされた理由を確認 (ターン、処理中など)

## 作成されたドキュメント

1. **DEBUG_LOGS_SUMMARY.md** - 完全なドキュメント (英語)
2. **QUICK_DEBUG_REFERENCE.md** - クイックリファレンス (英語)
3. **LOG_FLOW_DIAGRAM.txt** - ログフロー図 (英語)
4. **DEBUG_LOGS_IMPLEMENTATION_JP.md** - このドキュメント (日本語)

## バックアップファイル

- **c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/game.js.backup**
  - 元の game.js ファイル (変更前)

## 使用したスクリプト

- **add_debug_final.py** - デバッグログを追加したPythonスクリプト

## 構文チェック

すべてのJavaScriptファイルの構文は検証済み:

```bash
node -c src/js/game.js
node -c src/js/view.js
node -c src/js/three/interaction.js
```

すべて正常に通過しました。

## 次のステップ

1. サーバーを起動してログをテスト
2. さまざまなクリックシナリオを試す
3. ブラウザコンソールのフィルター機能を使用:
   - "BLOCKED" で検索 → ブロックされたインタラクションを表示
   - "ALLOWED" で検索 → 許可されたインタラクションを表示
   - "Card Click" で検索 → すべてのカードクリックイベントを表示

---

**実装日:** 2026年1月3日
**実装者:** Claude Code
**ステータス:** 完了
