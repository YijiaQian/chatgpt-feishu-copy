"""Run with Python + playwright; no Feishu credentials and no document writes."""
import argparse, functools, http.server, json, os, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--browser',help='Optional Chromium executable path')
parser.add_argument('--work-dir',default='work',help='Temporary files, under current directory')
args=parser.parse_args()
task_work=Path(args.work_dir).resolve();task_work.mkdir(exist_ok=True,parents=True)
os.environ['TEMP']=str(task_work);os.environ['TMP']=str(task_work)
root=Path(__file__).resolve().parent.parent
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,**({'executable_path':args.browser} if args.browser else {}))
        page=browser.new_page();results=[]
        for suite in ['core-tests.html','conversation-tests.html','offscreen-tests.html']:
            page.goto(f'http://127.0.0.1:{server.server_port}/tests/{suite}')
            page.wait_for_function('()=>Array.isArray(window.TEST_RESULTS)',timeout=60000)
            results.extend(page.evaluate('TEST_RESULTS'))
        browser.close()
    print(json.dumps(results,ensure_ascii=True,indent=2))
    failed=[r for r in results if not r['passed']]
    print(f"{len(results)-len(failed)}/{len(results)} passed")
    raise SystemExit(1 if failed else 0)
finally:
    server.shutdown()
