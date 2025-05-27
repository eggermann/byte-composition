/**
 * @file analyzer.js
 * @description Audio analysis module for real-time audio processing. Provides utilities
 * for analyzing audio channels and applying dynamic corrections based on audio characteristics.
 *
 * @module AudioAnalyzer
 * @author eggman
 * @created 2025
 *
 * @exports {Map} analysisData - Stores real-time analysis results for each processor
 * @exports {Function} analyzeChannels - Performs audio channel analysis
 * @exports {Function} applyCorrections - Applies dynamic audio corrections
 *
 * @algorithm
 * - RMS (Root Mean Square) calculation for average loudness
 * - Peak detection for maximum amplitude
 * - Adaptive compression threshold based on peak levels
 * - Dynamic gain staging based on RMS and processor count
 */

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