// spectrometer.js

/**
 * A custom "spectrometer" that:
 *  1) Copies the old canvas frame into an offscreen canvas.
 *  2) Clears/fills the main canvas with black.
 *  3) Draws the old image in the middle, shifted by (-1, -1) at 0.8 opacity.
 *  4) Draws the new frequency data on top at full opacity.
 *
 * @param {AnalyserNode} analyser - The Web Audio AnalyserNode for frequency data.
 * @param {Object} options
 * @param {number} [options.width=600]    - Canvas width in pixels.
 * @param {number} [options.height=256]   - Canvas height in pixels.
 * @param {number} [options.sliceHeight=2] - Thickness of the new frequency "slice."
 * @param {boolean} [options.enabled=true] - Whether to create/run this visualization.
 */
export function initSpectroVisualizer3D(analyser, options = {}) {
    const {
        width = 600,
        height = 256,
        sliceHeight = 256/10,
        enabled = true,
    } = options;

    if (!enabled) return;

    // 1) Create the main canvas and add it to the page.
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    // Inline styles removed - will be handled by CSS
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    // 2) Prepare an offscreen canvas to hold old frames.
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext('2d');

    // 3) Frequency data setup.
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Fill the canvas with black initially.
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);

    // Main animation loop.
    function draw() {
        requestAnimationFrame(draw);

        // a) Copy the current main canvas into offCanvas.
        offCtx.clearRect(0, 0, width, height);
        offCtx.drawImage(canvas, 0, 0);

        // b) Clear the main canvas, fill with black.
        ctx.fillStyle = 'black';
      //  ctx.fillRect(0, 0, width, height);

        // c) Draw the old image in the center at 0.8 opacity, offset by -1, -1.
        ctx.save();
        ctx.globalAlpha = .41;

        // Calculate where "middle" is. We'll shift it by -1, -1 from center.
        const offsetX = Math.floor(width / 2 - offCanvas.width / 2) /2;
        const offsetY = Math.floor(height / 2 - offCanvas.height / 2) -1;

        ctx.drawImage(offCanvas, offsetX, offsetY);
        ctx.restore();

        // d) Get the new frequency data.
        analyser.getByteFrequencyData(dataArray);

        // e) Draw a new horizontal "slice" at the bottom (or top).
        const barWidth = width / bufferLength;
        const sliceY = height - sliceHeight;

        for (let i = 0; i < bufferLength; i++) {
            const val = dataArray[i];
            // Simple hue mapping: 0=blue, 255=red
            const hue = 240 - (240 * val) / 255;
            ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;

            const x = i * barWidth;
            ctx.fillRect(x, sliceY, barWidth, sliceHeight);
        }
    }

    draw();
}