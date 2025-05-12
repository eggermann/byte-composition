/**
 * @file prepareAudioBuffer.js
 * @description Audio buffer preparation and analysis utilities. Provides functions for
 * loading, analyzing, and playing audio buffers with loudness measurements.
 *
 * @module AudioBufferUtils
 * @author eggman
 * @created 2025
 *
 * @exports {Object} default
 * Methods:
 * - analyzeLoudness(data): Computes RMS and peak values from audio data
 * - getAudioBufferFromSample(url): Fetches and decodes audio from URL
 * - playFromAudioBuffer(audioBuffer): Plays decoded audio buffer
 *
 * @algorithm
 * Loudness Analysis:
 * - RMS (Root Mean Square) calculation for average power
 * - Peak detection for maximum amplitude
 * - Non-blocking async audio loading and decoding
 */

const defaultFormat = {
    float: true,
    interleaved: false
};
function analyzeLoudness(data) {
    let sumSquares = 0;
    let peak = 0;

    for (let i = 0; i < data.length; i++) {
        const sample = data[i];
        sumSquares += sample * sample;
        if (Math.abs(sample) > peak) {
            peak = Math.abs(sample);
        }
    }

    const rms = Math.sqrt(sumSquares / data.length);
    return { rms, peak };
}

async function getAudioBufferFromSample(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
}

function playFromAudioBuffer(audioBuffer) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);
}

export default {
    getAudioBufferFromSample,
    playFromAudioBuffer,
    analyzeLoudness
};