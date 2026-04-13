export async function loadAssets() {
    const assets = {
        props: {
            tree: "assets/IMG_1715.png",
            stone: "assets/IMG_1735.png" // Neu
        }
    };

    const loadImg = (src) => new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => rej(new Error("Bild nicht gefunden: " + src));
        img.src = src;
    });

    // Lade alle Bilder im Loop
    for (let key in assets.props) {
        assets.props[key] = await loadImg(assets.props[key]);
    }

    return assets;
}
