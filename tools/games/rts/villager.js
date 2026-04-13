// villager.js

/**
 * Definiert die möglichen Zustände eines Villagers.
 */
const VillagerState = {
    IDLE: 'idle',
    MOVING_TO_TREE: 'moving_to_tree',
    CHOPPING: 'chopping',
    MOVING_TO_STONE: 'moving_to_stone',
    MINING: 'mining',
    RETURNING: 'returning',
    BUILDING: 'building',
    PLANTING: 'planting'
};

export class Villager {
    constructor(x, y, id) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.state = VillagerState.IDLE;
        
        // Ressourcen-Logik
        this.inventory = 0;
        this.inventoryType = null; // 'wood' oder 'stone'
        this.capacity = 5;
        
        // Ziele
        this.targetTree = null;
        this.targetStone = null;
        this.targetBuilding = null;
        
        // Animation & Richtung
        this.lastActionTime = 0;
        this.lastDir = 'down'; // Standard-Blickrichtung (down, up, left, right)
        this.autoBecomeForester = false;
    }

    /**
     * Haupt-Update-Loop des Villagers.
     * @param {Object} GameState - Der aktuelle globale Spielzustand.
     */
    update(GameState) {
        switch (this.state) {
            case VillagerState.MOVING_TO_TREE:
                if (!this.targetTree || !GameState.entities.trees.includes(this.targetTree)) {
                    this.findNextTree(GameState);
                    return;
                }
                this.moveTo(this.targetTree.x, this.targetTree.y, GameState, () => {
                    this.state = VillagerState.CHOPPING;
                });
                break;

            case VillagerState.CHOPPING:
                this.work(() => {
                    if (this.targetTree && this.targetTree.woodAmount > 0) {
                        this.targetTree.woodAmount--;
                        this.inventory++;
                        this.inventoryType = 'wood';
                        if (this.targetTree.woodAmount <= 0) {
                            GameState.entities.trees = GameState.entities.trees.filter(t => t !== this.targetTree);
                            this.targetTree = null;
                            this.state = VillagerState.RETURNING;
                        } else if (this.inventory >= this.capacity) {
                            this.state = VillagerState.RETURNING;
                        }
                    } else {
                        this.state = VillagerState.RETURNING;
                    }
                });
                break;

            case VillagerState.MOVING_TO_STONE:
                if (!this.targetStone || !GameState.entities.stones.includes(this.targetStone)) {
                    this.findNextStone(GameState);
                    return;
                }
                this.moveTo(this.targetStone.x, this.targetStone.y, GameState, () => {
                    this.state = VillagerState.MINING;
                });
                break;

            case VillagerState.MINING:
                this.work(() => {
                    if (this.targetStone && this.targetStone.stoneAmount > 0) {
                        this.targetStone.stoneAmount--;
                        this.inventory++;
                        this.inventoryType = 'stone';
                        if (this.targetStone.stoneAmount <= 0) {
                            GameState.entities.stones = GameState.entities.stones.filter(s => s !== this.targetStone);
                            this.targetStone = null;
                            this.state = VillagerState.RETURNING;
                        } else if (this.inventory >= this.capacity) {
                            this.state = VillagerState.RETURNING;
                        }
                    } else {
                        this.state = VillagerState.RETURNING;
                    }
                });
                break;

            case VillagerState.RETURNING:
                // Wir laufen zum HQ, aber versetzt (y + 50), damit wir nicht im Gebäude stecken bleiben
                const tc = GameState.entities.townCenter;
                this.moveTo(tc.x, tc.y + 50, GameState, () => {
                    if (this.inventoryType === 'wood') GameState.resources.wood += this.inventory;
                    else if (this.inventoryType === 'stone') GameState.resources.stone += this.inventory;
                    
                    this.inventory = 0;
                    // Automatisch zurück zur Arbeit
                    if (this.targetTree) this.state = VillagerState.MOVING_TO_TREE;
                    else if (this.targetStone) this.state = VillagerState.MOVING_TO_STONE;
                    else this.state = VillagerState.IDLE;
                });
                break;

            case VillagerState.BUILDING:
                if (!this.targetBuilding) {
                    this.state = VillagerState.IDLE;
                    return;
                }
                this.moveTo(this.targetBuilding.x, this.targetBuilding.y + 25, GameState, () => {
                    this.work(() => {
                        this.targetBuilding.progress += 10;
                        if (this.targetBuilding.progress >= 100) {
                            this.targetBuilding.progress = 100;
                            this.targetBuilding.isFinished = true;
                            if (this.autoBecomeForester && this.targetBuilding.type === 'lodge') {
                                this.autoBecomeForester = false;
                                this.state = VillagerState.PLANTING;
                            } else {
                                this.state = VillagerState.IDLE;
                                this.targetBuilding = null;
                            }
                        }
                    });
                });
                break;

            case VillagerState.PLANTING:
                if (!this.targetBuilding || this.targetBuilding.type !== 'lodge') {
                    this.state = VillagerState.IDLE;
                    return;
                }
                this.moveTo(this.targetBuilding.x, this.targetBuilding.y, GameState, () => {
                    this.work(() => {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = 40 + Math.random() * 70;
                        const px = this.targetBuilding.x + Math.cos(angle) * dist;
                        const py = this.targetBuilding.y + Math.sin(angle) * dist;
                        const tooClose = GameState.entities.trees.some(t => Math.sqrt((t.x-px)**2 + (t.y-py)**2) < 30);
                        if (!tooClose && px > 0 && px < GameState.world.width && py > 0 && py < GameState.world.height) {
                            GameState.entities.trees.push({ x: px, y: py, woodAmount: 100 });
                        }
                    });
                });
                break;
        }
    }

    findNextTree(GameState) {
        let closest = null;
        let minDist = Infinity;
        GameState.entities.trees.forEach(t => {
            const d = Math.sqrt((t.x - this.x)**2 + (t.y - this.y)**2);
            if (d < minDist) { minDist = d; closest = t; }
        });
        if (closest) {
            this.targetTree = closest;
            this.state = VillagerState.MOVING_TO_TREE;
        } else {
            this.state = VillagerState.IDLE;
        }
    }

    findNextStone(GameState) {
        let closest = null;
        let minDist = Infinity;
        GameState.entities.stones.forEach(s => {
            const d = Math.sqrt((s.x - this.x)**2 + (s.y - this.y)**2);
            if (d < minDist) { minDist = d; closest = s; }
        });
        if (closest) {
            this.targetStone = closest;
            this.state = VillagerState.MOVING_TO_STONE;
        } else {
            this.state = VillagerState.IDLE;
        }
    }

    /**
     * Bewegt den Villager und speichert die Richtung für die Animation.
     */
    moveTo(tx, ty, GameState, onArrived) {
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
            // Richtung für Animation bestimmen
            if (Math.abs(dx) > Math.abs(dy)) {
                this.lastDir = dx > 0 ? 'right' : 'left';
            } else {
                this.lastDir = dy > 0 ? 'down' : 'up';
            }

            this.x += (dx / dist) * GameState.config.villagerSpeed;
            this.y += (dy / dist) * GameState.config.villagerSpeed;
        } else {
            onArrived();
        }
    }

    /**
     * Verzögert Aktionen (Arbeitstakt).
     */
    work(onAction) {
        const now = Date.now();
        if (now - this.lastActionTime > 1000) {
            onAction();
            this.lastActionTime = now;
        }
    }
}
