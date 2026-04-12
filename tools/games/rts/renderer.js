const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),

    draw: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Gebäude
        GameState.entities.buildings.forEach(b => {
            this.ctx.fillStyle = b.isFinished ? (b.type === 'house' ? '#8B4513' : '#2F4F4F') : '#555';
            this.ctx.fillRect(b.x - 20, b.y - 20, 40, 40);
            if (!b.isFinished) {
                this.ctx.fillStyle = 'lime';
                this.ctx.fillRect(b.x - 20, b.y - 30, b.progress * 0.4, 5);
            }
            this.ctx.fillStyle = 'white';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(b.type === 'house' ? 'Haus' : 'Forst', b.x - 15, b.y + 5);
        });

        // Bäume
        GameState.entities.trees.forEach(t => {
            this.ctx.fillStyle = '#2d5a27';
            this.ctx.beginPath(); this.ctx.arc(t.x, t.y, 10, 0, Math.PI * 2); this.ctx.fill();
        });

        // HQ & Villager
        const tc = GameState.entities.townCenter;
        this.ctx.fillStyle = '#654321'; this.ctx.fillRect(tc.x - 25, tc.y - 25, 50, 50);
        GameState.entities.villagers.forEach(v => {
            this.ctx.fillStyle = (GameState.selection === v) ? 'white' : '#ffdf00';
            this.ctx.fillRect(v.x - 6, v.y - 6, 12, 12);
        });

        document.getElementById('wood-count').innerText = GameState.resources.wood;
        document.getElementById('pop-count').innerText = GameState.entities.villagers.length + "/" + GameState.getMaxPop();
    }
};
