// renderer.js

const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),

    draw: function() {
        // 1. Hintergrund löschen
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Kamera-Verschiebung starten
        this.ctx.save();
        this.ctx.translate(-GameState.camera.x, -GameState.camera.y);

        // --- BODEN-GITTER (Orientierungshilfe) ---
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= GameState.world.width; x += 100) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, GameState.world.height);
            this.ctx.stroke();
        }
        for (let y = 0; y <= GameState.world.height; y += 100) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(GameState.world.width, y);
            this.ctx.stroke();
        }

        // --- GEBÄUDE ZEICHNEN ---
        GameState.entities.buildings.forEach(b => {
            // Radius für fertige Forsthäuser (Lodge) anzeigen
            if (b.type === 'lodge' && b.isFinished) {
                this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(b.x, b.y, 100, 0, Math.PI * 2); // 100px Pflanz-Radius
                this.ctx.stroke();
            }

            // Gebäude-Körper
            // Haus = Braun, Forsthaus = Dunkelblau/Grün, Baustelle = Grau
            if (!b.isFinished) {
                this.ctx.fillStyle = '#555555'; // Baustelle
            } else {
                this.ctx.fillStyle = (b.type === 'house') ? '#8B4513' : '#2F4F4F';
            }
            this.ctx.fillRect(b.x - 20, b.y - 20, 40, 40);

            // Fortschrittsbalken für Baustellen
            if (!b.isFinished) {
                this.ctx.fillStyle = '#333';
                this.ctx.fillRect(b.x - 20, b.y - 30, 40, 5);
                this.ctx.fillStyle = '#00FF00';
                this.ctx.fillRect(b.x - 20, b.y - 30, (b.progress / 100) * 40, 5);
            }

            // Beschriftung
            this.ctx.fillStyle = 'white';
            this.ctx.font = '10px Arial';
            this.ctx.textAlign = 'center';
            const label = b.isFinished ? (b.type === 'house' ? 'Haus' : 'Forsthaus') : 'Baustelle';
            this.ctx.fillText(label, b.x, b.y + 5);
        });

        // --- BÄUME ZEICHNEN ---
        GameState.entities.trees.forEach(t => {
            this.ctx.fillStyle = '#2d5a27';
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Kleiner brauner Stamm
            this.ctx.fillStyle = '#4B2C20';
            this.ctx.fillRect(t.x - 2, t.y + 5, 4, 5);
        });

        // --- DORFZENTRUM (HQ) ---
        const tc = GameState.entities.townCenter;
        this.ctx.fillStyle = '#654321';
        this.ctx.fillRect(tc.x - 30, tc.y - 30, 60, 60);
        this.ctx.strokeStyle = 'gold';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(tc.x - 30, tc.y - 30, 60, 60);
        this.ctx.fillStyle = 'white';
        this.ctx.fillText('ZENTRUM', tc.x, tc.y + 5);

        // --- VILLAGER ZEICHNEN ---
        GameState.entities.villagers.forEach(v => {
            // Auswahl-Rahmen
            if (GameState.selection === v) {
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(v.x - 10, v.y - 10, 20, 20);
            }

            // Villager Körper (Gelb)
            this.ctx.fillStyle = '#ffdf00';
            this.ctx.fillRect(v.x - 6, v.y - 6, 12, 12);

            // Inventar-Anzeige (Balken über dem Kopf)
            if (v.inventory > 0) {
                this.ctx.fillStyle = 'brown';
                this.ctx.fillRect(v.x - 6, v.y - 15, (v.inventory / v.capacity) * 12, 3);
            }
        });

        // --- PLACEMENT VORSCHAU ---
        if (GameState.placementMode.active) {
            this.ctx.globalAlpha = 0.4;
            this.ctx.fillStyle = (GameState.resources.wood >= GameState.placementMode.cost) ? 'white' : 'red';
            this.ctx.fillRect(GameState.placementMode.x - 20, GameState.placementMode.y - 20, 40, 40);
            
            // Radius-Vorschau für Forsthaus beim Platzieren
            if (GameState.placementMode.type === 'lodge') {
                this.ctx.strokeStyle = 'white';
                this.ctx.beginPath();
                this.ctx.arc(GameState.placementMode.x, GameState.placementMode.y, 100, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            this.ctx.globalAlpha = 1.0;
        }

        this.ctx.restore(); // Kamera-Verschiebung beenden

        // --- MINIMAP (Fest am Bildschirmrand) ---
        this.drawMinimap();

        // --- RESSOURCEN UPDATE ---
        document.getElementById('wood-count').innerText = GameState.resources.wood;
        document.getElementById('pop-count').innerText = GameState.entities.villagers.length + "/" + GameState.getMaxPop();
    },

    drawMinimap: function() {
        const size = 150;
        const offsetX = this.canvas.width - size - 10;
        const offsetY = this.canvas.height - size - 10;
        const ratio = size / GameState.world.width;

        // Minimap Hintergrund
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(offsetX, offsetY, size, size);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.strokeRect(offsetX, offsetY, size, size);

        // HQ auf Minimap
        this.ctx.fillStyle = 'brown';
        this.ctx.fillRect(offsetX + GameState.entities.townCenter.x * ratio - 2, offsetY + GameState.entities.townCenter.y * ratio - 2, 5, 5);

        // Gebäude auf Minimap
        GameState.entities.buildings.forEach(b => {
            this.ctx.fillStyle = b.isFinished ? 'white' : 'gray';
            this.ctx.fillRect(offsetX + b.x * ratio - 1, offsetY + b.y * ratio - 1, 3, 3);
        });

        // Villager auf Minimap (Gelbe Punkte)
        this.ctx.fillStyle = 'yellow';
        GameState.entities.villagers.forEach(v => {
            this.ctx.fillRect(offsetX + v.x * ratio, offsetY + v.y * ratio, 2, 2);
        });

        // Aktueller Kamera-Ausschnitt (Weißer Rahmen)
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(
            offsetX + GameState.camera.x * ratio,
            offsetY + GameState.camera.y * ratio,
            this.canvas.width * ratio,
            this.canvas.height * ratio
        );
    }
};
