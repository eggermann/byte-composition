/**
 * @file processorManager.js
 * @description Manages AudioWorklet processors, their setup, and message handling
 */

import { AudioWorkletNode } from "standardized-audio-context";
import audioContext from './audioContext';
import bufferManager from './bufferManager';

export const PROCESSOR_COUNT = 3;

class ProcessorManager {
    constructor() {
        this.processors = {};
        this.mixer = {};
        this.compressors = {};
        this.prefetchedSamples = {};
    }

    setupProcessor(procId) {
        // Create processor components
        this.mixer[procId] = {
            gain: audioContext.getContext().createGain(),
            analyzer: audioContext.getContext().createAnalyser(),
        };
        this.mixer[procId].analyzer.fftSize = 2048;
        this.mixer[procId].gain.gain.value = 0.35;

        // Setup compressor
        const compressor = audioContext.getContext().createDynamicsCompressor();
        compressor.threshold.value = -50;
        compressor.ratio.value = 20;
        this.compressors[procId] = compressor;

        // Create processor
        this.processors[procId] = new AudioWorkletNode(audioContext.getContext(), `byte-step-processor-${procId.split('proc')[1]}`);
        this.prefetchedSamples[procId] = [];

        return {
            processor: this.processors[procId],
            mixer: this.mixer[procId],
            compressor: this.compressors[procId]
        };
    }

    connectProcessor(procId, masterGain) {
        if (procId === 'proc2') { // Special handling for proc2 with delay
            const delay = audioContext.getContext().createDelay();
            delay.delayTime.value = 0.15;
            this.processors[procId].connect(delay);
            delay.connect(this.mixer[procId].gain);
        } else {
            this.processors[procId].connect(this.mixer[procId].gain);
        }

        this.mixer[procId].gain.connect(this.compressors[procId]);
        this.compressors[procId].connect(this.mixer[procId].analyzer);
        this.mixer[procId].analyzer.connect(masterGain);
    }

    addBufferToWorklet(buffer, index = 0, processorId = "proc1") {
        const procId = processorId.startsWith("proc") ? processorId : `proc${processorId.split("-").pop()}`;
        if (!this.processors[procId]) {
            console.error(`Processor ${procId} not found`);
            return;
        }

        console.log(`Processing buffer for ${procId}:`, {
            length: buffer.length,
            sampleRate: buffer.sampleRate,
            channels: buffer.numberOfChannels,
            index: index,
        });

        const simpleBuffer = bufferManager.prepareBuffer(buffer);

        this.processors[procId].port.postMessage({
            type: "sendSample",
            buffer: simpleBuffer,
            index: index,
            processorId: procId,
        });
    }

    getProcessorIds() {
        return Array.from({length: PROCESSOR_COUNT}, (_, i) => `proc${i + 1}`);
    }

    setupMessageHandler(procId, onDeliverNewSample) {
        this.processors[procId].port.onmessage = async (event) => {
            const data = event.data;
            console.log(`Received message from ${procId}:`, data.type);

            if (data.type === "deliverNewSample") {
                await onDeliverNewSample(procId);
            }
        };
    }

    getPrefetchedSamples(procId) {
        return this.prefetchedSamples[procId] || [];
    }

    addPrefetchedSample(procId, sample) {
        if (!this.prefetchedSamples[procId]) {
            this.prefetchedSamples[procId] = [];
        }
        this.prefetchedSamples[procId].push(sample);
    }

    getMixer() {
        return this.mixer;
    }

    getCompressors() {
        return this.compressors;
    }
}

// Export a singleton instance
export default new ProcessorManager();