#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to add detailed debug logging to click handling functions
"""

import re

def add_logs_to_game_js():
    """Add debug logs to game.js _handleCardClick function"""
    file_path = r'c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/game.js'

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern 1: Add initial debug log after function signature
    pattern1 = r'(async _handleCardClick\(dataset\) \{\s+const \{ owner, zone, cardId, index \} = dataset;)\s+'
    replacement1 = r'''\1

        // 🔍 デバッグログ: クリックイベント発生
        console.log('🖱️ Card Click:', {
            owner,
            zone,
            cardId,
            index,
            currentPhase: this.state.phase,
            turnPlayer: this.state.turnPlayer,
            isProcessing: this.state.isProcessing
        });

        '''

    content = re.sub(pattern1, replacement1, content)

    # Pattern 2: Add log when isProcessing blocks
    pattern2 = r'(// 処理中の場合はクリックを無視\s+if \(this\.state\.isProcessing\) \{)'
    replacement2 = r'''\1
            console.log('⛔ Click blocked: isProcessing = true');'''

    content = re.sub(pattern2, replacement2, content)

    # Pattern 3: Add log for player turn, CPU card clicked
    pattern3 = r'(// ターンプレイヤーと所有者のチェック（情報表示を除く）\s+if \(this\.state\.turnPlayer === \'player\' && owner === \'cpu\'\) \{)'
    replacement3 = r'''\1
            console.log('⛔ Click blocked: Player turn, CPU card clicked', { zone });'''

    content = re.sub(pattern3, replacement3, content)

    # Pattern 4: Add log for info display allowed
    pattern4 = r'(// CPUのカードは情報表示のみ許可（アクティブ・ベンチのみ）\s+if \(zone === \'active\' \|\| zone === \'bench\'\) \{)'
    replacement4 = r'''\1
                console.log('ℹ️ Info display allowed for CPU active/bench');'''

    content = re.sub(pattern4, replacement4, content)

    # Pattern 5: Add log for CPU turn, player card clicked
    pattern5 = r'(if \(this\.state\.turnPlayer === \'cpu\' && owner === \'player\'\) \{\s+// CPUターン中はプレイヤーカードをクリック不可)'
    replacement5 = r'''\1
            console.log('⛔ Click blocked: CPU turn, Player card clicked');'''

    content = re.sub(pattern5, replacement5, content)

    # Pattern 6: Add success log before switch statement
    pattern6 = r'(\n\s+// Handle different phases\s+switch \(this\.state\.phase\) \{)'
    replacement6 = r'''

        console.log('✅ Click allowed, processing...');
\1'''

    content = re.sub(pattern6, replacement6, content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✅ Updated {file_path}")


def add_logs_to_view_js():
    """Add debug logs to view.js _makeSlotClickable function"""
    file_path = r'c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/view.js'

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add log inside click event listener
    pattern = r'(const cardInSlot = slotElement\.querySelector\(\'\[data-card-id\]\'\);\s+const cardId = cardInSlot \? \(cardInSlot\.dataset\.runtimeId \|\| cardInSlot\.dataset\.cardId\) : null;)'
    replacement = r'''\1

            console.log('🎯 Slot clicked (view.js):', {
                owner,
                zone,
                index,
                hasCard: !!cardId,
                cardId
            });'''

    content = re.sub(pattern, replacement, content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✅ Updated {file_path}")


def add_logs_to_interaction_js():
    """Add debug logs to three/interaction.js _handleMouseDown function"""
    file_path = r'c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/three/interaction.js'

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add log after finding interactive parent
    pattern = r'(const object = this\._findInteractiveParent\(firstHit\.object\);)\s+(\/\/ ドラッグ可能なオブジェクト（カード）のみ)'
    replacement = r'''\1

            console.log('🖱️ Three.js Mouse Down:', {
                objectType: object?.userData?.type,
                owner: object?.userData?.owner,
                isDraggable: object?.userData?.isDraggable,
                currentPlayer: this.gameState?.turnPlayer
            });

            \2'''

    content = re.sub(pattern, replacement, content)

    # Add log when drag is blocked by wrong turn
    pattern2 = r'(// ターンチェック: CPUターン中はドラッグ不可\s+if \(this\.gameState && this\.gameState\.turnPlayer !== \'player\'\) \{)'
    replacement2 = r'''\1
                    console.log('⛔ Drag blocked: Wrong turn', { owner: object.userData.owner, currentPlayer: this.gameState.turnPlayer });'''

    content = re.sub(pattern2, replacement2, content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✅ Updated {file_path}")


def add_logs_to_board_event_handler_js():
    """Add debug logs to view/board-event-handler.js _handleClick function"""
    file_path = r'c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/view/board-event-handler.js'

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if logs already exist
    if '⛔ BoardEventHandler: disabled' in content:
        print(f"ℹ️  {file_path} already has debug logs")
        return

    # Replace existing log with enhanced version
    pattern = r"console\.log\('🖱️ BoardEventHandler: disabled, ignoring'\);"
    replacement = "console.log('⛔ BoardEventHandler: disabled');"

    content = re.sub(pattern, replacement, content)

    # Enhance the isEnabled check
    pattern2 = r'(_handleClick\(event\) \{\s+)(//.*\s+console\.log.*\s+\s+if \(!this\.isEnabled\) \{)'
    replacement2 = r'''\1if (!this.isEnabled) {
            console.log('⛔ BoardEventHandler: disabled');
            return;
        }

        console.log('🎯 BoardEventHandler click:', {
            isEnabled: this.isEnabled,
            target: event.target.className
        });

        // カードスロットを探す
        const slot = this._findCardSlot(event.target);
        console.log('🖱️ BoardEventHandler: found slot?', slot);

        if (!slot) {'''

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✅ Updated {file_path}")


if __name__ == '__main__':
    print("Adding debug logs to click handling functions...")
    add_logs_to_game_js()
    add_logs_to_view_js()
    add_logs_to_interaction_js()
    add_logs_to_board_event_handler_js()
    print("\n[OK] All debug logs added successfully!")
    print("\nTo test:")
    print("1. Restart the development server")
    print("2. Open the game in browser")
    print("3. Check console for debug logs when clicking cards")
