/**
 * BUG DETECTOR
 * 
 * 自動バグ検出エンジン
 * アニメーション問題、メモリリーク、状態不整合を検出
 */

import { wait, checkMemoryLeaks, checkStateSync, logTestResult } from './test-helpers.js';

class BugDetector {
    constructor() {
        this.issues = [];
        this.monitoring = false;
        this.monitoringInterval = null;
    }

    /**
     * すべてのバグチェックを実行
     * @returns {Object} - 検出結果
     */
    async detectAll() {
        console.log('🔍 Starting bug detection...\n');

        this.issues = [];

        await this.detectAnimationIssues();
        await this.detectMemoryLeaks();
        await this.detectStateInconsistencies();
        await this.detectDOMIssues();
        await this.detectThreeJSIssues();

        return this.generateReport();
    }

    /**
     * アニメーション問題を検出
     */
    async detectAnimationIssues() {
        console.log('🎬 Checking for animation issues...');

        const animatedElements = document.querySelectorAll('[style*="transition"], [style*="animation"]');

        for (const element of animatedElements) {
            const computedStyle = window.getComputedStyle(element);

            // 非常に長いトランジション（スタックの可能性）
            const transitionDuration = parseFloat(computedStyle.transitionDuration);
            if (transitionDuration > 10) {
                this.addIssue('animation', 'long-transition', {
                    element: element.tagName,
                    duration: transitionDuration,
                    message: `Transition duration is abnormally long: ${transitionDuration}s`
                });
            }

            // 競合するトランジションプロパティ
            const transitionProperty = computedStyle.transitionProperty;
            if (transitionProperty.includes('all') && transitionProperty.includes(',')) {
                this.addIssue('animation', 'conflicting-transitions', {
                    element: element.tagName,
                    property: transitionProperty,
                    message: 'Conflicting transition properties detected'
                });
            }
        }

        logTestResult('Animation Issues Check', this.issues.filter(i => i.category === 'animation').length === 0);
    }

    /**
     * メモリリークを検出
     */
    async detectMemoryLeaks() {
        console.log('💾 Checking for memory leaks...');

        const memoryInfo = checkMemoryLeaks();

        if (memoryInfo.warnings.length > 0) {
            memoryInfo.warnings.forEach(warning => {
                this.addIssue('memory', 'potential-leak', {
                    warning,
                    domNodes: memoryInfo.domNodes,
                    threeObjects: memoryInfo.threeObjects
                });
            });
        }

        // イベントリスナーの重複チェック
        const eventElements = document.querySelectorAll('[data-has-listener="true"]');
        if (eventElements.length > 100) {
            this.addIssue('memory', 'too-many-listeners', {
                count: eventElements.length,
                message: `Too many elements with event listeners: ${eventElements.length}`
            });
        }

        logTestResult('Memory Leak Check', this.issues.filter(i => i.category === 'memory').length === 0);
    }

    /**
     * 状態不整合を検出
     */
    async detectStateInconsistencies() {
        console.log('🔄 Checking for state inconsistencies...');

        const syncResult = checkStateSync();

        if (!syncResult.synced) {
            syncResult.mismatches.forEach(mismatch => {
                this.addIssue('state', 'sync-mismatch', {
                    mismatch,
                    stateCards: syncResult.stateCards,
                    threeCards: syncResult.threeCards
                });
            });
        }

        // ゲーム状態の論理チェック
        if (window.game?.state) {
            const state = window.game.state;

            // プレイヤーがアクティブもベンチも持っていない
            const playerHasNoCards = !state.players.player.active &&
                state.players.player.bench.every(c => !c);
            const cpuHasNoCards = !state.players.cpu.active &&
                state.players.cpu.bench.every(c => !c);

            if (playerHasNoCards && state.phase !== 'game_over') {
                this.addIssue('state', 'no-player-cards', {
                    message: 'Player has no cards on field but game is not over'
                });
            }

            if (cpuHasNoCards && state.phase !== 'game_over') {
                this.addIssue('state', 'no-cpu-cards', {
                    message: 'CPU has no cards on field but game is not over'
                });
            }

            // サイドカード数の不整合
            if (state.players.player.prizeRemaining < 0 || state.players.player.prizeRemaining > 6) {
                this.addIssue('state', 'invalid-prize-count', {
                    player: 'player',
                    prizeRemaining: state.players.player.prizeRemaining,
                    message: `Invalid prize count: ${state.players.player.prizeRemaining}`
                });
            }

            if (state.players.cpu.prizeRemaining < 0 || state.players.cpu.prizeRemaining > 6) {
                this.addIssue('state', 'invalid-prize-count', {
                    player: 'cpu',
                    prizeRemaining: state.players.cpu.prizeRemaining,
                    message: `Invalid prize count: ${state.players.cpu.prizeRemaining}`
                });
            }
        }

        logTestResult('State Consistency Check', this.issues.filter(i => i.category === 'state').length === 0);
    }

