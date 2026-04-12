const GameState = {
    resources: {
        wood: 0
    },
    entities: {
        townCenter: { x: 400, y: 300 },
        villagers: [],
        trees: []
    },
    selection: null,
    config: {
        maxVillagers: 10,
        villagerSpeed: 2,
        treeWoodAmount: 50 // Wie viel Holz hat ein Baum, bevor er verschwindet?
    }
};
