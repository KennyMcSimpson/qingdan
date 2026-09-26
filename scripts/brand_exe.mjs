// Build-time only. npm install resedit@3.1.0 in a separate build-tools directory.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(process.env.QINGDAN_BUILD_PACKAGE || import.meta.url);
const PE = await import(pathToFileURL(require.resolve('pe-library')).href);
const ResEdit = await import(pathToFileURL(require.resolve('resedit')).href);
const [source, destination, icon] = process.argv.slice(2);
if (!source || !destination || !icon) throw new Error('Arguments: electron.exe Qingdan.exe icon.ico');
const exe = PE.NtExecutable.from(fs.readFileSync(source),{ignoreCert:true});
const res = PE.NtExecutableResource.from(exe);
const file = ResEdit.Data.IconFile.from(fs.readFileSync(icon));
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
for (const group of groups) ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries,group.id,group.lang,file.icons.map(i=>i.data));
const versions = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
for (const v of versions) {
  v.setFileVersion(1,0,0,0,1033); v.setProductVersion(1,0,0,0,1033);
  v.setStringValues({lang:1033,codepage:1200},{ FileDescription:'轻单 · 桌边待办', ProductName:'轻单 Qingdan', CompanyName:'Qingdan', InternalName:'Qingdan', OriginalFilename:'Qingdan.exe', LegalCopyright:'Copyright (c) 2026 Qingdan contributors. MIT License.' });
  v.outputToResourceEntries(res.entries);
}
res.outputResource(exe);
fs.writeFileSync(destination,Buffer.from(exe.generate()));
const check = PE.NtExecutable.from(fs.readFileSync(destination));
const result = PE.NtExecutableResource.from(check);
if (!ResEdit.Resource.VersionInfo.fromEntries(result.entries).length) throw new Error('Missing version resources');
console.log('Branded Windows executable verified: '+destination);
