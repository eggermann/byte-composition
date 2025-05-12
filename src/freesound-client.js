/**
 * @file freesound-client.js
 * @description Freesound.org API client for fetching and processing audio samples.
 * Provides utilities for random sample selection, metadata retrieval, and audio buffer creation.
 *
 * @module FreesoundClient
 * @author eggman
 * @created 2025
 *
 * @requires window.ENV.FREESOUND_API_KEY
 *
 * @exports {Object} default
 * Methods:
 * - load(): Loads multiple random samples simultaneously
 * - setSampleInfos(samples): Fetches additional metadata for samples
 * - startFromFiles(): Loads samples from local files
 * - getRandomSample(): Fetches a random sample from Freesound
 *
 * @api
 * - GET /apiv2/search/text/ - Random sample search
 * - GET /apiv2/sounds/{id}/ - Sample metadata retrieval
 *
 * @security
 * Requires Freesound API key configured in window.ENV
 */

const API_KEY = window.ENV?.FREESOUND_API_KEY;

// Utility functions
const utils = {
    powLength: (len) => {
        let pow = 2, index = 2;
        while (len >= pow) {
            pow = Math.pow(2, index++);
        }
        return pow;
    }
};

// Fetch a random sample from FreeSound
async function getRandomSample() {
    const rnd = Math.round(Math.random() * 100000);
    console.log('Random number:', rnd);

    const response = await fetch(`https://freesound.org/apiv2/search/text/?query=${rnd}&page_size=1&fields=url,id,previews&token=${API_KEY}`);
    const data = await response.json();

    if (!data.count) {
        return getRandomSample(); // Retry if no samples found
    }

    return data.results[0];
}

// Set additional information for samples
async function setSampleInfos(samples) {
    return Promise.all(samples.map(async (sample) => {
        const id = sample.id;
        const response = await fetch(`https://freesound.org/apiv2/sounds/${id}/?fields=url,original_filename,description,duration,comment&token=${API_KEY}`);
        sample.info = await response.json();
        return sample;
    }));
}

// Load and process audio samples
async function load() {
    const rndSamples = await Promise.all([
        getRandomSample(),
        getRandomSample(),
        getRandomSample(),
        getRandomSample()
    ]);

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const audioBuffers = await Promise.all(rndSamples.map(async (sample) => {
        const preview = sample.previews['preview-hq-mp3'];
        const response = await fetch(preview);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBuffer.id = sample.id;
        return audioBuffer;
    }));

    return audioBuffers;
}

// Load samples from files
async function startFromFiles() {
    const fileSamples = ['http://localhost:3333/sample'];
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const audioBuffers = await Promise.all(fileSamples.map(async (sample) => {
        const response = await fetch(sample);
        const arrayBuffer = await response.arrayBuffer();
        return audioContext.decodeAudioData(arrayBuffer);
    }));

    return audioBuffers;
}

// Export functions
export default {
    load,
    setSampleInfos,
    startFromFiles,
    getRandomSample
};
