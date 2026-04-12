const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),

    draw: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Welt zeichnen
        this.ctx.save();
        this.ctx.translate(-GameState.camera.x, -GameState.camera.y);

        // Boden-Gitter zur Orientierung
        this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        for(let x=0; x<GameState.world.width; x+=100) {
            this.ctx.beginPath(); this.ctx.moveTo(x,0); this.ctx.lineTo(x, GameState.world.height); this.ctx.stroke();
        }
        for(let y=0; y<GameState.world.height; y+=100) {
            this.ctx.beginPath(); this.ctx.moveTo(0,y); this.ctx.lineTo(GameState.world.width, y); this.ctx.stroke();
        }

        // Gebäude
        GameState.entities.buildings.forEach(b => {
            this.ctx.fillStyle = b.isFinished ? (b.type === 'house' ? '#8B4513' : '#2F4F4F') : '#555';
            this.ctx.fillRect(b.x - 20, b.y - 20, 40, 40);
        });

        // Bäume
        GameState.entities.trees.forEach(t => {
            this.ctx.fillStyle = '#2d5a27'; this.ctx.beginPath(); this.ctx.arc(t.x, t.y, 10, 0, Math.PI * 2); this.ctx.fill();
        });

        // HQ
        const tc = GameState.entities.townCenter;
        this.ctx.fillStyle = '#654321'; this.ctx.fillRect(tc.x - 25, tc.y - 25, 50, 50);

        // Villager
        GameState.entities.villagers.forEach(v => {
            this.ctx.fillStyle = (GameState.selection === v) ? 'white' : '#ffdf00';
            this.ctx.fillRect(v.x - 6, v.y - 6, 12, 12);
        });

        // Placement Vorschau
        if (GameState.placementMode.active) {
            this.ctx.globalAlpha = 0.5; this.ctx.fillStyle = 'white';
            this.ctx.fillRect(GameState.placementMode.x - 20, GameState.placementMode.y - 20, 40, 40);
            this.ctx.globalAlpha = 1.0;
        }

        this.ctx.restore();

        // UI & Minimap (fest am Bildschirm)
        this.drawMinimap();
        document.getElementById('wood-count').innerText = GameState.resources.wood;
        document.getElementById('pop-count').innerText = GameState.entities.villagers.length + "/" + GameState.getMaxPop();
    },

    drawMinimap: function() {
        const size = 150;
        const offsetX = this.canvas.width - size - 10;
        const offsetY = this.canvas.height - size - 10;
        const ratio = size / GameState.world.width;

        // Hintergrund
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.fillRect(offsetX, offsetY, size, size);
        this.ctx.strokeStyle = 'white';
        this.ctx.strokeRect(offsetX, offsetY, size, size);

        // HQ auf Minimap
        this.ctx.fillStyle = 'brown';
        this.ctx.fillRect(offsetX + GameState.entities.townCenter.x * ratio - 2, offsetY + GameState.entities.townCenter.y * ratio - 2, 4, 4);

        // Villager auf Minimap (gelbe Punkte)
        this.ctx.fillStyle = 'yellow';
        GameState.entities.villagers.forEach(v => {
            this.ctx.fillRect(offsetX + v.x * ratio, offsetY + v.y * ratio, 2, 2);
        });

        // Aktueller Kamera-Ausschnitt
        this.ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        this.ctx.strokeRect(offsetX + GameState.camera.x * ratio, offsetY + GameState.camera.y * ratio, this.canvas.width * ratio, this.canvas.height * ratio);
    }
};
