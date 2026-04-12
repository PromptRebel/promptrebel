// villager.js

// DIE FEHLENDE DEFINITION:
const VillagerState = {
    IDLE: 'idle',
    MOVING_TO_TREE: 'moving_to_tree',
    CHOPPING: 'chopping',
    RETURNING: 'returning',
    BUILDING: 'building',
    PLANTING: 'planting'
};

class Villager {
    constructor(x, y, id) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.state = VillagerState.IDLE; // Jetzt existiert VillagerState!
        this.inventory = 0;
        this.capacity = 5;
        this.targetTree = null;
        this.targetBuilding = null;
        this.lastActionTime = 0;
        this.isQueuedForIdle = false;
    }

    update() {
        switch (this.state) {
            case VillagerState.MOVING_TO_TREE:
                if (!this.targetTree || !GameState.entities.trees.includes(this.targetTree)) {
                    this.findNextTree();
                    return;
                }
                this.moveTo(this.targetTree.x, this.targetTree.y, () => {
                    this.state = VillagerState.CHOPPING;
                });
                break;

            case VillagerState.CHOPPING:
                this.work(() => {
                    if (this.targetTree && this.targetTree.woodAmount > 0) {
                        this.targetTree.woodAmount--;
                        this.inventory++;
                        if (this.targetTree.woodAmount <= 0) {
                            const idx = GameState.entities.trees.indexOf(this.targetTree);
                            if (idx > -1) GameState.entities.trees.splice(idx, 1);
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

            case VillagerState.RETURNING:
                this.moveTo(GameState.entities.townCenter.x, GameState.entities.townCenter.y, () => {
                    GameState.resources.wood += this.inventory;
                    this.inventory = 0;
                    if (this.isQueuedForIdle) {
                        this.state = VillagerState.IDLE;
                        this.isQueuedForIdle = false;
                        this.targetTree = null;
                    } else {
                        if (this.targetTree && GameState.entities.trees.includes(this.targetTree)) {
                            this.state = VillagerState.MOVING_TO_TREE;
                        } else {
                            this.findNextTree();
                        }
                    }
                });
                break;

            case VillagerState.BUILDING:
                if (!this.targetBuilding || this.targetBuilding.isFinished) {
                    this.state = VillagerState.IDLE;
                    return;
                }
                this.moveTo(this.targetBuilding.x, this.targetBuilding.y + 25, () => {
                    this.work(() => {
                        this.targetBuilding.progress += 10;
                        if (this.targetBuilding.progress >= 100) {
                            this.targetBuilding.progress = 100;
                            this.targetBuilding.isFinished = true;
                            this.state = VillagerState.IDLE;
                        }
                    });
                });
                break;

            case VillagerState.PLANTING:
                if (!this.targetBuilding || !this.targetBuilding.isFinished) {
                    this.state = VillagerState.IDLE;
                    return;
                }
                this.moveTo(this.targetBuilding.x, this.targetBuilding.y, () => {
                    this.work(() => {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = 40 + Math.random() * 60;
                        const px = this.targetBuilding.x + Math.cos(angle) * dist;
                        const py = this.targetBuilding.y + Math.sin(angle) * dist;
                        const tooClose = GameState.entities.trees.some(t => Math.sqrt((t.x-px)**2 + (t.y-py)**2) < 25);
                        if (!tooClose && px > 0 && px < GameState.world.width && py > 0 && py < GameState.world.height) {
                            GameState.entities.trees.push({ x: px, y: py, woodAmount: GameState.config.treeWoodAmount });
                        }
                    });
                });
                break;
        }
    }

    findNextTree() {
        if (!GameState.entities.trees || GameState.entities.trees.length === 0) {
            this.state = VillagerState.IDLE;
            return;
        }
        let closest = null;
        let minDist = Infinity;
        GameState.entities.trees.forEach(t => {
            const d = Math.sqrt((t.x - this.x)**2 + (t.y - this.y)**2);
            if (d < minDist) {
                minDist = d;
                closest = t;
            }
        });
        if (closest) {
            this.targetTree = closest;
            this.state = VillagerState.MOVING_TO_TREE;
        } else {
            this.state = VillagerState.IDLE;
        }
    }

    moveTo(tx, ty, onArrived) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Wenn weiter als 3 Pixel weg, dann bewegen
    if (dist > 3) {
        const vx = (dx / dist) * GameState.config.villagerSpeed;
        const vy = (dy / dist) * GameState.config.villagerSpeed;
        this.x += vx;
        this.y += vy;
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
