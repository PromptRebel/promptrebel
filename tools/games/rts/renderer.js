export const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),
    assets: {},

    drawSketchLine: function(x1, y1, x2, y2, color = '#331a00', width = 2) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        const midX = (x1 + x2) / 2 + (Math.random() * 4 - 2);
        const midY = (y1 + y2) / 2 + (Math.random() * 4 - 2);
        this.ctx.lineTo(midX, midY);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    },

    drawSketchPath: function(points, fillColor) {
        this.ctx.fillStyle = fillColor;
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => this.ctx.lineTo(p.x, p.y));
        this.ctx.closePath();
        this.ctx.fill();
        for (let i = 0; i < points.length; i++) {
            const start = points[i];
            const end = points[(i + 1) % points.length];
            this.drawSketchLine(start.x, start.y, end.x, end.y);
        }
    },

    draw: function() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(-GameState.camera.x, -GameState.camera.y);

        // Steine zeichnen
        GameState.entities.stones.forEach(s => {
            const img = this.assets.props ? this.assets.props.stone : null;
            if (img) {
                this.ctx.drawImage(img, s.x - 25, s.y - 25, 50, 50);
            } else {
                this.ctx.fillStyle = 'gray';
                this.ctx.beginPath(); this.ctx.arc(s.x, s.y, 15, 0, Math.PI*2); this.ctx.fill();
            }
        });

        // Bäume zeichnen
        GameState.entities.trees.forEach(t => {
            const img = this.assets.props ? this.assets.props.tree : null;
            if (img) this.ctx.drawImage(img, t.x - 30, t.y - 50, 60, 60);
        });

        // Gebäude (HQ)
        const tc = GameState.entities.townCenter;
        this.ctx.save();
        this.ctx.translate(tc.x, tc.y);
        this.drawSketchPath([{x:-35,y:-20},{x:35,y:-20},{x:40,y:25},{x:-40,y:25}], '#654321');
        this.drawSketchPath([{x:-40,y:-20},{x:0,y:-55},{x:40,y:-20}], '#A0522D');
        this.ctx.restore();

        // Villager
        GameState.entities.villagers.forEach(v => {
            if (GameState.selection === v) {
                this.ctx.strokeStyle = 'white';
                this.ctx.strokeRect(v.x - 12, v.y - 12, 24, 24);
            }
            this.ctx.fillStyle = '#ffdf00';
            this.ctx.fillRect(v.x - 6, v.y - 6, 12, 12);
        });

        this.ctx.restore();
        
        // UI Update
        document.getElementById('wood-count').innerText = GameState.resources.wood;
        document.getElementById('stone-count').innerText = GameState.resources.stone;
        document.getElementById('pop-count').innerText = GameState.entities.villagers.length + "/" + GameState.getMaxPop();
    }
};
