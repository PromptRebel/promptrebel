const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),
    assets: {}, // Hier speichern wir die geladenen Bilder

    draw: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Welt zeichnen (Kamera-Verschiebung)
        this.ctx.save();
        this.ctx.translate(-GameState.camera.x, -GameState.camera.y);

        // Boden-Gitter
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        for(let x=0; x<=GameState.world.width; x+=100) {
            this.ctx.beginPath(); this.ctx.moveTo(x,0); this.ctx.lineTo(x, GameState.world.height); this.ctx.stroke();
        }
        for(let y=0; y<=GameState.world.height; y+=100) {
            this.ctx.beginPath(); this.ctx.moveTo(0,y); this.ctx.lineTo(GameState.world.width, y); this.ctx.stroke();
        }

        // GEBÄUDE
        GameState.entities.buildings.forEach(b => {
            if (b.type === 'lodge' && b.isFinished) {
                this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
                this.ctx.beginPath(); this.ctx.arc(b.x, b.y, 100, 0, Math.PI * 2); this.ctx.stroke();
            }
            this.ctx.fillStyle = b.isFinished ? (b.type === 'house' ? '#8B4513' : '#2F4F4F') : '#555';
            this.ctx.fillRect(b.x - 20, b.y - 20, 40, 40);
            this.ctx.fillStyle = 'white';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(b.type.toUpperCase(), b.x - 15, b.y + 5);
        });

        // BÄUME (Mit deiner neuen Grafik!)
        GameState.entities.trees.forEach(t => {
            const treeImg = this.assets.tree;
            if (treeImg) {
                // Wir zeichnen den Baum etwas größer (60x60) 
                // Der Fuß des Baumes (t.y) soll die Bodenposition sein
                this.ctx.drawImage(treeImg, t.x - 30, t.y - 50, 60, 60);
            } else {
                // Fallback
                this.ctx.fillStyle = '#2d5a27';
                this.ctx.beginPath(); this.ctx.arc(t.x, t.y, 10, 0, Math.PI * 2); this.ctx.fill();
            }
        });

        // HQ
        const tc = GameState.entities.townCenter;
        this.ctx.fillStyle = '#654321'; this.ctx.fillRect(tc.x - 30, tc.y - 30, 60, 60);
        this.ctx.strokeStyle = 'gold'; this.ctx.strokeRect(tc.x - 30, tc.y - 30, 60, 60);

        // VILLAGER
        GameState.entities.villagers.forEach(v => {
            if (GameState.selection === v) {
                this.ctx.strokeStyle = 'white'; this.ctx.strokeRect(v.x - 8, v.y - 8, 16, 16);
            }
            this.ctx.fillStyle = '#ffdf00';
            this.ctx.fillRect(v.x - 6, v.y - 6, 12, 12);
        });

        // PLACEMENT VORSCHAU
        if (GameState.placementMode.active) {
            this.ctx.globalAlpha = 0.5;
            this.ctx.fillStyle = 'white';
            this.ctx.fillRect(GameState.placementMode.mx - 20, GameState.placementMode.my - 20, 40, 40);
            this.ctx.globalAlpha = 1.0;
        }

        this.ctx.restore();

        // UI & Minimap
        this.drawMinimap();
        document.getElementById('wood-count').innerText = GameState.resources.wood;
        document.getElementById('pop-count').innerText = GameState.entities.villagers.length + "/" + GameState.getMaxPop();
    },

    drawMinimap: function() {
        const size = 150;
        const offsetX = this.canvas.width - size - 10;
        const offsetY = this.canvas.height - size - 10;
        const ratio = size / GameState.world.width;
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.fillRect(offsetX, offsetY, size, size);
        this.ctx.strokeStyle = 'white';
        this.ctx.strokeRect(offsetX + GameState.camera.x * ratio, offsetY + GameState.camera.y * ratio, this.canvas.width * ratio, this.canvas.height * ratio);
    }
};
