# セットアップシステム リファクタリング移行ガイド

## 概要

このガイドは、新しいアーキテクチャに移行するための手順と、既存コードを更新する方法を説明します。

## 主な変更点

### 1. グローバル変数 `window.gameInstance` の使用廃止

**非推奨:**
```javascript
// ❌ 直接アクセス（非推奨）
if (window.gameInstance) {
  const state = window.gameInstance.state;
  window.gameInstance._updateState(newState);
}
```

**推奨:**
```javascript
// ✅ GameContext経由でアクセス
import { gameContext } from './core/game-context.js';

if (gameContext.hasGameInstance()) {
  const state = gameContext.getState();
  gameContext.updateState(newState);
}
```

### 2. `setInterval` + `async` の組み合わせ廃止

**非推奨:**
```javascript
// ❌ setInterval内でasync処理（危険）
const interval = setInterval(async () => {
  await someAsyncOperation();
  index++;
  if (index >= items.length) {
    clearInterval(interval);
  }
}, 1000);
```

**推奨:**
```javascript
// ✅ SequentialAnimatorを使用
import { SequentialAnimator } from './utils/sequential-animator.js';

const animator = new SequentialAnimator({ defaultDelay: 1000 });

items.forEach((item, index) => {
  animator.add(`task-${index}`, async () => {
    await someAsyncOperation(item);
  });
});

await animator.run();
```

### 3. エラーハンドリングの改善

**非推奨:**
```javascript
// ❌ 単純なtry-catch
try {
  // 処理
} catch (error) {
  console.error('Error:', error);
  return state;
}
```

**推奨:**
```javascript
// ✅ SetupErrorを使用
import { SetupError, SetupErrorType } from './errors/setup-error.js';

try {
  // 処理
} catch (error) {
  throw new SetupError(
    SetupErrorType.INVALID_STATE,
    'Detailed error message',
    {
      userMessage: 'ユーザー向けメッセージ',
      context: { playerId, cardId }
    }
  );
}
```

## 新しいクラスの使用方法

### GameContext

ゲームインスタンスとステートキューへの安全なアクセスを提供します。

```javascript
import { gameContext } from './core/game-context.js';

// ゲームインスタンスの取得
const gameInstance = gameContext.getGameInstance();

// 状態の取得
const state = gameContext.getState();

// 状態の更新
gameContext.updateState(newState);

// 状態更新のキューイング
await gameContext.enqueueStateUpdate(
  async (currentState) => {
    // 状態を更新
    return { ...currentState, /* 変更 */ };
  },
  'Description of update'
);
```

### SequentialAnimator

順次アニメーション実行を管理します。

```javascript
import { SequentialAnimator } from './utils/sequential-animator.js';

// 基本的な使用方法
const animator = new SequentialAnimator({
  defaultDelay: 800,        // タスク間の遅延
  stopOnError: false,       // エラーで停止しない
  onTaskComplete: (task, result) => {
    console.log(`Task ${task.id} completed`);
  }
});

// タスクを追加
animator.add('task1', async () => {
  await doSomething();
});

animator.add('task2', async () => {
  await doSomethingElse();
}, { delay: 1000 }); // このタスクだけ遅延を変更

// 実行
const result = await animator.run();
console.log('All tasks completed:', result.success);

// 便利な静的メソッド
import { processSequentially, repeatWithInterval } from './utils/sequential-animator.js';

// 配列を順次処理
await processSequentially(
  items,
  async (item, index) => {
    await processItem(item);
  },
  { defaultDelay: 500 }
);

// 指定回数繰り返し実行
await repeatWithInterval(
  async (iteration) => {
    console.log(`Iteration ${iteration}`);
  },
  5,        // 5回実行
  1000      // 1秒間隔
);
```

### SetupError

セットアップ専用のエラークラスです。

```javascript
import { SetupError, SetupErrorType, SetupErrorHandler } from './errors/setup-error.js';

// エラーの作成
throw new SetupError(
  SetupErrorType.CARD_NOT_FOUND,
  'Card XYZ not found in hand',
  {
    userMessage: '指定されたカードが見つかりません。',
    recoveryStrategy: RecoveryStrategy.USER_INPUT,
    context: {
      playerId: 'player',
      cardId: 'xyz-123'
    }
  }
);

// エラーハンドラーの使用
const errorHandler = new SetupErrorHandler(gameContext);

try {
  // 処理
} catch (error) {
  if (error instanceof SetupError) {
    const result = await errorHandler.handleError(error);
    // リカバリー処理
  }
}
```

### SetupStateValidator

状態検証を行います。

