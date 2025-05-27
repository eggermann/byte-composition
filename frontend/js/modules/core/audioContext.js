/**
 * @file audioContext.js
 * @description Manages the audio context and its initialization state
 */

import { getContext } from "tone";

class AudioContextManager {
    constructor() {
        this.audioContext = new getContext().rawContext;
        this.isInitialized = false;
        this.isPlaying = false;
    }

    async resume() {
        if (this.audioContext.state === 'suspended') {
            console.log("Resuming audio context...");
            await this.audioContext.resume();
            console.log("Audio context resumed.");
            this.isPlaying = true;
            return true;
        }
        return false;
    }

    async suspend() {
        if (this.audioContext.state === 'running') {
            console.log("Suspending audio context...");
            await this.audioContext.suspend();
            console.log("Audio context suspended.");
            this.isPlaying = false;
            return true;
        }
        return false;
    }

    setInitialized(value) {
        this.isInitialized = value;
    }

    getContext() {
        return this.audioContext;
    }

    getState() {
        return {
            isInitialized: this.isInitialized,
            isPlaying: this.isPlaying,
            contextState: this.audioContext.state
        };
    }
}

// Export a singleton instance
export default new AudioContextManager();