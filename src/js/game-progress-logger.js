/**
 * GAME-PROGRESS-LOGGER.JS - ゲーム進行状況の構造化ログシステム
 *
 * ゲームの主要なイベントのみを分かりやすく表示
 */

class GameProgressLogger {
    constructor() {
        this.enabled = true;
        this.sessionStartTime = Date.now();
        this.currentPhase = null;
        this.turnNumber = 0;
    }

    /**
     * ゲーム初期化ログ
     */
    logGameInit() {
        if (!this.enabled) return;
        console.log('\n' + '='.repeat(60));
        console.log('🎮 Pokemon Card Battle - Game Initialized');
        console.log('='.repeat(60));
    }

    /**
     * ゲーム開始ログ
     */
    logGameStart() {
        if (!this.enabled) return;
        console.log('\n' + '🎲 GAME START'.padEnd(60, ' '));
        console.log('─'.repeat(60));
    }

    /**
     * ターン開始ログ
     */
    logTurnStart(player, turnNumber) {
        if (!this.enabled) return;
        this.turnNumber = turnNumber;
        const icon = player === 'player' ? '👤' : '🤖';
        console.log(`\n${icon} === TURN ${turnNumber} START (${player.toUpperCase()}) ===`);
    }

    /**
     * フェーズ遷移ログ
     */
    logPhaseChange(fromPhase, toPhase) {
        if (!this.enabled) return;
        this.currentPhase = toPhase;

        const phaseNames = {
            'SETUP': '⚙️  セットアップ',
            'PLAYER_DRAW': '📥 プレイヤー ドロー',
            'PLAYER_MAIN': '⚡ プレイヤー メイン',
            'PLAYER_ATTACK': '⚔️  プレイヤー 攻撃',
            'CPU_DRAW': '📥 CPU ドロー',
            'CPU_MAIN': '⚡ CPU メイン',
            'CPU_ATTACK': '⚔️  CPU 攻撃',
            'END': '🏁 ゲーム終了'
        };

        const phaseName = phaseNames[toPhase] || toPhase;
        console.log(`  Phase: ${phaseName}`);
    }

    /**
     * カードドローログ
     */
    logCardDraw(player, cardCount) {
        if (!this.enabled) return;
        const icon = player === 'player' ? '👤' : '🤖';
        console.log(`  ${icon} Drawn ${cardCount} card(s)`);
    }

    /**
     * ポケモン配置ログ
     */
    logPokemonPlacement(player, pokemonName, zone) {
        if (!this.enabled) return;
        const icon = player === 'player' ? '👤' : '🤖';
        const zoneIcon = zone === 'active' ? '🎯' : '💺';
        console.log(`  ${icon} ${zoneIcon} Placed ${pokemonName} on ${zone}`);
    }

    /**
     * エネルギー付与ログ
     */
    logEnergyAttach(player, pokemonName, energyType) {
        if (!this.enabled) return;
        const icon = player === 'player' ? '👤' : '🤖';
        console.log(`  ${icon} ⚡ Attached ${energyType} energy to ${pokemonName}`);
    }

    /**
     * 攻撃ログ
     */
    logAttack(attacker, defender, attackName, damage) {
        if (!this.enabled) return;
        console.log(`  ⚔️  ${attacker} used ${attackName}!`);
        console.log(`  💥 ${damage} damage to ${defender}`);
    }

    /**
     * ポケモン気絶ログ
     */
    logKnockout(pokemonName, player) {
        if (!this.enabled) return;
        const icon = player === 'player' ? '👤' : '🤖';
        console.log(`  💀 ${icon} ${pokemonName} was knocked out!`);
    }

    /**
     * サイドカード取得ログ
     */
    logPrizeTaken(player, remaining) {
        if (!this.enabled) return;
        const icon = player === 'player' ? '👤' : '🤖';
        console.log(`  🏆 ${icon} Took a prize card! (${remaining} remaining)`);
    }

    /**
     * ゲーム終了ログ
     */
    logGameEnd(winner) {
        if (!this.enabled) return;
        const icon = winner === 'player' ? '👤' : '🤖';
        const duration = Math.floor((Date.now() - this.sessionStartTime) / 1000);
        console.log('\n' + '='.repeat(60));
        console.log(`🏆 GAME OVER - ${winner.toUpperCase()} WINS!`);
        console.log(`${icon} Victory! Game duration: ${duration}s`);
        console.log('='.repeat(60) + '\n');
    }

    /**
     * エラーログ
     */
    logError(message, error) {
        if (!this.enabled) return;
        console.error(`❌ ERROR: ${message}`, error);
    }

    /**
     * 警告ログ
     */
    logWarning(message) {
        if (!this.enabled) return;
        console.warn(`⚠️  WARNING: ${message}`);
    }

    /**
     * デバッグモード切り替え
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * 現在の状態サマリー
     */
    logStateSummary(state) {
        if (!this.enabled) return;

        console.log('\n📊 Game State Summary:');
        console.log(`  Turn: ${state.turn} | Phase: ${state.phase}`);
        console.log(`  Player Hand: ${state.players.player.hand.length} cards`);
        console.log(`  Player Active: ${state.players.player.active ? '✓' : '✗'}`);
        console.log(`  Player Bench: ${state.players.player.bench.filter(p => p !== null).length}/5`);
        console.log(`  Player Prize: ${state.players.player.prize.filter(p => p !== null).length} remaining`);
        console.log(`  CPU Hand: ${state.players.cpu.hand.length} cards`);
        console.log(`  CPU Active: ${state.players.cpu.active ? '✓' : '✗'}`);
        console.log(`  CPU Bench: ${state.players.cpu.bench.filter(p => p !== null).length}/5`);
        console.log(`  CPU Prize: ${state.players.cpu.prize.filter(p => p !== null).length} remaining`);
    }
}

// シングルトンインスタンスをエクスポート
export const gameProgressLogger = new GameProgressLogger();

export default gameProgressLogger;
