/**
 * @file utilities.js
 * @description Utility functions for audio processing and mathematical calculations
 */

/**
 * Calculates how many times a smaller buffer fits into a longer one using log2 scaling
 * @param {number} buffLen - Length of the longer buffer
 * @param {number} smallerLength - Length of the smaller buffer
 * @param {number} [scaleFactor=0.3] - Scaling factor for log2 calculation
 * @returns {number} Number of times the smaller buffer fits
 */
export function getLogScaledFitCount(buffLen, smallerLength, scaleFactor = 0.3) {
    const ratio = buffLen / smallerLength;
    // Use log2 for scaling, adjusted by scaleFactor
    const logFactor = Math.max(1, Math.log2(ratio) * scaleFactor);
    // Calculate fit count and ensure at least 1
    return Math.max(1, Math.floor(ratio / logFactor));
}

/**
 * Linear interpolation between two values
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} amount - Interpolation amount (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(start, end, amount) {
    return start + (end - start) * amount;
}

/**
 * Maps a value from one range to another
 * @param {number} value - Value to map
 * @param {number} inMin - Input range minimum
 * @param {number} inMax - Input range maximum
 * @param {number} outMin - Output range minimum
 * @param {number} outMax - Output range maximum
 * @returns {number} Mapped value
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

/**
 * Creates an easing curve using power function
 * @param {number} x - Input value (0-1)
 * @param {number} power - Power for the curve (higher = steeper)
 * @returns {number} Eased value
 */
export function easePower(x, power) {
    return Math.pow(x, power);
}

/**
 * Smooth step function (Hermite interpolation)
 * @param {number} x - Input value (0-1)
 * @returns {number} Smoothed value
 */
export function smoothStep(x) {
    return x * x * (3 - 2 * x);
}

/**
 * Clamps a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Converts linear value to decibels
 * @param {number} value - Linear value
 * @param {number} [minDb=-100] - Minimum dB value
 * @returns {number} Value in decibels
 */
export function linearToDb(value, minDb = -100) {
    if (value <= 0) return minDb;
    return Math.max(minDb, 20 * Math.log10(value));
}

/**
 * Converts decibels to linear value
 * @param {number} db - Value in decibels
 * @returns {number} Linear value
 */
export function dbToLinear(db) {
    return Math.pow(10, db / 20);
}

// Export utilities as a single object
const utilities = {
    getLogScaledFitCount,
    lerp,
    mapRange,
    easePower,
    smoothStep,
    clamp,
    linearToDb,
    dbToLinear
};

export default utilities;