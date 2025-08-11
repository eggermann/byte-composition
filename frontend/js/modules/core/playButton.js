// Play button module extracted from UIController

let button = null;

export function createPlayButton(processorManager) {
    const wrapper = document.createElement('div');
    wrapper.className = 'button-wrapper fixed-wrapper';

    button = document.createElement("button");
    button.innerHTML = "Play";
    button.className = 'start-button';

    wrapper.appendChild(button);
    document.body.appendChild(wrapper);

    return button;
}

export function onPlayButtonClick(callback) {
    if (button) {
        button.addEventListener('click', callback);
    }
}