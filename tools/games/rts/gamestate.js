const GameState = {
    resources: {
        wood: 0
    },
    entities: {
        townCenter: { x: 400, y: 300 },
        villagers: [],
        trees: []
    },
    selection: null, // Welcher Villager ist gerade angeklickt?
    config: {
        maxVillagers: 10,
        villagerSpeed: 1.5,
        collectRange: 15,
        interactionRange: 30
    }
};
