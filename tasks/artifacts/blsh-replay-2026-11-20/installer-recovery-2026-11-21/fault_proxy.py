#!/usr/bin/env python3
"""Loopback TCP fault proxy for the Postgres wire protocol (test-only, disposable clusters).

Usage: fault_proxy.py LISTEN_PORT TARGET_PORT MODE [MARKER] EVENT_LOG
  MODE cut-before:  when a client simple-Query message contains MARKER, reset both sockets
                    BEFORE forwarding it (the server never sees that statement or a COMMIT).
  MODE drop-commit-reply: forward the client's `commit;` Query to the server, read the server's
                    reply through ReadyForQuery (so the server has committed and answered), discard
                    that reply, then reset the client socket (the client never learns the outcome).
  MODE cut-client-keep-server: like cut-before, but only the client is reset; the server connection (and its open,
                    uncommitted transaction) is held for PROXY_HOLD_S seconds, as a pooler holding the backend would.
  MODE cut-client-pool-reuse: like cut-client-keep-server, but the proxy first sends `rollback;` to the server and then
                    holds the now-idle backend open, as a session pooler returning it to its pool would.
  MODE pass:        forward everything (reference run).
Requires sslmode=disable on the client. Only connection #1 is faulted; later connections pass through. Runs until killed.
"""
import json, os, socket, struct, sys, threading, time

listen_port, target_port, mode = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
marker = sys.argv[4].encode() if mode in ("cut-before", "cut-client-keep-server", "cut-client-pool-reuse") else None
HOLD_S = float(os.environ.get("PROXY_HOLD_S", "40"))
event_log = sys.argv[-1]

def log(event, **kw):
    with open(event_log, "a") as f:
        f.write(json.dumps({"t": time.strftime("%H:%M:%S", time.gmtime()) + f".{int(time.time()*1000)%1000:03d}Z", "event": event, **kw}) + "\n")

def rst(sock):
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack("ii", 1, 0))
        sock.close()
    except OSError:
        pass

def recv_exact(sock, n):
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("eof")
        buf += chunk
    return buf

srv = socket.socket(); srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
srv.bind(("127.0.0.1", listen_port)); srv.listen(4)
log("listening", mode=mode, marker=marker.decode() if marker else None)

def handle(conn_no, client):
    fault = mode if conn_no == 1 else "pass"  # only the first connection is faulted; later ones pass through
    server = socket.create_connection(("127.0.0.1", target_port))
    done = threading.Event(); hold = threading.Event(); queries = 0
    def server_to_client():
        try:
            while not done.is_set():
                data = server.recv(65536)
                if not data:
                    break
                if not hold.is_set():
                    client.sendall(data)
        except OSError:
            pass
    threading.Thread(target=server_to_client, daemon=True).start()
    try:
        n = struct.unpack("!I", recv_exact(client, 4))[0]  # startup message: length + body, no type byte
        server.sendall(struct.pack("!I", n) + recv_exact(client, n - 4))
        while True:
            head = recv_exact(client, 5)
            typ, n = head[:1], struct.unpack("!I", head[1:])[0]
            body = recv_exact(client, n - 4)
            if typ == b"Q":
                queries += 1
                text = body.rstrip(b"\x00")
                if fault == "cut-before" and marker in text:
                    log("cut_before_forwarding", conn=conn_no, query_no=queries, statement=text[:160].decode(errors="replace"))
                    done.set(); rst(client); rst(server); return
                if fault == "cut-client-keep-server" and marker in text:
                    log("cut_client_keep_server", conn=conn_no, query_no=queries, hold_s=HOLD_S)
                    hold.set(); rst(client); time.sleep(HOLD_S); done.set(); server.close()
                    log("server_released", conn=conn_no); return
                if fault == "cut-client-pool-reuse" and marker in text:
                    hold.set(); rst(client)
                    rb = b"rollback;\x00"; server.sendall(b"Q" + struct.pack("!I", len(rb) + 4) + rb)
                    log("cut_client_rollback_backend_kept_idle", conn=conn_no, query_no=queries, hold_s=HOLD_S)
                    time.sleep(HOLD_S); done.set(); server.close(); return
                if fault == "drop-commit-reply" and text.strip().lower() == b"commit;":
                    hold.set()  # discard everything the server sends from here on
                    server.sendall(head + body)
                    log("commit_forwarded", conn=conn_no, query_no=queries)
                    time.sleep(1.5)  # the server commits and answers; the answer is discarded
                    log("commit_reply_dropped_client_reset", conn=conn_no, query_no=queries)
                    done.set(); rst(client); server.close(); return
            server.sendall(head + body)
    except (ConnectionError, OSError) as e:
        log("stream_end", conn=conn_no, detail=str(e), queries=queries)
    finally:
        done.set()
        log("conn_exit", conn=conn_no, fault=fault, queries=queries)

conn_no = 0
while True:
    c, _ = srv.accept(); conn_no += 1
    threading.Thread(target=handle, args=(conn_no, c), daemon=True).start()
