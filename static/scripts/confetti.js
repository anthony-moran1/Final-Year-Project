const canvas = document.createElement("canvas");
canvas.setAttribute("id", "confettiCanvas")
const ctx = canvas.getContext("2d");

const colours = ["#ff3388", "#55ff22", "#4422ff", "#ffff44"]
const collection = [];
const INITIAL_CONFETTI_COUNT = Math.floor(Math.sqrt(window.innerWidth));

const gravity = -0.04;
const terminal_velocity = 2;

function sign(x) {
    if (x == 0) {
        return 0
    }

    return x < 0 ? -1 : 1;
}

function confetti(x, y) {
    this.x = x;
    this.y = y;
    this.w = Math.floor(Math.random() * 5) + 7;
    this.h = Math.floor(Math.random() * 5) + 7;
    this.xVel = Math.random() * (Math.sqrt(window.innerWidth) / 20);
    this.yVel = -(Math.random() * 3 + 2);
    this.colour = colours[Math.floor(Math.random() * colours.length)];
    this.alpha = 1;
    this.lifetime = 20 * Math.sqrt(window.innerHeight);

    if (Math.random() < 0.5) {
        this.xVel *= -1;
    }

    this.update = function() {
        this.xVel -= sign(this.xVel) * (Math.sqrt(Math.abs(this.xVel)) / 200);
        if (this.yVel < terminal_velocity) {
            this.yVel -= gravity;
        }
        this.x += this.xVel;
        this.y += this.yVel;
        this.lifetime -= 1

        if (this.lifetime > 0) {
            this.lifetime -= 1;
        } else {
            this.alpha -= 0.05;
            if (this.alpha < 0) {
                this.alpha = 0;
            }
        }
    }

    this.draw = function() {
        ctx.fillStyle = this.colour;
        ctx.globalAlpha = this.alpha;
        ctx.fillRect(
            this.x - this.w / 2,
            this.y - this.h / 2,
            this.w, this.h);
    }

    this.get_offscreen = function() {
        return this.y > window.innerHeight;
    }
}

export function launch(x, y) {
    if (!document.body.contains(canvas)) {
        document.body.append(canvas);
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    if (x == undefined) {
        x = canvas.width / 2;
    }

    if (y == undefined) {
        y = canvas.height / 4
    }

    for (let i=0; i<INITIAL_CONFETTI_COUNT; i++) {
        collection.push(new confetti(x, y));
    }

    loop();
}

export function multi_launch() {
    launch(window.innerWidth * .5, window.innerHeight * .25)
    launch(window.innerWidth * .25, window.innerHeight * .5)
    launch(window.innerWidth * .75, window.innerHeight * .5)
}

function update() {
    collection.forEach(confetti => confetti.update())
}

function draw() {
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    collection.forEach(confetti => confetti.draw())
}

function remove_offscreen_confetti() {
    let confetti;
    for (let i=collection.length-1; i >= 0; i--) {
        confetti = collection[i];
        if (confetti.get_offscreen() || confetti.alpha == 0) {
            collection.splice(i, 1);
        }
    }
}

function check_confetti_exists() {
    return collection.length != 0;
}

function loop() {
    remove_offscreen_confetti();
    update();
    draw();
    if (check_confetti_exists()) {
        requestAnimationFrame(loop)
    } else {
        canvas.remove()
    }
}
