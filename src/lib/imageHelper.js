export function preloadImage(url) {
    if (!url) return Promise.reject('invalid url.');

    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = () => reject(`preloadImage: ${url}`);
        img.src = url;
    });
}
