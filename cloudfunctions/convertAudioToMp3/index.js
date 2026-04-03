const cloud = require('wx-server-sdk');
const fs = require('fs');
const path = require('path');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const TEMP_DIR = '/tmp';
const PREVIEW_CODEC = {
  sampleRate: 24000,
  bitrate: '40k'
};
const FULL_CODEC = {
  sampleRate: 44100,
  bitrate: '80k'
};

/**
 * WAV 转 M4A 预览/正式播放资源
 * @param {string} fileID - 云存储文件 ID
 * @param {string} cloudPath - 云存储路径
 * @param {string} recordId - 录音记录 ID
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { fileID, cloudPath, recordId, openid } = event || {};
  const ownerOpenId = openid || OPENID || extractOpenIdFromCloudPath(cloudPath);

  if (!fileID || !cloudPath || !recordId) {
    return {
      success: false,
      error: 'fileID, cloudPath, and recordId are required'
    };
  }
  if (!ownerOpenId) {
    return {
      success: false,
      error: 'OPENID not found in event/open context/cloudPath'
    };
  }

  console.log('Starting audio conversion:', { fileID, cloudPath, recordId });

  try {
    const ffmpegPath = resolveBinaryPath(
      process.env.FFMPEG_PATH,
      ['ffmpeg', '/opt/bin/ffmpeg', '/opt/ffmpeg', '/opt/ffmpeg/bin/ffmpeg'],
      'ffmpeg'
    );
    const ffprobePath = resolveBinaryPath(
      process.env.FFPROBE_PATH,
      ['ffprobe', '/opt/bin/ffprobe', '/opt/ffprobe', '/opt/ffmpeg/bin/ffprobe'],
      'ffprobe'
    );

    // 1. 下载 WAV 文件
    const downloadResult = await cloud.downloadFile({
      fileID
    });

    const tempWavPath = path.join(TEMP_DIR, `${recordId}.wav`);
    const tempPreviewPath = path.join(TEMP_DIR, `${recordId}_preview.m4a`);
    const tempFullPath = path.join(TEMP_DIR, `${recordId}_full.m4a`);

    // 将文件保存到临时目录
    const { fileContent } = downloadResult;
    fs.writeFileSync(tempWavPath, fileContent);
    console.log('WAV file downloaded to:', tempWavPath);

    // 2. 获取音频信息
    const audioInfo = await getAudioInfo(tempWavPath, ffprobePath);
    console.log('Audio info:', audioInfo);

    // 3. 生成 preview/full m4a
    await convertToM4a(tempWavPath, tempPreviewPath, ffmpegPath, PREVIEW_CODEC);
    await convertToM4a(tempWavPath, tempFullPath, ffmpegPath, FULL_CODEC);
    console.log('M4A conversion completed:', {
      tempPreviewPath,
      tempFullPath
    });

    // 4. 上传 preview/full m4a
    const baseName = path.basename(cloudPath, '.wav');
    const previewM4aCloudPath = `${ownerOpenId}/preview/${baseName}.m4a`;
    const fullM4aCloudPath = `${ownerOpenId}/full/${baseName}.m4a`;

    const previewUploadResult = await cloud.uploadFile({
      cloudPath: previewM4aCloudPath,
      fileContent: fs.readFileSync(tempPreviewPath)
    });
    const fullUploadResult = await cloud.uploadFile({
      cloudPath: fullM4aCloudPath,
      fileContent: fs.readFileSync(tempFullPath)
    });

    const previewM4aFileID = previewUploadResult.fileID;
    const fullM4aFileID = fullUploadResult.fileID;
    console.log('M4A uploaded:', {
      previewM4aCloudPath,
      fullM4aCloudPath,
      previewM4aFileID,
      fullM4aFileID
    });

    // 5. 更新数据库记录
    await db.collection('notebook').doc(recordId).update({
      data: {
        previewM4aFileID,
        previewM4aCloudPath,
        fullM4aFileID,
        fullM4aCloudPath,
        conversion_status: 'completed',
        conversion_error: '',
        conversion_time: db.serverDate(),
        audio_info: audioInfo
      }
    });
    console.log('Database updated:', recordId);

    // 6. 清理临时文件
    try {
      fs.unlinkSync(tempWavPath);
      fs.unlinkSync(tempPreviewPath);
      fs.unlinkSync(tempFullPath);
      console.log('Temp files cleaned');
    } catch (err) {
      console.warn('Failed to clean temp files:', err);
    }

    return {
      success: true,
      previewM4aFileID,
      previewM4aCloudPath,
      fullM4aFileID,
      fullM4aCloudPath,
      audioInfo
    };

  } catch (error) {
    console.error('Conversion failed:', error);

    // 更新转换状态为失败
    try {
      await db.collection('notebook').doc(recordId).update({
        data: {
          conversion_status: 'failed',
          conversion_error: error.message || String(error)
        }
      });
    } catch (updateErr) {
      console.error('Failed to update status:', updateErr);
    }

    return {
      success: false,
      error: error.message || String(error)
    };
  }
};

/**
 * 使用 ffprobe 获取音频信息
 */
