function compareVersions(left, right) {
  const parse = value => String(value || '').replace(/^v/i, '').split(/[.-]/).slice(0, 3).map(part => Number(part) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function syncStateFor({ configured, remoteExists, remoteValid, localExists, localChecksum, remoteChecksum, lastSyncChecksum }) {
  if (!configured) return 'disabled';
  if (remoteExists && !remoteValid) return 'invalid';
  if (!remoteExists) return localExists ? 'local-only' : 'empty';
  if (!localExists) return 'remote-newer';
  if (localChecksum && localChecksum === remoteChecksum) return 'synced';
  if (lastSyncChecksum && localChecksum === lastSyncChecksum) return 'remote-newer';
  if (lastSyncChecksum && remoteChecksum === lastSyncChecksum) return 'local-newer';
  return 'conflict';
}

function validateUpdateManifest(value) {
  if (!value || typeof value !== 'object') throw new Error('版本清单不是有效对象');
  const version = String(value.version || '').trim();
  if (!/^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error('版本清单缺少有效 version');
  const downloadUrl = String(value.downloadUrl || value.url || '').trim();
  if (downloadUrl) {
    const url = new URL(downloadUrl);
    if (url.protocol !== 'https:') throw new Error('更新下载地址必须使用 HTTPS');
  }
  const sha256 = String(value.sha256 || '').trim();
  if (sha256 && !/^[a-f0-9]{64}$/i.test(sha256)) throw new Error('sha256 必须是 64 位十六进制值');
  return { version, downloadUrl, sha256, notes: String(value.notes || '').slice(0, 4000) };
}

module.exports = { compareVersions, syncStateFor, validateUpdateManifest };
