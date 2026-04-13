import { GameState } from './gamestate.js';

export const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),
    assets: {}, // Hier landen die Bilder aus der main.js

    draw: function() {
        if (!this.canvas || !this.ctx) return;

        // Canvas an Bildschirmgröße anpassen
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        // Kamera-Verschiebung anwenden
        this.ctx.translate(-GameState.camera.x, -GameState.camera.y);

        // 1. STEINE ZEICHNEN
        GameState.entities.stones.forEach(s => {
            const img = this.assets.props?.stone;
            if (img) {
                this.ctx.drawImage(img, s.x - 25, s.y - 25, 50, 50);
            } else {
                this.ctx.fillStyle = 'gray';
                this.ctx.beginPath(); this.ctx.arc(s.x, s.y, 15, 0, Math.PI * 2); this.ctx.fill();
            }
        });

        // 2. BÄUME ZEICHNEN
        GameState.entities.trees.forEach(t => {
            const img = this.assets.props?.tree;
            if (img) {
                this.ctx.drawImage(img, t.x - 30, t.y - 50, 60, 60);
            }
        });

        // 3. GEBÄUDE (Häuser & Forsthaus)
        GameState.entities.buildings.forEach(b => {
            const img = b.type === 'house' ? this.assets.props?.house : this.assets.props?.lodge;
            if (img) {
                // Wenn noch nicht fertig, leicht transparent zeichnen
                this.ctx.globalAlpha = b.isFinished ? 1.0 : 0.5;
                this.ctx.drawImage(img, b.x - 40, b.y - 40, 80, 80);
                this.ctx.globalAlpha = 1.0;
            }
            
            // Fortschrittsbalken über Baustellen
            if (!b.isFinished) {
                this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
                this.ctx.fillRect(b.x - 20, b.y - 50, 40, 5);
                this.ctx.fillStyle = "#00ff00";
                this.ctx.fillRect(b.x - 20, b.y - 50, (b.progress / 100) * 40, 5);
            }
        });

        // 4. TOWN CENTER (HQ)
        const tc = GameState.entities.townCenter;
        const hqImg = this.assets.props?.hq;
        if (hqImg) {
            this.ctx.drawImage(hqImg, tc.x - 60, tc.y - 60, 120, 120);
        } else {
            // Fallback falls Bild fehlt
            this.ctx.fillStyle = '#654321';
            this.ctx.fillRect(tc.x - 40, tc.y - 40, 80, 80);
        }

        // 5. VILLAGER
        GameState.entities.villagers.forEach(v => {
            // Auswahl-Ring
            if (GameState.selection === v) {
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(v.x - 10, v.y - 10, 20, 20);
            }
            this.ctx.fillStyle = 'yellow';
            this.ctx.fillRect(v.x - 6, v.y - 6, 12, 12);
        });

        this.ctx.restore();

        // UI WERTE AKTUALISIEREN (Immer am Ende)
        const woodEl = document.getElementById('wood-count');
        const stoneEl = document.getElementById('stone-count');
        const popEl = document.getElementById('pop-count');

        if (woodEl) woodEl.innerText = Math.floor(GameState.resources.wood);
        if (stoneEl) stoneEl.innerText = Math.floor(GameState.resources.stone);
        if (popEl) popEl.innerText = GameState.entities.villagers.length + "/" + GameState.getMaxPop();
    }
};
