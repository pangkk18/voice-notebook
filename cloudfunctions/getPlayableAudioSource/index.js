const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { recordId, shareToken } = event || {};

  if (!recordId && !shareToken) {
    return {
      success: false,
      error: 'recordId or shareToken is required'
    };
  }

  try {
    let record = null;

    if (recordId) {
      const recordRes = await db.collection('notebook').doc(recordId).get();
      record = recordRes?.data || null;
    } else if (shareToken) {
      const recordRes = await db
        .collection('notebook')
        .where({ shareToken })
        .limit(1)
        .get();
      record = recordRes?.data?.[0] || null;
    }

    if (!record) {
      return {
        success: false,
        error: 'record not found'
      };
    }

    const isOwner = !!(OPENID && record.openid === OPENID);
    const isSharedAccess = !!shareToken;

    if (!isOwner && !isSharedAccess) {
      return {
        success: false,
        error: 'record not found or permission denied'
      };
    }

    return {
      success: true,
      data: {
        id: record._id || record.id || '',
        name: record.name || '未命名录音',
        create_time: record.create_time || '',
        fileID: record.fileID || '',
        cloudPath: record.cloudPath || '',
        temp_path: isOwner ? (record.temp_path || '') : '',
        conversion_status: record.conversion_status || '',
        previewM4aFileID: record.previewM4aFileID || '',
        previewM4aCloudPath: record.previewM4aCloudPath || '',
        fullM4aFileID: record.fullM4aFileID || '',
        fullM4aCloudPath: record.fullM4aCloudPath || '',
        duration: Number(record.duration) || 0,
        audio_info: record.audio_info || {},
        shareToken: record.shareToken || '',
        isOwner
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
};
