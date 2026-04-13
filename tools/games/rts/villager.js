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
        this.plantLocation = null;
        
        // Animation & Richtung
        this.lastActionTime = 0;
        this.lastDir = 'down'; 
        this.actionTimer = 0;      // Startzeitpunkt der aktuellen Animation
        this.actionDuration = 3000; // Dauer einer Arbeitsaktion (3 Sek)
        
        this.autoBecomeForester = false;
    }

    update(GameState) {
        switch (this.state) {
            case VillagerState.MOVING_TO_TREE:
                if (!this.targetTree || !GameState.entities.trees.includes(this.targetTree)) {
                    this.findNextTree(GameState);
                    return;
                }
                this.moveTo(this.targetTree.x, this.targetTree.y, GameState, () => {
                    this.state = VillagerState.CHOPPING;
                    this.actionTimer = 0; // Reset für Animation
                });
                break;

            case VillagerState.CHOPPING:
            case VillagerState.MINING:
                this.handleHarvesting(GameState);
                break;

            case VillagerState.MOVING_TO_STONE:
                if (!this.targetStone || !GameState.entities.stones.includes(this.targetStone)) {
                    this.findNextStone(GameState);
                    return;
                }
                this.moveTo(this.targetStone.x, this.targetStone.y, GameState, () => {
                    this.state = VillagerState.MINING;
                    this.actionTimer = 0;
                });
                break;

            case VillagerState.RETURNING:
                const tc = GameState.entities.townCenter;
                this.moveTo(tc.x, tc.y + 50, GameState, () => {
                    if (this.inventoryType === 'wood') GameState.resources.wood += this.inventory;
                    else if (this.inventoryType === 'stone') GameState.resources.stone += this.inventory;
                    
                    this.inventory = 0;
                    this.inventoryType = null;
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
                this.handlePlanting(GameState);
                break;
        }
    }

    handleHarvesting(GameState) {
        const isWood = this.state === VillagerState.CHOPPING;
        const target = isWood ? this.targetTree : this.targetStone;

        if (!target) {
            this.state = VillagerState.RETURNING;
            return;
        }

        const now = Date.now();
        if (this.actionTimer === 0) this.actionTimer = now;

        // Wenn die Zeit für eine Aktion abgelaufen ist
        if (now - this.actionTimer >= this.actionDuration) {
            if (isWood) target.woodAmount--;
            else target.stoneAmount--;

            this.inventory++;
            this.inventoryType = isWood ? 'wood' : 'stone';
            this.actionTimer = now; // Timer für den nächsten Schlag neu starten

            const currentAmount = isWood ? target.woodAmount : target.stoneAmount;
            if (currentAmount <= 0) {
                if (isWood) GameState.entities.trees = GameState.entities.trees.filter(t => t !== target);
                else GameState.entities.stones = GameState.entities.stones.filter(s => s !== target);
                this.state = VillagerState.RETURNING;
                this.actionTimer = 0;
            } else if (this.inventory >= this.capacity) {
                this.state = VillagerState.RETURNING;
                this.actionTimer = 0;
            }
        }
    }

    handlePlanting(GameState) {
        if (!this.targetBuilding || this.targetBuilding.type !== 'lodge') {
            this.state = VillagerState.IDLE;
            return;
        }

        if (!this.plantLocation) {
            // Erst zurück zur Lodge (Samen holen)
            this.moveTo(this.targetBuilding.x, this.targetBuilding.y + 20, GameState, () => {
                const angle = Math.random() * Math.PI * 2;
                const dist = 60 + Math.random() * 80;
                this.plantLocation = {
                    x: this.targetBuilding.x + Math.cos(angle) * dist,
                    y: this.targetBuilding.y + Math.sin(angle) * dist
                };
            });
            return;
        }

        // Dann zum Pflanzort laufen
        this.moveTo(this.plantLocation.x, this.plantLocation.y, GameState, () => {
            const now = Date.now();
            if (this.actionTimer === 0) this.actionTimer = now;

            if (now - this.actionTimer >= this.actionDuration) {
                const px = this.plantLocation.x;
                const py = this.plantLocation.y;
                const tooClose = GameState.entities.trees.some(t => Math.sqrt((t.x-px)**2 + (t.y-py)**2) < 30);
                
                if (!tooClose && px > 0 && px < GameState.world.width && py > 0 && py < GameState.world.height) {
                    GameState.entities.trees.push({ x: px, y: py, woodAmount: 100 });
                }
                
                this.actionTimer = 0;
                this.plantLocation = null; 
            }
        });
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

    moveTo(tx, ty, GameState, onArrived) {
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
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

    work(onAction) {
        const now = Date.now();
        if (now - this.lastActionTime > 1000) {
            onAction();
            this.lastActionTime = now;
        }
    }
}
