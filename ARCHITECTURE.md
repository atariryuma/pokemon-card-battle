# ポケモンカードバトル - アーキテクチャ設計書

## 業界標準TCGアーキテクチャの採用

このプロジェクトは、Hearthstone、Pokemon TCG Online、Magic: The Gathering Arenaなどの
商用TCGで実証されたアーキテクチャパターンを採用しています。

## 参考文献
- [Game Architecture for Card Game Model](https://bennycheung.github.io/game-architecture-card-ai-1)
- [Carty - Hearthstone-like Game Engine](https://github.com/VHonzik/Carty)
- [State Pattern in Games](https://betterprogramming.pub/design-patterns-for-games-state-pattern-97519e0b9165)
- [Card Game Design as Systems Architecture](https://critpoints.net/2023/05/26/card-game-design-as-systems-architecture/)

---

## アーキテクチャ階層

```
┌─────────────────────────────────────────────────────────┐
│                     Presentation Layer                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  View (DOM)  │  │ View (3D)    │  │  UI Manager  │  │
│  │              │  │  (Three.js)  │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────┐
│                    Controller Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Input        │  │ Action       │  │ Event        │  │
│  │ Handler      │  │ Controller   │  │ Dispatcher   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────┐
│                      Game Logic Layer                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Game State   │  │ Turn Manager │  │ Phase        │  │
│  │ Machine      │  │              │  │ Manager      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Rule Engine  │  │ Effect       │  │ Validator    │  │
│  │              │  │ Resolver     │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────┐
│                       Data Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Card         │  │ Game State   │  │ Player       │  │
│  │ Repository   │  │ Repository   │  │ Repository   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## ディレクトリ構造（業界標準）

```
src/
├── core/                       # コアシステム
│   ├── game-engine.js         # メインゲームエンジン
│   ├── game-context.js        # 依存性注入コンテナ ✅
│   └── event-bus.js           # イベントバス（Observer Pattern）
│
├── models/                     # データモデル（Model）
│   ├── card/
│   │   ├── card.js            # カードエンティティ
│   │   ├── card-factory.js    # カード生成（Factory Pattern）
│   │   └── card-repository.js # カードデータアクセス
│   ├── player/
│   │   ├── player.js          # プレイヤーエンティティ
│   │   └── player-state.js    # プレイヤー状態
│   └── game-state/
│       ├── game-state.js      # ゲーム状態モデル
│       └── state-snapshot.js  # 状態スナップショット（Memento Pattern）
│
├── controllers/                # ゲームロジック制御（Controller）
│   ├── game-controller.js     # メインゲームコントローラー
│   ├── turn-controller.js     # ターン制御
│   ├── phase-controller.js    # フェーズ制御
│   └── action-controller.js   # アクション実行制御
│
├── state-machine/              # 状態機械（State Pattern）
│   ├── game-state-machine.js  # ゲーム状態機械
│   ├── states/
│   │   ├── setup-state.js     # セットアップ状態
│   │   ├── playing-state.js   # プレイ中状態
│   │   ├── battle-state.js    # バトル状態
│   │   └── end-state.js       # 終了状態
│   └── transitions.js         # 状態遷移定義
│
├── commands/                   # コマンドパターン
│   ├── command.js             # 基底コマンド
│   ├── play-card-command.js   # カードプレイコマンド
│   ├── attack-command.js      # 攻撃コマンド
│   └── command-history.js     # コマンド履歴（Undo/Redo）
│
├── systems/                    # ゲームシステム（ECS風）
│   ├── combat-system.js       # 戦闘システム
│   ├── energy-system.js       # エネルギーシステム
│   ├── effect-system.js       # エフェクトシステム
│   └── animation-system.js    # アニメーションシステム
│
├── rules/                      # ルールエンジン
│   ├── rule-engine.js         # ルール実行エンジン
│   ├── validators/            # バリデーター ✅
│   │   ├── card-validator.js
│   │   ├── move-validator.js
│   │   └── state-validator.js
│   └── effects/               # カード効果
│       ├── effect-resolver.js
│       └── effect-definitions/
│
├── views/                      # ビュー層（View）
│   ├── view-manager.js        # ビュー管理
│   ├── dom-view/              # DOM版ビュー
│   └── three-view/            # Three.js版ビュー
│       ├── scene-manager.js
│       ├── card-renderer.js
│       └── animation-controller.js
│
├── services/                   # サービス層
│   ├── card-service.js        # カード関連サービス
│   ├── player-service.js      # プレイヤーサービス
│   └── ai-service.js          # AI制御サービス
│
├── utils/                      # ユーティリティ
│   ├── event-emitter.js       # イベント発行
│   ├── sequential-animator.js # シーケンシャルアニメーター
│   └── logger.js              # ロガー
│
└── constants/                  # 定数 ✅
    ├── timing.js              # タイミング定数
    ├── game-phases.js         # ゲームフェーズ定義
    └── event-types.js         # イベントタイプ定義
```

---

## 主要デザインパターン

### 1. State Pattern（状態パターン）
**目的**: ゲームフェーズ・ターンの状態管理

```javascript
class GameState {
    constructor(context) {
        this.context = context;
    }
    enter() {}
    execute() {}
    exit() {}
}

class SetupState extends GameState {
    enter() { /* セットアップ処理 */ }
    execute() { /* セットアップ実行 */ }
    exit() { /* クリーンアップ */ }
}
```

### 2. Command Pattern（コマンドパターン）
**目的**: アクションの実行・Undo・Redo

```javascript
class Command {
    execute(gameState) {}
    undo(gameState) {}
}

class PlayCardCommand extends Command {
    constructor(cardId, targetZone) {
        this.cardId = cardId;
        this.targetZone = targetZone;
    }
    execute(gameState) { /* カードをプレイ */ }
    undo(gameState) { /* 元に戻す */ }
}
```

### 3. Observer Pattern（オブザーバーパターン）
**目的**: イベント駆動アーキテクチャ

```javascript
class EventBus {
    constructor() {
        this.listeners = {};
    }
    on(eventType, callback) {
        if (!this.listeners[eventType]) {
            this.listeners[eventType] = [];
        }
        this.listeners[eventType].push(callback);
    }
    emit(eventType, data) {
        if (this.listeners[eventType]) {
            this.listeners[eventType].forEach(cb => cb(data));
        }
    }
}
```

### 4. Factory Pattern（ファクトリパターン）
**目的**: カード・エンティティの生成

```javascript
class CardFactory {
    static createCard(cardData) {
        switch(cardData.card_type) {
            case 'pokemon':
                return new PokemonCard(cardData);
            case 'energy':
                return new EnergyCard(cardData);
            case 'trainer':
                return new TrainerCard(cardData);
        }
    }
}
```

### 5. Repository Pattern（リポジトリパターン）
**目的**: データアクセスの抽象化

```javascript
class CardRepository {
    constructor() {
        this.cards = new Map();
    }
    getById(id) { return this.cards.get(id); }
    save(card) { this.cards.set(card.id, card); }
    findByType(type) { /* ... */ }
}
```

---

## イベント駆動フロー（Event-Driven）

```
User Action
    ↓
Input Handler
    ↓
EventBus.emit('USER_ACTION', data)
    ↓
Action Controller (subscriber)
    ↓
Command.execute()
    ↓
Game State Update
    ↓
EventBus.emit('STATE_CHANGED', newState)
    ↓
View Manager (subscriber)
    ↓
Render Update
```

---

## 次のステップ

1. ✅ GameContext 作成完了
2. ✅ 定数管理 完了
3. ✅ Validator 分離完了
4. ✅ EventBus 作成・統合完了
   - core/event-bus.js (332 lines) - Observer Pattern実装
   - 30+ GameEventTypes定義
   - game.js, animation-manager.js, view.js, turn-manager.jsに統合
   - イベント駆動フロー確立: GAME_INITIALIZED, STATE_UPDATED, PHASE_CHANGED, ATTACK_DECLARED, DAMAGE_DEALT, POKEMON_KNOCKED_OUT, ENERGY_ATTACHED, CARD_DRAWN
5. ⏳ State Machine 実装
6. ⏳ Command Pattern 実装
7. ⏳ Repository Pattern 実装

---

## 参考実装

このアーキテクチャは以下の商用TCGで実証されています：
- **Hearthstone** (Blizzard) - State Machine + Event System
- **Pokemon TCG Online** - MVC + Command Pattern
- **Magic: The Gathering Arena** - ECS + Rule Engine
- **Legends of Runeterra** (Riot Games) - Event-Driven Architecture
