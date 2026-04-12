const GameState = {
    resources: { wood: 0 },
    entities: {
        townCenter: { x: 1000, y: 1000 }, // HQ in der Mitte der großen Welt
        villagers: [],
        trees: [],
        buildings: [] 
    },
    selection: null,
    placementMode: { active: false, type: null, x: 0, y: 0, cost: 0 },
    camera: { x: 600, y: 700 }, // Start-Ausschnitt
    world: { width: 2000, height: 2000 },
    config: {
        baseMaxPop: 10,
        villagerSpeed: 2,
        treeWoodAmount: 50,
        costs: { house: 50, lodge: 100 }
    },
    getMaxPop: function() {
        let bonus = 0;
        this.entities.buildings.forEach(b => { if (b.type === 'house' && b.isFinished) bonus += 5; });
        return this.config.baseMaxPop + bonus;
    }
};
