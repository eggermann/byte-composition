/**
 * @file bufferManager.js
 * @description Handles audio buffer loading, decoding, and processing
 */

import audioContext from './audioContext';

class BufferManager {
    async decodeAndResampleAudio(arrayBuffer, targetSampleRate = 44100) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: targetSampleRate,
        });
        try {
            let audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
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
        let arrayBuffer;
        if (previewUrl) {
            return await bufferHelpers.getAudioBufferFromSample(previewUrl);
        } else if (url) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                arrayBuffer = await response.arrayBuffer();
            } catch (error) {
                console.error("Error loading sample:", error);
                throw error;
            }
        } else {
            throw new Error("No URL provided for sample");
        }
        return await this.decodeAndResampleAudio(arrayBuffer);
    }

    prepareBuffer(buffer) {
        const channel0 = Array.from(buffer.getChannelData(0));
        const channel1 = buffer.numberOfChannels > 1 ? Array.from(buffer.getChannelData(1)) : channel0;

        return {
            channels: [channel0, channel1],
            length: buffer.length,
            sampleRate: buffer.sampleRate,
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