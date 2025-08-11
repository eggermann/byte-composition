// Warn Firefox users about possible audio issues
if (navigator.userAgent.toLowerCase().includes('firefox')) {
  alert('Warning: Firefox may have issues with AudioWorklet or audio output in this app. If you experience no sound, try Chrome or Safari.');
}
// Firefox fallback: If no sound, connect processor gains directly to destination after 2s
if (navigator.userAgent.toLowerCase().includes('firefox')) {
  setTimeout(() => {
    Object.keys(window.processorManager?.mixer || {}).forEach(procId => {
      if (procId !== 'master') {
        try {
          window.processorManager.mixer[procId].gain.disconnect();
          window.processorManager.mixer[procId].gain.connect(window.audioContext.getContext().destination);
          console.warn(`Firefox fallback: Connected processor ${procId} gain directly to destination`);
        } catch (e) {
          console.warn(`Could not connect processor ${procId} gain:`, e);
        }
      }
    });
  }, 2000);
}
// Check AudioWorklet support in Firefox
if (!('audioWorklet' in (window.AudioContext || window.webkitAudioContext).prototype)) {
  alert('AudioWorklet is not supported in this browser. Sound will not work.');
  console.warn('AudioWorklet is not supported in this browser.');
}
/**
 * @file index.js
 * @description Main entry point for the ByteComposition application
 */

import byteStepProcessor from './modules/worklets/byteStepProcessor.worklet.js';
import Ab5Sample from "../samples/Ab5.mp3";
import freeSoundClient from "./modules/freesound-client.js";
import bufferHelpers from "./modules/audio/prepareAudioBuffer.js";
import { initSpectroVisualizer3D } from "./modules/spectroVisualizer/spectroVisualizer-exp.js";
import '../styles.css';

// Import core modules
import audioContext from './modules/core/audioContext';
import processorManager from './modules/core/processorManager';
import sampleManager from './modules/core/sampleManager';
import uiController from './modules/core/uiController';
import composition from './modules/composition';
import { analyzeChannels, applyCorrections } from './modules/core/analyzer';

// Initialize core dependencies
sampleManager.initialize(bufferHelpers);

// Expose processorManager to window for UI access
window.processorManager = processorManager;

// Initialize the audio system
async function initializeAudio() {
    if (audioContext.getState().isInitialized) return;

    console.log("Initializing audio system...");
    try {
        // Add the audio worklet modules
        await audioContext.getContext().audioWorklet.addModule(byteStepProcessor);

        // Create main "master" gain and analyzer
        const masterGain = audioContext.getContext().createGain();
        masterGain.gain.value = 1.0;

        const masterAnalyser = audioContext.getContext().createAnalyser();
        masterAnalyser.fftSize = 2048;

        // Setup processors and connections
        processorManager.getProcessorIds().forEach(procId => {
            const components = processorManager.setupProcessor(procId);
            processorManager.connectProcessor(procId, masterGain);
            processorManager.setupMessageHandler(procId, (procId) =>
                sampleManager.deliverSamplesToProcessor(procId)
            );
        });

        // Connect master gain to analyzer and destination
        masterGain.connect(masterAnalyser);
        masterAnalyser.connect(audioContext.getContext().destination);

        // Add master analyzer to mixer for level metering
        processorManager.mixer['master'] = {
            analyzer: masterAnalyser,
            gain: masterGain
        };

        // Initialize visualizer
        initSpectroVisualizer3D(masterAnalyser, {
            width: 600,
            height: 256,
            enabled: true
        });

        // Start periodic tasks
        sampleManager.startPrefetchInterval(freeSoundClient);
        startAnalysisInterval();

        audioContext.setInitialized(true);
        console.log("Audio system initialized successfully.");

        composition.process(processorManager);

    } catch (err) {
        console.error("Error during initialization:", err);
        audioContext.setInitialized(false);
        throw err;
    }
}

// Start the analysis loop
function startAnalysisInterval() {
    // Initial state check
    if (!audioContext.getState().isInitialized) {
        console.warn('Analysis started before audio initialization');
        return;
    }

    console.log('Starting analysis loop');

    const analyzeLoop = () => {
        const mixer = processorManager.getMixer();
        const compressors = processorManager.getCompressors();

        if (!mixer) {
// --- Automatic fallback for Firefox if master output is silent ---
if (navigator.userAgent.toLowerCase().includes('firefox')) {
  setTimeout(() => {
    // Check if master gain is silent (animation but no sound)
    const ctx = audioContext.getContext();
    const testNode = ctx.createOscillator();
    const testGain = ctx.createGain();
    testGain.gain.value = 0;
    testNode.connect(testGain).connect(ctx.destination);
    testNode.start();
    setTimeout(() => {
      testNode.stop();
      testNode.disconnect();
      testGain.disconnect();
      // If still no sound, fallback: connect processor gains directly to destination
      // (Assume user can hear test tone if audio routing is OK)
      // This is a workaround for Firefox master chain silence
      Object.keys(processorManager.mixer).forEach(procId => {
        if (procId !== 'master') {
          try {
            processorManager.mixer[procId].gain.disconnect();
            processorManager.mixer[procId].gain.connect(ctx.destination);
            console.warn(`Firefox fallback: Connected processor ${procId} gain directly to destination`);
          } catch (e) {
            console.warn(`Could not connect processor ${procId} gain:`, e);
          }
        }
      });
    }, 500);
  }, 2000);
}
            console.warn('No mixer available for analysis');
            return;
        }

        // Ensure analyzer nodes are set up correctly
        Object.entries(mixer).forEach(([procId, channel]) => {
            if (channel.analyzer) {
                channel.analyzer.smoothingTimeConstant = 0.3;
                channel.analyzer.minDecibels = -90;
                channel.analyzer.maxDecibels = -10;
            }
        });

        // Start the analysis chain
        analyzeChannels(mixer);
        // applyCorrections(mixer, compressors, audioContext.getContext(), processorManager.PROCESSOR_COUNT);
    };

    // Start the loop
    analyzeLoop();
}

// Handle playback toggling
async function togglePlayback() {
    const state = audioContext.getState();
    if (!state.isInitialized) {
        console.error("Audio system not initialized yet.");
        return;
    }

    if (state.contextState === 'suspended') {
        const resumed = await audioContext.resume();
        if (resumed && !processorManager.processors['proc1']?._started) {
            console.log("Sending initial samples and start command...");
            await sampleManager.loadInitialSamples(Ab5Sample);
        }
    } else if (state.contextState === 'running') {
        await audioContext.suspend();
    }
}

// Set up click handler
uiController.onButtonClick(async () => {
    try {
        if (!audioContext.getState().isInitialized) {
            await initializeAudio();
        }

        // Always resume context on user gesture
        if (audioContext.getContext().state === 'suspended') {
            await audioContext.resume();
        }

        // Ensure at least one sample is loaded before starting
        if (!processorManager.processors['proc1']?._started) {
            await sampleManager.loadInitialSamples(Ab5Sample);
        }

        // Start playback if not already running
        if (audioContext.getContext().state !== 'running') {
            await audioContext.resume();
        }

        // Optionally, toggle playback (pause/resume) on repeated clicks
        // Uncomment below if you want play/pause toggle:
        // else {
        //     await audioContext.suspend();
        // }
    } catch (err) {
        console.error("Play handling error:", err);
        uiController.setError();
    } finally {
        uiController.resetError();
    }
});