import { Game } from './game.js';
import { errorHandler } from './error-handler.js';
import { animate } from './animation-manager.js';
import { enableAutoRefresh, loadCardsFromJSON } from './data-manager.js';
import { debugSystem } from './debug-system.js';
import { gameLogger } from './game-logger.js';
import { noop } from './utils.js';
import { difficultySelector } from './ui/DifficultySelector.js';

// 初期化状態の追跡
let initializationState = {
    started: false,
    completed: false,
    error: null
};

// 初期化プロセスの確実な実行
async function initializeApp() {
    // ✅ FIX #2: 初期化エラーリカバリの実装
    // エラー発生時は再初期化を許可
    if (initializationState.started && !initializationState.error) {
        console.warn('⚠️ Initialization already in progress or completed');
        return;
    }

    // エラーからの復帰時は状態をリセット
    if (initializationState.error) {
        console.log('🔄 Recovering from previous initialization error...');
        initializationState = {
            started: false,
            completed: false,
            error: null
        };
    }

    initializationState.started = true;

    try {
        // ✅ CRITICAL: Load card data BEFORE anything else
        console.log('📦 Loading card data from JSON...');
        await loadCardsFromJSON();
        console.log('✅ Card data loaded successfully');

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

        // ✅ Button handlers are now registered in game.js._setupActionButtonHandlers()
        // No need for manual registration here


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

        // ✅ Start Screen Handler
        const startBtn = document.getElementById('start-btn-primary');
        const startScreen = document.getElementById('start-screen');
        const gameWrapper = document.getElementById('game-wrapper');
        const gameStatusPanel = document.getElementById('game-status-panel');

        if (startBtn && startScreen && gameWrapper) {
            startBtn.addEventListener('click', async () => {
                // Audio Context Initialization (User Interaction Required)
                if (window.Howler) {
                    // Unlock audio on iOS/mobile
                    if (Howler.ctx && Howler.ctx.state !== 'running') {
                        Howler.ctx.resume().then(() => {
                            console.log('🔊 Audio Context Resumed');
                        });
                    }
                    console.log('🎵 Game Start clicked - Audio initialized');
                }

                try {
                    // ✅ FIX: Hide start screen IMMEDIATELY to prevent overlay
                    startScreen.classList.add('hidden');
                    startScreen.style.display = 'none';

                    // Show difficulty selector and wait for user choice
                    const difficulty = await difficultySelector.show();

                    // Handle cancellation (user clicked cancel or background)
                    if (!difficulty) {
                        console.log('Difficulty selection cancelled - returning to menu');
                        // ✅ FIX: Show start screen again if user cancels
                        startScreen.style.display = 'flex';
                        startScreen.classList.remove('hidden');
                        return; // Exit start flow, stay on start screen
                    }

                    console.log(`🤖 Selected AI Difficulty: ${difficulty}`);

                    // Set AI difficulty
                    if (window.game && window.game.turnManager) {
                        window.game.turnManager.setAIDifficulty(difficulty);
                    }

                    // UI Transition to game
                    gameWrapper.classList.remove('hidden');

                    // Show game status panel
                    if (gameStatusPanel) {
                        gameStatusPanel.classList.remove('hidden');
                    }

                    // Trigger Three.js game start (if available)
                    if (window.game && window.game.view && window.game.view.threeViewBridge) {
                        console.log('🎬 ThreeViewBridge: onGameStart triggered');
                        window.game.view.threeViewBridge.onGameStart();
                    }

                } catch (error) {
                    console.error('Error during game start:', error);
                    // ✅ FIX: Show start screen again on error
                    startScreen.style.display = 'flex';
                    startScreen.classList.remove('hidden');
                    alert('ゲーム開始中にエラーが発生しました。ページを再読み込みしてください。');
                }
            });
        }

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