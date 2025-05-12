/**
 * @file byteStepProcessor.worklet.js
 * @description Audio Worklet Processor for byte-based audio manipulation and composition.
 * Handles real-time audio processing, buffer management, and sample arrangement.
 *
 * @module ByteStepProcessor
 * @author eggman
 * @created 2025
 *
 * @dependencies
 * - process.js: Core audio processing logic
 * - composition.js: Sample arrangement and composition utilities
 *
 * @classes
 * - ByteStepProcessor: Main audio worklet processor implementation
 * - ProcessorWithId: Extended processor with ID handling capabilities
 *
 * @state
 * - freshBuffers: Array of newly loaded audio buffers
 * - workBuffer: Current working audio buffers (2 channels)
 * - isPlaying: Playback state flag
 * - pos: Current playback position
 * - roundCount: Processing cycle counter
 *
 * @constants
 * - PROCESSOR_COUNT: Number of parallel processors to register (3)
 */

import { process } from './process.js';
import composition, { arrangement } from '../composition';

class ByteStepProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.freshBuffers = [];
        this.sampleRoundCount = 0;
        this.isPlaying = false;
        this.pos = 0;
        this.workBuffer = [
            { channelData: [[], []], getLength: () => 0 },
            { channelData: [[], []], getLength: () => 0 }
        ];
        this.roundCount = 0;
        this.port.onmessage = this.handleMessage.bind(this);
    }


    handleMessage(event) {
        try {
            console.log('AudioWorklet received message:', event.data.type);

            if (event.data.type === 'sendSample') {
                const { buffer, index } = event.data;

                if (!buffer || !buffer.channels) {
                    console.error('Invalid buffer format:', buffer);
                    return;
                }

                // Convert back to Float32Arrays
                const channelData = [
                    new Float32Array(buffer.channels[0]),
                    new Float32Array(buffer.channels[1])
                ];

                this.freshBuffers.push({
                    channelData: channelData,
                    getLength: () => buffer.length,
                    sampleRate: buffer.sampleRate
                });

                if (this.freshBuffers.length % 2 === 0) {
                    this.finishCount = 0

                    const sample1 = this.freshBuffers.shift();
                    const sample2 = this.freshBuffers.shift();

                    event.data.arrangementType = 'random'
                    let c;
                    if (event.data.arrangementType === 'repeat') {
                        c = composition.arrangement.repeat(sample1, sample2, event.data.justifyContent);
                    } else if (event.data.arrangementType === 'random') {
                        c = composition.arrangement.random(sample1, sample2);
                    } else {
                        c = composition.arrangement.equal(sample1, sample2);
                    }

                    console.log('-->after arrange', c.s1.getLength(), c.s2.getLength());

                    this.workBuffer[0] = c.s1;
                    this.workBuffer[1] = c.s2;
                    this.hasRefreshed = false
                    this.newSample = true;
                }

                console.log('Sample loaded into freshBuffers', {
                    length: buffer.length,
                    sampleRate: buffer.sampleRate,
                    channels: buffer.numberOfChannels
                });

            } else if (event.data.type === 'stop') {
                this.isPlaying = false;
            } else if (event.data.type === 'start') {
                this.isPlaying = true;
            }
        } catch (err) {
            console.error('Error in handleMessage:', err);
        }
    }

    process(inputs, outputs, parameters) {
        return process.call(this, inputs, outputs, parameters);
    }
}

// Create processor class with ID handling
class ProcessorWithId extends ByteStepProcessor {
    constructor() {
        super();
        this.processorId = this.constructor.name;

        // Add processor ID to all outgoing messages
        const originalPostMessage = this.port.postMessage.bind(this.port);
        this.port.postMessage = (msg) => {
            originalPostMessage({
                ...msg,
                processorId: this.processorId
            });
        };
    }
}

// Register processors dynamically
const PROCESSOR_COUNT = 3;
for (let i = 1; i <= PROCESSOR_COUNT; i++) {
    const processorName = `byte-step-processor-${i}`;
    registerProcessor(processorName, class extends ProcessorWithId {
        constructor() {
            super();
            this.processorId = processorName;
        }
    });
}