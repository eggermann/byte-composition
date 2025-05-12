// index.js
import { AudioWorkletNode } from "standardized-audio-context";
import { getContext } from "tone";
import byteStepProcessor from './byteStepProcessor/byteStepProcessor.worklet.js';
import frequencyArrayProcessor from './frequencyArrayProcessor.worklet.js';
import Ab5Sample from "./samples/Ab5.mp3";
import freeSoundClient from "./freesound-client.js";
import bufferHelpers from "./prepareAudioBuffer.js";
import { analysisData, analyzeChannels, applyCorrections } from "./analyzer.js";

// Import our new spectrogram visualizer
//import { initSpectroVisualizer3D } from "./spectroVisualizer.js";
import { initSpectroVisualizer3D } from "./spectroVisualizer-exp.js";
import './styles.css';

const prefetchedSamplesSize = 2;
const PROCESSOR_COUNT = 3;
const audioContext = new getContext().rawContext;
let isInitialized = false;
let isPlaying = false;

const _ = {
    audioContext,
    processors: {}, // Initialize processors object
    mixer: {},      // Initialize mixer object
    compressors: {}, // Initialize compressors object
    prefetchedSamples: {}, // Initialize prefetchedSamples object

    async decodeAndResampleAudio(arrayBuffer, targetSampleRate = 44100) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: targetSampleRate,
        });
        try {
            let audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            if (audioBuffer.sampleRate !== targetSampleRate) {
                console.log(`Resampling from ${audioBuffer.sampleRate} to ${targetSampleRate}`);
            }
            return audioBuffer;
        } catch (error) {
            console.error("Error decoding audio data:", error);
        }
    },

    async loadSample(url = null, previewUrl = null) {
        let arrayBuffer;
        if (previewUrl) {
            return await bufferHelpers.getAudioBufferFromSample(previewUrl);
        } else if (url) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                arrayBuffer = await response.arrayBuffer();
            } catch (error) {
                console.error("Error loading sample:", error);
                throw error;
            }
        } else {
            throw new Error("No URL provided for sample");
        }
        return await _.decodeAndResampleAudio(arrayBuffer);
        return await _.decodeAndResampleAudio(arrayBuffer);
    },

    addBufferToWorklet(buffer, index = 0, processorId = "proc1") {
        const procId = processorId.startsWith("proc") ? processorId : `proc${processorId.split("-").pop()}`;
        if (!_.processors[procId]) {
            console.error(`Processor ${procId} not found`);
            return;
        }
        console.log(`Processing buffer for ${procId}:`, {
            length: buffer.length,
            sampleRate: buffer.sampleRate,
            channels: buffer.numberOfChannels,
            index: index,
        });

        const channel0 = Array.from(buffer.getChannelData(0));
        const channel1 = buffer.numberOfChannels > 1 ? Array.from(buffer.getChannelData(1)) : channel0;

        const simpleBuffer = {
            channels: [channel0, channel1],
            length: buffer.length,
            sampleRate: buffer.sampleRate,
        };

        _.processors[procId].port.postMessage({
            type: "sendSample",
            buffer: simpleBuffer,
            index: index,
            processorId: procId,
        });
    },
};

