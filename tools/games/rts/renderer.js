import { GameState } from './gamestate.js';

export const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),
    assets: {},

    // Spritesheet Konfiguration
    FRAME_W: 64,
    FRAME_H: 64,
    animTick: 0,
    
    // Konfiguration basierend auf dem LPC-Spritesheet
    ANIM: {
        // Gehen
        walk_up:    { row: 8,  frames: 9 },
        walk_left:  { row: 9,  frames: 9 },
        walk_down:  { row: 10, frames: 9 },
        walk_right: { row: 11, frames: 9 },
        
        // Hacken (Holz) - Slash Animation
        chop_up:    { row: 12, frames: 6 },
        chop_left:  { row: 13, frames: 6 },
        chop_down:  { row: 14, frames: 6 },
        chop_right: { row: 15, frames: 6 },

        // Klopfen (Stein) - Oversize/Action Animation
        mine_up:    { row: 16, frames: 6 },
        mine_left:  { row: 17, frames: 6 },
        mine_down:  { row: 18, frames: 6 },
        mine_right: { row: 19, frames: 6 },

        // Pflanzen / Gießen (Förster)
        plant_up:    { row: 20, frames: 6 },
        plant_left:  { row: 21, frames: 6 },
        plant_down:  { row: 22, frames: 6 },
        plant_right: { row: 23, frames: 6 },

        idle:       { row: 10, frames: 1 }, 
    },

    draw: function() {
        if (!this.canvas || !this.ctx) return;

        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(-GameState.camera.x, -GameState.camera.y);

        // 1. STEINE
        GameState.entities.stones.forEach(s => {
            const img = this.assets.props?.stone;
            if (img) this.ctx.drawImage(img, s.x - 25, s.y - 25, 50, 50);
        });

        // 2. BÄUME
        GameState.entities.trees.forEach(t => {
            const img = this.assets.props?.tree;
            if (img) this.ctx.drawImage(img, t.x - 30, t.y - 50, 60, 60);
        });

        // 3. GEBÄUDE
        GameState.entities.buildings.forEach(b => {
            const img = b.type === 'house' ? this.assets.props?.house : this.assets.props?.lodge;
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

        // 4. HQ
        const tc = GameState.entities.townCenter;
        const hqImg = this.assets.props?.hq;
        if (hqImg) this.ctx.drawImage(hqImg, tc.x - 60, tc.y - 60, 120, 120);

        // 5. VILLAGER
        this.animTick++;

        GameState.entities.villagers.forEach(v => {
            const img = this.assets.props?.villager_sheet;

            if (GameState.selection === v) {
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.ellipse(v.x, v.y + 15, 15, 5, 0, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            if (img) {
                const isActing = v.actionTimer > 0;
                const isMoving = !isActing && [
                    'moving_to_tree', 'moving_to_stone',
                    'returning', 'building', 'planting'
                ].includes(v.state);

                let animKey = 'idle';
                
                if (isActing) {
                    // Bestimme welche Action-Animation (Hacken, Klopfen, Pflanzen)
                    let action = 'chop';
                    if (v.state === 'mining') action = 'mine';
                    if (v.state === 'planting') action = 'plant';
                    animKey = `${action}_${v.lastDir}`;
                } else if (isMoving) {
                    animKey = 'walk_' + v.lastDir;
                }

                const anim = this.ANIM[animKey] || this.ANIM.idle;

                let frame = 0;
                if (isActing) {
                    // Die Action-Animation läuft synchron zur actionDuration in villager.js
                    const elapsed = Date.now() - v.actionTimer;
                    frame = Math.min(anim.frames - 1, Math.floor((elapsed / v.actionDuration) * anim.frames));
                } else if (isMoving) {
                    frame = Math.floor(this.animTick / 6) % anim.frames;
                }

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

        // UI WERTE
        document.getElementById('wood-count').innerText = Math.floor(GameState.resources.wood);
        document.getElementById('stone-count').innerText = Math.floor(GameState.resources.stone);
        document.getElementById('pop-count').innerText = GameState.entities.villagers.length + "/" + GameState.getMaxPop();
    }
};
