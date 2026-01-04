# 診断チェックリスト

ブラウザをリロードして、以下を順番に確認してください。

## 1. ゲーム起動

- [ ] ページが読み込まれる
- [ ] Three.jsシーンが表示される
- [ ] プレイマット（緑の台）が表示される
- [ ] 「手札を7枚引く」ボタンが表示される

**コンソールで確認**:
```
✅ Three.js Scene initialized
✅ Playmat slot data loaded successfully
✅ GameContext initialized
```

## 2. セットアップフェーズ

「手札を7枚引く」ボタンをクリック

- [ ] カードが7枚配布される
- [ ] カードがフリップ（回転）アニメーションで表示される
- [ ] カードが表向きになる
- [ ] CPU側も7枚配布される

**コンソールで確認**:
```
✅ DOM elements verified: #player-hand and #cpu-hand exist
✅ Initial hand draw animation completed
```

## 3. 手札の表示

- [ ] プレイヤー手札が画面下部に表示される
- [ ] CPU手札が画面上部に表示される（小さめ）
- [ ] カードが表向きに見える
- [ ] カード画像が正しく表示される

**ブラウザDevToolsで確認**:
```javascript
// コンソールで実行
document.getElementById('player-hand').children.length
// → 7 が返ってくるはず

document.querySelectorAll('#player-hand .hand-slot').length
// → 7 が返ってくるはず
```

## 4. 手札のホバー効果

プレイヤー手札の任意のカードにマウスオーバー

- [ ] カードが拡大する（1.2倍）
- [ ] カードが少し浮き上がる（20px）
- [ ] 近くのカードも影響を受ける（Mac Dockエフェクト）
- [ ] カーソルがポインターになる

## 5. 手札のクリック

プレイヤー手札のポケモンカードをクリック

- [ ] クリックイベントが発火する
- [ ] カードが選択状態になる（枠が光る、など）
- [ ] 3Dボード上に配置される、またはモーダルが表示される

**コンソールで確認**:
```
（クリックイベントが発火したログが表示されるはず）
```

**もしクリックしても何も起きない場合**:
```javascript
// コンソールで実行して確認
const card = document.querySelector('#player-hand .hand-slot');
console.log('pointer-events:', window.getComputedStyle(card).pointerEvents);
// → "auto" が返ってくるはず

console.log('cursor:', window.getComputedStyle(card).cursor);
// → "pointer" が返ってくるはず

console.log('opacity:', window.getComputedStyle(card).opacity);
// → "1" が返ってくるはず

console.log('visibility:', window.getComputedStyle(card).visibility);
// → "visible" が返ってくるはず
```

## 6. ポケモン配置

手札のたねポケモンをクリックしてバトル場に配置

- [ ] バトル場にポケモンが配置される
- [ ] 3Dモデルが表示される
- [ ] CPUも自動的にポケモンを配置する
- [ ] 「セットアップ完了」ボタンが表示される

## 7. ゲーム進行

「セットアップ完了」ボタンをクリック

- [ ] ゲームが開始される
- [ ] ドローフェーズに移行する
- [ ] カードが1枚ドローされる
- [ ] メインフェーズに移行する
- [ ] アクションボタンが表示される

## 結果レポート

**どの段階で問題が発生しましたか？**

段階: ________________

**具体的な症状**:
- [ ] カードが表示されない
- [ ] カードがクリックできない
- [ ] アニメーションが動かない
- [ ] ゲームが進行しない
- [ ] エラーメッセージが表示される
- [ ] その他: ________________

**コンソールのエラーメッセージ**:
```
（ここにコピー＆ペースト）
```

**スクリーンショット**:
（可能であれば添付）

---

このチェックリストの結果を教えてください。問題箇所を特定して修正します。
