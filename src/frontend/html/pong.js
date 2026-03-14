/// <reference lib="dom" />

import { canvasWidth, canvasHeight, GameState, gameLoop } from '../src/game/pongEngine.js'

const keyState = {
    'KeyJ': false, // p2 down
    'KeyK': false, // p2 up
    'KeyW': false, // p1 up
    'KeyS': false, // p1 down
};

window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyJ'
        || event.code === 'KeyK'
        || event.code === 'KeyW'
        || event.code === 'KeyS'
       ) {
        keyState[event.code] = true;
    }
});

window.addEventListener('keyup', (event) => {
    if (event.code === 'KeyJ'
        || event.code === 'KeyK'
        || event.code === 'KeyW'
        || event.code === 'KeyS'
       ) {
        keyState[event.code] = false;
    }
});

function getInput() {
    let p1VelY = keyState['KeyS'] ? 1 : 0;
    p1VelY -= keyState['KeyW'] ? 1 : 0;
    let p2VelY = keyState['KeyJ'] ? 1 : 0;
    p2VelY -= keyState['KeyK'] ? 1 : 0;
    return {
        player1: {velY: p1VelY, velX: 0},
        player2: {velY: p2VelY, velX: 0},
    }
}

// elements with id set on html automatically have
// a js variable referencing that id with that element
// but this do not work if element id is not a proper js identifier
// like using kebab cased ids for example "pong-canvas"
const canvasContext = pongCanvas.getContext("2d");
const gameState = new GameState();

const targetFrameRate = 30; //frame per second
const timeFrameMillis = 1000 / targetFrameRate; //millis per frame

setInterval(gameLoop, timeFrameMillis, canvasContext, gameState, () => {}, getInput);
