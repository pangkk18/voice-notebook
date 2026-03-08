const cloud = require('wx-server-sdk');
const fs = require('fs');
const path = require('path');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const TEMP_DIR = '/tmp';

/**
 * WAV 转 MP3 云函数
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
    const tempMp3Path = path.join(TEMP_DIR, `${recordId}.mp3`);

    // 将文件保存到临时目录
    const { fileContent } = downloadResult;
    fs.writeFileSync(tempWavPath, fileContent);
    console.log('WAV file downloaded to:', tempWavPath);

    // 2. 获取音频信息
    const audioInfo = await getAudioInfo(tempWavPath, ffprobePath);
    console.log('Audio info:', audioInfo);

    // 3. 转换为 MP3
    await convertToMp3(tempWavPath, tempMp3Path, ffmpegPath);
    console.log('Conversion completed:', tempMp3Path);

    // 3.1 转换为 HLS (m3u8 + ts)
    const hlsDir = path.join(TEMP_DIR, `${recordId}_hls`);
    ensureDir(hlsDir);
    const hlsIndexPath = path.join(hlsDir, 'index.m3u8');
    await convertToHls(tempWavPath, hlsIndexPath, ffmpegPath);
    console.log('HLS conversion completed:', hlsIndexPath);

    // 4. 上传 MP3 文件
    const mp3FileName = path.basename(cloudPath, '.wav') + '.mp3';
    const mp3CloudPath = `${ownerOpenId}/mp3/${mp3FileName}`;

    const uploadResult = await cloud.uploadFile({
      cloudPath: mp3CloudPath,
      fileContent: fs.readFileSync(tempMp3Path)
    });

    const mp3FileID = uploadResult.fileID;
    console.log('MP3 uploaded:', { mp3CloudPath, mp3FileID });

    // 4.1 上传 HLS 文件
    const hlsFolderName = path.basename(cloudPath, '.wav');
    const hlsCloudDir = `${ownerOpenId}/hls/${hlsFolderName}`;
    const hlsUploadResult = await uploadHlsDirectory(hlsDir, hlsCloudDir);
    console.log('HLS uploaded:', hlsUploadResult);

    // 5. 更新数据库记录
    await db.collection('notebook').doc(recordId).update({
      data: {
        mp3FileID,
        mp3CloudPath,
        m3u8FileID: hlsUploadResult.m3u8FileID,
        m3u8CloudPath: hlsUploadResult.m3u8CloudPath,
        hlsSegmentCloudPaths: hlsUploadResult.segmentCloudPaths,
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
      fs.unlinkSync(tempMp3Path);
      cleanupDir(path.join(TEMP_DIR, `${recordId}_hls`));
      console.log('Temp files cleaned');
    } catch (err) {
      console.warn('Failed to clean temp files:', err);
    }

    return {
      success: true,
      mp3FileID,
      mp3CloudPath,
      m3u8FileID: hlsUploadResult.m3u8FileID,
      m3u8CloudPath: hlsUploadResult.m3u8CloudPath,
      hlsSegmentCloudPaths: hlsUploadResult.segmentCloudPaths,
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
 * 使用 ffmpeg 转换为 MP3
 */
async function convertToMp3(inputPath, outputPath, ffmpegPath) {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');

    // ffmpeg 命令参数说明:
    // -i: 输入文件
    // -codec:a libmp3lame: 使用 mp3 编码器
    // -b:a 128k: 音频比特率 128kbps (质量较好的平衡值)
    // -ar 44100: 采样率 44.1kHz (MP3 标准)
    // -ac 2: 双声道
    // -y: 覆盖输出文件
    const cmd = `"${ffmpegPath}" -i "${inputPath}" -codec:a libmp3lame -b:a 128k -ar 44100 -ac 2 -y "${outputPath}"`;

    console.log('Executing ffmpeg command...');

    exec(cmd, {
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('FFmpeg error:', stderr);
        reject(new Error(`FFmpeg conversion failed: ${stderr}`));
        return;
      }

      console.log('FFmpeg output:', stderr); // ffmpeg 输出到 stderr
      resolve();
    });
  });
}

async function convertToHls(inputPath, hlsIndexPath, ffmpegPath) {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    const segmentPattern = path.join(path.dirname(hlsIndexPath), 'segment_%03d.ts');
    const cmd = `"${ffmpegPath}" -i "${inputPath}" -c:a aac -b:a 128k -ar 44100 -ac 2 -f hls -hls_time 6 -hls_list_size 0 -hls_segment_filename "${segmentPattern}" -y "${hlsIndexPath}"`;

    console.log('Executing HLS ffmpeg command...');
    exec(cmd, {
      maxBuffer: 50 * 1024 * 1024
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('HLS FFmpeg error:', stderr);
        reject(new Error(`HLS conversion failed: ${stderr}`));
        return;
      }
      resolve();
    });
  });
}

async function uploadHlsDirectory(localDir, cloudDir) {
  const files = fs.readdirSync(localDir).filter((name) => name.endsWith('.m3u8') || name.endsWith('.ts'));
  files.sort();

  if (!files.length) {
    throw new Error(`No HLS files found in ${localDir}`);
  }

  let m3u8FileID = '';
  let m3u8CloudPath = '';
  const segmentCloudPaths = [];

  for (const name of files) {
    const localPath = path.join(localDir, name);
    const cloudPath = `${cloudDir}/${name}`;
    const uploaded = await cloud.uploadFile({
      cloudPath,
      fileContent: fs.readFileSync(localPath)
    });

    if (name.endsWith('.m3u8')) {
      m3u8FileID = uploaded.fileID;
      m3u8CloudPath = cloudPath;
    } else if (name.endsWith('.ts')) {
      segmentCloudPaths.push(cloudPath);
    }
  }

  if (!m3u8FileID) {
    throw new Error('HLS upload completed but m3u8 file missing');
  }

  return {
    m3u8FileID,
    m3u8CloudPath,
    segmentCloudPaths
  };
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

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function cleanupDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  for (const name of fs.readdirSync(dirPath)) {
    fs.unlinkSync(path.join(dirPath, name));
  }
  fs.rmdirSync(dirPath);
}
