/**
 * CORE.JS - アニメーションコアクラス
 * 
 * シンプルで軽量なアニメーション基盤
 * 最小限のコードで最大の効果を提供
 */

export const ANIMATION_TIMING = {
    fast: 200,
    normal: 400, 
    slow: 800,
    combat: 600
};

export const ANIMATION_EASING = {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
};

/**
 * アニメーション基底クラス
 */
export class AnimationCore {
    constructor() {
        this.activeAnimations = new Set();
        this.cleanupSchedule = new Set();
        this.initializeAnimationStyles();
    }

    /**
     * 基本アニメーション実行
     * @param {Element} element - 対象要素
     * @param {string} className - CSSクラス名
     * @param {number} duration - 継続時間
     * @returns {Promise} 完了Promise
     */
    async animate(element, className, duration = ANIMATION_TIMING.normal) {
        if (!element) return;
        
        return new Promise(resolve => {
            // アニメーション開始
            element.classList.add(className);
            
            // 完了後クリーンアップ
            const cleanup = () => {
                element.classList.remove(className);
                this.activeAnimations.delete(cleanup);
                resolve();
            };
            
            this.activeAnimations.add(cleanup);
            setTimeout(cleanup, duration);
        });
    }

    /**
     * 全アニメーションクリーンアップ
     */
    async cleanup() {
        const promises = Array.from(this.activeAnimations);
        this.activeAnimations.clear();
        await Promise.all(promises.map(fn => fn()));
    }

    /**
     * 要素の基本情報取得
     */
    getElementRect(element) {
        if (!element) return null;
        return element.getBoundingClientRect();
    }

    /**
     * 遅延処理
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * クリーンアップのスケジュール
     */
    scheduleCleanup(callback, delay) {
        const timeoutId = setTimeout(() => {
            callback();
            this.cleanupSchedule.delete(timeoutId);
        }, delay);
        this.cleanupSchedule.add(timeoutId);
    }

