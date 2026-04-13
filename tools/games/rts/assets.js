/**
 * Lädt alle benötigten Bilder asynchron.
 * Gibt ein Objekt mit den geladenen Image-Instanzen zurück.
 */
export async function loadAssets() {
    // Definition der Pfade zu deinen Bildern
    const assetManifest = {
        props: {
            tree: "assets/IMG_1715.png",
            stone: "assets/IMG_1735.png"
        }
    };

    const assets = {
        props: {}
    };

    // Hilfsfunktion zum Laden eines einzelnen Bildes via Promise
    const loadImg = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Bild konnte nicht geladen werden: ${src}`));
        img.src = src;
    });

    try {
        // Wir gehen das Manifest durch und laden die Bilder
        const loadPromises = Object.keys(assetManifest.props).map(async (key) => {
            const img = await loadImg(assetManifest.props[key]);
            assets.props[key] = img;
        });

        // Warten, bis alle Bilder fertig geladen sind
        await Promise.all(loadPromises);
        
        return assets;
    } catch (error) {
        // Fehler an die main.js weiterreichen
        throw error;
    }
}
