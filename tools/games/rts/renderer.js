import { GameState } from './gamestate.js';

export const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),
    assets: {},

    // Spritesheet Konfiguration
    FRAME_W: 64,
    FRAME_H: 64,
    animTick: 0,
    ANIM: {
        walk_up:    { row: 8,  frames: 9 },
        walk_left:  { row: 9,  frames: 9 },
        walk_down:  { row: 10, frames: 9 }, // Row 10 ist meist Standard für Down (LPC)
        walk_right: { row: 11, frames: 9 },
        idle:       { row: 10, frames: 1 }, 
    },

    draw: function() {
        if (!this.canvas || !this.ctx) return;

        // Canvas an Bildschirmgröße anpassen
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(-GameState.camera.x, -GameState.camera.y);

        // 1. STEINE ZEICHNEN
        GameState.entities.stones.forEach(s => {
            const img = this.assets.props?.stone;
            if (img) {
                this.ctx.drawImage(img, s.x - 25, s.y - 25, 50, 50);
            } else {
                this.ctx.fillStyle = 'gray';
                this.ctx.beginPath();
                this.ctx.arc(s.x, s.y, 15, 0, Math.PI * 2);
                this.ctx.fill();
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
            const img = b.type === 'house' 
                ? this.assets.props?.house 
                : this.assets.props?.lodge;
            if (img) {
                this.ctx.globalAlpha = b.isFinished ? 1.0 : 0.5;
                this.ctx.drawImage(img, b.x - 40, b.y - 40, 80, 80);
                this.ctx.globalAlpha = 1.0;
            }
            
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
            this.ctx.fillStyle = '#654321';
            this.ctx.fillRect(tc.x - 40, tc.y - 40, 80, 80);
        }

        // 5. VILLAGER (Zuletzt zeichnen, damit sie ÜBER den Gebäuden sind)
        this.animTick++;

        GameState.entities.villagers.forEach(v => {
            const img = this.assets.props?.villager_sheet;

            // Auswahl-Ellipse unter dem Villager
            if (GameState.selection === v) {
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.ellipse(v.x, v.y + 15, 15, 5, 0, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            if (img) {
                const isMoving = [
                    'moving_to_tree', 'moving_to_stone',
                    'returning', 'building', 'planting'
                ].includes(v.state);

                // NUTZT JETZT v.lastDir AUS DER villager.js
                let animKey = isMoving ? 'walk_' + v.lastDir : 'idle';
                
                // Falls v.lastDir noch nicht gesetzt wurde (beim ersten Frame)
                if (!v.lastDir) animKey = 'idle';

                const anim = this.ANIM[animKey] || this.ANIM.idle;

                const frame = isMoving
                    ? Math.floor(this.animTick / 6) % anim.frames
                    : 0;

                this.ctx.drawImage(
                    img,
                    frame * this.FRAME_W,
                    anim.row * this.FRAME_H,
                    this.FRAME_W,
                    this.FRAME_H,
                    v.x - 32,
                    v.y - 48,
                    64,
                    64
                );
            } else {
                this.ctx.fillStyle = 'yellow';
                this.ctx.fillRect(v.x - 6, v.y - 6, 12, 12);
            }
        });

        this.ctx.restore();

        // UI WERTE AKTUALISIEREN
        const woodEl = document.getElementById('wood-count');
        const stoneEl = document.getElementById('stone-count');
        const popEl = document.getElementById('pop-count');

        if (woodEl) woodEl.innerText = Math.floor(GameState.resources.wood);
        if (stoneEl) stoneEl.innerText = Math.floor(GameState.resources.stone);
        if (popEl) popEl.innerText = GameState.entities.villagers.length + "/" + GameState.getMaxPop();
    }
};
