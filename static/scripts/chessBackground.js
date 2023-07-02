const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

let target;

canvas.setAttribute("id", "background");

const spritesheet = document.querySelector("img")
const spritesheet_rows = 2;
const spritesheet_cols = 6;
let framewidth;
let frameheight;

const density = 1;

let CELL_SIZE;
let CELL_ROWS;
let CELL_COLS;
let variation;

function get_random_source_rect() {
    const x = Math.floor(Math.random() * spritesheet_cols) * framewidth;
    const y = Math.floor(Math.random() * spritesheet_rows) * frameheight;
    return [x, y, framewidth, frameheight];
}

function fill() {
    for (let row=0; row<CELL_ROWS; row+=variation/CELL_SIZE * 2) {
        for (let col=0; col<CELL_COLS; col+=variation/CELL_SIZE * 2) {
            const offset = Math.floor(Math.random() * variation - variation / 2);

            const [sx, sy, sw, sh] = get_random_source_rect();
            const [dx, dy, dw, dh] = [col * CELL_SIZE + offset, row * CELL_SIZE + offset,
                                    CELL_SIZE, CELL_SIZE];

            ctx.drawImage(spritesheet, sx, sy, sw, sh, dx, dy, dw, dh);
        }
    }
}

function set_background_target(given_target) {
    target = given_target;
    target.append(canvas);

    canvas.width = target.clientWidth;
    canvas.height = target.clientHeight;
    ctx.globalAlpha = 0.2;

    const area = canvas.width * canvas.height;
    CELL_SIZE = Math.sqrt(area) / 8;
    CELL_ROWS = Math.ceil(target.clientHeight / CELL_SIZE);
    CELL_COLS = Math.ceil(target.clientWidth / CELL_SIZE);
    variation = CELL_SIZE

    fill();
}

window.addEventListener("DOMContentLoaded", () => {
    framewidth = spritesheet.width / spritesheet_cols;
    frameheight = spritesheet.height / spritesheet_rows;
});