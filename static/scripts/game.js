import { multi_launch } from "./confetti.js";
import { make_hoverable, make_unhoverable } from "./hoverableElement.js";

const ROWS_AND_COLS = 8;
let square_size;

const canvas = document.querySelector("#ChessBoard");
const ctx = canvas.getContext("2d");

const prompt = document.querySelector("#Prompt");
const turn_text = document.querySelector("#turn-text")
const check_text = document.querySelector("#check-text");
const join_text_element = document.querySelector("#join-text");
const join_link_element = document.querySelector("#join-link");
const join_code_element = document.querySelector("#join-code-text");
join_text_element.style.display = "none"

const check_definition_text_element = document.querySelector("#checkDefinitionText");
const not_your_turn_text_element = document.querySelector("#notYourTurnText");
make_hoverable(check_text, check_definition_text_element);

const main = document.querySelector("main");
const reconnect_link = document.querySelector("#reconnect-link");
const no_server_text = document.querySelector("#no-server-text");

const promotion_panel = document.querySelector("#PromotionPanel");

const pp_pieces = document.querySelectorAll(".pp-piece");
const pp_pieces_symbols = ["q", "r", "n", "b"];
const pp_percent_width = .8;
const pp_percent_height = .2;
const pp_padding = 10;

const chess_spritesheet = document.querySelector('img');
const spritesheet_rows = 2;
const spritesheet_cols = 6;
let frame_width;
let frame_height;

const WHITE = true;
const BLACK = false;
let player;
let turn;

const COLOUR0 = "#22aa44";
const COLOUR1 = "#ffffff";
const COLOUR_SELECT = "#ffff00";
const COLOUR_HIGHLIGHT = "#33aaff";
const COLOUR_LAST_MOVE = "#cc44cc";
const SELECT_ALPHA = "dd";
const HOVER_ALPHA = "99";
const LAST_MOVE_ALPHA = "88";

let current_selection = null;
let current_moves = null;

let hover_square_index = null;
let last_move;

let choosing_promotion = false;

export function click(callback) {
    canvas.addEventListener("click", event => {
        if (choosing_promotion) {
            return;
        }

        callback(event);
    });
}

export function pp_click(callback) {
    pp_pieces.forEach((piece, index) => {
        piece.addEventListener("click", () => {
            hide_promotion_panel();

            let symbol = pp_pieces_symbols[index];
            symbol = player ? symbol.toUpperCase() : symbol.toLowerCase();
            callback(symbol);
        })
    })
}

export function init(fen, given_player, given_last_move, given_turn, join_key, check, finished, finished_reason, winner) {
    // This needs to go first because the presence of the link will affect the size of the canvas element
    if (!finished) {
        init_join_text(join_key);
        update_turn(given_turn, check);
    } else {
        if (finished_reason == "Checkmate") {
            display_winner(winner);
        } else if (finished_reason == "Stalemate") {
            display_draw(finished_reason)
        }
    }

    player = given_player ? WHITE : BLACK;

    frame_width = chess_spritesheet.width / spritesheet_cols;
    frame_height = chess_spritesheet.height / spritesheet_rows;

    init_canvas(fen, given_last_move);
}

export function init_canvas(fen, given_last_move) {
    const container = canvas.parentElement;
    const min = Math.min(container.clientWidth, container.clientHeight);
    square_size = min / ROWS_AND_COLS;

    canvas.width = min;
    canvas.height = min;
    ctx.font = "15px Arial";
    ctx.textBaseline = "top";

    const pp_width = canvas.width * pp_percent_width
    const pp_height = canvas.height * pp_percent_height
    promotion_panel.style.width = pp_width + "px";
    promotion_panel.style.height = pp_height + "px";
    promotion_panel.style.top = (canvas.height - promotion_panel.clientHeight) / 2 + "px";

    const pp_piece_width = (pp_width - pp_padding * (pp_pieces.length + 1)) / pp_pieces.length;
    const pp_piece_height = pp_height - pp_padding * 2;
    const pp_piece_size = Math.min(pp_piece_width, pp_piece_height);
    const pp_revised_padding = (pp_width - pp_piece_size * pp_pieces.length) / (pp_pieces.length + 1);

    pp_pieces.forEach((piece, index) => {
        piece.width = pp_piece_size;
        piece.height = pp_piece_size;
        piece.style.left = (pp_piece_size + pp_revised_padding) * index + pp_revised_padding + "px";
        piece.style.top = (pp_height - pp_piece_size) / 2 + "px";

        const ctx = piece.getContext("2d");
        let piece_symbol = pp_pieces_symbols[index];
        piece_symbol = player ? piece_symbol.toUpperCase() : piece_symbol.toLowerCase();
        const [sx, sy, sw, sh] = get_source_rect_from_char(piece_symbol);
        ctx.drawImage(chess_spritesheet, sx, sy, sw, sh,
            0, 0, pp_piece_size, pp_piece_size);
    })

    draw_board(fen);
    update_last_move(given_last_move);
}

function init_join_text(join_key) {
    join_link_element.href = "?join="+join_key;
    join_code_element.innerHTML = join_key;
    show_join_text_first();
}

