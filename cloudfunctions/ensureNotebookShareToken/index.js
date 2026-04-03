const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

function createShareToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

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

    const nextShareToken = record.shareToken || createShareToken();

    if (!record.shareToken) {
      await db.collection('notebook').doc(id).update({
        data: {
          shareToken: nextShareToken,
          update_time: db.serverDate()
        }
      });
    }

    return {
      success: true,
      id,
      shareToken: nextShareToken
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
};
