import { GameState } from './gamestate.js';

export const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),
    assets: {},

    draw: function() {
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

        // 3. GEBÄUDE (Haus & Forsthaus)
        GameState.entities.buildings.forEach(b => {
            const img = b.type === 'house' ? this.assets.props?.house : this.assets.props?.lodge;
            if (img) {
                this.ctx.globalAlpha = b.isFinished ? 1.0 : 0.5;
                this.ctx.drawImage(img, b.x - 40, b.y - 40, 80, 80);
                this.ctx.globalAlpha = 1.0;
            }
            if (!b.isFinished) {
                this.ctx.fillStyle = "green";
                this.ctx.fillRect(b.x - 20, b.y - 50, b.progress * 0.4, 5);
            }
        });

        // 4. HQ
        const tc = GameState.entities.townCenter;
        const hqImg = this.assets.props?.hq;
        if (hqImg) {
            this.ctx.drawImage(hqImg, tc.x - 60, tc.y - 60, 120, 120);
        }

        // 5. VILLAGER
        GameState.entities.villagers.forEach(v => {
            this.ctx.fillStyle = GameState.selection === v ? 'white' : 'yellow';
            this.ctx.fillRect(v.x - 6, v.y - 6, 12, 12);
        });

        this.ctx.restore();

        // UI
        document.getElementById('wood-count').innerText = GameState.resources.wood;
        document.getElementById('stone-count').innerText = GameState.resources.stone;
        document.getElementById('pop-count').innerText = GameState.entities.villagers.length + "/" + GameState.getMaxPop();
    }
};
