const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { id, name } = event || {};

  if (!OPENID) {
    return {
      success: false,
      error: 'OPENID not found'
    };
  }

  if (!id || !name) {
    return {
      success: false,
      error: 'id and name are required'
    };
  }

  const nextName = String(name).trim();
  if (!nextName) {
    return {
      success: false,
      error: 'name cannot be empty'
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

    await db.collection('notebook').doc(id).update({
      data: {
        name: nextName,
        update_time: db.serverDate()
      }
    });

    return {
      success: true,
      id,
      name: nextName
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
};
