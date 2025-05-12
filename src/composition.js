import {WorkBuffer} from './WorkBuffer';

export default {
    arrangement: {
        // The `equal` function takes two WorkBuffers and makes them equal in length.
        equal: (s1, s2) => {
console.log('s1', s1);
console.log('s2', s2);

            const lenS1 = s1.getLength(), // Get the length of the first buffer
                lenS2 = s2.getLength(); // Get the length of the second buffer

            // A function to fit smaller WorkBuffer length to the longer WorkBuffer length
            const fitIn = (longer, smaller) => {
                const buffLen = longer.getLength(); // Length of the longer buffer
                const smallerLength = smaller.getLength(); // Length of the smaller buffer

                // Create two Float32Arrays with the length of the longer buffer
                const floatArray = [new Float32Array(buffLen), new Float32Array(buffLen)];

                // Calculate how many complete times the smaller buffer can fit into the longer one
                const howManyTimesFit = Math.floor(buffLen / smallerLength);

                // Calculate the remaining space in the longer buffer after fitting
                const rest = buffLen - (howManyTimesFit * smallerLength);

                // Calculate how to distribute the rest
                const howManyTimesFitRest = rest / howManyTimesFit;

                let modRoom = smallerLength + howManyTimesFitRest; // New effective length of the smaller buffer

                for (let j = 0; j < longer.channelData.length; j++) {
                    console.log('floatArray', j)
                    for (let i = 0; i < buffLen; i++) {
                        // Calculate the index in the smaller buffer, wrapping around if necessary
                        const index = (i - (rest / 2)) % modRoom;
                        const val = smaller.channelData[j][index] ?? 0; // Use the value or 0 if undefined

                        floatArray[j][i] = val; // Set the value in the new buffer
                    }
                }

                // Return a new WorkBuffer with the adjusted channel data
                return new WorkBuffer({channelData: floatArray});
            }

            // Adjust the shorter buffer to match the length of the longer one
            if (lenS1 > lenS2) {
                s2 = fitIn(s1, s2);
                console.log('*-->', lenS1, s2.getLength()); // Log the new length for debugging
            }

            if (lenS2 > lenS1) {
                console.log('buffLen', s2.getLength());
                s1 = fitIn(s2, s1); // Adjust the first buffer to match the second
            }

            return {s1, s2}; // Return the adjusted second buffer

        },
        random(s1, s2){
          
            const justifyOptions = ['space-between', 'space-evenly', 'center', 'start'];
            const randomIndex = Math.floor(Math.random() * justifyOptions.length);
            const randomJustify = justifyOptions[randomIndex];
            return this.repeat(s1, s2, randomJustify);
        },
        repeat: (s1, s2, justifyContent = 'space-between') => {
            const lenS1 = s1.getLength();
            const lenS2 = s2.getLength();

            const [longer, smaller] = lenS1 > lenS2 ? [s1, s2] : [s2, s1];
            const longerLen = longer.getLength();
            const smallerLen = smaller.getLength();
            const howManyTimesFit = Math.floor(longerLen / smallerLen);
            const rest = longerLen - (howManyTimesFit * smallerLen);

            let spaceBetween = 0;
            let initialOffset = 0;

            switch (justifyContent) {
                case 'space-between':
                    spaceBetween = howManyTimesFit > 1 ? rest / (howManyTimesFit - 1) : 0;
                    break;
                case 'space-evenly':
                    spaceBetween = rest / (howManyTimesFit + 1);
                    initialOffset = spaceBetween;
                    break;
                case 'center':
                    initialOffset = rest / 2;
                    break;
                case 'start':
                    initialOffset = 0;
                    break;
            }

            const floatArray = [new Float32Array(longerLen), new Float32Array(longerLen)];

            for (let j = 0; j < longer.channelData.length; j++) {
                let offset = initialOffset;
                for (let i = 0; i < howManyTimesFit; i++) {
                    for (let k = 0; k < smallerLen; k++) {
                        const index = i * smallerLen + k;
                        if (index + offset < longerLen) {
                            const val = smaller.channelData[j][k] ?? 0;
                            floatArray[j][index + offset] = val;
                        }
                    }
                    offset += spaceBetween;
                }
            }

            if (lenS1 > lenS2) {
                return {s1: longer, s2: new WorkBuffer({channelData: floatArray})};
            } else {
                return {s1: new WorkBuffer({channelData: floatArray}), s2: longer};
            }
        }
    }
};