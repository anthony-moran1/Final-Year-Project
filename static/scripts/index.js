import { make_hoverable } from "./hoverableElement.js";

function appHeight() {
    const doc = document.documentElement;
    doc.style.setProperty('--app-height', `${window.innerHeight}px`);
};

window.addEventListener('resize', appHeight);
appHeight();

const params = new URLSearchParams(window.location.search);
const not_existing_prompt = document.querySelector("#not-existing-prompt");

if (params.has("badRequest") && params.get("badRequest")=="true") {
    not_existing_prompt.style.display = "block";
}

const example_hint_anchor = document.querySelector(".hint-anchor");
const example_hint_text = document.querySelector(".hint-text");
make_hoverable(example_hint_anchor, example_hint_text);

window.addEventListener("DOMContentLoaded", () => {
    set_background_target(document.body)
});