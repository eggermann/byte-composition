const defaultFormat = {
    float: true,
    interleaved: false
};
function analyzeLoudness(data) {
    let sumSquares = 0;
    let peak = 0;

    for (let i = 0; i < data.length; i++) {
        const sample = data[i];
        sumSquares += sample * sample;
        if (Math.abs(sample) > peak) {
            peak = Math.abs(sample);
        }
    }

    const rms = Math.sqrt(sumSquares / data.length);
    return { rms, peak };
}

async function getAudioBufferFromSample(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
}

function playFromAudioBuffer(audioBuffer) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);
}

export default {
    getAudioBufferFromSample,
    playFromAudioBuffer,
    analyzeLoudness
};