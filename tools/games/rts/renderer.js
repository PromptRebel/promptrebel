const Renderer = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),
    assets: {}, // Wird von main.js mit loadAssets() befüllt (für den Baum)

    // Hilfsfunktion: Zeichnet eine unregelmäßige, skizzierte Linie
    drawSketchLine: function(x1, y1, x2, y2, color = '#331a00', width = 2) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        
        // Füge 1-2 Zwischenpunkte für die Unregelmäßigkeit hinzu
        const midX = (x1 + x2) / 2 + (Math.random() * 3 - 1.5);
        const midY = (y1 + y2) / 2 + (Math.random() * 3 - 1.5);
        this.ctx.lineTo(midX, midY);
        
        this.ctx.lineTo(x2 + (Math.random() * 1.5 - 0.75), y2 + (Math.random() * 1.5 - 0.75));
        this.ctx.stroke();
    },

    // Hilfsfunktion: Zeichnet eine skizzierte Form (Hauskörper/Dach)
    drawSketchPath: function(points, fillColor, lineColor = '#331a00') {
        if (points.length < 3) return;

        // 1. Form füllen
        this.ctx.fillStyle = fillColor;
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        this.ctx.closePath();
        this.ctx.fill();

        // 2. Umrandung mit skizzierten Linien zeichnen
        for (let i = 0; i < points.length; i++) {
            const start = points[i];
            const end = points[(i + 1) % points.length];
            this.drawSketchLine(start.x, start.y, end.x, end.y, lineColor);
        }
    },

    draw: function() {
        // 1. Hintergrund löschen
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Kamera-Verschiebung starten
        this.ctx.save();
        this.ctx.translate(-GameState.camera.x, -GameState.camera.y);

        // --- BODEN-GITTER ---
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= GameState.world.width; x += 100) {
            this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, GameState.world.height); this.ctx.stroke();
        }
        for (let y = 0; y <= GameState.world.height; y += 100) {
            this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(GameState.world.width, y); this.ctx.stroke();
        }

        // --- GEBÄUDE ZEICHNEN ---
        GameState.entities.buildings.forEach(b => {
            // Radius für fertige Forsthäuser (Lodge)
            if (b.type === 'lodge' && b.isFinished) {
                this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.15)';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath(); this.ctx.arc(b.x, b.y, 100, 0, Math.PI * 2); this.ctx.stroke();
            }

            this.ctx.save();
            this.ctx.translate(b.x, b.y); // Zum Zentrum des Gebäudes springen

            // Schatten (Ellipse auf dem Boden)
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            this.ctx.beginPath(); this.ctx.ellipse(0, 0, 30, 10, 0, 0, Math.PI * 2); this.ctx.fill();

            if (b.isFinished) {
                if (b.type === 'house') {
                    // --- HAUS ZEICHNEN --- skizzierter Stil
                    // Hauskörper
                    this.drawSketchPath([
                        { x: -20, y: -10 }, { x: 20, y: -10 },
                        { x: 20, y: 20 }, { x: -20, y: 20 }
                    ], '#CD853F'); // Hellbraun

                    // Dach (Dreieck)
                    this.drawSketchPath([
                        { x: -23, y: -10 }, { x: 0, y: -35 }, { x: 23, y: -10 }
                    ], '#8B0000'); // Dunkelrot

                    // Tür (Dunkel)
                    this.drawSketchPath([
                        { x: -6, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 20 }, { x: -6, y: 20 }
                    ], '#331a00'); 

                    // Fenster (Gelbes Licht)
                    this.drawSketchPath([
                        { x: 8, y: -3 }, { x: 16, y: -3 }, { x: 16, y: 5 }, { x: 8, y: 5 }
                    ], '#e6e600'); 

                } else if (b.type === 'lodge') {
                    // --- LODGE (FORSTHAUS) ZEICHNEN --- skizzierter Stil
                    // Hauskörper (Leicht unregelmäßig)
                    this.drawSketchPath([
                        { x: -25, y: -15 }, { x: 25, y: -15 },
                        { x: 28, y: 15 }, { x: -28, y: 15 }
                    ], '#556B2F'); // Dunkles Olivgrün

                    // Dach (Flacher)
                    this.drawSketchPath([
                        { x: -28, y: -15 }, { x: 0, y: -40 }, { x: 28, y: -15 }
                    ], '#003300'); // Sehr dunkles Grün

                    // Großer Holzeingang
                    this.drawSketchPath([
                        { x: -10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 15 }, { x: -10, y: 15 }
                    ], '#4B2C20'); // Dunkles Holzbraun

                    // Balken über der Tür (Zusätzliche skizzierte Linie)
                    this.drawSketchLine(-12, -2, 12, -2, '#331a00', 3);
                }
            } else {
                // --- BAUSTELLE ZEICHNEN --- skizzierter Stil
                this.ctx.globalAlpha = 0.6;
                this.drawSketchPath([
                    { x: -18, y: -10 }, { x: 18, y: -10 },
                    { x: 20, y: 18 }, { x: -20, y: 18 }
                ], '#777777'); // Grau
                this.ctx.globalAlpha = 1.0;

                // Bau-Gerüst Linien
                this.drawSketchLine(-15, -15, 15, 15, '#331a00', 2);
                this.drawSketchLine(15, -15, -15, 15, '#331a00', 2);
            }

            this.ctx.restore(); // Gebäudeposition zurücksetzen

            // Fortschrittsbalken über der Baustelle
            if (!b.isFinished) {
                this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
                this.ctx.fillRect(b.x - 20, b.y - 35, 40, 5);
                this.ctx.fillStyle = '#00FF00';
                this.ctx.fillRect(b.x - 20, b.y - 35, (b.progress / 100) * 40, 5);
            }
        });

        // --- BÄUME ZEICHNEN ---
        GameState.entities.trees.forEach(t => {
            const treeImg = this.assets.props ? this.assets.props.tree : null;
            if (treeImg) {
                // Schatten unter dem Baum zeichnen (Ellipse)
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
                this.ctx.beginPath(); this.ctx.ellipse(t.x, t.y, 18, 8, 0, 0, Math.PI * 2); this.ctx.fill();

                // Baum-Grafik (Fußpunkt bei t.y)
                this.ctx.drawImage(treeImg, t.x - 30, t.y - 50, 60, 60);
            } else {
                // Fallback
                this.ctx.fillStyle = '#2d5a27'; this.ctx.beginPath(); this.ctx.arc(t.x, t.y, 10, 0, Math.PI * 2); this.ctx.fill();
            }
        });

        // --- DORFZENTRUM (HQ) --- skizzierter Stil
        const tc = GameState.entities.townCenter;
        this.ctx.save();
        this.ctx.translate(tc.x, tc.y);

        // Schatten
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.beginPath(); this.ctx.ellipse(0, 0, 45, 18, 0, 0, Math.PI * 2); this.ctx.fill();

        // Haupthaus (Dunkelbraun)
        this.drawSketchPath([
            { x: -35, y: -20 }, { x: 35, y: -20 },
            { x: 40, y: 25 }, { x: -40, y: 25 }
        ], '#654321');

        // Dach (Helleres Braun/Rot)
        this.drawSketchPath([
            { x: -40, y: -20 }, { x: 0, y: -55 }, { x: 40, y: -20 }
        ], '#A0522D');

        // Tür & Fenster
        this.drawSketchPath([{ x: -10, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 25 }, { x: -10, y: 25 }], '#331a00'); 
        this.drawSketchPath([{ x: 15, y: -5 }, { x: 25, y: -5 }, { x: 25, y: 5 }, { x: 15, y: 5 }], '#e6e600');

        // Beschriftung
        this.ctx.fillStyle = 'white'; this.ctx.font = 'bold 14px Arial'; this.ctx.textAlign = 'center'; this.ctx.fillText("HQ", 0, -5);
        this.ctx.restore();

        // --- VILLAGER ZEICHNEN ---
        GameState.entities.villagers.forEach(v => {
            if (GameState.selection === v) {
                this.ctx.strokeStyle = 'white'; this.ctx.lineWidth = 2; this.ctx.strokeRect(v.x - 10, v.y - 10, 20, 20);
            }
            this.ctx.fillStyle = '#ffdf00'; this.ctx.fillRect(v.x - 6, v.y - 6, 12, 12);
        });

        // --- PLACEMENT VORSCHAU ---
        if (GameState.placementMode.active) {
            this.ctx.globalAlpha = 0.5; this.ctx.fillStyle = 'white'; this.ctx.fillRect(GameState.placementMode.x - 20, GameState.placementMode.y - 20, 40, 40); this.ctx.globalAlpha = 1.0;
        }

        this.ctx.restore();

        // UI & Minimap (fest am Bildschirm)
        this.drawMinimap();
        document.getElementById('wood-count').innerText = GameState.resources.wood;
        document.getElementById('pop-count').innerText = GameState.entities.villagers.length + "/" + GameState.getMaxPop();
    },

    drawMinimap: function() {
        const size = 150;
        const offsetX = this.canvas.width - size - 10;
        const offsetY = this.canvas.height - size - 10;
        const ratio = size / GameState.world.width;

        // Hintergrund
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.fillRect(offsetX, offsetY, size, size);
        
        // Kamera-Rahmen
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(
            offsetX + GameState.camera.x * ratio, 
            offsetY + GameState.camera.y * ratio, 
            this.canvas.width * ratio, 
            this.canvas.height * ratio
        );

        // HQ Punkt
        this.ctx.fillStyle = 'brown';
        this.ctx.fillRect(offsetX + GameState.entities.townCenter.x * ratio - 2, offsetY + GameState.entities.townCenter.y * ratio - 2, 4, 4);
        
        // Villager Punkte
        this.ctx.fillStyle = 'yellow';
        GameState.entities.villagers.forEach(v => {
            this.ctx.fillRect(offsetX + v.x * ratio, offsetY + v.y * ratio, 2, 2);
        });
    }
};
