/**
 * @file uiController.js
 * @description Manages UI elements and playback controls
 */

import audioContext from './audioContext';

class UIController {
    constructor() {
        this.button = this.createPlayButton();
        this.appendToDOM();
    }

    createPlayButton() {
        const button = document.createElement("button");
        button.innerHTML = "Play";
        button.className = 'start-button';
        return button;
    }

    appendToDOM() {
        document.body.appendChild(this.button);
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
}

// Export a singleton instance
export default new UIController();