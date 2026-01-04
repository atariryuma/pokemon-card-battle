#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re
import sys

if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

def add_logs_to_game_js():
    file_path = r'c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/game.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if already modified
    if 'DEBUG: Click event occurred' in content or '// DEBUG: Click event occurred' in content:
        print("[SKIP] game.js already has debug logs")
        return
    
    lines = content.split('\n')
    new_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        new_lines.append(line)
        
        # Add log after extracting dataset
        if 'const { owner, zone, cardId, index } = dataset;' in line and 'async _handleCardClick' in lines[i-1]:
            new_lines.append('')
            new_lines.append('        // DEBUG: Click event occurred')
            new_lines.append("        console.log('Card Click:', {")
            new_lines.append('            owner,')
            new_lines.append('            zone,')
            new_lines.append('            cardId,')
            new_lines.append('            index,')
            new_lines.append('            currentPhase: this.state.phase,')
            new_lines.append('            turnPlayer: this.state.turnPlayer,')
            new_lines.append('            isProcessing: this.state.isProcessing')
            new_lines.append('        });')
        
        # Add log when isProcessing blocks
        elif line.strip() == 'if (this.state.isProcessing) {' and i > 0 and '処理中の場合はクリックを無視' in lines[i-1]:
            new_lines.append("            console.log('BLOCKED: isProcessing = true');")
        
        # Add log for player turn, CPU card clicked  
        elif line.strip() == "if (this.state.turnPlayer === 'player' && owner === 'cpu') {" and i > 0 and 'ターンプレイヤーと所有者のチェック' in lines[i-1]:
            new_lines.append("            console.log('BLOCKED: Player turn, CPU card clicked', { zone });")
        
        # Add log for info display allowed
        elif line.strip() == "if (zone === 'active' || zone === 'bench') {" and 'CPUのカードは情報表示のみ許可' in lines[i-1]:
            new_lines.append("                console.log('INFO: Info display allowed for CPU active/bench');")
        
        # Add log for CPU turn, player card clicked
        elif line.strip() == "if (this.state.turnPlayer === 'cpu' && owner === 'player') {":
            new_lines.append("            console.log('BLOCKED: CPU turn, Player card clicked');")
        
        # Add success log before switch
        elif line.strip() == '// Handle different phases' and 'switch' in lines[i+1]:
            new_lines.insert(-1, '')
            new_lines.insert(-1, "        console.log('ALLOWED: Click allowed, processing...');")
        
        i += 1
    
    content = '\n'.join(new_lines)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("[OK] Updated game.js")

def add_logs_to_view_js():
    file_path = r'c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/view.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'SLOT CLICKED (view.js):' in content:
        print("[SKIP] view.js already has debug logs")
        return
    
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
    content = re.sub(pattern, replacement, content, count=1)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("[OK] Updated view.js")

def add_logs_to_interaction_js():
    file_path = r'c:/Projects/pokemon-card-battle/pokemon-card-battle/src/js/three/interaction.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'THREE.JS MOUSE DOWN:' in content:
        print("[SKIP] interaction.js already has debug logs")
        return
    
    lines = content.split('\n')
    new_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        new_lines.append(line)
        
        # Add log after finding interactive parent
        if 'const object = this._findInteractiveParent(firstHit.object);' in line:
            new_lines.append('')
            new_lines.append("            console.log('THREE.JS MOUSE DOWN:', {")
            new_lines.append('                objectType: object?.userData?.type,')
            new_lines.append('                owner: object?.userData?.owner,')
            new_lines.append('                isDraggable: object?.userData?.isDraggable,')
            new_lines.append('                currentPlayer: this.gameState?.turnPlayer')
            new_lines.append('            });')
        
        # Add log when drag is blocked
        elif "if (this.gameState && this.gameState.turnPlayer !== 'player') {" in line and 'CPUターン中はドラッグ不可' in lines[i-1]:
            new_lines.append("                    console.log('DRAG BLOCKED: Wrong turn', { owner: object.userData.owner, currentPlayer: this.gameState.turnPlayer });")
        
        i += 1
    
    content = '\n'.join(new_lines)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("[OK] Updated interaction.js")

if __name__ == '__main__':
    print("Adding debug logs...")
    add_logs_to_game_js()
    add_logs_to_view_js()
    add_logs_to_interaction_js()
    print("\n[DONE] All debug logs added!")
    print("\nLogs added:")
    print("- Card Click: Basic click information")
    print("- BLOCKED: When clicks are blocked and why")
    print("- INFO: Additional information")
    print("- ALLOWED: When clicks are allowed")
    print("- SLOT CLICKED: When a slot is clicked in view")
    print("- THREE.JS MOUSE DOWN: When 3D objects are clicked")
    print("- DRAG BLOCKED: When dragging is blocked")
