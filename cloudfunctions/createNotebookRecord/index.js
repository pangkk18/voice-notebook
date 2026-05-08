const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const DAILY_RECORD_LIMIT = 3;
const MAX_RECORD_SECONDS = 10 * 60;
const CHINA_TIME_OFFSET = 8 * 60 * 60 * 1000;

function getChinaDayRange(date = new Date()) {
  const chinaNow = new Date(date.getTime() + CHINA_TIME_OFFSET);
  const year = chinaNow.getUTCFullYear();
  const month = chinaNow.getUTCMonth();
  const day = chinaNow.getUTCDate();
  const start = new Date(Date.UTC(year, month, day) - CHINA_TIME_OFFSET);
  const end = new Date(Date.UTC(year, month, day + 1) - CHINA_TIME_OFFSET);

  return { start, end };
}

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
    const normalizedDuration = Number(duration) || 0;
    if (normalizedDuration > MAX_RECORD_SECONDS) {
      return {
        success: false,
        error: '单条录音最长10分钟'
      };
    }

    const { start, end } = getChinaDayRange();
    const todayCountRes = await db
      .collection('notebook')
      .where({
        openid: OPENID,
        create_time: _.gte(start).and(_.lt(end))
      })
      .count();

    if ((todayCountRes.total || 0) >= DAILY_RECORD_LIMIT) {
      return {
        success: false,
        error: '今天最多录制3条'
      };
    }

    const result = await db.collection('notebook').add({
      data: {
        name,
        duration: normalizedDuration,
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
