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
        // Initialize analyzer for accurate metering
        this.mixer[procId].analyzer.smoothingTimeConstant = 0.3;
        this.mixer[procId].analyzer.minDecibels = -90;
        this.mixer[procId].analyzer.maxDecibels = -10;

        if (procId === 'proc2') { // Special handling for proc2 with delay
            const delay = audioContext.getContext().createDelay();
            delay.delayTime.value = 0.15;
            this.processors[procId].connect(delay);
            delay.connect(this.mixer[procId].analyzer);
            this.mixer[procId].analyzer.connect(this.mixer[procId].gain);
        } else {
            this.processors[procId].connect(this.mixer[procId].analyzer);
            this.mixer[procId].analyzer.connect(this.mixer[procId].gain);
        }

        // Connect gain to compressor and then to master
        this.mixer[procId].gain.connect(this.compressors[procId]);
        this.compressors[procId].connect(masterGain);
    }

    addBufferToWorklet(buffer, index = 0, processorId = "proc1") {
        const procId = processorId.startsWith("proc") ? processorId : `proc${processorId.split("-").pop()}`;
        if (!this.processors[procId]) {
            console.error(`Processor ${procId} not found`);
            return;
        }

        // Prepare buffer in next microtask to avoid blocking
        queueMicrotask(async () => {
            try {
                // Use transferable objects for better performance
                const simpleBuffer = await bufferManager.prepareBuffer(buffer);
                
                // Convert channels to TypedArrays for transfer
                const channel0 = new Float32Array(simpleBuffer.channels[0]);
                const channel1 = new Float32Array(simpleBuffer.channels[1]);
                
                // Separate control and audio data channels
                if (this.processors[procId].port) {
                    this.processors[procId].port.postMessage({
                        type: "sendSample",
                        buffer: {
                            channels: [channel0, channel1],
                            length: simpleBuffer.length,
                            sampleRate: simpleBuffer.sampleRate,
                            numberOfChannels: 2
                        },
                        index: index,
                        processorId: procId,
                    }, [channel0.buffer, channel1.buffer]);
                }
            } catch (err) {
                console.error(`Error preparing buffer for ${procId}:`, err);
            }
        });
    }

    getProcessorIds() {
        return Array.from({length: PROCESSOR_COUNT}, (_, i) => `proc${i + 1}`);
    }

    setupMessageHandler(procId, onDeliverNewSample) {
        // Create separate port for control messages
        const controlPort = this.processors[procId].port;
        
        controlPort.onmessage = async (event) => {
            const data = event.data;
            
            // Handle control messages in next tick to avoid blocking
            if (data.type === "deliverNewSample") {
                queueMicrotask(async () => {
                    try {
                        await onDeliverNewSample(procId);
                    } catch (err) {
                        console.error(`Error delivering sample to ${procId}:`, err);
                    }
                });
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