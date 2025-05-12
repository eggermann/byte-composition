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

const _ = {
    audioContext,

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

async function startAudio() {
    let s1, s2;
    const loadRandomSample = false;

    // Load or fetch your samples
    if (loadRandomSample) {
        const sample1 = await freeSoundClient.getRandomSample();
        const sample2 = await freeSoundClient.getRandomSample();
        s1 = await _.loadSample(null, sample1.previews["preview-hq-mp3"]);
        s2 = await _.loadSample(null, sample2.previews["preview-hq-mp3"]);
    } else {
        s1 = await _.loadSample(Ab5Sample);
        s2 = s1;
    }

    console.log("s1, s2", s1, s2);

    try {
        // Setup
        _.mixer = {};
        _.compressors = {};
        _.processors = {};
        _.prefetchedSamples = {};

        // Add the audio worklet modules
        await audioContext.audioWorklet.addModule(byteStepProcessor);

        // Create main "master" gain (or you can skip if you already have a final node)
        const masterGain = audioContext.createGain();
        masterGain.gain.value = 1.0;

        // Create a master analyzer for the spectrogram
        const masterAnalyser = audioContext.createAnalyser();
        masterAnalyser.fftSize = 1024; // or 2048 for more detail

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
            _.prefetchedSamples[procId] = [];

            // Connect each processor chain
            if (i === 2) {
                const delay = audioContext.createDelay();
                delay.delayTime.value = 0.15;
                _.processors[procId].connect(delay);
                delay.connect(_.mixer[procId].gain);
            } else {
                _.processors[procId].connect(_.mixer[procId].gain);
            }

            _.mixer[procId].gain.connect(compressor);
            compressor.connect(_.mixer[procId].analyzer);
            // Now connect each channel's analyzer to the masterGain
            _.mixer[procId].analyzer.connect(masterGain);
        }

        // Finally connect the masterGain to the masterAnalyser, and then to the destination
        masterGain.connect(masterAnalyser);
        masterAnalyser.connect(audioContext.destination);

        // OPTIONAL: Start the spectrogram (toggle with a boolean if you want).
        const spectroEnabled = true; // or false if you want to disable
        initSpectroVisualizer3D(masterAnalyser, { width: 600, height: 256, enabled: spectroEnabled });

        // Monitor and adjust levels every 40ms
        setInterval(() => {
            analyzeChannels(_.mixer, bufferHelpers);
            applyCorrections(_.mixer, _.compressors, audioContext, PROCESSOR_COUNT);
        }, 40);
    } catch (err) {
        console.error("Error during initialization:", err);
        throw err;
    }

    // Handle processor messages
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
                }
            };

            if (_.prefetchedSamples[procId] && _.prefetchedSamples[procId].length >= 2) {
                addSamplesToWorklet();
            } else {
                const checkSamples = setInterval(() => {
                    if (_.prefetchedSamples[procId] && _.prefetchedSamples[procId].length >= 2) {
                        clearInterval(checkSamples);
                        addSamplesToWorklet();
                    }
                }, 400);
            }
        }
    };

    for (let i = 1; i <= PROCESSOR_COUNT; i++) {
        const procId = `proc${i}`;
        _.processors[procId].port.onmessage = handleProcessorMessage(procId);
    }

    // Prefetch samples
    setInterval(async () => {
        for (let i = 1; i <= PROCESSOR_COUNT; i++) {
            const procId = `proc${i}`;
            if (_.prefetchedSamples[procId].length < prefetchedSamplesSize) {
                console.log(`Prefetching a new sample for ${procId}...`);
                const sample = await freeSoundClient.getRandomSample();
                const newSample = await _.loadSample(null, sample.previews["preview-hq-mp3"]);
                _.prefetchedSamples[procId].push(newSample);
            }
        }
    }, 5000);

    try {
        console.log("Resuming audio context...");
        await audioContext.resume();
        console.log("Audio context resumed");

        // Start each processor
        for (let i = 1; i <= PROCESSOR_COUNT; i++) {
            const procId = `proc${i}`;
            _.addBufferToWorklet(s1, 0, procId);
            _.addBufferToWorklet(s2, 1, procId);
            _.processors[procId].port.postMessage({ type: "start", processorId: procId });
        }
    } catch (error) {
        console.error("Error in startAudio:", error);
        throw error;
    }
}

// Create a button to start
const button = document.createElement("button");
button.innerHTML = "Start Audio Worklet";
button.className = 'start-button';
button.addEventListener("click", startAudio);
document.body.appendChild(button);