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
        console.log(`${procId}: Received request for new sample`);
        const samples = processorManager.getPrefetchedSamples(procId);

        // Immediate delivery if samples are available
        if (samples && samples.length >= 2) {
            const sample1 = samples.shift();
            const sample2 = samples.shift();
            
            // Schedule next prefetch immediately
            this.prefetchSamples(this._freeSoundClient).catch(console.error);
            
            // Queue buffer additions to avoid blocking
            queueMicrotask(() => {
                processorManager.addBufferToWorklet(sample1, 0, procId);
                processorManager.addBufferToWorklet(sample2, 1, procId);
            });
            
            return;
        }

        // If no samples available, prefetch immediately
        console.log(`${procId}: Emergency prefetch needed`);
        try {
            await this.prefetchSamples(this._freeSoundClient);
            return this.deliverSamplesToProcessor(procId);
        } catch (err) {
            console.error(`${procId}: Failed to prefetch samples:`, err);
            throw err;
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

    startPrefetchInterval(freeSoundClient, interval = 2000) {
        if (!this.bufferHelpers) {
            throw new Error('SampleManager not initialized with bufferHelpers');
        }
        this._freeSoundClient = freeSoundClient;
        
        // Initial prefetch
        this.prefetchSamples(freeSoundClient).catch(console.error);
        
        // Shorter interval for more responsive prefetching
        return setInterval(() => {
            this.prefetchSamples(freeSoundClient).catch(console.error);
        }, interval);
    }
}

// Export a singleton instance
export default new SampleManager();