async function getAudioInfo(filePath, ffprobePath) {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    const cmd = `"${ffprobePath}" -v quiet -print_format json -show_format -show_streams "${filePath}"`;

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn('Failed to get audio info:', error.message);
        resolve({}); // 返回空对象，不阻塞转换流程
        return;
      }

      try {
        const info = JSON.parse(stdout);
        const stream = info.streams?.[0] || {};
        const format = info.format || {};

        resolve({
          duration: format.duration ? Math.round(format.duration) : 0,
          bitrate: format.bit_rate ? Math.round(format.bit_rate) : 0,
          sample_rate: stream.sample_rate || 16000,
          channels: stream.channels || 1,
          codec: stream.codec_name || 'unknown'
        });
      } catch (parseErr) {
        console.warn('Failed to parse audio info:', parseErr);
        resolve({});
      }
    });
  });
}

function extractOpenIdFromCloudPath(cloudPath) {
  if (!cloudPath || typeof cloudPath !== 'string') return '';
  const seg = cloudPath.split('/').filter(Boolean);
  return seg[0] || '';
}

/**
 * 使用 ffmpeg 转换为 M4A，支持 preview/full 两套配置
 */
async function convertToM4a(inputPath, outputPath, ffmpegPath, codec) {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    const cmd = `"${ffmpegPath}" -i "${inputPath}" -c:a aac -b:a ${codec.bitrate} -ar ${codec.sampleRate} -ac 1 -movflags +faststart -y "${outputPath}"`;

    console.log('Executing ffmpeg m4a command...', { outputPath, codec });

    exec(cmd, {
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('FFmpeg error:', stderr);
        reject(new Error(`FFmpeg m4a conversion failed: ${stderr}`));
        return;
      }
      resolve();
    });
  });
}

function resolveBinaryPath(envPath, candidates, binaryName) {
  const all = [envPath, ...candidates].filter(Boolean);
  const { execSync } = require('child_process');

  for (const p of all) {
    if (p.includes('/')) {
      if (fs.existsSync(p)) return p;
      continue;
    }
    try {
      const found = execSync(`which ${p}`, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
      if (found) return found;
    } catch (e) {
      // continue
    }
  }
  try {
    const foundInOpt = execSync(
      `find /opt -type f -name ${binaryName} 2>/dev/null | head -n 1`,
      { stdio: ['ignore', 'pipe', 'ignore'] }
    ).toString().trim();
    if (foundInOpt) return foundInOpt;
  } catch (e) {
    // continue
  }
  throw new Error(`Binary not found. Tried: ${all.join(', ')}`);
}

function cleanupDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  for (const name of fs.readdirSync(dirPath)) {
    fs.unlinkSync(path.join(dirPath, name));
  }
  fs.rmdirSync(dirPath);
}
