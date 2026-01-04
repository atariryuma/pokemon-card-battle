# サウンドとインプット統合機能

## 概要

ポケモンカードバトルゲームにエキサイティングな機能を追加しました：

1. **サウンドマネージャー** - Howler.jsを使用した効果音とBGMの管理
2. **インプットマネージャー** - キーボードとゲームパッドによる操作
3. **キーボードショートカット** - 素早いゲーム操作のためのショートカット
4. **アクセシビリティ向上** - キーボード選択のビジュアルフィードバック

## 実装ファイル

### 新規作成ファイル

1. **c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/sound-manager.js**
   - Howler.jsを使用したサウンド管理
   - BGMと効果音の再生
   - 音量コントロール
   - ON/OFFトグル機能

2. **c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/input-manager.js**
   - キーボードショートカット管理
   - ゲームパッド入力処理
   - 選択可能な要素のナビゲーション
   - アクションコールバックシステム

3. **c:/Projects/pokemon-card-battle/pokemon-card-battle/src/styles/components/_input-controls.css**
   - キーボード選択のハイライトスタイル
   - ゲームパッドインジケーター
   - キーボードヘルプオーバーレイ
   - アクセシビリティ対応のフォーカススタイル

### 更新ファイル

1. **c:/Projects/pokemon-card-battle/pokemon-card-battle/public/index.html**
   - Howler.js CDN追加

2. **c:/Projects/pokemon-card-battle/pokemon-card-battle/src/styles/main.css**
   - input-controls.cssのインポート追加

3. **c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/game.js**
   - サウンドマネージャーとインプットマネージャーのインポート
   - 初期化メソッド追加：
     - `_setupSoundAndInputManagers()`
     - `_updateSelectableElements()`
     - `_showKeyboardHelp()`
     - `_playSound()`

## 使用方法

### キーボードショートカット

#### 基本操作
- **Enter / Space**: 選択を確定
- **Esc**: キャンセル / モーダルを閉じる
- **E**: ターン終了

#### ナビゲーション
- **← / A**: 左に移動
- **→ / D**: 右に移動
- **↑ / W**: 上に移動
- **↓ / S**: 下に移動

#### カード選択
- **1-7**: 手札の1-7番目のカードを選択

#### UI操作
- **M**: サウンドON/OFF切り替え
- **H / F1**: キーボードヘルプを表示
- **F**: フルスクリーン切り替え

### ゲームパッド対応

標準的なゲームコントローラー（Xbox、PlayStation等）をサポート：

- **Aボタン / ×ボタン**: 確定
- **Bボタン / ○ボタン**: キャンセル
- **Xボタン / □ボタン**: ターン終了
- **Yボタン / △ボタン**: 情報表示
- **十字キー**: ナビゲーション

### サウンドエフェクト

以下のサウンドエフェクトが定義されています（音源ファイルはオプション）：

- `cardDraw`: カードを引く
- `cardPlace`: カードを配置
- `attack`: 攻撃
- `damage`: ダメージを受ける
- `knockout`: きぜつ
- `victory`: 勝利
- `click`: クリック音
- `evolve`: 進化
- `shuffle`: デッキをシャッフル

### BGM

- `battle`: バトルテーマ
- `victory`: 勝利テーマ

## 音源ファイルの配置（オプション）

音源ファイルを追加する場合は、以下のディレクトリに配置してください：

```
pokemon-card-battle/
├── public/
│   └── assets/
│       ├── sounds/
│       │   ├── card-draw.mp3
│       │   ├── card-place.mp3
│       │   ├── attack.mp3
│       │   ├── damage.mp3
│       │   ├── knockout.mp3
│       │   ├── victory.mp3
│       │   ├── click.mp3
│       │   ├── evolve.mp3
│       │   └── shuffle.mp3
│       └── music/
│           ├── battle-theme.mp3
│           └── victory-theme.mp3
```

**注意**: 音源ファイルがない場合でも、ゲームは正常に動作します。サウンドマネージャーは音源が見つからない場合、エラーを無視します。

## コードでの使用例

### ゲームコード内でサウンドを再生

```javascript
// 効果音を再生
this._playSound('cardDraw');      // カードを引く音
this._playSound('attack');        // 攻撃音
this._playSound('victory');       // 勝利音

// BGMを再生
soundManager.playMusic('battle'); // バトルBGM開始
soundManager.stopMusic();         // BGM停止

// 音量調整
soundManager.setVolume('sfx', 0.5);    // 効果音の音量を50%に
soundManager.setVolume('music', 0.3);  // BGMの音量を30%に
soundManager.setVolume('master', 0.7); // マスター音量を70%に
```

### インプット管理

```javascript
// 選択可能な要素を更新
this._updateSelectableElements();

// カスタムアクションを追加
inputManager.on('customAction', () => {
    console.log('Custom action triggered!');
});
```

## 技術仕様

### サウンドマネージャー

- **ライブラリ**: Howler.js 2.2.4
- **対応フォーマット**: MP3, OGG, WAV, AAC
- **機能**:
  - 複数サウンドの同時再生
  - フェードイン/アウト
  - ループ再生
  - 音量コントロール
  - エラーハンドリング

### インプットマネージャー

- **キーボードAPI**: KeyboardEvent
- **ゲームパッドAPI**: Gamepad API
- **機能**:
  - カスタムキーバインディング
  - ゲームパッドボタンマッピング
  - 選択要素のナビゲーション
  - アクションコールバックシステム

## アクセシビリティ

- キーボードのみでの完全な操作をサポート
- 視覚的なフォーカスインジケーター
- スクリーンリーダー対応を考慮
- モーション削減の設定を尊重（prefers-reduced-motion）
- ゲームパッドによる代替操作

## ブラウザ互換性

- **サウンド**:
  - Chrome/Edge: 完全サポート
  - Firefox: 完全サポート
  - Safari: 完全サポート（ユーザーインタラクション後）

- **ゲームパッド**:
  - Chrome/Edge: 完全サポート
  - Firefox: 完全サポート
  - Safari: 部分的サポート

## トラブルシューティング

### サウンドが再生されない

1. Howler.jsが正しくロードされているか確認
2. ブラウザのコンソールでエラーを確認
3. 音源ファイルのパスが正しいか確認
4. ブラウザの自動再生ポリシーを確認（ユーザーインタラクション後に再生）

### キーボードショートカットが動作しない

1. 入力フィールドにフォーカスがないか確認
2. ブラウザのコンソールでエラーを確認
3. `inputManager.setKeyboardEnabled(true)` が呼ばれているか確認

### ゲームパッドが認識されない

1. ゲームパッドが接続されているか確認
2. ブラウザがGamepad APIをサポートしているか確認
3. ゲームパッドのボタンを押して認識させる

## 今後の拡張

- より多くのサウンドエフェクトの追加
- カスタムキーバインディングの設定UI
- サウンド設定パネルの実装
- ゲームパッド振動機能のサポート
- マルチプレイヤー対応のサウンド同期

## 参考資料

- [Howler.js Documentation](https://howlerjs.com/)
- [Gamepad API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API)
- [Card Game UI/UX Best Practices](https://www.gunslingersnft.com/post/card-game-ui-ux-design-elevating-player-experience)
- [Keyboard vs Gamepad in UI Design](https://game-wisdom.com/videos/keyboard-vs-gamepad-ui-design)

---

**実装日**: 2026-01-03
**バージョン**: 1.0.0