    /**
     * アニメーションスタイルを初期化
     */
    initializeAnimationStyles() {
        if (document.getElementById('pokemon-animation-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'pokemon-animation-styles';
        style.textContent = `
            @keyframes slideToTarget {
                0% { transform: translate(0px, 0px) scale(1); opacity: 0; }
                30% { transform: translate(-15px, -15px) scale(0.95); opacity: 1; }
                70% { transform: translate(-30px, -30px) scale(0.7); opacity: 0.9; }
                100% { transform: translate(-45px, -45px) scale(0.3); opacity: 0; }
            }
            
            .anim-attack-forward {
                animation: attackForward ${ANIMATION_TIMING.combat}ms ease-out;
            }
            
            .anim-damage-shake {
                animation: damageShake ${ANIMATION_TIMING.combat}ms ease-in-out;
            }
            
            .anim-knockout {
                animation: knockout ${ANIMATION_TIMING.slow}ms ease-in;
            }
            
            .anim-screen-shake {
                animation: screenShake ${ANIMATION_TIMING.combat}ms ease-in-out;
            }
            
            .anim-screen-flash {
                animation: screenFlash ${ANIMATION_TIMING.fast}ms ease-in-out;
            }
            
            .anim-condition-poison {
                animation: conditionPoison 2s ease-in-out infinite;
            }
            
            .anim-condition-burn {
                animation: conditionBurn 1.5s ease-in-out infinite;
            }
            
            .anim-condition-sleep {
                animation: conditionSleep 3s ease-in-out infinite;
            }
            
            .anim-condition-paralyze {
                animation: conditionParalyze 1s ease-in-out infinite;
            }
            
            .anim-condition-confuse {
                animation: conditionConfuse 2.5s ease-in-out infinite;
            }
            
            @keyframes attackForward {
                0% { transform: translateX(0) scale(1); }
                50% { transform: translateX(10px) scale(1.05); }
                100% { transform: translateX(0) scale(1); }
            }
            
            @keyframes damageShake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }
            
            @keyframes knockout {
                0% { transform: rotate(0deg) scale(1); opacity: 1; }
                100% { transform: rotate(360deg) scale(0); opacity: 0; }
            }
            
            @keyframes screenShake {
                0%, 100% { transform: translateY(0); }
                25% { transform: translateY(-2px); }
                75% { transform: translateY(2px); }
            }
            
            @keyframes screenFlash {
                0%, 100% { background-color: transparent; }
                50% { background-color: rgba(255, 255, 255, 0.3); }
            }
            
            @keyframes conditionPoison {
                0%, 100% { filter: hue-rotate(0deg) brightness(1); }
                50% { filter: hue-rotate(270deg) brightness(1.2); }
            }
            
            @keyframes conditionBurn {
                0%, 100% { filter: hue-rotate(0deg) brightness(1); }
                50% { filter: hue-rotate(15deg) brightness(1.3); }
            }
            
            @keyframes conditionSleep {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            @keyframes conditionParalyze {
                0%, 100% { filter: brightness(1); }
                50% { filter: brightness(1.5) sepia(1) hue-rotate(40deg); }
            }
            
            @keyframes conditionConfuse {
                0%, 100% { transform: rotate(0deg); }
                25% { transform: rotate(2deg); }
                75% { transform: rotate(-2deg); }
            }
            
            /* UI アニメーション */
            .anim-game-start {
                animation: gameStart ${ANIMATION_TIMING.slow}ms ease-in-out;
            }
            
            .anim-attack-ready {
                animation: attackReady ${ANIMATION_TIMING.normal}ms ease-in-out;
            }
            
            .anim-turn-end {
                animation: turnEnd ${ANIMATION_TIMING.normal}ms ease-in-out;
            }
            
            .anim-turn-start {
                animation: turnStart ${ANIMATION_TIMING.normal}ms ease-in-out;
            }
            
            .anim-notification-show {
                animation: notificationShow ${ANIMATION_TIMING.normal}ms ease-out;
            }
            
            .anim-notification-hide {
                animation: notificationHide ${ANIMATION_TIMING.normal}ms ease-in;
            }
            
            /* Dynamic notification type classes */
            .anim-notification-info { background-color: #2196f3; }
            .anim-notification-success { background-color: #4caf50; }
            .anim-notification-warning { background-color: #ff9800; }
            .anim-notification-error { background-color: #f44336; }
            
            .anim-modal-show {
                animation: modalShow ${ANIMATION_TIMING.normal}ms ease-out;
            }
            
            .anim-modal-hide {
                animation: modalHide ${ANIMATION_TIMING.normal}ms ease-in;
            }
            
            .anim-loading-show {
                animation: loadingShow ${ANIMATION_TIMING.fast}ms ease-out;
            }
            
            .anim-loading-hide {
                animation: loadingHide ${ANIMATION_TIMING.fast}ms ease-in;
            }
            
            .anim-highlight-show {
                animation: highlightShow ${ANIMATION_TIMING.fast}ms ease-out;
            }
            
            .anim-highlight-hide {
                animation: highlightHide ${ANIMATION_TIMING.fast}ms ease-in;
            }
            
            /* カード移動アニメーション */
            .anim-card-to-active {
                animation: cardToActive ${ANIMATION_TIMING.normal}ms ease-out;
            }
            
            .anim-card-to-bench {
                animation: cardToBench ${ANIMATION_TIMING.normal}ms ease-out;
            }
            
            .anim-card-knockout {
                animation: cardKnockout ${ANIMATION_TIMING.slow}ms ease-in;
            }
            
            .anim-card-promote {
                animation: cardPromote ${ANIMATION_TIMING.normal}ms ease-out;
            }
            
            .anim-deck-lift {
                animation: deckLift ${ANIMATION_TIMING.fast}ms ease-out;
            }
            
            .anim-card-draw {
                animation: cardDraw ${ANIMATION_TIMING.normal}ms ease-out;
            }
            
            .anim-card-move {
                animation: cardMove ${ANIMATION_TIMING.normal}ms ease-out;
            }
            
            .anim-card-flip {
                animation: cardFlip ${ANIMATION_TIMING.normal}ms ease-in-out;
            }
            
            /* エフェクトアニメーション */
            .anim-energy-glow-fire { animation: energyGlowFire ${ANIMATION_TIMING.slow}ms ease-in-out; }
            .anim-energy-glow-water { animation: energyGlowWater ${ANIMATION_TIMING.slow}ms ease-in-out; }
            .anim-energy-glow-grass { animation: energyGlowGrass ${ANIMATION_TIMING.slow}ms ease-in-out; }
            .anim-energy-glow-lightning { animation: energyGlowLightning ${ANIMATION_TIMING.slow}ms ease-in-out; }
            .anim-energy-glow-psychic { animation: energyGlowPsychic ${ANIMATION_TIMING.slow}ms ease-in-out; }
            .anim-energy-glow-fighting { animation: energyGlowFighting ${ANIMATION_TIMING.slow}ms ease-in-out; }
            .anim-energy-glow-darkness { animation: energyGlowDarkness ${ANIMATION_TIMING.slow}ms ease-in-out; }
            .anim-energy-glow-metal { animation: energyGlowMetal ${ANIMATION_TIMING.slow}ms ease-in-out; }
            .anim-energy-glow-colorless { animation: energyGlowColorless ${ANIMATION_TIMING.slow}ms ease-in-out; }
            
            .anim-energy-integrate {
                animation: energyIntegrate ${ANIMATION_TIMING.normal}ms ease-in-out;
            }
            
            .anim-evolution-glow {
                animation: evolutionGlow ${ANIMATION_TIMING.slow}ms ease-in-out;
            }
            
            .anim-evolution-emerge {
                animation: evolutionEmerge ${ANIMATION_TIMING.slow}ms ease-out;
            }
            
            .anim-heal-glow {
                animation: healGlow ${ANIMATION_TIMING.normal}ms ease-in-out;
            }
            
            .anim-hp-recover {
                animation: hpRecover ${ANIMATION_TIMING.normal}ms ease-out;
            }
            
            .anim-hp-flash {
                animation: hpFlash ${ANIMATION_TIMING.fast}ms ease-in-out;
            }
            
            .anim-prize-glow {
                animation: prizeGlow ${ANIMATION_TIMING.normal}ms ease-in-out;
            }
            
            .anim-prize-take {
                animation: prizeTake ${ANIMATION_TIMING.normal}ms ease-out;
            }
            
            .anim-victory-approach {
                animation: victoryApproach ${ANIMATION_TIMING.normal}ms ease-in-out;
            }
            
            /* ===== KEYFRAMES ===== */
            
            /* UI Keyframes */
            @keyframes gameStart {
                0% { transform: scale(0.8); opacity: 0; }
                50% { transform: scale(1.1); opacity: 0.8; }
                100% { transform: scale(1); opacity: 1; }
            }
            
            @keyframes attackReady {
                0%, 100% { box-shadow: 0 0 0 rgba(255, 255, 0, 0.5); }
                50% { box-shadow: 0 0 20px rgba(255, 255, 0, 0.8); }
            }
            
            @keyframes turnEnd {
                0% { opacity: 1; transform: scale(1); }
                100% { opacity: 0.6; transform: scale(0.95); }
            }
            
            @keyframes turnStart {
                0% { opacity: 0.6; transform: scale(0.95); }
                100% { opacity: 1; transform: scale(1); }
            }
            
            @keyframes notificationShow {
                0% { transform: translateY(-20px); opacity: 0; }
                100% { transform: translateY(0); opacity: 1; }
            }
            
            @keyframes notificationHide {
                0% { transform: translateY(0); opacity: 1; }
                100% { transform: translateY(-20px); opacity: 0; }
            }
            
            @keyframes modalShow {
                0% { transform: scale(0.8); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
            }
            
            @keyframes modalHide {
                0% { transform: scale(1); opacity: 1; }
                100% { transform: scale(0.8); opacity: 0; }
            }
            
            @keyframes loadingShow {
                0% { opacity: 0; }
                100% { opacity: 1; }
            }
            
            @keyframes loadingHide {
                0% { opacity: 1; }
                100% { opacity: 0; }
            }
            
            @keyframes highlightShow {
                0% { box-shadow: 0 0 0 rgba(255, 215, 0, 0); }
                100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.8); }
            }
            
            @keyframes highlightHide {
                0% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.8); }
                100% { box-shadow: 0 0 0 rgba(255, 215, 0, 0); }
            }
            
            /* Card Movement Keyframes */
            @keyframes cardToActive {
                0% { transform: translateY(0) scale(1); }
                50% { transform: translateY(-20px) scale(1.1); }
                100% { transform: translateY(0) scale(1); }
            }
            
            @keyframes cardToBench {
                0% { transform: translateX(0) scale(1); }
                50% { transform: translateX(-10px) scale(0.9); }
                100% { transform: translateX(0) scale(1); }
            }
            
            @keyframes cardKnockout {
                0% { transform: rotate(0deg) scale(1); opacity: 1; }
                50% { transform: rotate(180deg) scale(1.1); opacity: 0.5; }
                100% { transform: rotate(360deg) scale(0); opacity: 0; }
            }
            
            @keyframes cardPromote {
                0% { transform: translateY(0) scale(0.8); }
                50% { transform: translateY(-30px) scale(1.2); }
                100% { transform: translateY(0) scale(1); }
            }
            
            @keyframes deckLift {
                0% { transform: translateY(0); }
                50% { transform: translateY(-5px); }
                100% { transform: translateY(0); }
            }
            
            @keyframes cardDraw {
                0% { transform: translateY(10px) scale(0.8); opacity: 0; }
                100% { transform: translateY(0) scale(1); opacity: 1; }
            }
            
            @keyframes cardMove {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            @keyframes cardFlip {
                0% { transform: rotateY(0deg); }
                50% { transform: rotateY(90deg); }
                100% { transform: rotateY(0deg); }
            }
            
            /* Effect Keyframes */
            @keyframes energyGlowFire { 
                0%, 100% { 
                    box-shadow: 0 0 20px #ff4444, 0 0 40px #ff444440; 
                    transform: scale(1); 
                } 
                25%, 75% { 
                    box-shadow: 0 0 40px #ff4444, 0 0 80px #ff444480; 
                    transform: scale(1.02); 
                } 
                50% { 
                    box-shadow: 0 0 60px #ff4444, 0 0 120px #ff4444aa; 
                    transform: scale(1.05); 
                } 
            }
            @keyframes energyGlowWater { 
                0%, 100% { 
                    box-shadow: 0 0 20px #4285f4, 0 0 40px #4285f440; 
                    transform: scale(1); 
                } 
                25%, 75% { 
                    box-shadow: 0 0 40px #4285f4, 0 0 80px #4285f480; 
                    transform: scale(1.02); 
                } 
                50% { 
                    box-shadow: 0 0 60px #4285f4, 0 0 120px #4285f4aa; 
                    transform: scale(1.05); 
                } 
            }
            @keyframes energyGlowGrass { 
                0%, 100% { 
                    box-shadow: 0 0 20px #34a853, 0 0 40px #34a85340; 
                    transform: scale(1); 
                } 
                25%, 75% { 
                    box-shadow: 0 0 40px #34a853, 0 0 80px #34a85380; 
                    transform: scale(1.02); 
                } 
                50% { 
                    box-shadow: 0 0 60px #34a853, 0 0 120px #34a853aa; 
                    transform: scale(1.05); 
                } 
            }
            @keyframes energyGlowLightning { 
                0%, 100% { 
                    box-shadow: 0 0 20px #fbbc04, 0 0 40px #fbbc0440; 
                    transform: scale(1); 
                } 
                25%, 75% { 
                    box-shadow: 0 0 40px #fbbc04, 0 0 80px #fbbc0480; 
                    transform: scale(1.02); 
                } 
                50% { 
                    box-shadow: 0 0 60px #fbbc04, 0 0 120px #fbbc04aa; 
                    transform: scale(1.05); 
                } 
            }
            @keyframes energyGlowPsychic { 
                0%, 100% { 
                    box-shadow: 0 0 20px #9c27b0, 0 0 40px #9c27b040; 
                    transform: scale(1); 
                } 
                25%, 75% { 
                    box-shadow: 0 0 40px #9c27b0, 0 0 80px #9c27b080; 
                    transform: scale(1.02); 
                } 
                50% { 
                    box-shadow: 0 0 60px #9c27b0, 0 0 120px #9c27b0aa; 
                    transform: scale(1.05); 
                } 
            }
            @keyframes energyGlowFighting { 
                0%, 100% { 
                    box-shadow: 0 0 20px #ff6d00, 0 0 40px #ff6d0040; 
                    transform: scale(1); 
                } 
                25%, 75% { 
                    box-shadow: 0 0 40px #ff6d00, 0 0 80px #ff6d0080; 
                    transform: scale(1.02); 
                } 
                50% { 
                    box-shadow: 0 0 60px #ff6d00, 0 0 120px #ff6d00aa; 
                    transform: scale(1.05); 
                } 
            }
            @keyframes energyGlowDarkness { 
                0%, 100% { 
                    box-shadow: 0 0 20px #424242, 0 0 40px #42424260; 
                    transform: scale(1); 
                } 
                25%, 75% { 
                    box-shadow: 0 0 40px #424242, 0 0 80px #42424280; 
                    transform: scale(1.02); 
                } 
                50% { 
                    box-shadow: 0 0 60px #424242, 0 0 120px #424242aa; 
                    transform: scale(1.05); 
                } 
            }
            @keyframes energyGlowMetal { 
                0%, 100% { 
                    box-shadow: 0 0 20px #607d8b, 0 0 40px #607d8b40; 
                    transform: scale(1); 
                } 
                25%, 75% { 
                    box-shadow: 0 0 40px #607d8b, 0 0 80px #607d8b80; 
                    transform: scale(1.02); 
                } 
                50% { 
                    box-shadow: 0 0 60px #607d8b, 0 0 120px #607d8baa; 
                    transform: scale(1.05); 
                } 
            }
            @keyframes energyGlowColorless { 
                0%, 100% { 
                    box-shadow: 0 0 20px #9e9e9e, 0 0 40px #9e9e9e40; 
                    transform: scale(1); 
                } 
                25%, 75% { 
                    box-shadow: 0 0 40px #9e9e9e, 0 0 80px #9e9e9e80; 
                    transform: scale(1.02); 
                } 
                50% { 
                    box-shadow: 0 0 60px #9e9e9e, 0 0 120px #9e9e9eaa; 
                    transform: scale(1.05); 
                } 
            }
            
            @keyframes energyIntegrate {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.8; transform: scale(1.1); }
                100% { opacity: 1; transform: scale(1); }
            }
            
            @keyframes evolutionGlow {
                0% { filter: brightness(1) blur(0px); }
                50% { filter: brightness(1.5) blur(2px); }
                100% { filter: brightness(1) blur(0px); }
            }
            
            @keyframes evolutionEmerge {
                0% { transform: scale(0.5); opacity: 0; filter: blur(10px); }
                100% { transform: scale(1); opacity: 1; filter: blur(0px); }
            }
            
            @keyframes healGlow {
                0%, 100% { box-shadow: 0 0 0 #4caf50; }
                50% { box-shadow: 0 0 25px #4caf50; }
            }
            
            @keyframes hpRecover {
                0% { color: inherit; }
                50% { color: #4caf50; }
                100% { color: inherit; }
            }
            
            @keyframes hpFlash {
                0%, 100% { color: inherit; }
                50% { color: #f44336; }
            }
            
            @keyframes prizeGlow {
                0%, 100% { box-shadow: 0 0 0 #ffd700; }
                50% { box-shadow: 0 0 30px #ffd700; }
            }
            
            @keyframes prizeTake {
                0% { transform: scale(1) rotate(0deg); }
                50% { transform: scale(1.2) rotate(5deg); }
                100% { transform: scale(0) rotate(360deg); }
            }
            
            @keyframes victoryApproach {
                0%, 100% { filter: brightness(1) hue-rotate(0deg); }
                50% { filter: brightness(1.3) hue-rotate(30deg); }
            }
            
            /* Legacy/Compatibility Animations - avoid conflict with index.html */
            .animate-energy-attach {
                animation: energyAttach 0.7s ease-out forwards;
            }
            
            /* Note: Many keyframes are already defined in index.html to avoid conflicts */
            /* Only defining ones that are missing or need override */
        `;
        document.head.appendChild(style);
    }
}