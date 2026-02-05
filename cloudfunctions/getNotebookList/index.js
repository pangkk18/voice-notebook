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

  const { limit = 100 } = event || {};

  try {
    const result = await db
      .collection('notebook')
      .where({ openid: OPENID })
      .orderBy('create_time', 'desc')
      .limit(Number(limit) || 100)
      .get();

    return {
      success: true,
      data: result.data || []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
};
