/**
 * @file sampleManager.js
 * @description Manages sample prefetching and delivery to processors
 */

import bufferManager from './bufferManager';
import processorManager from './processorManager';

export const PREFETCH_SIZE = 2;

class SampleManager {
    constructor() {
        this.bufferHelpers = null;
    }

    initialize(bufferHelpers) {
        this.bufferHelpers = bufferHelpers;
    }

    async deliverSamplesToProcessor(procId) {
        console.log(`${procId}: Received request for new sample, prefetching...`);
        const samples = processorManager.getPrefetchedSamples(procId);

        const addSamplesToWorklet = () => {
            if (samples && samples.length >= 2) {
                processorManager.addBufferToWorklet(samples.shift(), 0, procId);
                processorManager.addBufferToWorklet(samples.shift(), 1, procId);
            } else {
                console.warn(`${procId}: Not enough prefetched samples to deliver.`);
            }
        };

        if (samples && samples.length >= 2) {
            addSamplesToWorklet();
        } else {
            console.log(`${procId}: Waiting for prefetched samples...`);
            return new Promise((resolve) => {
                const checkSamples = setInterval(() => {
                    if (samples && samples.length >= 2) {
                        clearInterval(checkSamples);
                        addSamplesToWorklet();
                        resolve();
                    }
                }, 400);
            });
        }
    }

    async prefetchSamples(freeSoundClient) {
        if (!this.bufferHelpers) {
            throw new Error('SampleManager not initialized with bufferHelpers');
        }

        const processorIds = processorManager.getProcessorIds();
        
        for (const procId of processorIds) {
            const samples = processorManager.getPrefetchedSamples(procId);
            if (samples.length < PREFETCH_SIZE) {
                console.log(`Prefetching a new sample for ${procId}...`);
                try {
                    const sample = await freeSoundClient.getRandomSample();
                    const newSample = await bufferManager.loadSample(
                        null, 
                        sample.previews["preview-hq-mp3"],
                        this.bufferHelpers
                    );
                    processorManager.addPrefetchedSample(procId, newSample);
                    console.log(`${procId}: Sample prefetched. Total: ${samples.length}`);
                } catch (error) {
                    console.error(`Error prefetching sample for ${procId}:`, error);
                }
            }
        }
    }

    async loadInitialSamples(sampleUrl) {
        if (!this.bufferHelpers) {
            throw new Error('SampleManager not initialized with bufferHelpers');
        }

        const s1 = await bufferManager.loadSample(sampleUrl, null, this.bufferHelpers);
        const s2 = s1; // Use same sample for both channels initially
        
        const processorIds = processorManager.getProcessorIds();
        for (const procId of processorIds) {
            processorManager.addBufferToWorklet(s1, 0, procId);
            processorManager.addBufferToWorklet(s2, 1, procId);
            processorManager.processors[procId].port.postMessage({ 
                type: "start", 
                processorId: procId 
            });
            processorManager.processors[procId]._started = true;
        }
    }

    startPrefetchInterval(freeSoundClient, interval = 5000) {
        if (!this.bufferHelpers) {
            throw new Error('SampleManager not initialized with bufferHelpers');
        }
        return setInterval(() => this.prefetchSamples(freeSoundClient), interval);
    }
}

// Export a singleton instance
export default new SampleManager();