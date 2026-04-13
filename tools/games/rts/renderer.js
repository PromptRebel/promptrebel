// In renderer.js draw() Funktion einfügen:

// --- STEINE ZEICHNEN ---
GameState.entities.stones.forEach(s => {
    const stoneImg = this.assets.props ? this.assets.props.stone : null;
    if (stoneImg) {
        this.ctx.drawImage(stoneImg, s.x - 25, s.y - 25, 50, 50);
    } else {
        this.ctx.fillStyle = 'gray';
        this.ctx.beginPath(); this.ctx.arc(s.x, s.y, 15, 0, Math.PI * 2); this.ctx.fill();
    }
});
