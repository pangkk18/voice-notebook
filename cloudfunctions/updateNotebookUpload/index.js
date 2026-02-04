const cloud = require('wx-server-sdk');

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

  const { id, fileID, cloudPath } = event || {};
  if (!id || !fileID || !cloudPath) {
    return {
      success: false,
      error: 'id, fileID, cloudPath are required'
    };
  }

  try {
    await db.collection('notebook').doc(id).update({
      data: {
        fileID,
        cloudPath,
        upload_time: db.serverDate()
      }
    });

    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
};
