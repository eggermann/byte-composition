/**
 * @file bufferManager.js
 * @description Handles audio buffer loading, decoding, and processing
 */

import audioContext from './audioContext';

class BufferManager {
    constructor() {
        // Initialize with default sample rate
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 44100
        });
        this.bufferCache = new Map();
        this._float32Arrays = [new Float32Array(0), new Float32Array(0)];
    }

    async decodeAndResampleAudio(arrayBuffer, targetSampleRate = 44100) {
        try {
            // Use the class audioContext instance
            let audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
            if (audioBuffer.sampleRate !== targetSampleRate) {
                console.log(`Resampling from ${audioBuffer.sampleRate} to ${targetSampleRate}`);
            }
            return audioBuffer;
        } catch (error) {
            console.error("Error decoding audio data:", error);
            throw error;
        }
    }

    async loadSample(url = null, previewUrl = null, bufferHelpers) {
        const sampleUrl = previewUrl || url;
        if (!sampleUrl) {
            throw new Error("No URL provided for sample");
        }

        // Check cache first
        const cached = this.bufferCache.get(sampleUrl);
        if (cached) {
            return cached;
        }

        try {
            let audioBuffer;
            if (previewUrl) {
                audioBuffer = await bufferHelpers.getAudioBufferFromSample(previewUrl);
            } else {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                audioBuffer = await this.decodeAndResampleAudio(arrayBuffer);
            }

            // Cache the result
            this.bufferCache.set(sampleUrl, audioBuffer);
            return audioBuffer;
        } catch (error) {
            console.error("Error loading sample:", error);
            throw error;
        }
    }

    prepareBuffer(buffer) {
        const length = buffer.length;
        
        // Resize Float32Arrays if needed
        if (this._float32Arrays[0].length < length) {
            this._float32Arrays[0] = new Float32Array(length);
            this._float32Arrays[1] = new Float32Array(length);
        }

        // Direct copy without Array.from()
        this._float32Arrays[0].set(buffer.getChannelData(0));
        if (buffer.numberOfChannels > 1) {
            this._float32Arrays[1].set(buffer.getChannelData(1));
        } else {
            this._float32Arrays[1].set(this._float32Arrays[0]);
        }

        // Match the expected format in byteStepProcessor.handleMessage
        return {
            channels: [
                Array.from(this._float32Arrays[0].slice(0, length)),
                Array.from(this._float32Arrays[1].slice(0, length))
            ],
            length: length,
            sampleRate: buffer.sampleRate,
            numberOfChannels: 2
        };
    }

    createEmptyBuffer() {
        return {
            channelData: [[], []],
            getLength: () => 0
        };
    }
}

// Export a singleton instance
export default new BufferManager();