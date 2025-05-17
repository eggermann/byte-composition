/**
 * @file frequencyArrayProcessor.worklet.js
 * @description Audio Worklet Processor for frequency-based audio synthesis.
 * Generates audio output based on an array of frequencies and magnitudes.
 *
 * @module FrequencyArrayProcessor
 * @author eggman
 * @created 2025
 *
 * @extends AudioWorkletProcessor
 *
 * @properties
 * - sampleRate: Audio sample rate (default: 44100Hz)
 * - phase: Current phase accumulator for waveform generation
 * - frequencyArray: Array of {frequency, magnitude} objects for synthesis
 *
 * @methods
 * - handleMessage: Processes incoming frequency array updates
 * - generateSound: Synthesizes audio based on frequency components
 * - process: Main audio processing callback
 *
 * @algorithm
 * Uses phase accumulation and sine wave synthesis to generate
 * complex waveforms from multiple frequency components.
 * Phase wrapping prevents numerical overflow.
 */

class FrequencyArrayProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.sampleRate = 44100;
        this.phase = 0;
        this.frequencyArray = [];
        this.port.onmessage = (event) => this.handleMessage(event.data);
    }

    handleMessage(message) {
        if (message.command === 'setFrequencies') {
            this.frequencyArray = message.frequencyArray;
        }
    }

    generateSound(output) {
        const { sampleRate } = this;
        const bufferSize = output[0].length;

        for (let channel = 0; channel < output.length; ++channel) {
            const outputChannel = output[channel];
            for (let i = 0; i < bufferSize; ++i) {
                outputChannel[i] = 0;
                this.frequencyArray.forEach(({ frequency, magnitude }) => {
                    outputChannel[i] += magnitude * Math.sin(2 * Math.PI * frequency * this.phase / sampleRate);
                });
                this.phase++;
                if (this.phase >= sampleRate) this.phase = 0; // Reset phase to avoid overflow
            }
        }

        // Notify that the frame is ready
        this.port.postMessage({ command: 'frameReady' });
    }

    process(inputs, outputs, parameters) {
        this.generateSound(outputs[0]);
        return true;
    }
}

registerProcessor('frequency-array-processor', FrequencyArrayProcessor);