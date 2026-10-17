"""Execute only selected route functions with explicit in-memory dependencies.

No application imports, environment loading, files outside source, or transports.
"""
import ast
import json
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
results = []

def load_function(relative, function_name, scope):
    tree = ast.parse((ROOT / relative).read_text(), filename=relative)
    node = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == function_name)
    node.decorator_list = []
    module = ast.fix_missing_locations(ast.Module(body=[node], type_ignores=[]))
    exec(compile(module, relative, 'exec'), scope)
    return scope[function_name]

for relative, name in [
    ('functions/api/index.py', 'fetch_team_table_api'),
    ('functions/api/fetch_team_table.py', '_handle_fetch_team_table_request'),
]:
    calls = []
    def upstream(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(payload={'data': [], 'debug': {}}, status_code=200)
    scope = {
        'request':SimpleNamespace(args={'from_season':'20252026', 'thru_season':'20252026', 'sit':'pk', 'rate':'n'}, headers={}),
        'fetch_team_table':upstream, 'jsonify':lambda value:value,
    }
    handler = load_function(relative, name, scope)
    _, status = handler()
    assert status == 200 and len(calls) == 1
    results.append({'test':f'{relative}:{name} calls upstream loader without authorization',
                    'result':'PASS', 'mockedOperations':len(calls), 'networkRequests':0, 'databaseRequests':0})

output = {'generatedAt':datetime.now(timezone.utc).isoformat(), 'tests':results,
          'limits':'Isolated source-function execution; Flask deployment/middleware and live provider access unverified.'}
(OUT / 'safe-python-checks.json').write_text(json.dumps(output, indent=2)+'\n')
print(json.dumps(output, indent=2))