// --- Initialization Function ---
async function initializeAudio() {
    if (isInitialized) return; // Prevent re-initialization

    console.log("Initializing audio system...");
    try {
        // Add the audio worklet modules
        await audioContext.audioWorklet.addModule(byteStepProcessor);

        // Create main "master" gain
        const masterGain = audioContext.createGain();
        masterGain.gain.value = 1.0;

        // Create a master analyzer for the spectrogram
        const masterAnalyser = audioContext.createAnalyser();
        masterAnalyser.fftSize = 1024;

        // Setup processors, mixers, compressors
        for (let i = 1; i <= PROCESSOR_COUNT; i++) {
            const procId = `proc${i}`;

            _.mixer[procId] = {
                gain: audioContext.createGain(),
                analyzer: audioContext.createAnalyser(),
            };
            _.mixer[procId].analyzer.fftSize = 2048;
            _.mixer[procId].gain.gain.value = 0.35;

            const compressor = audioContext.createDynamicsCompressor();
            compressor.threshold.value = -50;
            compressor.ratio.value = 20;
            _.compressors[procId] = compressor;

            _.processors[procId] = new AudioWorkletNode(audioContext, `byte-step-processor-${i}`);
            _.prefetchedSamples[procId] = []; // Initialize prefetched samples array

            // Connect processor chain
            if (i === 2) { // Example: Add delay to proc2
                const delay = audioContext.createDelay();
                delay.delayTime.value = 0.15;
                _.processors[procId].connect(delay);
                delay.connect(_.mixer[procId].gain);
            } else {
                _.processors[procId].connect(_.mixer[procId].gain);
            }

            _.mixer[procId].gain.connect(compressor);
            compressor.connect(_.mixer[procId].analyzer);
            _.mixer[procId].analyzer.connect(masterGain); // Connect channel analyzer to master gain
        }

        // Connect master gain to master analyzer and destination
        masterGain.connect(masterAnalyser);
        masterAnalyser.connect(audioContext.destination);

        // Initialize the visualizer
        const spectroEnabled = true;
        initSpectroVisualizer3D(masterAnalyser, { width: 600, height: 256, enabled: spectroEnabled });

        // Setup message handling for processors
        const handleProcessorMessage = (processorId) => async (event) => {
             const data = event.data;
             let procId = processorId.startsWith("proc") ? processorId : `proc${processorId.split("-").pop()}`;

             console.log(`Received message from ${procId}:`, data.type);

             if (data.type === "deliverNewSample") {
                 console.log(`${procId}: Received request for new sample, prefetching...`);

                 if (!_.prefetchedSamples[procId]) _.prefetchedSamples[procId] = [];

                 const addSamplesToWorklet = () => {
                     const samples = _.prefetchedSamples[procId];
                     if (samples && samples.length >= 2) {
                         _.addBufferToWorklet(samples.shift(), 0, procId);
                         _.addBufferToWorklet(samples.shift(), 1, procId);
                     } else {
                         console.warn(`${procId}: Not enough prefetched samples to deliver.`);
                     }
                 };

                 // Check if enough samples are ready, otherwise wait
                 if (_.prefetchedSamples[procId] && _.prefetchedSamples[procId].length >= 2) {
                     addSamplesToWorklet();
                 } else {
                     console.log(`${procId}: Waiting for prefetched samples...`);
                     const checkSamples = setInterval(() => {
                         if (_.prefetchedSamples[procId] && _.prefetchedSamples[procId].length >= 2) {
                             clearInterval(checkSamples);
                             addSamplesToWorklet();
                         }
                     }, 400); // Check every 400ms
                 }
             }
        };

        for (let i = 1; i <= PROCESSOR_COUNT; i++) {
            const procId = `proc${i}`;
            _.processors[procId].port.onmessage = handleProcessorMessage(procId);
        }

        // Start prefetching samples periodically
        setInterval(async () => {
            for (let i = 1; i <= PROCESSOR_COUNT; i++) {
                const procId = `proc${i}`;
                if (_.prefetchedSamples[procId].length < prefetchedSamplesSize) {
                    console.log(`Prefetching a new sample for ${procId}...`);
                    try {
                        const sample = await freeSoundClient.getRandomSample();
                        const newSample = await _.loadSample(null, sample.previews["preview-hq-mp3"]);
                        _.prefetchedSamples[procId].push(newSample);
                        console.log(`${procId}: Sample prefetched. Total: ${_.prefetchedSamples[procId].length}`);
                    } catch (error) {
                        console.error(`Error prefetching sample for ${procId}:`, error);
                    }
                }
            }
        }, 5000); // Prefetch every 5 seconds

        // Start monitoring levels
        setInterval(() => {
            analyzeChannels(_.mixer, bufferHelpers);
            applyCorrections(_.mixer, _.compressors, audioContext, PROCESSOR_COUNT);
        }, 40);

        isInitialized = true;
        console.log("Audio system initialized successfully.");

    } catch (err) {
        console.error("Error during initialization:", err);
        isInitialized = false; // Reset flag on error
        throw err;
    }
}

// --- Playback Toggle Function ---
async function togglePlayback() {
    if (!isInitialized) {
        console.error("Audio system not initialized yet.");
        return;
    }

    const button = document.querySelector('.start-button'); // Get the button reference

    if (audioContext.state === 'suspended') {
        try {
            console.log("Resuming audio context...");
            await audioContext.resume();
            console.log("Audio context resumed.");
            isPlaying = true;
            if (button) button.innerHTML = "Pause";

            // Send initial samples and start message ONLY if it's the first play
            if (!_.processors['proc1']._started) { // Check a flag or state if processor has started
                 console.log("Sending initial samples and start command...");
                 // Load initial samples (assuming s1, s2 are needed globally or passed differently)
                 // This part needs adjustment based on how s1, s2 are managed now
                 let s1 = await _.loadSample(Ab5Sample); // Example: Load default sample
                 let s2 = s1;

                 for (let i = 1; i <= PROCESSOR_COUNT; i++) {
                     const procId = `proc${i}`;
                     _.addBufferToWorklet(s1, 0, procId);
                     _.addBufferToWorklet(s2, 1, procId);
                     _.processors[procId].port.postMessage({ type: "start", processorId: procId });
                     _.processors[procId]._started = true; // Mark processor as started
                 }
            }

        } catch (error) {
            console.error("Error resuming audio context:", error);
            isPlaying = false; // Revert state on error
             if (button) button.innerHTML = "Play";
        }
    } else if (audioContext.state === 'running') {
        try {
            console.log("Suspending audio context...");
            await audioContext.suspend();
            console.log("Audio context suspended.");
            isPlaying = false;
            if (button) button.innerHTML = "Play";
        } catch (error) {
            console.error("Error suspending audio context:", error);
            // isPlaying remains true if suspend fails? Or set to false? Decide based on desired behavior.
        }
    } else {
        console.log(`Audio context state is: ${audioContext.state}`);
    }
}


// --- Button Setup ---
const button = document.createElement("button");
button.innerHTML = "Play"; // Initial text
button.className = 'start-button';

async function handleButtonClick() {
    button.disabled = true; // Disable button during async operations
    button.innerHTML = "Loading...";
    try {
        if (!isInitialized) {
            await initializeAudio();
        }
        // Ensure initialization is complete before toggling
        if (isInitialized) {
           await togglePlayback(); // Now toggle playback state
        } else {
           console.error("Initialization failed. Cannot toggle playback.");
           button.innerHTML = "Error"; // Indicate error state
           return; // Exit if initialization failed
        }
    } catch (error) {
        console.error("Error during button click handling:", error);
        button.innerHTML = "Error"; // Show error on button
    } finally {
       // Re-enable button only if not in error state? Or always?
       if (button.innerHTML !== "Error") {
           button.disabled = false;
           // Update text based on final state after toggle attempt
           button.innerHTML = isPlaying ? "Pause" : "Play";
       }
    }
}

button.addEventListener("click", handleButtonClick);
document.body.appendChild(button);