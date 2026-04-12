const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),
    assets: {}, // Wird von main.js mit dem Ergebnis von loadAssets() befüllt

    draw: function() {
        // 1. Hintergrund löschen
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Kamera-Verschiebung starten
        this.ctx.save();
        this.ctx.translate(-GameState.camera.x, -GameState.camera.y);

        // --- BODEN-GITTER ---
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= GameState.world.width; x += 100) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, GameState.world.height);
            this.ctx.stroke();
        }
        for (let y = 0; y <= GameState.world.height; y += 100) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(GameState.world.width, y);
            this.ctx.stroke();
        }

        // --- GEBÄUDE ZEICHNEN ---
        GameState.entities.buildings.forEach(b => {
            // Radius für fertige Forsthäuser (Lodge)
            if (b.type === 'lodge' && b.isFinished) {
                this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
                this.ctx.beginPath();
                this.ctx.arc(b.x, b.y, 100, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            // Grafik oder Fallback-Rechteck
            const bImg = this.assets.buildings ? this.assets.buildings[b.type] : null;
            if (bImg && b.isFinished) {
                this.ctx.drawImage(bImg, b.x - 30, b.y - 30, 60, 60);
            } else {
                this.ctx.fillStyle = b.isFinished ? (b.type === 'house' ? '#8B4513' : '#2F4F4F') : '#555';
                this.ctx.fillRect(b.x - 20, b.y - 20, 40, 40);
            }

            // Fortschrittsbalken bei Bauplätzen
            if (!b.isFinished) {
                this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
                this.ctx.fillRect(b.x - 20, b.y - 30, 40, 5);
                this.ctx.fillStyle = '#00FF00';
                this.ctx.fillRect(b.x - 20, b.y - 30, (b.progress / 100) * 40, 5);
            }
        });

        // --- BÄUME ZEICHNEN ---
        GameState.entities.trees.forEach(t => {
            const treeImg = this.assets.props ? this.assets.props.tree : null;

            if (treeImg) {
                // Schatten unter dem Baum zeichnen
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                this.ctx.beginPath();
                this.ctx.ellipse(t.x, t.y, 15, 8, 0, 0, Math.PI * 2);
                this.ctx.fill();

                // Baum-Grafik (60x60, Fußpunkt bei t.y)
                this.ctx.drawImage(treeImg, t.x - 30, t.y - 50, 60, 60);
            } else {
                // Fallback Kreise
                this.ctx.fillStyle = '#2d5a27';
                this.ctx.beginPath();
                this.ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });

        // --- DORFZENTRUM (HQ) ---
        const tc = GameState.entities.townCenter;
        const hqImg = this.assets.buildings ? this.assets.buildings.hq : null;
        if (hqImg) {
            this.ctx.drawImage(hqImg, tc.x - 40, tc.y - 40, 80, 80);
        } else {
            this.ctx.fillStyle = '#654321';
            this.ctx.fillRect(tc.x - 30, tc.y - 30, 60, 60);
            this.ctx.strokeStyle = 'gold';
            this.ctx.strokeRect(tc.x - 30, tc.y - 30, 60, 60);
        }

        // --- VILLAGER ZEICHNEN ---
        GameState.entities.villagers.forEach(v => {
            if (GameState.selection === v) {
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(v.x - 10, v.y - 10, 20, 20);
            }
            this.ctx.fillStyle = '#ffdf00';
            this.ctx.fillRect(v.x - 6, v.y - 6, 12, 12);
        });

        // --- PLACEMENT VORSCHAU ---
        if (GameState.placementMode.active) {
            this.ctx.globalAlpha = 0.5;
            this.ctx.fillStyle = 'white';
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
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.fillRect(offsetX, offsetY, size, size);
        
        // Kamera-Rahmen
        this.ctx.strokeStyle = 'white';
        this.ctx.strokeRect(
            offsetX + GameState.camera.x * ratio, 
            offsetY + GameState.camera.y * ratio, 
            this.canvas.width * ratio, 
            this.canvas.height * ratio
        );

        // HQ Punkt
        this.ctx.fillStyle = 'brown';
        this.ctx.fillRect(offsetX + GameState.entities.townCenter.x * ratio - 2, offsetY + GameState.entities.townCenter.y * ratio - 2, 4, 4);
    }
};
