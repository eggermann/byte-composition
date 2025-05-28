/**
 * @file analyzer.js
 * @description Audio analysis and correction utilities
 */

// Store analysis results per processor with higher precision
export const analysisData = new Map();

/**
 * Analyzes audio channels and updates analysis data
 */
export function analyzeChannels(mixer, bufferHelpers) {
    for (const [procId, channels] of Object.entries(mixer)) {
        if (!channels.analyzer) continue;

        const analyzer = channels.analyzer;
        const bufferLength = analyzer.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        analyzer.getFloatTimeDomainData(dataArray);

        // Calculate RMS (Root Mean Square)
        let sumSquares = 0;
        let peak = 0;

        for (let i = 0; i < bufferLength; i++) {
            const sample = dataArray[i];
            sumSquares += sample * sample;
            peak = Math.max(peak, Math.abs(sample));
        }

        const rms = Math.sqrt(sumSquares / bufferLength);
        
        // Apply smoothing to prevent jumpy meters
        const prevAnalysis = analysisData.get(procId) || { rms: 0, peak: 0 };
        const smoothingFactor = 0.8; // Higher = smoother, but less responsive

        const smoothedRms = prevAnalysis.rms * smoothingFactor + rms * (1 - smoothingFactor);
        const smoothedPeak = prevAnalysis.peak * smoothingFactor + peak * (1 - smoothingFactor);

        // Store analysis results for this processor
        analysisData.set(procId, {
            rms: smoothedRms,
            peak: smoothedPeak,
            timestamp: Date.now()
        });
    }

    // Trigger a requestAnimationFrame for continuous updates
    requestAnimationFrame(() => {
        if (mixer && bufferHelpers) {
            analyzeChannels(mixer, bufferHelpers);
        }
    });
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

        const analysis = analysisData.get(procId);
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

// Export a function to get analysis results if needed
export const getAnalysisResults = () => Object.fromEntries(analysisData);

export default {
    analyzeChannels,
    applyCorrections,
    getAnalysisResults,
    analysisData
};