/**
 * @file WorkBuffer.js
 * @description Wrapper class for audio buffer data manipulation. Provides a simplified
 * interface for handling multi-channel audio data in the byte composition system.
 *
 * @module WorkBuffer
 * @author eggman
 * @created 2025
 *
 * @class WorkBuffer
 * @property {Array<Float32Array>} channelData - Array of audio channels data
 * @method getLength() - Returns the length of the buffer's channel data
 *
 * @example
 * const buffer = new WorkBuffer({
 *   channelData: [new Float32Array(1024), new Float32Array(1024)]
 * });
 */

export class WorkBuffer {
    constructor(buffer) {
        this.channelData = buffer.channelData;//[[][]]
    }

    getLength() {
        return this.channelData[0].length;
    }
}