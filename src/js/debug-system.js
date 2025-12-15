/**
 * DEBUG-SYSTEM.JS - CPU手札 vs プレイマット専用デバッグシステム
 */

export class DebugSystem {
    constructor() {
        this.isEnabled = false;
        this.logLevel = 'INFO';
    }

    /**
     * デバッグモードを有効化
     */
    enable(logLevel = 'INFO') {
        this.isEnabled = true;
        this.logLevel = logLevel;
        this.log('INFO', '🔧 CPU手札 vs プレイマット専用デバッグ開始');
        
        // 定期測定開始
        this.startPeriodicMeasurement();
    }

    /**
     * デバッグモードを無効化
     */
    disable() {
        this.isEnabled = false;
        this.stopPeriodicMeasurement();
        this.log('INFO', '🔧 デバッグ終了');
    }

    /**
     * ログ出力 - シンプル化
     */
    log(level, message, data = null) {
        if (!this.isEnabled) return;
        
        // 基本的なゲーム状態のみログ出力
        const allowedMessages = [
            'ゲーム開始',
            'ターン開始', 
            'ターン終了',
            'カード移動',
            'アニメーション開始',
            'アニメーション終了'
        ];
        
        // 測定系やスペック系のメッセージはスキップ
        if (message.includes('測定') || message.includes('スペック') || message.includes('詳細') || message.includes('分析')) {
            return;
        }
        
        // 許可されたメッセージのみ出力
        const shouldLog = allowedMessages.some(allowed => message.includes(allowed));
        if (!shouldLog) return;
        
        const timestamp = new Date().toISOString().slice(11, 19);
        const prefix = `[${timestamp}] ${level}`;
        
        if (data) {
            console.log(`${prefix} ${message}`, data);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }

    /**
     * CPU手札とプレイマットプレースホルダーの専用測定
     */
    measureAll() {
        this.log('INFO', '🎯 === CPU手札 & プレースホルダー測定 ===');
        
        this.measureCpuHandSpecs();
        this.testPlayerPlaceholderClicks();
        
        this.log('INFO', '🎯 === 測定完了 ===');
    }

    /**
     * プレースホルダーの詳細スペック分析
     */
    testPlayerPlaceholderClicks() {
        this.log('INFO', '🔍 === プレースホルダー詳細スペック分析 ===');
        
        const allSlots = document.querySelectorAll('#game-board .card-slot');
        const specs = [];
        
        allSlots.forEach((slot) => {
            const styles = window.getComputedStyle(slot);
            const classes = Array.from(slot.classList);
            const parentBoard = slot.closest('.player-board');
            const boardType = parentBoard ? (parentBoard.classList.contains('player-self') ? 'player' : 'cpu') : 'shared';
            
            const spec = {
                name: classes.find(c => c !== 'card-slot') || 'unnamed',
                board: boardType,
                depth: {
                    zIndex: styles.zIndex,
                    transform: styles.transform,
                },
            };
            specs.push(spec);
        });
        
        const categories = {
            player_active: specs.filter(s => s.board === 'player' && s.name.includes('active')),
            player_bench: specs.filter(s => s.board === 'player' && s.name.includes('bench')),
            cpu_active: specs.filter(s => s.board === 'cpu' && s.name.includes('active')),
            cpu_bench: specs.filter(s => s.board === 'cpu' && s.name.includes('bench')),
            shared: specs.filter(s => s.board === 'shared' && s.name.includes('stadium')),
        };
        
        Object.entries(categories).forEach(([category, items]) => {
            if (items.length > 0) {
                this.log('INFO', `📍 ${category.toUpperCase()}:`);
                items.forEach(item => {
                    this.log('INFO', `  ${item.name}: Z-Index: ${item.depth.zIndex}, Transform: ${item.depth.transform.substring(0, 50)}${item.depth.transform.length > 50 ? '...' : ''}`);
                });
            }
        });
        
        this.log('INFO', '🎯 === 分析完了 ===');
    }

    /**
     * CPU手札スペック測定
     */
    measureCpuHandSpecs() {
        this.log('INFO', '🤖 CPU手札スペック:');
        
        const cpuHandArea = document.querySelector('#cpu-hand-area');
        if (cpuHandArea) {
            const rect = cpuHandArea.getBoundingClientRect();
            const styles = getComputedStyle(cpuHandArea);
            this.log('INFO', `  エリア: ${rect.width.toFixed(1)}×${rect.height.toFixed(1)}px @(${rect.left.toFixed(1)}, ${rect.top.toFixed(1)}) z:${styles.zIndex}`);
            this.log('INFO', `  コンテナ: ${rect.width.toFixed(1)}×${rect.height.toFixed(1)}px transform:${styles.transform} z:${styles.zIndex}`);
        }
    }
    
    /**
     * プレイマットプレースホルダースペック測定
     */
    // measurePlaymatPlaceholderSpecs関数を削除 - testPlayerPlaceholderClicksに統合

    /**
     * 定期測定の開始
     */
    startPeriodicMeasurement() {
        // 初回測定
        setTimeout(() => this.measureAll(), 2000);
        
        // 20秒間隔で測定（ログ削減）
        this.measurementInterval = setInterval(() => {
            this.measureAll();
        }, 20000);
    }

    /**
     * 定期測定の停止
     */
    stopPeriodicMeasurement() {
        if (this.measurementInterval) {
            clearInterval(this.measurementInterval);
            this.measurementInterval = null;
        }
    }
}

// シングルトンインスタンス
export const debugSystem = new DebugSystem();