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
                this.moveTo(this.targetTree.x, this.targetTree.y, () => {
                    this.state = VillagerState.CHOPPING;
                });
                break;

            case VillagerState.CHOPPING:
                this.work(() => {
                    this.inventory++;
                    if (this.inventory >= this.capacity) {
                        this.state = VillagerState.RETURNING;
                    }
                });
                break;

            case VillagerState.RETURNING:
                this.moveTo(GameState.entities.townCenter.x, GameState.entities.townCenter.y, () => {
                    GameState.resources.wood += this.inventory;
                    this.inventory = 0;
                    this.state = VillagerState.MOVING_TO_TREE; // Zurück zum Wald!
                });
                break;
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
        if (now - this.lastActionTime > 1000) { // Jede Sekunde 1 Holz
            onAction();
            this.lastActionTime = now;
        }
    }
}
