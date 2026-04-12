const VillagerState = {
    IDLE: 'IDLE',
    MOVING_TO_TREE: 'MOVING_TO_TREE',
    CHOPPING: 'CHOPPING',
    RETURNING: 'RETURNING'
};

class Villager {
    constructor(x, y, id) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.state = VillagerState.IDLE;
        this.inventory = 0;
        this.capacity = 5;
        this.targetTree = null;
        this.lastActionTime = 0;
    }

    update() {
        switch (this.state) {
            case VillagerState.MOVING_TO_TREE:
                if (!this.targetTree || !GameState.entities.trees.includes(this.targetTree)) {
                    this.state = VillagerState.RETURNING; // Baum weg? Erstmal heim.
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
                        
                        // Wenn Baum leer, entfernen
                        if (this.targetTree.woodAmount <= 0) {
                            const index = GameState.entities.trees.indexOf(this.targetTree);
                            if (index > -1) GameState.entities.trees.splice(index, 1);
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

                    // Automatische Suche nach neuem Baum
                    if (!this.targetTree || !GameState.entities.trees.includes(this.targetTree)) {
                        this.findNextTree();
                    } else {
                        this.state = VillagerState.MOVING_TO_TREE;
                    }
                });
                break;
        }
    }

    findNextTree() {
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
        if (dist > 5) {
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
