export const GameState = {
    world: { width: 2000, height: 2000 },
    camera: { x: 0, y: 0 },
    resources: {
        wood: 100,
        stone: 0 // Neu
    },
    config: {
        villagerSpeed: 2.5,
        treeWoodAmount: 100,
        stoneAmount: 500, // Neu: 500 Leben pro Stein
        maxPopulation: 10
    },
    entities: {
        townCenter: { x: 1000, y: 1000 },
        villagers: [],
        trees: [],
        stones: [], // Neu
        buildings: []
    },
    selection: null,
    placementMode: { active: false, type: null, cost: 0, x: 0, y: 0 },
    
    getMaxPop: function() {
        let pop = this.config.maxPopulation;
        this.entities.buildings.forEach(b => {
            if(b.type === 'house' && b.isFinished) pop += 5;
        });
        return pop;
    }
};
