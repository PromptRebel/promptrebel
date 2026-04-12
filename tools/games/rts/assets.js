// assets.js
async function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Bild fehlt: " + url));
    });
}

export async function loadAssets() {
    const manifest = {
        props: {
            tree: "assets/IMG_1715.png", // Hier liegt dein Baum-Bild
        },
        buildings: {
            hq: "assets/hq.png",
            house: "assets/house.png",
            lodge: "assets/lodge.png"
        }
    };

    const assets = { props: {}, buildings: {} };
    for (const group in manifest) {
        for (const key in manifest[group]) {
            try {
                assets[group][key] = await loadImage(manifest[group][key]);
            } catch (e) {
                console.warn(e.message);
                assets[group][key] = null; // Fallback auf Kreise/Rechtecke
            }
        }
    }
    return assets;
}