function show_join_text_first() {
    join_text_element.style.display = "block";
}

export function show_join_text(fen, given_last_move) {
    show_join_text_first();
    init_canvas(fen, given_last_move);
}

export function remove_join_text(fen, given_last_move) {
    join_text_element.style.display = "none";
    init_canvas(fen, given_last_move);
}

export function player_joined(full, fen, given_last_move) {
    if (!full) {
        return;
    }
    remove_join_text(fen, given_last_move)
}

export function get_player() {
    return player;
}

function get_piece_from_char(char) {
    let addition = " ";
    if (char == char.toUpperCase()) {
        addition += "white"
    } else {
        addition += "black"
    }
    return char.toLowerCase() + addition;
}

export function get_rowcol_from_xy(x, y) {
    let row = Math.floor(y / square_size);
    if (player) {
        row = ROWS_AND_COLS - row - 1;
    }
    let col = Math.floor(x / square_size);
    if (!player) {
        col = ROWS_AND_COLS - col - 1;
    }
    return [row, col];
}

function get_rowcol_from_index(index) {
    let row = Math.floor(index / ROWS_AND_COLS);
    const col = index % ROWS_AND_COLS;
    return [row, col];
}

export function get_index_from_xy(x, y) {
    const [row, col] = get_rowcol_from_xy(x, y);
    return get_index_from_rowcol(row, col);
}

function get_xy_from_index(index) {
    let [row, col] = get_rowcol_from_index(index);
    if (player) {
        row = ROWS_AND_COLS - row - 1;
    }
    if (!player) {
        col = ROWS_AND_COLS - col - 1;
    }
    return [col * square_size, row * square_size];
}

function get_index_from_rowcol(row, col) {
    return row * ROWS_AND_COLS + col;
}

function get_source_rect(piece) {
    const [type, colour] = piece.split(" ");
    const x = get_source_col(type) * frame_width;
    const y = get_source_row(colour) * frame_height;
    return [x, y, frame_width, frame_height];
}

function get_source_rect_from_char(char) {
    const piece = get_piece_from_char(char);
    return get_source_rect(piece);
}

function get_source_row(colour) {
    switch (colour) {
        case "white":
            return 0;
        case "black":
            return 1;
    }
}

function get_source_col(type) {
    switch (type) {
        case "k":
            return 0;
        case "q":
            return 1;
        case "b":
            return 2;
        case "n":
            return 3;
        case "r":
            return 4;
        case "p":
            return 5;
    }
}

function get_colour_from_index(index) {
    const [row, col] = get_rowcol_from_index(index)
    return (row + col) % 2 == 0 ? COLOUR0 : COLOUR1;
}

function draw_square(index, colour=null, alpha=SELECT_ALPHA) {
    if (colour == null) {
        ctx.fillStyle = get_colour_from_index(index);
    }

    const [x, y] = get_xy_from_index(index);
    if (colour != null && parseInt(alpha, 16) < 255) {
        // This ensures that the transparent colour has a solid base to draw on top of.
        draw_square(index);
        ctx.fillStyle = colour+alpha;
    }
    ctx.fillRect(x, y, square_size, square_size);

    draw_square_name(index);
}

function draw_square_name(index) {
    const [row, col] = get_rowcol_from_index(index);
    const [x, y] = get_xy_from_index(index);
    const padding = 3;
    ctx.fillStyle = "#515151";

    if (row == 0 && player || row == 7 && !player) {
        const str = String.fromCharCode(97+col);
        const text_metrics = ctx.measureText(str);
        const width = text_metrics.width;
        const height = text_metrics.fontBoundingBoxDescent;
        ctx.fillText(str, x + square_size - width - padding, y + square_size - height - padding);
    }
    if (col == 0 && player || col == 7 && !player) {
        const str = (row+1).toString();
        ctx.fillText(str, x + padding, y + padding);
    }
}

function draw_piece(index, piece) {
    // 's' and 'd' denote source and destination respectively
    const [dx, dy] = get_xy_from_index(index);
    const [sx, sy, sw, sh] = get_source_rect(piece);

    ctx.drawImage(chess_spritesheet, sx, sy, sw, sh,
        dx, dy, square_size, square_size);
}

function draw_piece_from_char(index, char) {
    const piece = get_piece_from_char(char);
    draw_piece(index, piece);
}

function draw_selection(selection, available_moves) {
    if (selection == undefined) {
        if (current_selection == null) {
            return;
        } else {
            selection = current_selection;
            available_moves = current_moves;
        }
    }

    const [square, char] = selection;
    if (char == "") {
        return;
    }

    draw_square(square, COLOUR_SELECT);
    draw_piece_from_char(square, char);

    current_selection = selection;
    highlight_available_moves(available_moves);
}

function draw_board(fen) {
    for (let i=0; i<ROWS_AND_COLS**2; i++) {
        draw_square(i);
    }
    
    let row = ROWS_AND_COLS - 1, col = 0;
    for (let i=0; i<fen.length; i++) {
        const char = fen[i];

        if (char == '/') {
            row -= 1;
            col = 0;
            continue;
        }

        if (!isNaN(char)) {
            const num = Number(char);
            col += num;
            continue;
        }

        const index = get_index_from_rowcol(row, col);
        draw_piece_from_char(index, char);
        col += 1;
    }

    draw_selection();
}


