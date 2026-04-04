const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const users = db.collection('users');
const DEFAULT_TOTAL_SPACE = 1024 * 1024 * 1024;

function sanitizeUser(doc, openid) {
  return {
    _id: doc?._id,
    openid,
    nickName: doc?.nickName || '',
    avatarUrl: doc?.avatarUrl || '',
    avatarFileID: doc?.avatarFileID || '',
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

async function resolveAvatarUrl(doc) {
  const avatarFileID = doc?.avatarFileID || '';
  const rawAvatarUrl = doc?.avatarUrl || '';
  const fileID = avatarFileID || (String(rawAvatarUrl).startsWith('cloud://') ? rawAvatarUrl : '');

  if (!fileID) {
    return String(rawAvatarUrl).startsWith('wxfile://') ? '' : rawAvatarUrl;
  }

  try {
    const result = await cloud.getTempFileURL({
      fileList: [{ fileID, maxAge: 3600 }]
    });
    return result?.fileList?.[0]?.tempFileURL || '';
  } catch (error) {
    console.warn('resolve avatar temp url failed:', error);
    return '';
  }
}

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return {
      success: false,
      error: 'OPENID not found'
    };
  }

  try {
    const existing = await users.where({ openid: OPENID }).limit(1).get();
    let doc = existing.data?.[0];
    const now = db.serverDate();

    if (!doc) {
      const createResult = await users.add({
        data: {
          openid: OPENID,
          totalSpace: DEFAULT_TOTAL_SPACE,
          usedSpace: 0,
          createdAt: now,
          updatedAt: now
        }
      });

      doc = {
        _id: createResult._id,
        openid: OPENID,
        totalSpace: DEFAULT_TOTAL_SPACE,
        usedSpace: 0
      };
    }

    const avatarUrl = await resolveAvatarUrl(doc);

    doc = {
      ...doc,
      avatarUrl,
      totalSpace: doc?.totalSpace ?? DEFAULT_TOTAL_SPACE,
      usedSpace: doc?.usedSpace ?? 0
    };

    return {
      success: true,
      user: sanitizeUser(doc, OPENID)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
};
