const pitch = 3;

const _ = {
    bufferLength: 0,
    hasRefreshed: false,
    falseASalseAsLong: function (limit) {
        //count consuming, when over limit -> true
        let pos = 0;
        return function getNext() {
            return pos++ >= limit ? { limit: limit } : false;
        }
    }
}

// Define a fade envelope generator:
function createFadeEnvelope(totalSamples, fadeInSamples, fadeOutSamples) {
    let sample = 0;
    return function nextEnvelope() {
        if (sample >= totalSamples) {
            return 0; // finished
        }
        let env = 1;
        if (sample < fadeInSamples) {
            // Fade in: ramp from 0 to 1
            env = sample / fadeInSamples;
        } else if (sample > totalSamples - fadeOutSamples) {
            // Fade out: ramp from 1 to 0
            env = (totalSamples - sample) / fadeOutSamples;
        }
        sample++;
        return env;
    }
}

let falseAS;

export function process(inputs, outputs, parameters) {
    try {
        if (!this.isPlaying) {
            return true; // Keep the processor alive but inactive
        }

        const floatArray = new Float32Array(128);
        const output = outputs[0];
        const outputChannel = output[0];
        let step = 2;

        if (!this.workBuffer[0] || !this.workBuffer[1]) {
            console.log('Work buffers not ready:', {
                buffer0: !!this.workBuffer[0],
                buffer1: !!this.workBuffer[1]
            });
            return true;
        }

        /* console.log('Processing with buffers:', {
             buffer0Length: this.workBuffer[0].getLength(),
             buffer1Length: this.workBuffer[1].getLength(),
             channelData0: !!this.workBuffer[0].channelData,
             channelData1: !!this.workBuffer[1].channelData
         });*/

        let buffer1Length = this.workBuffer[0].getLength();
        const buffer2Length = this.workBuffer[1].getLength();
        let lengthDiff = buffer1Length / buffer2Length;

        for (let i = 0; i < outputChannel.length; ++i) {
            const cnt = this.pos % buffer1Length;
            const pos1 = cnt;

            let pos2 = cnt;

            if (cnt === 0) {

                if (this.newSample) {
                    this.newSample = false;
                    this.finishCount = 0;
                    buffer1Length = this.workBuffer[0].getLength();
                }
                console.log('   this.roundCount:', this.roundCount);
                console.log('buffer1Length:', buffer1Length, '/', buffer2Length, '/', lengthDiff);
                this.roundCount++;


                const totalBytes = this.workBuffer[0].getLength() * 2;
                const runningBytes = totalBytes - this.finishCount;

                console.log('finished', this.finishCount, 'runningBytes', runningBytes);

                const percentage = ((this.finishCount / totalBytes) * 100).toFixed(2);
                console.log(`finished ${this.finishCount} runningBytes ${runningBytes} ${percentage}%`);

                if (parseFloat(percentage) >= 96 && !this.hasRefreshed) {

                    this.hasRefreshed = true;

                    this.port.postMessage({
                        type: 'deliverNewSample',
                        command: 'requestNewSample'
                    });
                }

                if (parseFloat(percentage) >= 50 && !this.hasSubLine) {
                    this.hasSubLine = true;


                    // Instead of _.falseASalseAsLong, create a fade envelope:
                    const totalFadeSamples = buffer1Length * 3;
                    const fadeInSamples = Math.floor(totalFadeSamples * 0.1);  // first 10% fade-in
                    const fadeOutSamples = Math.floor(totalFadeSamples * 0.1); // last 10% fade-out
                    falseAS = createFadeEnvelope(totalFadeSamples, fadeInSamples, fadeOutSamples);

                    this.port.postMessage({
                        type: 'nextTrigger',
                        command: 'requestNewSample'
                    });
                }



                _.bufferLength = buffer1Length * 2;//channels
                this.finishCount = 0;
            }

            for (let channel = 0; channel < output.length; ++channel) {
                try {
                    const sample1 = this.workBuffer[0].channelData[channel][pos1];
                    const sample2 = this.workBuffer[1].channelData[channel][pos2];
                    let byteValue1 = Math.round((sample1 + 1) * 127.5);
                    const byteValue2 = Math.round((sample2 + 1) * 127.5);

                    if (byteValue1 < byteValue2) {
                        byteValue1 += step;
                        if (byteValue1 > byteValue2) {
                            byteValue1 = byteValue2;
                            this.finishCount++
                        }
                    } else if (byteValue1 > byteValue2) {
                        byteValue1 -= step;
                        if (byteValue1 < byteValue2) {
                            byteValue1 = byteValue2;
                            this.finishCount++
                        }
                    } else {
                        this.finishCount++
                    }

                    const normalizedSample = (byteValue1 / 127.5) - 1;
                    this.workBuffer[0].channelData[channel][pos1] = normalizedSample;
                    floatArray[i] = normalizedSample;
                    output[channel][i] = floatArray[i];


                    const d = this.pos % (buffer1Length * pitch);
                    if (falseAS) {
                        const fadeVal = falseAS();
                        // Calculate the position with linear interpolation
                        const index = d / pitch;
                        const integerPart = Math.floor(index);
                        const fractional = index - integerPart;
                        const bufferLength = this.workBuffer[0].getLength();
                        const idx0 = integerPart % bufferLength;
                        const idx1 = (integerPart + 1) % bufferLength;
                        const sampleA = this.workBuffer[0].channelData[channel][idx0];
                        const sampleB = this.workBuffer[0].channelData[channel][idx1];
                        const interpolatedSample = sampleA + fractional * (sampleB - sampleA);
                        
                        // Crossfade between original and interpolated sample
                        output[channel][i] = (output[channel][i] * (1 - fadeVal)) + (interpolatedSample * fadeVal);
                    }


                } catch (err) {
                    console.error('Error processing channel:', err);
                }
            }

            this.pos += 1;
        }

        return true;
    } catch (err) {
        console.error('Error in process:', err);
        return true; // Keep processor alive even if there's an error
    }
}