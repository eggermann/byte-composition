// spectroVisualizer.js

/**
 * Initializes a spectrogram visualization on a canvas for a given AnalyserNode.
 * @param {AnalyserNode} analyser - The AnalyserNode to visualize.
 * @param {Object} options - Additional config.
 * @param {Number} [options.width=600] - Canvas width.
 * @param {Number} [options.height=256] - Canvas height.
 * @param {Boolean} [options.enabled=true] - Whether the spectrogram is initially enabled.
 */
export function initSpectroVisualizer(analyser, options = {}) {
    const { width = 600, height = 256, enabled = true } = options;

    // If disabled, do nothing.
    if (!enabled) return;

    // Create a canvas in the DOM.
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.right = "0";
    canvas.style.zIndex = 9999;
    canvas.style.border = "1px solid #333";
    document.body.appendChild(canvas);

    const canvasCtx = canvas.getContext("2d");

    // For a spectrogram, we'll read frequency data (magnitude of each frequency bin).
    // Use getByteFrequencyData() for a 0-255 range.
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // We'll draw from left to right, "scrolling" the older image to the left by 1 pixel.
    // Then we'll draw a new vertical line for the current frequency data on the right edge.
    function draw() {
        requestAnimationFrame(draw);

        // Get current frequency data.
        analyser.getByteFrequencyData(dataArray);

        // Move the existing image 1px to the left.
        canvasCtx.drawImage(canvas, -1, 0);

        // Draw the new column on the right side (the last pixel column).
        // For each frequency bin, map its magnitude to a color and set one pixel in height.
        for (let i = 0; i < bufferLength; i++) {
            // dataArray[i] is between 0 and 255
            const val = dataArray[i];
            // For a simple "fire" or "heatmap" style color, map val to some hue or RGB.
            // For simplicity, let's use a standard gradient from blue->red->yellow->white:
            const hue = 240 - (240 * val) / 255; // 240=blue, 0=red
            canvasCtx.fillStyle = `hsl(${hue}, 100%, 50%)`;

            // Draw from bottom to top.
            // One pixel wide, 1 pixel tall:
            canvasCtx.fillRect(width - 1, height - i, 1, 1);
        }
    }

    draw(); // Start animation loop
}