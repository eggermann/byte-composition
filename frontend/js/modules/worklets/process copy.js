import tm from 'taktmuster';

const taktmuster = new tm.Taktmuster();
const curve = taktmuster.setTakt(4, 4, 4, 'sin', 'mixFinalClassic')

function getProcessorColor(procId) {
    // Extract processor number from ID
    const match = procId.match(/\d+$/);
    if (!match) return 'black';

    const procNum = parseInt(match[0]);
    // Use golden ratio for nice color distribution
    const hue = (procNum * 137.5) % 360;  // golden angle approximation
    return `hsl(${hue}, 70%, 45%)`;
}


let pitch = 3;

const _ = {
    bufferLength: 0,
    hasRefreshed: false,
    falseASalseAsLong: function (limit) {
        let pos = 0;
        return function getNext() {
            return pos++ >= limit ? { limit: limit } : (() => {
                context.hasSubLine = false;
                return false;
            });
        }
    }
}

function createFadeEnvelope(totalSamples, fadeInSamples, fadeOutSamples) {
    let sample = 0;
    return function nextEnvelope() {
        if (sample >= totalSamples) {
            return 0;
        }
        let env = 1;
        if (sample < fadeInSamples) {
            env = sample / fadeInSamples;
        } else if (sample > totalSamples - fadeOutSamples) {
            env = (totalSamples - sample) / fadeOutSamples;
        }
        sample++;
        return env;
    }
}

function validateBuffers(context, workBuffer) {
    if (!workBuffer[0] || !workBuffer[1]) {
        context.logger('Work buffers not ready:', {
            buffer0: !!workBuffer[0],
            buffer1: !!workBuffer[1]
        });
        return false;
    }
    return true;
}

function handleSampleCount(context, buffer1Length, buffer2Length) {
    context.logger('   this.roundCount:', context.roundCount);
    context.logger('buffer1Length:', buffer1Length, '/', buffer2Length);
    context.roundCount++;

    const totalBytes = buffer1Length;
    const runningBytes = totalBytes - context.finishCount;
    const percentage = ((context.finishCount / totalBytes) * 100).toFixed(2);

    context.logger(`finished ${context.finishCount} runningBytes ${runningBytes} ${percentage}%`);

    if (parseFloat(percentage) >= 96 && !context.hasRefreshed) {
        context.hasRefreshed = true;
        context.port.postMessage({
            type: 'deliverNewSample',
            command: 'requestNewSample'
        });
    }

    if (parseFloat(percentage) >= 50 && !context.hasSubLine) {
        pitch = curve.getNext().taktValue + .25


        context.hasSubLine = true;
        const totalFadeSamples = buffer1Length *  curve.getNext().taktValue;
        const fadeInSamples = Math.floor(totalFadeSamples * 0.1);
        const fadeOutSamples = Math.floor(totalFadeSamples * 0.1);
        context.falseAS = createFadeEnvelope(totalFadeSamples, fadeInSamples, fadeOutSamples);

        context.port.postMessage({
            type: 'nextTrigger',
            command: 'requestNewSample'
        });
    }

    _.bufferLength = buffer1Length * 2;
    context.finishCount = 0;
}

function adjustBufferValue(byteValue1, byteValue2, step) {
    let finished = false;

    if (byteValue1 < byteValue2) {
        byteValue1 += step;
        if (byteValue1 > byteValue2) {
            byteValue1 = byteValue2;
            finished = true;
        }
    } else if (byteValue1 > byteValue2) {
        byteValue1 -= step;
        if (byteValue1 < byteValue2) {
            byteValue1 = byteValue2;
            finished = true;
        }
    } else {
        finished = true;
    }

    return { byteValue1, finished };
}

function processChannelSample(context, channel, pos1, pos2, step) {
    const sample1 = context.workBuffer[0].channelData[channel][pos1];
    const sample2 = context.workBuffer[1].channelData[channel][pos2];
    let byteValue1 = Math.round((sample1 + 1) * 127.5);
    const byteValue2 = Math.round((sample2 + 1) * 127.5);

    const { byteValue1: adjustedValue, finished } = adjustBufferValue(byteValue1, byteValue2, step);

    if (finished) {
        context.finishCount++;
    }

    const normalizedSample = (adjustedValue / 127.5) - 1;
    context.workBuffer[0].channelData[channel][pos1] = normalizedSample;
    return normalizedSample;
}

