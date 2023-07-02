import asyncio
import websockets
import json
import random
from string import ascii_uppercase, digits

import os
import signal

import chess
Boards = {}

JOIN_KEY_LENGTH = 4
POTENTIAL_KEY_CHARACTERS = ascii_uppercase+digits

URL_404 = "./?badRequest=true"

def get_join_url(join_key):
    return f"./chess.html?join={join_key}"

def map_squarename_to_validmove(board, square_name):
    square = chess.parse_square(square_name)
    piece = board.piece_at(square)
    piece = piece.symbol() if piece is not None else ""
    return (square, piece)

def get_valid_moves_from(board, index):
    name = chess.square_name(index)

    valid_squares = []
    for move in map(lambda x: str(x), board.legal_moves):
        if move[:2] != name:
            continue
        valid_squares.append(move[2:4])
    return list(map(lambda x: map_squarename_to_validmove(board, x), valid_squares))

def get_piece_from_square(board, square):
    piece = board.piece_at(square)
    return piece.symbol() if piece is not None else ""

def get_piecetype_from_symbol(symbol):
    return chess.Piece.from_symbol(symbol).piece_type

def get_finished(board: chess.Board):
    if board.outcome() is None:
        return False
    
    # While the game only considers checkmate and stalemate, we need this additional check.
    # If all end games are implemented, this check is not necessary because the presence of an outcome
    # object is enough to know that the game has ended
    return board.is_checkmate() or board.is_stalemate()

def get_finished_reason(board: chess.Board):
    if board.outcome() is None:
        return ""
    
    if board.is_checkmate():
        return "Checkmate"
    if board.is_stalemate():
        return "Stalemate"
    
def get_winner(board: chess.Board):
    if (outcome := board.outcome()) is None:
        return -1
    
    return outcome.winner

def get_missing_player(board):
    if chess.WHITE not in board.am_active_players:
        return chess.WHITE
    if chess.BLACK not in board.am_active_players:
        return chess.BLACK
    raise RuntimeError

def get_full(board):
    return len(board.am_active_players) == 2

def get_last_move(board):
    try:
        last_move = board.peek()
        piece = get_piece_from_square(board, last_move.to_square)
        last_move = (last_move.from_square, last_move.to_square, piece)
        return last_move
    except IndexError:
        last_move = None
        return last_move
    except Exception as e:
        print(e)

def generate_join_key():
    success = False

    for _ in range(1000):
        key = "".join(random.choice(POTENTIAL_KEY_CHARACTERS) for _ in range(JOIN_KEY_LENGTH))
    
        if key not in Boards.keys():
            success = True
            break

    if not success:
        raise RuntimeError
    else:
        return key
    
async def bad_request(websocket):
    await websocket.send(json.dumps({
        "type": "bad request",
        "url": URL_404
    }))

async def invalid_url(websocket):
    await websocket.send(json.dumps({
        "type": "invalid url",
        "message": "You entered an invalid url... Redirecting to the home menu",
        "url": "./"
    }))

async def opponent_left_during_disconnect(websocket):
    await websocket.send(json.dumps({
        "type": "reconnecting",
        "success": False,
        "message": "There is nobody in this game",
        "url": "./"
    }))

async def error(websocket, message):
    event = {
        "type": "error",
        "message": message,
    }
    await websocket.send(json.dumps(event))

