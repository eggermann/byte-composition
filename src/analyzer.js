export const analysisData = new Map();

/**
 * Analyzes the audio channels and stores the loudness parameters.
 * @param {Object} mixer - The mixer object containing processors and analyzers.
 * @param {Object} bufferHelpers - The helper functions for loudness analysis.
 */
export function analyzeChannels(mixer, bufferHelpers) {
    analysisData.clear();
    Object.entries(mixer).forEach(([procId, { analyzer }]) => {
        const data = new Float32Array(analyzer.frequencyBinCount);
        analyzer.getFloatTimeDomainData(data);

        // Calculate loudness parameters
        const { rms, peak } = bufferHelpers.analyzeLoudness(data);
        analysisData.set(procId, { rms, peak });
    });
}

/**
 * Applies adaptive compression and gain staging based on analyzed data.
 * @param {Object} mixer - The mixer object containing processors and gains.
 * @param {Object} compressors - The compressor settings for each processor.
 * @param {AudioContext} audioContext - The Web Audio API context.
 * @param {Number} PROCESSOR_COUNT - The total number of processors in the system.
 */
export function applyCorrections(mixer, compressors, audioContext, PROCESSOR_COUNT) {
    const now = audioContext.currentTime;

    analysisData.forEach(({ rms, peak }, procId) => {
        if (!mixer[procId] || !compressors[procId]) return;

        const { gain } = mixer[procId];
        const compressor = compressors[procId];

        // Adaptive compression
        compressor.threshold.setTargetAtTime(
            Math.min(-18, -18 * (peak / 0.9)),
            now,
            0.1
        );

        // Gain staging
        const targetGain = Math.min(
            0.9 / (rms * PROCESSOR_COUNT),
            0.95 / peak
        );

        gain.gain.setTargetAtTime(
            Math.min(targetGain, 1),
            now,
            peak > 0.9 ? 0.01 : 0.1  // Faster response for peaks
        );
    });
}