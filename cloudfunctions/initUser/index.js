const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const DEFAULT_TOTAL_SPACE = 1024 * 1024 * 1024; // 1GB

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    console.log('OPENID missing in wxContext');
    return {
      success: false,
      error: 'OPENID not found'
    };
  }

  console.log('OPENID:', OPENID);
  const users = db.collection('users');

  try {
    const existing = await users.where({ openid: OPENID }).limit(1).get();

    if (!existing.data || existing.data.length === 0) {
      await users.add({
        data: {
          openid: OPENID,
          totalSpace: DEFAULT_TOTAL_SPACE,
          usedSpace: 0,
          createdAt: db.serverDate()
        }
      });

      // Create a placeholder file to ensure the "folder" exists
      await cloud.uploadFile({
        cloudPath: `${OPENID}/.init`,
        fileContent: Buffer.from('')
      });

      return {
        success: true,
        initialized: true,
        openid: OPENID
      };
    }

    return {
      success: true,
      initialized: false,
      openid: OPENID
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
};