```javascript
import { setupStateValidator } from './setup/setup-state-validator.js';

// 状態全体を検証
const validation = setupStateValidator.validateState(state);
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
}

// プレイヤー状態を検証
const playerValidation = setupStateValidator.validatePlayerState(state, 'player');

// カード配置を検証
const placementValidation = setupStateValidator.validateCardPlacement(
  state,
  'player',
  cardId,
  'active',
  0
);

if (placementValidation.isValid) {
  // 配置実行
}

// セットアップ完了を検証
const setupComplete = setupStateValidator.validateSetupComplete(state);
if (setupComplete.details.bothReady) {
  // ゲーム開始
}
```

### PokemonPlacementHandler

ポケモン配置処理を担当します。

```javascript
import { PokemonPlacementHandler } from './setup/pokemon-placement-handler.js';

const placementHandler = new PokemonPlacementHandler(gameContext);

// プレイヤーがポケモンを配置
const newState = await placementHandler.placePlayerPokemon(
  state,
  'player',
  cardId,
  'active',
  0
);

// CPUがポケモンを配置（初期セットアップ）
const newState2 = await placementHandler.placeCpuPokemon(
  state,
  true  // isInitialSetup
);

// 非ブロッキング配置
await placementHandler.placeNonBlockingCpuSetup(state);
```

### InitialSetupOrchestrator

セットアップフロー全体を統括します。

```javascript
import { InitialSetupOrchestrator } from './setup/setup-orchestrator.js';

const orchestrator = new InitialSetupOrchestrator(gameContext);

// セットアップ全体を実行
const newState = await orchestrator.executeFullSetup(state);

// デバッグモードを有効化
orchestrator.setDebugMode(true);
```

## 段階的移行手順

### フェーズ 1: 基礎の準備（完了）
- [x] GameContext の導入
- [x] game.js での初期化
- [x] setup-manager.js のリファクタリング

### フェーズ 2: 他のモジュールの更新（推奨）

1. **error-handler.js の更新**
```javascript
// Before
if (window.gameInstance?.view) {
  window.gameInstance.view.displayModal({...});
}

// After
import { gameContext } from './core/game-context.js';

if (gameContext.hasGameInstance()) {
  const gameInstance = gameContext.getGameInstance();
  if (gameInstance.view) {
    gameInstance.view.displayModal({...});
  }
}
```

2. **state-queue.js の更新**
```javascript
// GameContextを使用して状態を取得・更新
import { gameContext } from './core/game-context.js';

// 状態更新時
gameContext.updateState(newState);
```

3. **アニメーション関連の更新**
```javascript
// setInterval の代わりに SequentialAnimator を使用
import { SequentialAnimator } from './utils/sequential-animator.js';
```

### フェーズ 3: window.gameInstance の完全削除（将来）

すべてのモジュールが GameContext を使用するように更新されたら：

1. `game.js` から `window.gameInstance = this;` を削除
2. グローバル検索で `window.gameInstance` が残っていないか確認
3. テストを実行して動作確認

## トラブルシューティング

### Q: GameContext が初期化されていないエラー

```javascript
// エラー: GameContext: gameInstance is not initialized

// 解決方法: game.js の init() が完了するまで待つ
if (gameContext.hasGameInstance()) {
  // 処理
} else {
  console.warn('GameContext not initialized yet');
}
```

### Q: SequentialAnimator がタイムアウトする

```javascript
// タイムアウトを延長
const animator = new SequentialAnimator({
  defaultTimeout: 60000  // 60秒に延長
});

// または個別のタスクで設定
animator.add('long-task', async () => {
  // 長い処理
}, { timeout: 120000 });
```

### Q: SetupError が正しくキャッチされない

```javascript
// SetupError を明示的にチェック
import { SetupError } from './errors/setup-error.js';

try {
  // 処理
} catch (error) {
  if (error instanceof SetupError) {
    // SetupError の処理
  } else {
    // その他のエラー
  }
}
```

## ベストプラクティス

1. **常に GameContext 経由でアクセス**
   - `window.gameInstance` を直接使わない
   - `gameContext.hasGameInstance()` で存在確認

2. **非同期処理は SequentialAnimator を使用**
   - setInterval + async を避ける
   - タイムアウトを適切に設定

3. **エラーは SetupError で投げる**
   - 詳細なコンテキストを含める
   - ユーザー向けメッセージを提供

4. **状態検証は Validator を使用**
   - 配置前に必ず検証
   - エラーメッセージを活用

5. **デバッグモードを活用**
   - 開発時は `setDebugMode(true)` を使用
   - 詳細なログが出力される

## 参考資料

- [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) - リファクタリングの詳細
- [CLAUDE.md](./CLAUDE.md) - プロジェクト全体のアーキテクチャ
- 各クラスのJSDocコメント - 詳細な使用方法

## サポート

質問や問題がある場合は、以下を確認してください：
1. このガイドのトラブルシューティングセクション
2. 各ファイルのドキュメントコメント
3. REFACTORING_SUMMARY.md の詳細説明
