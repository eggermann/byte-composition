export class WorkBuffer {
    constructor(buffer) {
        this.channelData = buffer.channelData;//[[][]]
    }

    getLength() {
        return this.channelData[0].length;
    }
}