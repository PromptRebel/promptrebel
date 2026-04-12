const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),

    draw: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Bäume
        GameState.entities.trees.forEach(tree => {
            this.ctx.fillStyle = '#2d5a27';
            this.ctx.beginPath();
            this.ctx.arc(tree.x, tree.y, 12, 0, Math.PI * 2);
            this.ctx.fill();
            // Kleiner Balken für Baum-Holz
            this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
            this.ctx.fillRect(tree.x - 10, tree.y + 15, tree.woodAmount / 2.5, 3);
        });

        // HQ
        const tc = GameState.entities.townCenter;
        this.ctx.fillStyle = '#654321';
        this.ctx.fillRect(tc.x - 25, tc.y - 25, 50, 50);

        // Villager
        GameState.entities.villagers.forEach(v => {
            this.ctx.fillStyle = (GameState.selection === v) ? 'white' : '#ffdf00';
            this.ctx.fillRect(v.x - 6, v.y - 6, 12, 12);
            if (v.inventory > 0) {
                this.ctx.fillStyle = 'brown';
                this.ctx.fillRect(v.x - 6, v.y - 15, (v.inventory / v.capacity) * 12, 4);
            }
        });

        document.getElementById('wood-count').innerText = GameState.resources.wood;
        document.getElementById('pop-count').innerText = GameState.entities.villagers.length;
    }
};
