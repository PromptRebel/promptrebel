const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),

    draw: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Bäume zeichnen
        GameState.entities.trees.forEach(tree => {
            this.ctx.fillStyle = '#2d5a27';
            this.ctx.beginPath();
            this.ctx.arc(tree.x, tree.y, 10, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // 2. Dorfzentrum zeichnen
        const tc = GameState.entities.townCenter;
        this.ctx.fillStyle = '#654321';
        this.ctx.fillRect(tc.x - 25, tc.y - 25, 50, 50);

        // 3. Villager zeichnen
        GameState.entities.villagers.forEach(v => {
            this.ctx.fillStyle = (GameState.selection === v) ? 'white' : '#ffdf00';
            this.ctx.fillRect(v.x - 5, v.y - 5, 10, 10);
            
            // Kleiner Balken über dem Kopf, wenn er Holz trägt
            if (v.inventory > 0) {
                this.ctx.fillStyle = 'brown';
                this.ctx.fillRect(v.x - 5, v.y - 12, v.inventory * 2, 3);
            }
        });

        // UI Update
        document.getElementById('wood-count').innerText = GameState.resources.wood;
        document.getElementById('pop-count').innerText = GameState.entities.villagers.length;
    }
};
