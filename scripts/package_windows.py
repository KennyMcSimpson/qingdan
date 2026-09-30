"""Build the portable distribution from a checksum-verified official Electron zip.

Usage: python scripts/package_windows.py --runtime /path/to/electron-win32-x64.zip
       --checksums /path/to/SHASUMS256.txt --out /path/to/output
Requires Node.js plus resedit for branding, and Pillow for the icon.
No dependencies are installed on the end user's machine.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser()
p.add_argument('--runtime', required=True)
p.add_argument('--checksums', required=True)
p.add_argument('--out', default=str(ROOT / 'release'))
args = p.parse_args()
runtime = Path(args.runtime)
version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['devDependencies']['electron']
expected_name = f'electron-v{version}-win32-x64.zip'
checksum_lines = Path(args.checksums).read_text(encoding='utf-8-sig').splitlines()
expected = next(line.split()[0] for line in checksum_lines if line.split()[-1].lstrip('*') == expected_name)
actual = hashlib.sha256(runtime.read_bytes()).hexdigest()
if expected != actual:
    raise SystemExit('Runtime SHA256 mismatch. Refusing to package.')
out = Path(args.out).resolve()
folder = out / 'Qingdan-Windows-x64'
if folder.exists():
    shutil.rmtree(folder)
folder.mkdir(parents=True)
with zipfile.ZipFile(runtime) as z:
    for item in z.infolist():
        target = (folder / item.filename).resolve()
        if not target.is_relative_to(folder):
            raise RuntimeError('Unsafe runtime zip entry')
    z.extractall(folder)
default_app = folder / 'resources' / 'default_app.asar'
if default_app.exists():
    default_app.unlink()
from PIL import Image
icon = ROOT / 'assets' / 'icon.ico'
Image.open(ROOT / 'assets' / 'icon.png').save(icon, sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
subprocess.run(['node', str(ROOT / 'scripts' / 'brand_exe.mjs'), str(folder / 'electron.exe'), str(folder / 'Qingdan.exe'), str(icon)], check=True)
(folder / 'electron.exe').unlink()
appdir = folder / 'resources' / 'app'
appdir.mkdir(parents=True)
for name in ['src', 'assets', 'tests', 'scripts', 'docs']:
    shutil.copytree(ROOT / name, appdir / name)
for name in ['package.json', 'package-lock.json', 'README.md', 'README.en.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'LICENSE', 'VALIDATION.md', 'REFERENCES.md']:
    if (ROOT / name).exists():
        shutil.copy2(ROOT / name, appdir / name)
for name in ['使用说明.txt', 'VALIDATION.md']:
    if (ROOT / name).exists():
        shutil.copy2(ROOT / name, folder / name)
shutil.copy2(ROOT / 'LICENSE', folder / 'LICENSE-Qingdan.txt')
with (folder / '启动轻单.cmd').open('w', encoding='utf-8', newline='') as f:
    f.write('@echo off\r\ncd /d "%~dp0"\r\nstart "" "%~dp0Qingdan.exe"\r\n')
for locale in (folder / 'locales').glob('*.pak'):
    if locale.name not in ['en-US.pak','en-GB.pak','zh-CN.pak','zh-TW.pak']:
        locale.unlink()
manifest = {}
for file in sorted(folder.rglob('*')):
    if file.is_file():
        manifest[file.relative_to(folder).as_posix()] = hashlib.sha256(file.read_bytes()).hexdigest()
(folder / 'SHA256-MANIFEST.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
app_version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
archive = out / f'Qingdan-{app_version}-windows-x64.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for file in sorted(folder.rglob('*')):
        if file.is_file():
            z.write(file, file.relative_to(out))
with zipfile.ZipFile(archive) as z:
    if z.testzip() is not None:
        raise RuntimeError('ZIP CRC check failed')
archive_sha256 = hashlib.sha256(archive.read_bytes()).hexdigest()
(out / 'SHA256SUMS.txt').write_text(archive_sha256 + '  ' + archive.name + '\n',encoding='utf-8')
print(json.dumps({'archive':str(archive),'size_bytes':archive.stat().st_size,'files':len(manifest),'runtime_sha256':actual,'archive_sha256':archive_sha256},ensure_ascii=False))
