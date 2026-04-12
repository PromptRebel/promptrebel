const btnWood = document.getElementById('btn-wood');
const actionMenu = document.getElementById('action-menu');

Renderer.canvas.addEventListener('mousedown', (e) => {
    const rect = Renderer.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // HQ Klick (Radius 40)
    const tc = GameState.entities.townCenter;
    if (Math.sqrt((mx - tc.x)**2 + (my - tc.y)**2) < 40) {
        spawnVillager();
        return;
    }

    // Villager Klick (Radius 30)
    let found = false;
    GameState.entities.villagers.forEach(v => {
        if (Math.sqrt((mx - v.x)**2 + (my - v.y)**2) < 30) {
            GameState.selection = v;
            found = true;
        }
    });

    if (found) {
        actionMenu.style.display = 'block';
    } else {
        GameState.selection = null;
        actionMenu.style.display = 'none';
    }
});

btnWood.addEventListener('click', (e) => {
    e.stopPropagation();
    if (GameState.selection) {
        GameState.selection.findNextTree();
    }
});

function spawnVillager() {
    if (GameState.entities.villagers.length < GameState.config.maxVillagers) {
        const tc = GameState.entities.townCenter;
        
        // Random Position im Kreis um das HQ
        const angle = Math.random() * Math.PI * 2;
        const radius = 50 + Math.random() * 30;
        const sx = tc.x + Math.cos(angle) * radius;
        const sy = tc.y + Math.sin(angle) * radius;

        const v = new Villager(sx, sy, Date.now());
        GameState.entities.villagers.push(v);
    }
}
