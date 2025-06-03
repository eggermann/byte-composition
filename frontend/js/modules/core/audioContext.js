/**
 * @file audioContext.js
 * @description Manages the audio context and its initialization state
 */


class AudioContextManager {
    constructor() {
        console.log("Initializing AudioContextManager...");

        if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
            // Use the browser‑native AudioContext so we can pass it to AudioWorkletNode
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log("AudioContext state after initialization:", this.audioContext);
            console.log("AudioContext state after initialization:", this.audioContext.state);
        } else {
            // Not in a browser environment, skip initialization
            this.audioContext = null;
            console.warn("AudioContext not initialized: window is undefined or AudioContext is unavailable.");
        }

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