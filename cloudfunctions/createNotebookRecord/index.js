const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return {
      success: false,
      error: 'OPENID not found'
    };
  }

  const {
    name = '未命名录音',
    duration = 0,
    temp_path = '',
    type = 'audio/wav'
  } = event || {};

  if (!temp_path) {
    return {
      success: false,
      error: 'temp_path is required'
    };
  }

  try {
    const result = await db.collection('notebook').add({
      data: {
        name,
        duration: Number(duration) || 0,
        temp_path,
        type,
        create_time: db.serverDate(),
        openid: OPENID
      }
    });

    return {
      success: true,
      id: result._id || result.id || ''
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
};
