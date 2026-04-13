// ui.js (gekürzt auf Stein-Änderungen)
const btnStone = document.getElementById('btn-stone');

setupButton(btnStone, () => {
    if(GameState.selection) {
        GameState.selection.targetTree = null;
        GameState.selection.targetBuilding = null;
        GameState.selection.findNextStone(); // Villager zur Stein-Suche schicken
    }
});

function processClick(e) {
    // ... bisherige Klick-Logik ...
    // Neu: Stein abbauen Anzeige etc.
    document.getElementById('stone-count').innerText = GameState.resources.stone;
}
// Vergiss nicht, in spawnVillager auch den Stein-Cooldown zu nutzen.
