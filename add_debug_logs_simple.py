#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re
import sys

# Set UTF-8 encoding for print
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

def add_logs_to_game_js():
    file_path = r'c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/game.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add initial debug log
    pattern1 = r'(async _handleCardClick\(dataset\) \{\s+const \{ owner, zone, cardId, index \} = dataset;)\s+'
    replacement1 = r'''\1

        // DEBUG: Click event occurred
        console.log('Card Click:', {
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

    # Add log when isProcessing blocks
    pattern2 = r'(if \(this\.state\.isProcessing\) \{)\s+(return;)'
    replacement2 = r'''\1
            console.log('BLOCKED: isProcessing = true');
            \2'''
    content = re.sub(pattern2, replacement2, content, count=1)

    # Add log for player turn, CPU card clicked
    pattern3 = r'(if \(this\.state\.turnPlayer === \'player\' && owner === \'cpu\'\) \{)'
    replacement3 = r'''\1
            console.log('BLOCKED: Player turn, CPU card clicked', { zone });'''
    content = re.sub(pattern3, replacement3, content, count=1)

    # Add log for info display allowed
    pattern4 = r'(// CPUのカードは情報表示のみ許可.*\n\s+if \(zone === \'active\' \|\| zone === \'bench\'\) \{)'
    replacement4 = r'''\1
                console.log('INFO: Info display allowed for CPU active/bench');'''
    content = re.sub(pattern4, replacement4, content)

    # Add log for CPU turn, player card clicked
    pattern5 = r'(if \(this\.state\.turnPlayer === \'cpu\' && owner === \'player\'\) \{)\s+(// CPUターン中はプレイヤーカードをクリック不可)'
    replacement5 = r'''\1
            console.log('BLOCKED: CPU turn, Player card clicked');
            \2'''
    content = re.sub(pattern5, replacement5, content)

    # Add success log before switch
    pattern6 = r'(// Handle different phases)'
    replacement6 = r'''console.log('ALLOWED: Click allowed, processing...');

        \1'''
    content = re.sub(pattern6, replacement6, content, count=1)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"[OK] Updated game.js")

def add_logs_to_view_js():
    file_path = r'c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/view.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add log inside click event listener
    pattern = r'(const cardInSlot = slotElement\.querySelector\(\'\[data-card-id\]\'\);\s+const cardId = cardInSlot \? \(cardInSlot\.dataset\.runtimeId \|\| cardInSlot\.dataset\.cardId\) : null;)'
    replacement = r'''\1

            console.log('SLOT CLICKED (view.js):', {
                owner,
                zone,
                index,
                hasCard: !!cardId,
                cardId
            });'''
    content = re.sub(pattern, replacement, content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"[OK] Updated view.js")

def add_logs_to_interaction_js():
    file_path = r'c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/three/interaction.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add log after finding interactive parent
    pattern = r'(const object = this\._findInteractiveParent\(firstHit\.object\);)\s+(\/\/ ドラッグ可能なオブジェクト)'
    replacement = r'''\1

            console.log('THREE.JS MOUSE DOWN:', {
                objectType: object?.userData?.type,
                owner: object?.userData?.owner,
                isDraggable: object?.userData?.isDraggable,
                currentPlayer: this.gameState?.turnPlayer
            });

            \2'''
    content = re.sub(pattern, replacement, content)

    # Add log when drag is blocked
    pattern2 = r'(if \(this\.gameState && this\.gameState\.turnPlayer !== \'player\'\) \{)\s+(return;)'
    replacement2 = r'''\1
                    console.log('DRAG BLOCKED: Wrong turn', { owner: object.userData.owner, currentPlayer: this.gameState.turnPlayer });
                    \2'''
    content = re.sub(pattern2, replacement2, content, count=1)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"[OK] Updated interaction.js")

if __name__ == '__main__':
    print("Adding debug logs...")
    add_logs_to_game_js()
    add_logs_to_view_js()
    add_logs_to_interaction_js()
    print("\n[DONE] All debug logs added!")
