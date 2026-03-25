const cloud = require('wx-server-sdk');
const CloudBaseManager = require('@cloudbase/manager-node');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const users = db.collection('users');
const DEFAULT_TOTAL_SPACE = 1024 * 1024 * 1024;
const STORAGE_SECRET_ID = process.env.CLOUDBASE_SECRETID || '';
const STORAGE_SECRET_KEY = process.env.CLOUDBASE_SECRETKEY || '';
const STORAGE_ENV_ID = process.env.CLOUDBASE_ENV_ID || cloud.DYNAMIC_CURRENT_ENV;

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

function createStorageManager() {
  if (!STORAGE_SECRET_ID || !STORAGE_SECRET_KEY) {
    throw new Error('MISSING_STORAGE_MANAGER_CREDENTIALS');
  }

  const app = new CloudBaseManager({
    secretId: STORAGE_SECRET_ID,
    secretKey: STORAGE_SECRET_KEY,
    envId: STORAGE_ENV_ID
  });

  return app.storage;
}

function normalizeStorageFiles(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.Files)) {
    return result.Files;
  }

  if (Array.isArray(result?.files)) {
    return result.files;
  }

  if (Array.isArray(result?.fileList)) {
    return result.fileList;
  }

  return [];
}

function getFilePath(file) {
  return String(file?.Key || file?.key || file?.cloudPath || file?.path || '');
}

function getFileSize(file) {
  const raw = file?.Size ?? file?.size ?? file?.Length ?? 0;
  return Number(raw) || 0;
}

function shouldCountFile(openid, file) {
  const filePath = getFilePath(file);

  if (!filePath) {
    return false;
  }

  if (filePath === `${openid}/.init` || filePath.endsWith('/.init')) {
    return false;
  }

  return true;
}

async function calculateUserStorageUsage(openid) {
  const storage = createStorageManager();
  const listResult = await storage.listDirectoryFiles(`${openid}/`);
  const files = normalizeStorageFiles(listResult);

  return files.reduce((total, file) => {
    if (!shouldCountFile(openid, file)) {
      return total;
    }

    return total + getFileSize(file);
  }, 0);
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

    const usedSpace = await calculateUserStorageUsage(OPENID);
    const totalSpace = doc?.totalSpace ?? DEFAULT_TOTAL_SPACE;

    if (doc?._id) {
      await users.doc(doc._id).update({
        data: {
          usedSpace,
          updatedAt: now
        }
      });
    }

    doc = {
      ...doc,
      totalSpace,
      usedSpace,
      updatedAt: now
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
