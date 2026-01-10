# Test Suite - README

## 概要

このテストスイートは、Pokemon Card Battleゲームのバグを機械的に検出するための包括的な自動テストシステムです。

## 主な機能

### 1. テストヘルパー (`test-helpers.js`)
- アニメーション完了待機
- スクリーンショット撮影
- カード存在チェック
- 攻撃シミュレーション
- ゲーム状態取得
- メモリリーク検出
- カードフリップ状態確認
- ダメージバッジ確認
- State/Three.js同期チェック

### 2. バグ検出エンジン (`bug-detector.js`)
自動的に以下の問題を検出:
- **アニメーション問題**: 長すぎるトランジション、競合するプロパティ
- **メモリリーク**: DOM要素の蓄積、Three.jsオブジェクトの未解放
- **状態不整合**: State vs DOM vs Three.js の不一致
- **DOM問題**: 孤立要素、重複ID、スロット内の複数カード
- **Three.js問題**: メッシュの欠落、デタッチされたオブジェクト、バッジの欠落

### 3. 自動テスト (`automated-tests.js`)
以下のテストを実行:
- **カードフリップテスト**: フリップアニメーション、回転状態
- **ダメージバッジテスト**: バッジ表示、位置、ダメージ値
- **ゲームフローテスト**: フェーズ遷移、手札/フィールドの状態、サイドカード
- **Three.js/DOM同期テスト**: カード数の一致、個別カードの存在確認
- **パフォーマンステスト**: DOM要素数、Three.jsオブジェクト数、FPS測定

### 4. テストランナーUI (`test-runner.html`)
インタラクティブなブラウザUIで:
- 個別テスト実行
- 全テスト一括実行
- バグ検出器実行
- リアルタイム結果表示
- 詳細なエラーログ

## 使用方法

### ブラウザでの実行（推奨）

1. 開発サーバーを起動:
```bash
cd c:\Projects\pokemon-card-battle\pokemon-card-battle
npm run dev
```

2. ブラウザで次のURLを開く:
```
http://localhost:3000/tests/test-runner.html
```

3. "Run All Tests" ボタンをクリック

### コンソールでの実行

1. ゲームを開始: `http://localhost:3000`

2. ブラウザのコンソールで以下を実行:

```javascript
// すべてのテストを実行
await runAutomatedTests();

// 個別テストを実行
await testCardFlip();
await testDamageBadge();
await testGameFlow();
await testThreeDOMSync();
await testPerformance();

// バグ検出器を実行
await bugDetector.detectAll();

// 継続的モニタリングを開始（5秒ごと）
bugDetector.startMonitoring(5000);

// モニタリングを停止
bugDetector.stopMonitoring();
```

### ES Moduleとして使用

```javascript
import { 
    runAutomatedTests, 
    testCardFlip, 
    testDamageBadge 
} from './tests/automated-tests.js';

import { bugDetector } from './tests/bug-detector.js';

import { 
    wait, 
    checkCardFlipState, 
    checkDamageBadge 
} from './tests/test-helpers.js';

// テスト実行
const results = await runAutomatedTests();
console.log(results);

// バグ検出
const report = await bugDetector.detectAll();
console.log(report);

// ヘルパー関数の使用
const flipState = checkCardFlipState('card-runtime-id');
const badgeInfo = checkDamageBadge('card-runtime-id');
```

## テスト結果の解釈

### 成功 (✅)
- テストが期待通りに動作
- バグは検出されず

### 失敗 (❌)
- 実際の動作が期待と異なる
- 要修正

### 警告 (⚠️)
- テストをスキップ（前提条件未満足）
- 潜在的な問題（ただし致命的ではない）

## よくある問題と解決策

### テストが "Game state not available" で失敗する

**原因**: ゲームが初期化されていない

**解決策**: 
1. ゲームをスタート画面から開始
2. 難易度を選択
3. "手札を7枚引く" をクリック
4. ポケモンを配置
5. セットアップを完了
6. その後テストを実行

### ダメージバッジテストが警告になる

**原因**: 攻撃に必要なエネルギーが不足

**解決策**:
1. セットアップ時にエネルギーカードも配置
2. 手動でエネルギーを付与してからテスト実行

### Three.js/DOM同期テストが失敗する

**原因**: Three.jsとゲーム状態の不一致が検出された

**チェック項目**:
1. コンソールエラーを確認
2. `checkStateSync()` の詳細を確認
3. 報告された不一致を修正

## トラブルシューティング

### テストランナーが読み込まれない

```bash
# サーバーが起動しているか確認
npm run dev

# ブラウザのキャッシュをクリア
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

### ES Module エラー

`test-runner.html` はゲームと同じサーバーから提供される必要があります。
`file://` プロトコルでは動作しません。

### スクリーンショットが保存されない

LocalStorageの容量制限に達している可能性があります:
```javascript
// localStorage をクリア
localStorage.clear();
```

## カスタマイズ

### 新しいテストを追加

`automated-tests.js` に新しい関数を追加:

```javascript
export async function testMyNewFeature() {
    console.log('🧪 Test: My New Feature');
    
    const results = {
        passed: [],
        failed: [],
        warnings: []
    };

    try {
        // テストロジック
        results.passed.push('Feature works!');
    } catch (error) {
        results.failed.push(`Error: ${error.message}`);
    }

    logTestResult('My New Feature Test', results.failed.length === 0);
    return results;
}
```

### 新しいバグチェックを追加

`bug-detector.js` の `BugDetector` クラスにメソッドを追加:

```javascript
async detectMyNewIssue() {
    console.log('🔍 Checking for my new issue...');
    
    // チェックロジック
    if (problemDetected) {
        this.addIssue('category', 'type', {
            message: 'Problem description',
            details: { ... }
        });
    }
}
```

`detectAll()` メソッドに追加:
```javascript
async detectAll() {
    // ... existing code ...
    await this.detectMyNewIssue();
    return this.generateReport();
}
```

## 今後の改善

- [ ] CI/CD統合（GitHub Actions）
- [ ] ビジュアル回帰テスト（スクリーンショット比較）
- [ ] E2Eテスト（Puppeteer/Playwright）
- [ ] カバレッジレポート
- [ ] テスト結果の永続化（JSON/CSV出力）

## 貢献

バグを発見した場合や新しいテストケースのアイデアがある場合は、issueを作成してください。

## ライセンス

このテストスイートはプロジェクトと同じライセンスに従います。
