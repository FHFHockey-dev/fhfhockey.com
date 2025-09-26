from http.server import BaseHTTPRequestHandler
import sys

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        v = sys.version
        self.send_response(200)
        self.send_header('Content-type','text/plain')
        self.end_headers()
        self.wfile.write(v.encode('utf-8'))