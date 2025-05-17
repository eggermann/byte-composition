// workletMessenger.js
/**
 * Creates a message handler for an AudioWorklet node.
 *
 * @param {String} processorId - The ID of the processor (e.g., "proc1")
 * @param {Object} prefetchedSamples - An object mapping processor IDs to sample arrays.
 * @param {Function} addBufferToWorklet - A helper function to send a buffer to a worklet.
 * @returns {Function} The event handler function.
 */
export function createWorkletMessenger(processorId, prefetchedSamples, addBufferToWorklet,PROCESSOR_COUNT) {
    return async function handleWorkletMessage(event) {
      const data = event.data;
      let procId = processorId.startsWith("proc") ? processorId : `proc${processorId.split("-").pop()}`;


      console.log(`Received message from ${processorId}:`, data.type);
  

      if (data.type === 'nextTrigger') {
        let changSample = procId
        while (changSample === procId) {
            changSample = Math.random() * PROCESSOR_COUNT
        }

        procId = changSample;
        data.type = 'deliverNewSample';
    }
    

      if (data.type === "deliverNewSample") {
        console.log(`${processorId}: Received request for new sample, prefetching...`);
  
        // Ensure we have an array to store samples for this processor
        if (!prefetchedSamples[processorId]) {
          prefetchedSamples[processorId] = [];
        }
  
        // Function to send two samples to the worklet if available
        const addSamplesToWorklet = () => {
          const samples = prefetchedSamples[processorId];
          if (samples && samples.length >= 2) {
            addBufferToWorklet(samples.shift(), 0, processorId);
            addBufferToWorklet(samples.shift(), 1, processorId);
          }
        };
  
        if (prefetchedSamples[processorId] && prefetchedSamples[processorId].length >= 2) {
          addSamplesToWorklet();
        } else {
          // If not enough samples yet, poll until they are available
          const checkSamples = setInterval(() => {
            if (prefetchedSamples[processorId] && prefetchedSamples[processorId].length >= 2) {
              clearInterval(checkSamples);
              addSamplesToWorklet();
            }
          }, 400);
        }
      }
      
      // Add further message types as needed
      // else if (data.type === 'otherType') { ... }
    };
  }