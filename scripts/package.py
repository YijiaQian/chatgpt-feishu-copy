"""Create reproducible ZIPs for stores (root manifest) and manual installation."""
from pathlib import Path
import hashlib
import json
import zipfile

root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
version=manifest['version']
top_files=['manifest.json','background.js','charts.js','content.js','converter.html','converter.js','core.js','offscreen.html','offscreen.js','popup.html','popup.js','privacy.html','ui.css','LICENSE','THIRD_PARTY_NOTICES.md']
files=[root/name for name in top_files]
for directory in ['icons','vendor']:
    files.extend(sorted(path for path in (root/directory).rglob('*') if path.is_file()))
for path in files:
    if not path.is_file():raise FileNotFoundError(path)
for script in manifest['content_scripts']:
    for path in script['js']:
        assert root/path in files,path
dist=root/'dist';dist.mkdir(exist_ok=True)
checksums=[]
for kind,prefix in [('store',''),('manual','chatgpt-feishu-copy/')]:
    archive=dist/f'chatgpt-feishu-copy-v{version}-{kind}.zip'
    selected=list(files)
    if kind=='manual':
        selected.extend(root/name for name in ['README.md','CHANGELOG.md','CONTRIBUTING.md'])
        for directory in ['docs','tests','scripts']:
            selected.extend(path for path in (root/directory).rglob('*') if path.is_file() and '__pycache__' not in path.parts and path.suffix!='.pyc')
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as bundle:
        for path in sorted(selected):
            info=zipfile.ZipInfo(prefix+path.relative_to(root).as_posix(),date_time=(2026,1,1,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=0o100644 << 16
            bundle.writestr(info,path.read_bytes(),compresslevel=9)
    with zipfile.ZipFile(archive) as bundle:
        assert bundle.testzip() is None
        assert prefix+'manifest.json' in bundle.namelist()
    digest=hashlib.sha256(archive.read_bytes()).hexdigest()
    checksums.append(f'{digest}  {archive.name}')
    print(f'{archive.name}: {archive.stat().st_size} bytes, manifest at {prefix}manifest.json')
(dist/'SHA256SUMS.txt').write_text('\n'.join(checksums)+'\n',encoding='utf-8')
