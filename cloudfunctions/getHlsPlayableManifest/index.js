const cloud = require('wx-server-sdk');
const path = require('path');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return {
      success: false,
      error: 'OPENID not found'
    };
  }

  const { recordId, maxAge = 3600 } = event || {};
  if (!recordId) {
    return {
      success: false,
      error: 'recordId is required'
    };
  }

  try {
    const recordRes = await db.collection('notebook').doc(recordId).get();
    const record = recordRes && recordRes.data ? recordRes.data : null;

    if (!record || record.openid !== OPENID) {
      return {
        success: false,
        error: 'record not found or permission denied'
      };
    }

    const m3u8FileID = record.m3u8FileID || '';
    const m3u8CloudPath = record.m3u8CloudPath || '';
    const segmentCloudPaths = Array.isArray(record.hlsSegmentCloudPaths) ? record.hlsSegmentCloudPaths : [];
    const segmentFileIDs = Array.isArray(record.hlsSegmentFileIDs) ? record.hlsSegmentFileIDs : [];

    if (!m3u8FileID || !m3u8CloudPath || !segmentCloudPaths.length) {
      return {
        success: false,
        error: 'HLS resource not ready'
      };
    }

    const manifestRaw = await cloud.downloadFile({ fileID: m3u8FileID });
    const manifestText = String(manifestRaw.fileContent || '');
    if (!manifestText) {
      return {
        success: false,
        error: 'm3u8 content is empty'
      };
    }

    const effectiveSegmentFileIDs = buildSegmentFileIDs({
      segmentFileIDs,
      segmentCloudPaths,
      m3u8FileID,
      m3u8CloudPath
    });

    if (!effectiveSegmentFileIDs.length) {
      return {
        success: false,
        error: 'cannot resolve segment file IDs'
      };
    }

    const tempResult = await cloud.getTempFileURL({
      fileList: effectiveSegmentFileIDs.map((fileID) => ({ fileID, maxAge: Number(maxAge) || 3600 }))
    });

    const fileList = Array.isArray(tempResult.fileList) ? tempResult.fileList : [];
    const mapByName = {};

    for (let i = 0; i < fileList.length; i++) {
      const item = fileList[i] || {};
      const sourceID = effectiveSegmentFileIDs[i] || '';
      const cloudPath = segmentCloudPaths[i] || '';
      const tempURL = item.tempFileURL || '';
      if (!tempURL) continue;

      const name1 = path.basename(cloudPath);
      const name2 = path.basename(parseCloudPathFromFileID(sourceID));
      const name3 = path.basename(sourceID);
      if (name1) mapByName[name1] = tempURL;
      if (name2) mapByName[name2] = tempURL;
      if (name3) mapByName[name3] = tempURL;
    }

    const signedManifest = rewriteManifest(manifestText, mapByName);

    return {
      success: true,
      recordId,
      signedManifest,
      expiresIn: Number(maxAge) || 3600
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
};

function rewriteManifest(manifestText, mapByName) {
  const lines = manifestText.split('\n');
  const rewritten = lines.map((line) => {
    const raw = line.trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('http://') || raw.startsWith('https://')) {
      return line;
    }
    const segName = path.basename(raw.split('?')[0]);
    const signedURL = mapByName[segName];
    return signedURL || line;
  });
  return rewritten.join('\n');
}

function buildSegmentFileIDs({ segmentFileIDs, segmentCloudPaths, m3u8FileID, m3u8CloudPath }) {
  if (segmentFileIDs.length) return segmentFileIDs;
  if (!segmentCloudPaths.length || !m3u8FileID || !m3u8CloudPath) return [];

  const idx = m3u8FileID.indexOf(m3u8CloudPath);
  if (idx < 0) return [];
  const prefix = m3u8FileID.slice(0, idx);
  return segmentCloudPaths.map((cloudPath) => `${prefix}${cloudPath}`);
}

function parseCloudPathFromFileID(fileID) {
  if (!fileID || typeof fileID !== 'string') return '';
  const s = fileID.replace(/^cloud:\/\/[^/]+\//, '');
  return s;
}
