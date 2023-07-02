function show_prompt(event, prompt) {
    prompt.style.display = "block";
    center_on_mouse(prompt, [event.clientX, event.clientY]);
}

function hide_prompt(prompt) {
    prompt.style.display = "none";
}

const HIDE_TIME = 5000;

export function make_hoverable(element, prompt) {
    element.am_mouseenter = event => {
        show_prompt(event, prompt);

        element.prompt = prompt;
        element.timeoutHide = setTimeout(() => {
            hide_prompt(prompt);
        }, HIDE_TIME);
    }

    element.am_mousemove = event => {
        center_on_mouse(prompt, [event.clientX, event.clientY]);
        if (element.timeoutHide != undefined && element.timeoutHide != null) {
            clearTimeout(element.timeoutHide);
            element.timeoutHide = setTimeout(() => {
                hide_prompt(prompt);
            }, HIDE_TIME);
        }
    }

    element.addEventListener("mouseenter", element.am_mouseenter)
    element.addEventListener("mousemove", element.am_mousemove)
}

export function make_unhoverable(element) {
    element.removeEventListener("mouseenter", element.am_mouseenter);
    element.removeEventListener("mousemove", element.am_mousemove);

    if (element.timeoutHide != undefined || element.timeoutHide != null) {
        clearTimeout(element.timeoutHide);
        hide_prompt(element.prompt);
    }
}

function center_on_mouse(element, mouse_pos) {
    const x = mouse_pos[0] - element.clientWidth / 2;
    const y = mouse_pos[1] - element.clientHeight / 2;
    const y_padding = 40;
    element.style.left = x + "px";
    element.style.top = y + y_padding + "px";
}