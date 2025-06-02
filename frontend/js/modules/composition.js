/**
 * @file composition.js
 * @description Audio buffer composition and arrangement module. Provides utilities for
 * manipulating and combining audio buffers with different arrangement strategies.
 *
 * @module Composition
 * @author eggman
 * @created 2025
 *
 * @dependencies
 * - WorkBuffer.js: Custom audio buffer wrapper implementation
 * - utilities.js: Math and scaling utilities
 *
 * @exports {Object} arrangement
 * Methods:
 * - equal(s1, s2): Equalizes two buffers to the same length
 * - random(s1, s2): Applies random arrangement strategy
 * - repeat(s1, s2, justifyContent): Repeats smaller buffer with spacing options
 *
 * @arrangements
 * - space-between: Distributes space between segments
 * - space-evenly: Equal space before, between, and after segments
 * - center: Centers the arrangement
 * - start: Aligns to the start
 */

import { WorkBuffer } from './audio/WorkBuffer.js';
import { getLogScaledFitCount } from './core/utilities.js';
import tm from 'taktmuster';

const taktmuster = new tm.Taktmuster();
const curve = taktmuster.setTakt(3, 3, 4, 'sin', 'mixFinalClassic')

export default {
    arrangement: {
        // The `equal` function takes two WorkBuffers and makes them equal in length.
        equal: (s1, s2) => {
            const lenS1 = s1.getLength(),
                lenS2 = s2.getLength();

            // A function to fit smaller WorkBuffer length to the longer WorkBuffer length
            const fitIn = (longer, smaller) => {
                const buffLen = longer.getLength();
                const smallerLength = smaller.getLength();

                // Create two Float32Arrays with the length of the longer buffer
                const floatArray = [new Float32Array(buffLen), new Float32Array(buffLen)];

                // Calculate how many complete times the smaller buffer can fit into the longer one
                const howManyTimesFit = Math.floor(buffLen / smallerLength);

                // Calculate the remaining space in the longer buffer after fitting
                const rest = buffLen - (howManyTimesFit * smallerLength);

                // Calculate how to distribute the rest
                const howManyTimesFitRest = rest / howManyTimesFit;
                let modRoom = smallerLength + howManyTimesFitRest;

                for (let j = 0; j < longer.channelData.length; j++) {
                    for (let i = 0; i < buffLen; i++) {
                        // Calculate the index in the smaller buffer, wrapping around if necessary
                        const index = (i - (rest / 2)) % modRoom;
                        const val = smaller.channelData[j][index] ?? 0;
                        floatArray[j][i] = val;
                    }
                }

                // Return a new WorkBuffer with the adjusted channel data
                return new WorkBuffer({ channelData: floatArray });
            }

            // Adjust the shorter buffer to match the length of the longer one
            if (lenS1 > lenS2) {
                s2 = fitIn(s1, s2);
            }

            if (lenS2 > lenS1) {
                s1 = fitIn(s2, s1);
            }

            return { s1, s2 };
        },

        random(s1, s2) {
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

            const howManyTimesFit = getLogScaledFitCount(longerLen, smallerLen);
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

                    let k2 = 1;
                    if (howManyTimesFit > 2) {
                        k2 = curve.getNext().taktValue ;

                    }


                    for (let k = 0; k < smallerLen; k+=k2){
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
                return { s1: longer, s2: new WorkBuffer({ channelData: floatArray }) };
            } else {
                return { s1: new WorkBuffer({ channelData: floatArray }), s2: longer };
            }
        }
    }
};