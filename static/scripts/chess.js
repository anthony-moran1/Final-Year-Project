import * as game from "./game.js";

let resize_timeout;
const main = document.querySelector("main");

function getWebSocketServer() {
	const host = window.location.host.split(":")[0];
	return `ws://${host}:8001`;
}

function init(websocket) {
    set_background_target(main);

    websocket.addEventListener("open", () => {
        const params = new URLSearchParams(window.location.search);
        const event = {"type": "init"};

        if (params.has("new")) {
            event.type = "new"
        }

        if (params.has("join")) {
            event.join = params.get("join");

            if (params.has("reconnecting")) {
                event.reconnecting = params.get("reconnecting");
            }
        }

        websocket.send(JSON.stringify(event));
        websocket.removeEventListener("close", alertNoServer);
        websocket.addEventListener("close", alertBrokenConnection);
    });
}

function sendHandler(websocket) {
    game.click(event => {
        if (game.choosing_promotion) {
            return;
        }

        let send_data = null;
        const index = game.get_index_from_xy(event.offsetX, event.offsetY);

        if (game.attempting_move(index)) {
            send_data = {
                "type": "play",
                "player": game.get_player(),
                "start square": game.get_current_selection_index(),
                "end square": index
            }
        } else {
            send_data = {
                "type": "select",
                "player": game.get_player(),
                "square": index
            }
        }

        websocket.send(JSON.stringify(send_data));
    });

    game.pp_click(piece => {
        websocket.send(JSON.stringify({
            "type": "promotion",
            "piece": piece
        }));
    });

    window.addEventListener("resize", () => {
        clearTimeout(resize_timeout);
        resize_timeout = setTimeout(() => {
            websocket.send(JSON.stringify({
            "type": "resize"
        }))
    }, 250); 
    });

    game.on_hover_square(() => {
        websocket.send(JSON.stringify({
            "type": "hover",
            "square": game.get_hover_square_index()
        }))
    })
}

function receiveHandler(websocket) {
    websocket.addEventListener("message", ({data}) => {
        const event = JSON.parse(data);
        console.log("received event", event)
        switch (event.type) {
            case "new":
                close_websocket(websocket);
                console.log(event.url);
                window.location.replace(event.url);
                break;
            case "init":
                game.init(event.board, event.player, event["last move"], event.turn, event.join,
                    event.check, event.finished, event["finished reason"], event.winner);
                if (event["finished"]) {
                    close_websocket(websocket);
                }
                break;
            case "hover":
                game.highlight_available_moves(event["available moves"], true);
                break;
            case "select":
                game.select([event.square, event.piece], event["available moves"]);
                break;
            case "play":
                game.play(event["start square"], event["end square"], event.piece, event.check, event["contribute turn"]);
                break;
            case "player joined":
                game.player_joined(event.full, event.board, event["last move"]);
                break;
            case "notYourTurn":
                game.warn_not_your_turn();
                break;
            case "win":
                game.win(event.winner);
                close_websocket(websocket);
                break;
            case "draw":
                game.draw(event.reason);
                break;
            case "promotion":
                game.choose_promotion()
                break;
            case "clear":
                game.clear(event.piece);
                break;
            case "opponent disconnected":
                game.opponent_disconnected(event.finished, event.board, event["last move"]);
                break;
            case "reconnecting":
                if (!event.success) {
                    alert(event.message);
                    close_websocket(websocket);
                    window.location.replace(event.url);
                } else {
                    game.reconnect(event.join);
                }
                break;
            case "resize":
                game.init_canvas(event.board);
                break;
            case "bad request":
                close_websocket(websocket);
                window.location.replace(event.url);
                break;
            case "full":
                close_websocket(websocket);
                alert(event.message);
                window.location.replace(event.url);
                break;
            case "invalid url":
                close_websocket(websocket);
                alert(event.message);
                window.location.replace(event.url);
                break;
            case "error":
                alert(event.message);
                break;
            }
    });
}

function alertNoServer() {
    game.no_server();
    setTimeout(() => {
        window.location.replace("./")
    }, 3000);
}

function connectionHandler(websocket) {
    websocket.addEventListener("close", alertNoServer);
}

function alertBrokenConnection() {
    alert("The connection to the server was broken...");
    const params = new URLSearchParams(window.location.search);
    if (params.get("reconnecting")) {
        window.location.replace("./");
        return;
    }
    params.append('reconnecting', true);
    window.location.search = params.toString();
}

function close_websocket(websocket) {
    websocket.removeEventListener("close", alertBrokenConnection);
    websocket.close()
}

window.addEventListener('DOMContentLoaded', () => {
    const websocket = new WebSocket(getWebSocketServer());
    init(websocket);
    sendHandler(websocket);
    receiveHandler(websocket);
    connectionHandler(websocket);
});
