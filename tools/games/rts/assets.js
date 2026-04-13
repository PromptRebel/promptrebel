/**
 * Lädt alle benötigten Bilder asynchron.
 * Gibt ein Objekt mit den geladenen Image-Instanzen zurück.
 */
export async function loadAssets() {
    // Definition der Pfade zu deinen Bildern
    const assetManifest = {
        props: {
            tree: "assets/IMG_1715.png",
            stone: "assets/IMG_1735.png",
            house: "assets/IMG_1744.png",
            lodge: "assets/IMG_1745.png",
            hq: "assets/IMG_1751.png"
        }
    };

    const assets = {
        props: {}
    };

    /**
     * Hilfsfunktion zum Laden eines einzelnen Bildes via Promise.
     * @param {string} src - Der Pfad zum Bild.
     */
    const loadImg = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
            console.error("Fehler beim Laden von Asset:", src);
            reject(new Error(`Bild konnte nicht geladen werden: ${src}`));
        };
        img.src = src;
    });

    try {
        // Wir erstellen eine Liste von Lade-Aufgaben (Promises)
        const keys = Object.keys(assetManifest.props);
        const loadPromises = keys.map(async (key) => {
            const img = await loadImg(assetManifest.props[key]);
            assets.props[key] = img;
        });

        // Warten, bis alle Bilder fertig geladen sind
        await Promise.all(loadPromises);
        
        console.log("Alle Assets erfolgreich geladen:", Object.keys(assets.props));
        return assets;
    } catch (error) {
        // Fehler an die aufrufende main.js weiterreichen
        throw error;
    }
}
