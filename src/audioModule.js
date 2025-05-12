// audioModule.js
import bufferHelpers from './prepareAudioBuffer.js';

// Create and export the audio module object.
const audioModule = {
  audioContext: null,

  async decodeAndResampleAudio(arrayBuffer, targetSampleRate = 44100) {
    // Create a temporary AudioContext for decoding/resampling.
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: targetSampleRate,
    });

    try {
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      if (audioBuffer.sampleRate !== targetSampleRate) {
        console.log(`Resampling from ${audioBuffer.sampleRate} to ${targetSampleRate}`);
      }
      return audioBuffer;
    } catch (error) {
      console.error("Error decoding audio data:", error);
    }
  },

  async loadSample(url = "./Ab4.mp3", previewUrl = null) {
    let arrayBuffer;
    if (previewUrl) {
      return await bufferHelpers.getAudioBufferFromSample(previewUrl);
    } else {
      const response = await fetch(url);
      arrayBuffer = await response.arrayBuffer();
    }
    return await audioModule.decodeAndResampleAudio(arrayBuffer);
  },

  addBufferToWorklet(buffer, index = 0, processorId = "proc1") {
    // Ensure the processor ID is in the correct format.
    const procId = processorId.startsWith("proc")
      ? processorId
      : `proc${processorId.split("-").pop()}`;

    // Check if the processor exists. Make sure you set audioModule.processors somewhere in your code.
    if (!audioModule.processors || !audioModule.processors[procId]) {
      console.error(`Processor ${procId} not found`);
      return;
    }

    console.log(`Processing buffer for ${procId}:`, {
      length: buffer.length,
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      index: index,
    });

    // Convert AudioBuffer channel data into plain arrays.
    const channel0 = Array.from(buffer.getChannelData(0));
    const channel1 =
      buffer.numberOfChannels > 1 ? Array.from(buffer.getChannelData(1)) : channel0;

    const simpleBuffer = {
      channels: [channel0, channel1],
      length: buffer.length,
      sampleRate: buffer.sampleRate,
    };

    // Send the buffer to the worklet via the processor's port.
    audioModule.processors[procId].port.postMessage({
      type: "sendSample",
      buffer: simpleBuffer,
      index: index,
      processorId: procId,
    });
  },

  // This object will hold references to AudioWorklet nodes.
  processors: {},
};

export default audioModule;