    /**
     * DOM問題を検出
     */
    async detectDOMIssues() {
        console.log('🌳 Checking for DOM issues...');

        // 孤立したカード要素（親がない）
        const orphanCards = Array.from(document.querySelectorAll('.card')).filter(card => {
            return !card.parentElement || card.parentElement.tagName === 'BODY';
        });

        if (orphanCards.length > 0) {
            this.addIssue('dom', 'orphan-cards', {
                count: orphanCards.length,
                message: `Found ${orphanCards.length} orphaned card elements`
            });
        }

        // 重複ID
        const ids = new Map();
        document.querySelectorAll('[id]').forEach(element => {
            const id = element.id;
            if (ids.has(id)) {
                this.addIssue('dom', 'duplicate-id', {
                    id,
                    message: `Duplicate ID found: ${id}`
                });
            }
            ids.set(id, element);
        });

        // 空のスロット内に複数のカード
        const slots = document.querySelectorAll('[data-slot-id]');
        slots.forEach(slot => {
            const cards = slot.querySelectorAll('.card');
            if (cards.length > 1) {
                this.addIssue('dom', 'multiple-cards-in-slot', {
                    slotId: slot.dataset.slotId,
                    cardCount: cards.length,
                    message: `Slot ${slot.dataset.slotId} contains ${cards.length} cards`
                });
            }
        });

        logTestResult('DOM Issues Check', this.issues.filter(i => i.category === 'dom').length === 0);
    }

    /**
     * Three.js問題を検出
     */
    async detectThreeJSIssues() {
        console.log('🎨 Checking for Three.js issues...');

        const bridge = window.threeViewBridge || window.game?.view?.threeViewBridge;
        if (!bridge?.gameBoard) {
            this.addIssue('threejs', 'no-bridge', {
                message: 'Three.js view bridge not available'
            });
            return;
        }

        const gameBoard = bridge.gameBoard;

        // undisposedオブジェクトのチェック
        if (gameBoard.scene) {
            const totalObjects = gameBoard.scene.children.length;
            const cardCount = gameBoard.cards.size;

            // カード以外のオブジェクトが多すぎる
            if (totalObjects > cardCount * 5) {
                this.addIssue('threejs', 'too-many-objects', {
                    totalObjects,
                    cardCount,
                    message: `Scene has ${totalObjects} objects but only ${cardCount} cards`
                });
            }
        }

        // カードメッシュの整合性チェック
        gameBoard.cards.forEach((card, runtimeId) => {
            if (!card.mesh) {
                this.addIssue('threejs', 'missing-mesh', {
                    runtimeId,
                    message: `Card ${runtimeId} has no mesh`
                });
            }

            if (card.mesh && !card.mesh.parent) {
                this.addIssue('threejs', 'detached-mesh', {
                    runtimeId,
                    message: `Card ${runtimeId} mesh is detached from scene`
                });
            }

            // ダメージがあるのにバッジがない
            if (card.mesh?.userData?.damage > 0 && !card.damageBadge) {
                this.addIssue('threejs', 'missing-damage-badge', {
                    runtimeId,
                    damage: card.mesh.userData.damage,
                    message: `Card ${runtimeId} has ${card.mesh.userData.damage} damage but no badge`
                });
            }
        });

        logTestResult('Three.js Issues Check', this.issues.filter(i => i.category === 'threejs').length === 0);
    }

    /**
     * 問題を追加
     */
    addIssue(category, type, details) {
        this.issues.push({
            category,
            type,
            timestamp: new Date().toISOString(),
            ...details
        });
    }

    /**
     * レポートを生成
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            totalIssues: this.issues.length,
            categories: {},
            issues: this.issues
        };

        // カテゴリ別に集計
        this.issues.forEach(issue => {
            if (!report.categories[issue.category]) {
                report.categories[issue.category] = 0;
            }
            report.categories[issue.category]++;
        });

        console.log('\n📊 Bug Detection Report:');
        console.log('========================');
        console.log(`Total Issues: ${report.totalIssues}`);

        if (report.totalIssues === 0) {
            console.log('✅ No issues detected!');
        } else {
            console.log('\nIssues by category:');
            Object.entries(report.categories).forEach(([category, count]) => {
                console.log(`  ${category}: ${count}`);
            });

            console.log('\nDetailed Issues:');
            this.issues.forEach((issue, index) => {
                console.log(`\n${index + 1}. [${issue.category}] ${issue.type}`);
                console.log(`   ${issue.message || JSON.stringify(issue)}`);
            });
        }

        return report;
    }

    /**
     * 継続的モニタリングを開始
     */
    startMonitoring(interval = 5000) {
        if (this.monitoring) {
            console.warn('Bug monitoring is already running');
            return;
        }

        console.log(`🔍 Starting continuous bug monitoring (interval: ${interval}ms)`);
        this.monitoring = true;

        this.monitoringInterval = setInterval(async () => {
            await this.detectAll();
        }, interval);
    }

    /**
     * モニタリングを停止
     */
    stopMonitoring() {
        if (!this.monitoring) {
            return;
        }

        console.log('⏸️ Stopping bug monitoring');
        clearInterval(this.monitoringInterval);
        this.monitoring = false;
        this.monitoringInterval = null;
    }
}

// シングルトンインスタンス
export const bugDetector = new BugDetector();

// グローバルに公開
if (typeof window !== 'undefined') {
    window.bugDetector = bugDetector;
}

export default bugDetector;