export function clear(index) {
    draw_square(index);
}

export function select(selection, available_moves) {
    const old_selection = current_selection;

    unselect();
    unhighlight_available_moves();
    hover_square_index = null;

    if (JSON.stringify(old_selection) == JSON.stringify(selection)) {
        return;
    }

    draw_selection(selection, available_moves);
}

function unselect() {
    if (current_selection == null) {
        return;
    }

    const [square, piece] = current_selection
    draw_square(square);
    draw_piece_from_char(square, piece);
    current_selection = null;
}

export function highlight_available_moves(available_moves, hover=false) {
    available_moves.forEach(move => {
        const [square, char] = move;
        const alpha = hover ? HOVER_ALPHA : SELECT_ALPHA;
        draw_square(square, COLOUR_HIGHLIGHT, alpha);
        if (char != "") {
            draw_piece_from_char(square, char);
        }
    });

    current_moves = available_moves;
}

function unhighlight_available_moves() {
    if (current_moves == null) {
        return;
    }

    current_moves.forEach(move => {
        const [square, piece] = move;
        draw_square(square);
        draw_piece_from_char(square, piece);
    });
    current_moves = null;

    update_last_move();
}

export function attempting_move(move) {
    if (current_moves == null) {
        return false;
    }

    return current_moves.map(move => move[0]).find(available_move => JSON.stringify(available_move) == JSON.stringify(move)) != undefined
}

export function play(start_square, end_square, char, check, contribute_turn=true) {
    unselect();
    unhighlight_available_moves();

    draw_square(start_square);
    draw_square(end_square);
    draw_piece_from_char(end_square, char);
    if (contribute_turn) {
        update_turn(!turn, check);
    }

    update_last_move([start_square, end_square, char])
}

export function win(winner) {
    display_winner(winner);
    multi_launch();
}

export function draw(reason) {
    display_draw(reason);
}

export function get_current_selection_index() {
    return current_selection[0];
}

export function choose_promotion() {
    choosing_promotion = true;
    promotion_panel.style.display = "block";
}

export function hide_promotion_panel() {
    choosing_promotion = false;
    promotion_panel.style.display = "none";
}

function get_player_from_bool(bool) {
    return bool ? "White" : "Black";
}

function update_turn(given_turn, check) {
    turn = given_turn;
    const player_text = get_player_from_bool(turn);
    const inner_check_text = check ? " (In check)" : "";
    const text = `${player_text}'s Turn`;
    turn_text.innerHTML = `~ ${text} ~`;
    check_text.innerHTML = inner_check_text;
}

function display_winner(winner) {
    const player_text = get_player_from_bool(winner);
    const text = `Checkmate (${player_text} Wins)`;
    prompt.innerHTML = text;
}

function display_draw(reason) {
    prompt.innerHTML = `Draw (${reason})`;
}

export function opponent_disconnected(finished, board, given_last_move) {
    if (finished) {
        return;
    }

    show_join_text(board, given_last_move);
}

export function reconnect(join_key) {
    main.remove()
    reconnect_link.href += join_key;
    reconnect_link.style.display = "block"
}

export function no_server() {
    prompt.style.display = "none";
    no_server_text.style.display = "block";
}

export function get_hover_square_index() {
    return hover_square_index;
}

export function on_hover_square(callback) {
    canvas.addEventListener("mousemove", event => {
        if (choosing_promotion || current_selection != null) {
            return;
        }

        const index = get_index_from_xy(event.offsetX, event.offsetY);
        if (index != hover_square_index) {
            unhighlight_available_moves();
            hover_square_index = index;
            callback(event);
        }
    })
}

export function warn_not_your_turn() {
    turn_text.classList.add("hint-anchor");
    turn_text.classList.add("error");
    make_hoverable(turn_text, not_your_turn_text_element);

    setTimeout(unwarn_not_your_turn, 3000);
}

function unwarn_not_your_turn() {
    turn_text.classList.remove("hint-anchor");
    turn_text.classList.remove("error");
    make_unhoverable(turn_text)
}

function update_last_move(given_last_move) {
    const actual_last_move = given_last_move != undefined ? given_last_move : last_move;
    if (actual_last_move == undefined) {
        return;
    }

    const [start, end, piece] = actual_last_move;
    remove_last_move(given_last_move);

    draw_square(start, COLOUR_LAST_MOVE, LAST_MOVE_ALPHA);
    draw_square(end, COLOUR_LAST_MOVE, LAST_MOVE_ALPHA);
    draw_piece_from_char(end, piece);

    last_move = actual_last_move;
}

function remove_last_move(given_last_move) {
    if (given_last_move == undefined || last_move == undefined) {
        return;
    }

    const [start, end, piece] = last_move;
    draw_square(start);
    draw_square(end);
    draw_piece_from_char(end, piece);

    last_move = null;
}