async def play(websocket, board: chess.Board, player, connected):
    while True:
        try:
            message = await websocket.recv()
        except websockets.ConnectionClosed:
            websockets.broadcast(connected, json.dumps({
                "type": "opponent disconnected",
                "board": board.board_fen(),
                "finished": get_finished(board),
                "last move": get_last_move(board)
            }))
            break
        
        event = json.loads(message)

        if event["type"] == "hover" and (player and not board.turn or not player and board.turn):
                continue

        if event["type"] == "select" or event["type"] == "play":
            if event["player"] == chess.WHITE and not board.turn or\
            event["player"] == chess.BLACK and board.turn:
                await websocket.send(json.dumps({
                    "type": "notYourTurn"
                }))
                continue

        if event["type"] == "select" or event["type"] == "hover":
            available_moves = get_valid_moves_from(board, event["square"])

            await websocket.send(json.dumps({
                "type": event["type"],
                "square": event["square"],
                "piece": get_piece_from_square(board, event["square"]),
                "available moves": available_moves
            }))

        if event["type"] == "play":
            send_en_passant = False

            move = chess.Move(event["start square"], event["end square"])
            piece = get_piece_from_square(board, event["start square"])
            end_piece = piece
            new_piece_rank = move.uci()[3]
            
            if (board.is_castling(move)):
                king_file, king_rank = move.uci()[2:4]

                old_castle_file = "a" if king_file == "c" else "h"
                new_castle_file = "d" if king_file == "c" else "f"
                castle_rank = king_rank
                castle_symbol = "R" if int(castle_rank) == 1 else "r"

                old_castle_uci = old_castle_file+castle_rank
                new_castle_uci = new_castle_file+castle_rank
                old_castle_square_index = chess.parse_square(old_castle_uci)
                new_castle_square_index = chess.parse_square(new_castle_uci)

                websockets.broadcast(connected, json.dumps({
                    "type": "play",
                    "start square": old_castle_square_index,
                    "end square": new_castle_square_index,
                    "piece": castle_symbol,
                    "contribute turn": False
                }))

            elif (board.is_en_passant(move)):
                attacking_file, attacking_rank = move.uci()[2:4]
                defending_file = attacking_file
                defending_rank = "4" if attacking_rank == "3" else "5"

                defending_uci = defending_file+defending_rank
                defending_square_index = chess.parse_square(defending_uci)

                send_en_passant = True
                en_passant_message = json.dumps({
                    "type": "clear",
                    "piece": defending_square_index
                })

            elif (piece.lower() == "p" and (int(new_piece_rank) == 1 or int(new_piece_rank) == 8)):
                await websocket.send(json.dumps({
                    "type": "promotion"
                }))

                promotion_message = await websocket.recv()
                promotion_event = json.loads(promotion_message)

                end_piece = promotion_event["piece"]
                move.promotion = get_piecetype_from_symbol(end_piece)
            
            board.push(move)
            websockets.broadcast(connected, json.dumps({
                "type": "play",
                "start square": event["start square"],
                "end square": event["end square"],
                "piece": end_piece,
                "check": board.is_check()
            }))

            if send_en_passant:
                websockets.broadcast(connected, en_passant_message)

            # End game conditions
            # Can be generalised to:
            '''
            outcome = board.outcome()
            if outcome is not None:
                websockets.broadcast(connected, json.dumps({
                    "type": "end",
                    "reason": <function to convert outcome.termination (enum) to string>,
                    "winner: outcome.winner
                }))
            '''

            # For now we only consider checkmate and stalemate
            if board.is_checkmate():
                websockets.broadcast(connected, json.dumps({
                    "type": "win",
                    "winner": get_winner(board)
                }))

            elif board.is_stalemate():
                websockets.broadcast(connected, json.dumps({
                    "type": "draw",
                    "reason": "stalemate"
                }))
        
        if event["type"] == "resize":
            await websocket.send(json.dumps({
                "type": "resize",
                "board": board.board_fen()
            }))

async def new(websocket):
    board = chess.Board()
    # Adding custom variables to keep track of the current white and black players
    board.am_active_players = []
    connected = set()

    try:
        join_key = generate_join_key()
    except RuntimeError:
        error(websocket, "Could not generate a unique key for this game, please try again")
        return

    Boards[join_key] = board, connected
    await websocket.send(json.dumps({
        "type": "new",
        "url": get_join_url(join_key)
    }))

async def join(websocket, join_key, reconnecting):
    join_key = join_key.upper()
    try:
        board, connected = Boards[join_key]
    except KeyError:
        if not reconnecting:
            await bad_request(websocket)
        else:
            await opponent_left_during_disconnect(websocket)
        return
    
    if len(connected) >= 2:
        if reconnecting:
            await websocket.send(json.dumps({
                "type": "reconnecting",
                "success": False,
                "message": "Someone else has filled your place while you were gone",
                "url": "./"
            }))
        else:
            await websocket.send(json.dumps({
                "type": "full",
                "message": "There are already two players in this game",
                "url": "./"
            })) # redirect request as "watch"
        return
    connected.add(websocket)

    try:
        player = get_missing_player(board)
        board.am_active_players.append(player)
    except:
        # The previous check 'len(connected) >= 2' should mean we never reach this line
        print("There is already a white and black player in this game")
        return
    
    try:        
        if reconnecting:
            await websocket.send(json.dumps({
                "type": "reconnecting",
                "success": True,
                "join": join_key
            }))
        else:
            last_move = get_last_move(board)

            await websocket.send(json.dumps({
                "type": "init",
                "join": join_key,
                "board": board.board_fen(),
                "player": player,
                "last move": last_move,
                "turn": board.turn,
                "check": board.is_check(),
                "finished": get_finished(board),
                "finished reason": get_finished_reason(board),
                "winner": get_winner(board)
            }))
            websockets.broadcast(connected, json.dumps({
                "type": "player joined",
                "board": board.board_fen(),
                "full": get_full(board),
                "last move": get_last_move(board)
            }))

        await play(websocket, board, player, connected)
    finally:
        connected.remove(websocket)
        board.am_active_players.remove(player)
        if len(connected) == 0:
            # Add a delay here in case a user is refreshing the page, instead of deleting the game immediately
            await asyncio.sleep(120)
            if len(connected) == 0 and join_key in Boards:
                del Boards[join_key]

async def handler(websocket):
    message = await websocket.recv()
    event = json.loads(message)
    assert event["type"] == "new" or event["type"] == "init"

    if event["type"] == "new":
        await new(websocket)
    elif "join" in event:
        reconnecting = False if "reconnecting" not in event else event["reconnecting"]
        await join(websocket, event["join"], reconnecting)
    else:
        await invalid_url(websocket)

async def main():
    loop = asyncio.get_running_loop()
    stop = loop.create_future()
    loop.add_signal_handler(signal.SIGTERM, stop.set_result, None)

    port = int(os.environ.get("PORT", 8001))
    async with websockets.serve(handler, "", port):
        await stop


if __name__ == "__main__":
    asyncio.run(main())
