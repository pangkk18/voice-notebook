const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { OPENID, APPID, UNIONID } = cloud.getWXContext();

  if (!OPENID) {
    return {
      success: false,
      error: 'OPENID not found'
    };
  }

  return {
    success: true,
    openid: OPENID,
    appid: APPID,
    unionid: UNIONID || null
  };
};
