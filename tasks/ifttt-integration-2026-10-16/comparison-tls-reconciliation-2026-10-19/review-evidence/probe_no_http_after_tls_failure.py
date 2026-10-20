"""Offline call-order control only: mocked socket establishment and TLS failure.
No DNS, socket connect, provider request, real credential or trust change.
"""
import http.client,json,socket,ssl,urllib.request,urllib.error
from pathlib import Path
from unittest.mock import patch
trace=[];app_writes=[]
class FakeSocket:
 def setsockopt(self,*a):pass
 def sendall(self,data):app_writes.append(bytes(data));raise AssertionError('HTTP bytes must never be sent')
 def close(self):trace.append('socket.close')
class FailingTLS:
 def wrap_socket(self,sock,*,server_hostname):
  trace.append('tls.wrap_socket:'+server_hostname)
  exc=ssl.SSLCertVerificationError(1,'offline synthetic certificate-validation failure');exc.verify_code=20
  raise exc
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*a,**kw):raise AssertionError('redirect reached unexpectedly')
def new_connection(address,*a,**kw):trace.append('socket.create_connection_mock:'+str(address));return FakeSocket()
original_send=http.client.HTTPConnection.send
def send(self,data):trace.append('http.send.enter_connect_before_write');return original_send(self,data)
request=urllib.request.Request('https://api.openai.com/v1/responses',data=b'{"offline_control":true}',method='POST',headers={'Authorization':'Bearer OFFLINE_SYNTHETIC_ONLY','Content-Type':'application/json'})
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=FailingTLS()),NoRedirect())
with patch.object(socket.socket,'connect',side_effect=AssertionError('all real network forbidden')),patch.object(socket,'create_connection',side_effect=new_connection),patch.object(http.client.HTTPConnection,'send',send):
 try:opener.open(request,timeout=20)
 except urllib.error.URLError as e:
  assert isinstance(e.reason,ssl.SSLCertVerificationError) and e.reason.verify_code==20
  trace.append('URLError:SSLCertVerificationError:20')
 else:raise AssertionError('expected TLS failure')
assert len([e for e in trace if e.startswith('socket.create_connection_mock')])==1
assert len([e for e in trace if e.startswith('tls.wrap_socket')])==1
assert app_writes==[]
result={'scope':'offline source-path control; not a reconstruction of remote packets','trace':trace,'applicationWriteCalls':len(app_writes),'applicationBytesSent':sum(map(len,app_writes)),'realNetworkCalls':0,'realCredentialReads':0,'proxyEnabled':False,'retryOrRedirectObserved':False}
Path(__file__).with_name('offline-no-http-proof.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