function applyInterpolation(context, channel, d, currentSample) {
    if (!context.falseAS) return currentSample;

    const fadeVal = context.falseAS();
    const index = d / pitch;
    const integerPart = Math.floor(index);
    const fractional = index - integerPart;
    const bufferLength = context.workBuffer[0].getLength();
    const idx0 = integerPart % bufferLength;
    const idx1 = (integerPart + 1) % bufferLength;
    const sampleA = context.workBuffer[0].channelData[channel][idx0];
    const sampleB = context.workBuffer[0].channelData[channel][idx1];
    const interpolatedSample = sampleA + fractional * (sampleB - sampleA);

    return (currentSample * (1 - fadeVal)) + (interpolatedSample * fadeVal);
}

export function process(inputs, outputs, parameters) {
    try {
        // Initialize logger only once per processor instance
        if (!this._loggerInitialized) {


            
            const procId = this.procId || 'unknown';
            console.log(`[Processor Initialization] procId: ${procId}`);
                       const procColor = getProcessorColor(procId);

            // Extended logger with state information
            this.logger = function (message, ...args) {
                const states = [];
                if (this.isMuted) states.push('MUTED');
                if (this.isSoloed) states.push('SOLO');

                const stateStr = states.length ? ` [${states.join('|')}]` : '';
                const prefix = `%c[Processor ${procId}${stateStr}]`;

                // Use gray color if muted
                const currentColor = this.isMuted ? '#999' : procColor;

                console.log(`${prefix} ${message}`, `color: ${currentColor}`, ...args);
            }.bind(this); // Bind to keep 'this' context

            this._loggerInitialized = true;
            this._lastLogTime = 0;
            this._logInterval = 1; // Log every second in audio time

                        // Initialize state
            this.isMuted = false;
            this.isSoloed = false;

        }

        // Throttle logging using audio context time
        const now = currentTime;

        if (!this.isPlaying) {
            return true;
        }

        if (!validateBuffers(this, this.workBuffer)) {
            return true;
        }

        const floatArray = new Float32Array(128);
        const output = outputs[0];
        const outputChannel = output[0];
        const step =2;// 2 * 3;

        const buffer1Length = this.workBuffer[0].getLength();
        const buffer2Length = this.workBuffer[1].getLength();

        for (let i = 0; i < outputChannel.length; ++i) {
            const cnt = this.pos % buffer1Length;
            const pos1 = cnt;
            const pos2 = cnt;

            if (cnt === 0) {
                if (this.newSample) {
                    this.newSample = false;
                    this.finishCount = 0;
                }
                // Check if enough time has passed since last log
                const timeSinceLastLog = now - this._lastLogTime;
                if (timeSinceLastLog > this._logInterval) {
                    this._lastLogTime = now;
                    handleSampleCount(this, buffer1Length, buffer2Length);
                }
            }

            for (let channel = 0; channel < output.length; ++channel) {
                try {
                    const normalizedSample = processChannelSample(this, channel, pos1, pos2, step);
                    floatArray[i] = normalizedSample;
                    output[channel][i] = floatArray[i];

                    const d = this.pos % (buffer1Length * pitch);
                    output[channel][i] = applyInterpolation(this, channel, d, output[channel][i]);

                } catch (err) {
                    const timeSinceLastLog = now - this._lastLogTime;
                    if (timeSinceLastLog > this._logInterval) {
                        this.logger('Error processing channel:', err);
                        this._lastLogTime = now;
                    }
                }
            }

            this.pos += 1;
        }

        return true;
    } catch (err) {
        const timeSinceLastLog = now - this._lastLogTime;
        if (timeSinceLastLog > this._logInterval) {
            this.logger('Error in process:', err);
            this._lastLogTime = now;
        }
        return true;
    }
}