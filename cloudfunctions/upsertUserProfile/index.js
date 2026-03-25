const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const users = db.collection('users');
const DEFAULT_TOTAL_SPACE = 1024 * 1024 * 1024;

function pickUserInfo(userInfo = {}) {
  return {
    nickName: userInfo.nickName || '',
    avatarUrl: userInfo.avatarUrl || '',
    gender: typeof userInfo.gender === 'number' ? userInfo.gender : null,
    country: userInfo.country || '',
    province: userInfo.province || '',
    city: userInfo.city || '',
    language: userInfo.language || ''
  };
}

function sanitizeUser(doc, openid) {
  return {
    _id: doc?._id,
    openid,
    nickName: doc?.nickName || '',
    avatarUrl: doc?.avatarUrl || '',
    gender: doc?.gender ?? null,
    country: doc?.country || '',
    province: doc?.province || '',
    city: doc?.city || '',
    language: doc?.language || '',
    totalSpace: doc?.totalSpace ?? DEFAULT_TOTAL_SPACE,
    usedSpace: doc?.usedSpace ?? 0,
    createdAt: doc?.createdAt || null,
    updatedAt: doc?.updatedAt || null
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const userInfo = pickUserInfo(event?.userInfo);

  if (!OPENID) {
    return {
      success: false,
      error: 'OPENID not found'
    };
  }

  if (!userInfo.nickName || !userInfo.avatarUrl) {
    return {
      success: false,
      error: 'INVALID_USER_INFO'
    };
  }

  try {
    const existing = await users.where({ openid: OPENID }).limit(1).get();
    const doc = existing.data?.[0];
    const now = db.serverDate();

    if (!doc) {
      const createResult = await users.add({
        data: {
          openid: OPENID,
          ...userInfo,
          totalSpace: DEFAULT_TOTAL_SPACE,
          usedSpace: 0,
          createdAt: now,
          updatedAt: now
        }
      });

      return {
        success: true,
        user: sanitizeUser(
          {
            _id: createResult._id,
            openid: OPENID,
            ...userInfo,
            totalSpace: DEFAULT_TOTAL_SPACE,
            usedSpace: 0
          },
          OPENID
        )
      };
    }

    await users.doc(doc._id).update({
      data: {
        ...userInfo,
        updatedAt: now
      }
    });

    return {
      success: true,
      user: sanitizeUser(
        {
          ...doc,
          ...userInfo,
          updatedAt: now
        },
        OPENID
      )
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
};
