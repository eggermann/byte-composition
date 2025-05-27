/**
 * @file analyzer.js
 * @description Audio analysis and correction utilities
 */

// Store analysis results per processor
const analysisResults = new Map();

/**
 * Analyzes audio channels and updates analysis data
 */
export function analyzeChannels(mixer, bufferHelpers) {
    for (const [procId, channels] of Object.entries(mixer)) {
        if (!channels.analyzer) continue;

        const bufferLength = channels.analyzer.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        channels.analyzer.getFloatTimeDomainData(dataArray);

        // Analyze the audio data using the existing analyzeLoudness function
        const analysis = bufferHelpers.analyzeLoudness(dataArray);
        
        // Store analysis results for this processor
        analysisResults.set(procId, {
            rms: analysis.rms,
            peak: analysis.peak,
            timestamp: Date.now()
        });
    }
}

/**
 * Applies corrections based on analysis results
 */
export function applyCorrections(mixer, compressors, audioContext, processorCount) {
    const baseGain = 0.35;
    const maxGainReduction = 0.1;

    for (let i = 1; i <= processorCount; i++) {
        const procId = `proc${i}`;
        if (!mixer[procId] || !compressors[procId]) continue;

        const analysis = analysisResults.get(procId);
        if (!analysis) continue;

        // Apply gain correction based on RMS level
        const gain = mixer[procId].gain;
        const compressor = compressors[procId];
        const currentTime = audioContext.currentTime;

        // If RMS is too high, reduce gain
        if (analysis.rms > 0.7) {
            const reduction = Math.min(analysis.rms - 0.7, maxGainReduction);
            gain.gain.setValueAtTime(baseGain - reduction, currentTime);
        } else {
            // Gradually restore gain to base level
            gain.gain.linearRampToValueAtTime(baseGain, currentTime + 0.1);
        }

        // Adjust compressor threshold based on peak levels
        if (analysis.peak > 0.9) {
            compressor.threshold.setValueAtTime(-50, currentTime);
        } else {
            compressor.threshold.linearRampToValueAtTime(-40, currentTime + 0.1);
        }
    }
}

// Export the analysis results map for potential monitoring
export const getAnalysisResults = () => Object.fromEntries(analysisResults);

export default {
    analyzeChannels,
    applyCorrections,
    getAnalysisResults
};