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
        walk_left:  { row: 10, frames: 9 },
        walk_down:  { row: 12, frames: 9 },
        walk_right: { row: 14, frames: 9 },
        idle:       { row: 12, frames: 1 },
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
            } else {
                this.ctx.fillStyle = '#228B22';
                this.ctx.beginPath();
                this.ctx.arc(t.x, t.y - 20, 20, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.fillStyle = '#8B4513';
                this.ctx.fillRect(t.x - 4, t.y, 8, 20);
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
            this.ctx.fillStyle = '#654321';
            this.ctx.fillRect(tc.x - 40, tc.y - 40, 80, 80);
        }

        // 5. VILLAGER mit Spritesheet-Animation
        this.animTick++;

        GameState.entities.villagers.forEach(v => {
            const img = this.assets.props?.villager_sheet;

            // Auswahl-Ellipse unter dem Villager
            if (GameState.selection === v) {
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.ellipse(v.x, v.y + 20, 18, 7, 0, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            if (!img) {
                // Fallback gelbes Quadrat
                this.ctx.fillStyle = 'yellow';
                this.ctx.fillRect(v.x - 6, v.y - 6, 12, 12);
                return;
            }

            // Bewegungszustand bestimmen
            const isMoving = [
                'moving_to_tree', 'moving_to_stone',
                'returning', 'building', 'planting'
            ].includes(v.state);

            // Richtung berechnen
            let anim = this.ANIM.idle;

            if (isMoving) {
                // Zielkoordinaten je nach State
                let tx = GameState.entities.townCenter.x;
                let ty = GameState.entities.townCenter.y;

                if (v.targetTree)     { tx = v.targetTree.x;     ty = v.targetTree.y; }
                if (v.targetStone)    { tx = v.targetStone.x;    ty = v.targetStone.y; }
                if (v.targetBuilding) { tx = v.targetBuilding.x; ty = v.targetBuilding.y; }

                const dx = tx - v.x;
                const dy = ty - v.y;

                if (Math.abs(dx) > Math.abs(dy)) {
                    anim = dx > 0 ? this.ANIM.walk_right : this.ANIM.walk_left;
                } else {
                    anim = dy > 0 ? this.ANIM.walk_down : this.ANIM.walk_up;
                }
            }

            // Animations-Frame berechnen
            const frame = isMoving
                ? Math.floor(this.animTick / 6) % anim.frames
                : 0;

            this.ctx.drawImage(
                img,
                frame * this.FRAME_W,       // X im Spritesheet
                anim.row * this.FRAME_H,    // Y im Spritesheet
                this.FRAME_W,               // Ausschnitt Breite
                this.FRAME_H,               // Ausschnitt Höhe
                v.x - 32,                   // Ziel X (zentriert)
                v.y - 48,                   // Ziel Y (Füße bei v.y)
                64,                         // Render Breite
                64                          // Render Höhe
            );
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
