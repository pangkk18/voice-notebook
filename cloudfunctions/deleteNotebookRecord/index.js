const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { id } = event || {};

  if (!OPENID) {
    return {
      success: false,
      error: 'OPENID not found'
    };
  }

  if (!id) {
    return {
      success: false,
      error: 'id is required'
    };
  }

  try {
    const recordRes = await db.collection('notebook').doc(id).get();
    const record = recordRes?.data || null;

    if (!record || record.openid !== OPENID) {
      return {
        success: false,
        error: 'record not found or permission denied'
      };
    }

    const fileList = Array.from(new Set([
      record.fileID,
      record.previewM4aFileID,
      record.fullM4aFileID
    ].filter(Boolean)));

    if (fileList.length) {
      try {
        await cloud.deleteFile({
          fileList
        });
      } catch (error) {
        console.warn('delete cloud files failed:', error);
      }
    }

    await db.collection('notebook').doc(id).remove();

    return {
      success: true,
      id,
      deletedFileCount: fileList.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
};
