/**
 * @file uiController.js
 * @description Manages UI elements and playback controls
 */

import audioContext from './audioContext';
import { analysisData } from './analyzer.js';
import { PROCESSOR_COUNT } from './processorManager.js';

class UIController {
    #meterFrameId = null;
    constructor() {
        this.button = this.createPlayButton();
        this.createSoundControlPanel();
    }

    createSoundControlPanel() {
        const controlPanel = document.createElement('div');
        controlPanel.className = 'sound-control-panel';
        controlPanel.classList.add('active');

        const processorControls = document.createElement('div');
        processorControls.className = 'processor-controls';

        // Create processor channels
        for (let i = 1; i <= PROCESSOR_COUNT; i++) {
            processorControls.appendChild(this.createProcessorChannel(`proc${i}`, `Processor ${i}`));
        }

        // Add master channel
        processorControls.appendChild(this.createProcessorChannel('master', 'Master Mix', true));

        controlPanel.appendChild(processorControls);
        document.querySelector('#app').appendChild(controlPanel);
    }

    createProcessorChannel(id, label, isMaster = false) {
        const channel = document.createElement('div');
        channel.className = `processor-channel${isMaster ? ' master-channel' : ''}`;
        channel.dataset.processorId = id;

        channel.innerHTML = `
            <div class="channel-header">
                <span class="processor-label">${label}</span>
                <div class="channel-controls">
                    <button class="control-btn mute-btn">M</button>
                    ${!isMaster ? '<button class="control-btn solo-btn">S</button>' : ''}
                    <span class="gain-value">0.0 dB</span>
                </div>
            </div>
            <div class="meter-container">
                <div class="level-meter">
                    <div class="meter-bar rms-level"></div>
                    <div class="meter-bar peak-level"></div>
                    <div class="meter-bars">
                        ${Array.from({ length: 20 }, (_, i) =>
            `<div class="meter-segment" style="bottom: ${i * 5}%"></div>`
        ).join('')}
                    </div>
                </div>
                <div class="meter-scale">
                    <span>0</span>
                    <span>-6</span>
                    <span>-12</span>
                    <span>-24</span>
                </div>
            </div>
        `;

        // Add event listeners for mute/solo buttons
        const muteBtn = channel.querySelector('.mute-btn');
        const soloBtn = !isMaster ? channel.querySelector('.solo-btn') : null;

        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                muteBtn.classList.toggle('active');
                if (!isMaster) {
                    const gainNode = this.getProcessorGain(id);
                    if (gainNode) {
                        gainNode.gain.value = muteBtn.classList.contains('active') ? 0 : 0.35;
                    }
                }
            });
        }

        if (soloBtn) {
            soloBtn.addEventListener('click', () => {
                soloBtn.classList.toggle('active');
                this.updateSoloState();
            });
        }

        return channel;
    }

    getProcessorGain(procId) {
        return window.processorManager?.mixer?.[procId]?.gain || null;
    }

    updateSoloState() {
        const channels = document.querySelectorAll('.processor-channel:not(.master-channel)');
        const soloedChannels = Array.from(channels).filter(
            channel => channel.querySelector('.solo-btn.active')
        );

        channels.forEach(channel => {
            const procId = channel.dataset.processorId;
            const gainNode = this.getProcessorGain(procId);
            const muteBtn = channel.querySelector('.mute-btn');
            const isMuted = muteBtn.classList.contains('active');

            if (gainNode) {
                if (soloedChannels.length > 0) {
                    // If any channel is soloed, only play soloed channels
                    gainNode.gain.value = soloedChannels.includes(channel) && !isMuted ? 0.35 : 0;
                } else {
                    // If no channels are soloed, respect mute state
                    gainNode.gain.value = isMuted ? 0 : 0.35;
                }
            }
        });
    }

    initializeMeterUpdates() {
        const updateMeters = () => {
            // Get current data from Map
            const mixer = window.processorManager?.getMixer() || {};
            Object.entries(mixer).forEach(([procId, channel]) => {
                if (!channel.analyzer) return;
                
                // Get fresh analyzer data
                const analyzer = channel.analyzer;
                const bufferLength = analyzer.frequencyBinCount;
                const dataArray = new Float32Array(bufferLength);
                analyzer.getFloatTimeDomainData(dataArray);

                // Calculate levels
                let sumSquares = 0;
                let peak = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const sample = dataArray[i];
                    sumSquares += sample * sample;
                    peak = Math.max(peak, Math.abs(sample));
                }
                
                const rms = Math.sqrt(sumSquares / bufferLength);
                this.updateChannelMeters(procId, { rms, peak });
            });
            this.#meterFrameId = requestAnimationFrame(updateMeters);
        };
        this.#meterFrameId = requestAnimationFrame(updateMeters);
    }

    async updateChannelMeters(procId, { rms, peak }) {
        const channel = document.querySelector(`.processor-channel[data-processor-id="${procId}"]`);
        if (!channel) return;

        // Convert to dB values (with floor at -60dB)
        const rmsDb = Math.max(-60, 20 * Math.log10(rms || 0.0001));
        const peakDb = Math.max(-60, 20 * Math.log10(peak || 0.0001));

        // Update gain display
        const gainDisplay = channel.querySelector('.gain-value');
        gainDisplay.textContent = `${peakDb.toFixed(1)} dB`;

        // Update level meters
        const rmsBar = channel.querySelector('.rms-level');
        const peakBar = channel.querySelector('.peak-level');
        const segments = channel.querySelectorAll('.meter-segment');

        // Convert dB to percentage (0dB -> 100%, -60dB -> 0%)
        const dbToPercent = (db) => {
            return Math.max(0, Math.min(100, (db + 60) * (100 / 60)));
        };

        const rmsHeight = dbToPercent(rmsDb);
        const peakHeight = dbToPercent(peakDb);

        rmsBar.style.height = `${rmsHeight}%`;
        peakBar.style.height = `${peakHeight}%`;

        // Update segment colors based on level
        segments.forEach((segment, i) => {
            const segmentDb = -60 + (i * 3); // Each segment represents 3dB
            const isActive = peakDb >= segmentDb;

            let color;
            if (segmentDb >= -3) { // Red zone (near 0dB)
                color = isActive ? 'rgba(255, 51, 0, 0.8)' : 'rgba(255, 51, 0, 0.1)';
            } else if (segmentDb >= -12) { // Yellow zone
                color = isActive ? 'rgba(255, 255, 0, 0.8)' : 'rgba(255, 255, 0, 0.1)';
            } else { // Green zone
                color = isActive ? 'rgba(0, 255, 136, 0.8)' : 'rgba(0, 255, 136, 0.1)';
            }

            segment.style.backgroundColor = color;
        });

        // Set peak bar color based on dB level
        if (peakDb >= -3) {
            peakBar.style.backgroundColor = '#ff3300';
        } else if (peakDb >= -12) {
            peakBar.style.backgroundColor = '#ffff00';
        } else {
            peakBar.style.backgroundColor = '#00ff88';
        }

        // If this is the last processor, update master channel
        const lastProcId = `proc${PROCESSOR_COUNT}`;
        if (procId === lastProcId) {
            await this.updateMasterChannel();
        }
    }

    async updateMasterChannel() {
        const masterChannel = document.querySelector('.processor-channel[data-processor-id="master"]');
        if (!masterChannel) return;

        // Calculate master levels by averaging all processor levels
        let totalRms = 0;
        let totalPeak = 0;
        let count = 0;

        analysisData.forEach(({ rms, peak }) => {
            totalRms += rms;
            totalPeak = Math.max(totalPeak, peak); // Use highest peak from any channel
            count++;
        });

        // Update master meters with averaged values
        const masterRms = totalRms / count;
        this.updateChannelMeters('master', {
            rms: masterRms,
            peak: totalPeak
        });
    }

    createPlayButton() {
        const wrapper = document.createElement('div');
        wrapper.className = 'button-wrapper fixed-wrapper';

        this.button = document.createElement("button");
        this.button.innerHTML = "Play";
        this.button.className = 'start-button';

        const controlsButton = document.createElement('button');
        controlsButton.id = 'controls-button';
        controlsButton.textContent = 'Controls';
        controlsButton.setAttribute('aria-label', 'Toggle sound controls panel');
        controlsButton.setAttribute('aria-expanded', 'true');
        controlsButton.addEventListener('click', () => {
            const soundControlPanel = document.querySelector('.sound-control-panel');
            if (soundControlPanel) {
                const isExpanded = soundControlPanel.classList.toggle('active');
                controlsButton.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
            }
        });

        wrapper.appendChild(this.button);
        wrapper.appendChild(controlsButton);
        document.body.appendChild(wrapper);
      
     return  this.button ;
    }

    appendToDOM() {

    }

    updatePlayState(isPlaying) {
        if (isPlaying) {
            this.button.innerHTML = "Pause";
            document.querySelector('#app h1')?.classList.add('playing');
        } else {
            this.button.innerHTML = "Play";
            document.querySelector('#app h1')?.classList.remove('playing');
        }
    }

    setLoading(isLoading) {
        this.button.disabled = isLoading;
        this.button.innerHTML = isLoading ? "Loading..." : (audioContext.isPlaying ? "Pause" : "Play");
    }

    setError() {
        this.button.innerHTML = "Error";
        this.button.disabled = true;
    }

    resetError() {
        this.button.disabled = false;
        this.updatePlayState(audioContext.isPlaying);
    }

    onButtonClick(callback) {
        this.button.addEventListener("click", async () => {
            this.setLoading(true);
            try {
                await callback();
                // Start meter updates after successful audio initialization
                if (!this.#meterFrameId && audioContext.getState().isInitialized) {
                    console.log('Starting meter updates');
                    this.initializeMeterUpdates();
                }
            } catch (error) {
                console.error("Error during button click handling:", error);
                this.setError();
            } finally {
                if (this.button.innerHTML !== "Error") {
                    this.resetError();
                }
            }
        });
    }

    cleanup() {
        if (this.#meterFrameId) {
            cancelAnimationFrame(this.#meterFrameId);
            this.#meterFrameId = null;
        }
    }
}

// Export a singleton instance
export default new UIController();