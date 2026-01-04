import { Game } from './game.js';
import { errorHandler } from './error-handler.js';
import { animate } from './animation-manager.js';
import { enableAutoRefresh } from './data-manager.js';
import { debugSystem } from './debug-system.js';
import { gameLogger } from './game-logger.js';
import { noop } from './utils.js';

// 初期化状態の追跡
let initializationState = {
    started: false,
    completed: false,
    error: null
};

// 初期化プロセスの確実な実行
async function initializeApp() {
    if (initializationState.started) {
        console.warn('⚠️ Initialization already in progress or completed');
        return;
    }
    
    initializationState.started = true;
    
    try {
        // ✅ Three.js専用: game-stageをルート要素として使用
        const root = document.getElementById('game-stage');
        if (!root) {
            throw new Error('ゲームステージ要素が見つかりません。');
        }

        // ゲームインスタンスの作成
        const game = new Game(root, window.playmatSlotsData);
        
        // グローバルアクセスを確保
        window.game = game;
        
        // アニメーション設定
        animate.setQuality(window.matchMedia('(max-width: 768px)').matches ? 'medium' : 'high');
        window.animate = animate;
        
        // カードデータ自動更新機能を有効化
        enableAutoRefresh();
        
        // ゲーム初期化を実行
        await game.init();
        
        // ゲームログシステム起動
        window.gameLogger = gameLogger;
        gameLogger.logGameEvent('GAME', 'ゲーム初期化完了');
        
        // コンテナ位置情報をログ出力
        // gameLogger.logAllContainers();
        
        // 初期化完了後にブラウザコンソール用のデバッグ関数を設定
        /* window.debugGameLayout = () => {
            console.log('🔍 === ゲームレイアウト診断 ===');
            
            const cpuHandArea = document.getElementById('cpu-hand-area-new');
            const cpuHand = document.getElementById('cpu-hand');
            const playerHand = document.getElementById('player-hand');
            const opponentBoard = document.querySelector('.opponent-board');
            
            console.log('CPU Hand Area:', cpuHandArea);
            if (cpuHandArea) {
                const rect = cpuHandArea.getBoundingClientRect();
                const style = getComputedStyle(cpuHandArea);
                console.log('CPU Hand Area - Position:', `${rect.left}x${rect.top}`, 'Size:', `${rect.width}x${rect.height}`, 'CSS Position:', style.position, 'z-index:', style.zIndex);
            }
            
            console.log('CPU Hand:', cpuHand);
            if (cpuHand) {
                const rect = cpuHand.getBoundingClientRect();
                const style = getComputedStyle(cpuHand);
                console.log('CPU Hand - Position:', `${rect.left}x${rect.top}`, 'Size:', `${rect.width}x${rect.height}`, 'Display:', style.display, 'Visibility:', style.visibility);
                console.log('CPU Hand Cards Count:', cpuHand.children.length);
            }
            
            console.log('Player Hand:', playerHand);
            if (playerHand) {
                const rect = playerHand.getBoundingClientRect();
                const style = getComputedStyle(playerHand);
                console.log('Player Hand - Position:', `${rect.left}x${rect.top}`, 'Size:', `${rect.width}x${rect.height}`, 'Transform:', style.transform);
            }
            
            console.log('Opponent Board:', opponentBoard);
            if (opponentBoard) {
                const rect = opponentBoard.getBoundingClientRect();
                const style = getComputedStyle(opponentBoard);
                console.log('Opponent Board - Position:', `${rect.left}x${rect.top}`, 'Size:', `${rect.width}x${rect.height}`, 'Pointer Events:', style.pointerEvents);
                
                // 相手フィールドの子要素をテスト
                const slots = opponentBoard.querySelectorAll('.card-slot');
                console.log('Opponent Board Slots:', slots.length);
                slots.forEach((slot, i) => {
                    const slotRect = slot.getBoundingClientRect();
                    console.log(`  Slot ${i}:`, slot.className, `${slotRect.left}x${slotRect.top}`, `${slotRect.width}x${slotRect.height}`);
                });
            }
            
            // 全エリアの相互作用テストを実行
            gameLogger.testAllGameAreaInteractions();
            
            // 相手フィールドの詳細テスト
            console.log('🎯 === 相手フィールド詳細テスト ===');
            if (opponentBoard) {
                const slots = opponentBoard.querySelectorAll('.card-slot');
                console.log(`Found ${slots.length} opponent slots`);
                
                // アクティブスロットの直接テスト
                const activeSlot = opponentBoard.querySelector('.active-top');
                if (activeSlot) {
                    const rect = activeSlot.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    const elementAtPoint = document.elementFromPoint(centerX, centerY);
                    console.log('Active Slot Test:', {
                        slot: activeSlot,
                        position: `${rect.left}x${rect.top}`,
                        size: `${rect.width}x${rect.height}`,
                        centerPoint: `${centerX}x${centerY}`,
                        elementAtPoint: elementAtPoint,
                        isBlocked: elementAtPoint !== activeSlot && !activeSlot.contains(elementAtPoint)
                    });
                }
            }
            
            console.log('🔍 === 診断完了 ===');
        }; */
        
        // 5秒後にデバッグ情報を自動実行
        /* setTimeout(() => {
            window.debugGameLayout();
        }, 5000); */
        
        initializationState.completed = true;
        
        // 初期化完了をグローバルイベントで通知
        window.dispatchEvent(new CustomEvent('gameInitialized', { 
            detail: { game, success: true } 
        }));
        
    } catch (error) {
        initializationState.error = error;
        console.error('❌ Game initialization failed:', error);
        
        // エラーハンドラーで処理
        errorHandler.handleError(error, 'game_initialization_failed');
        
        // エラー通知イベント
        window.dispatchEvent(new CustomEvent('gameInitialized', { 
            detail: { game: null, success: false, error } 
        }));
        
        // フォールバック: 基本的なボタン機能のみ有効化
        setupFallbackButtonHandlers();
    }
}

// フォールバック: 基本的なボタン機能
function setupFallbackButtonHandlers() {
    const startButton = document.getElementById('start-game-button-float');
    if (startButton) {
        startButton.addEventListener('click', () => {
            alert('ゲームの初期化に失敗しました。ページを再読み込みしてください。');
        });
    }
    
    const editorButton = document.getElementById('card-editor-button-float');
    if (editorButton) {
        editorButton.addEventListener('click', () => {
            window.open('card_viewer.html', '_blank');
        });
    }
}

// 確実なDOMContentLoaded処理
function ensureDOMReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

// メイン初期化処理
ensureDOMReady(async () => {
    await initializeApp();
});

// デバッグ情報をグローバルに提供
window.gameDebug = {
    initializationState,
    reinitialize: initializeApp,
    setupFallback: setupFallbackButtonHandlers
};