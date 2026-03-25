import cloudbase from '@cloudbase/js-sdk'
import adapter from '@cloudbase/adapter-uni-app'

// 使用 UniApp 适配器
cloudbase.useAdapters(adapter, { uni: uni });

const RAW_ENV_ID = String(import.meta.env.VITE_CLOUDBASE_ENV_ID || '').trim();
const ENV_ID: string = RAW_ENV_ID;

// 检查环境ID是否已配置
export const isValidEnvId = Boolean(
  ENV_ID &&
  ENV_ID !== 'your env id' &&
  ENV_ID !== '<your-cloudbase-env-id>'
);

// 客户端Publishable Key, 可前往https://tcb.cloud.tencent.com/dev?envId={env}#/env/apikey获取
const PUBLISHABLE_KEY = import.meta.env.VITE_PUBLISHABLE_KEY || "";


/**
 * 初始化云开发实例
 * @param {Object} config - 初始化配置
 * @param {string} config.env - 环境ID，默认使用ENV_ID
 * @param {number} config.timeout - 超时时间，默认15000ms
 * @returns {Object} 云开发实例
 */
export const init = (config: any = {}) => {
  const appConfig = {
    env: config.env || ENV_ID,
    timeout: config.timeout || 15000,
    accessKey: config.accessKey || PUBLISHABLE_KEY,
    auth: { detectSessionInUrl: true },
    // 仅在App端需要配置
    appSign: "your-app-sign",
    appSecret: {
      appAccessKeyId: 1,
      appAccessKey: "your-app-access-key",
    },
  };

  if (!appConfig.accessKey) {
    console.warn("客户端 Publishable Key 未配置");
  }

  return cloudbase.init(appConfig);
};

/**
 * 默认的云开发实例
 */
export const app = init();

let wxCloudInited = false;
const ensureWxCloud = () => {
  if (typeof wx !== "undefined" && wx.cloud && !wxCloudInited) {
    wx.cloud.init({ env: ENV_ID });
    wxCloudInited = true;
  }
};

type CallFunctionParams = {
  name: string;
  data?: Record<string, unknown>;
};

export type NotebookUserProfile = {
  _id?: string;
  openid: string;
  nickName?: string;
  avatarUrl?: string;
  gender?: number;
  country?: string;
  province?: string;
  city?: string;
  language?: string;
  totalSpace?: number;
  usedSpace?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type UserProfilePayload = Pick<
  NotebookUserProfile,
  "nickName" | "avatarUrl" | "gender" | "country" | "province" | "city" | "language"
>;

export async function callCloudFunction<T = any>(params: CallFunctionParams) {
  if (!checkEnvironment()) {
    throw new Error("环境ID未配置");
  }

  if (typeof wx !== "undefined" && wx.cloud && wx.cloud.callFunction) {
    ensureWxCloud();
    const { result } = await wx.cloud.callFunction(params);
    return result as T;
  }

  const { result } = await app.callFunction(params);
  return result as T;
}


/**
 * 云开发认证实例
 */
export const auth = app.auth;

/**
 * 检查环境配置是否有效
 */
export const checkEnvironment = () => {
  if (!isValidEnvId) {
    const message = '❌ 云开发环境ID未配置\n\n请按以下步骤配置：\n1. 在项目根目录创建 .env.local 文件\n2. 添加 VITE_CLOUDBASE_ENV_ID=你的云开发环境ID\n3. 如需客户端密钥，再添加 VITE_PUBLISHABLE_KEY=你的客户端 Publishable Key\n4. 保存后重新运行\n\n获取环境ID：https://console.cloud.tencent.com/tcb';
    console.error(message);
    return false;
  }
  return true;
};


/**
 * 执行登录
 * @returns {Promise} 登录状态
 */
export const login = async () => {
  try {
    // 默认采用匿名登录
    await auth.signInAnonymously();
    // 也可以换成跳转SDK 内置的登录页面，支持账号密码登录/手机号登录/微信登录,目前只支持 web 端，小程序等其他平台请自行实现登录逻辑
    // await auth.toDefaultLoginPage()
  } catch (error) {
    console.error('登录失败:', error);
    throw error;
  }
};

/**
 * 微信小程序手机号一键登录
 * @param phoneCode - 从 getPhoneNumber 事件中获取的动态令牌
 */
export const signInWithPhoneAuth = async (phoneCode: string) => {
  if (!checkEnvironment()) {
    throw new Error('环境ID未配置');
  }

  const { data, error } = await auth.signInWithPhoneAuth({
    phoneCode: phoneCode
  });

  if (error) {
    throw error;
  }

  return data;
};

/**
 * 【新增】微信小程序 OpenID 静默登录
 */
export const signInWithOpenId = async () => {
  if (!checkEnvironment()) {
    throw new Error('环境ID未配置');
  }
  // 直接调用 auth 模块的同名方法
  const { data, error } = await auth.signInWithOpenId({ useWxCloud: true });

  if (error) {
    throw error;
  }

  return data;
};

/**
 * 密码登录
 * @param {string} username - 手机号码（格式：13800000000）/邮箱/用户名
 * @param {string} password - 密码
 * @returns {Promise} 登录状态
 */
export const signInWithPassword = async (username: string, password: string) => {
  // 检查环境配置
  if (!checkEnvironment()) {
    throw new Error('环境ID未配置');
  }

  try {
    let loginType = '';
    let params: Parameters<typeof auth.signInWithPassword>[0] = { password: password }

    // 判断输入类型并格式化
    if (/^1[3-9]\d{9}$/.test(username)) {
      // 中国大陆手机号（11位数字）
      params.phone = username;
      loginType = '手机号';
    }
    else if (/^\+\d{1,3}\s\d{4,20}$/.test(username)) {
      // 已经是国际格式的手机号
      params.phone = username;
      loginType = '手机号';
    }
    else if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(username)) {
      // 邮箱格式
      params.email = username;
      loginType = '邮箱';
    }
    else if (/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      // 用户名格式（3-20位字母、数字、下划线）
      params.username = username;
      loginType = '用户名';
    }
    else {
      // 格式不符合任何规则，但仍然尝试登录（可能是其他格式的用户名）
      params.username = username;
      loginType = '用户名';
    }

    const { data, error } = await auth.signInWithPassword(params);

    console.log(!error ? `${loginType}密码登录成功` : `${loginType}密码登录失败`);

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    throw error;
  }
};


type SignInWithOAuthRes = Awaited<ReturnType<typeof auth.signInWithOtp>>
type SignInWithOAuthReq = Parameters<typeof auth.signInWithOtp>[0]
/**
 * 使用一次性密码（OTP）进行登录验证，支持邮箱和手机号验证
 * @param {SignInWithOAuthReq} params - 登录参数
 * @returns {Promise} 验证信息
 */
export const signInWithOtp = async (params: SignInWithOAuthReq): Promise<SignInWithOAuthRes['data']['verifyOtp'] | SignInWithOAuthRes['error']> => {
  // 检查环境配置
  if (!checkEnvironment()) {
    throw new Error('环境ID未配置');
  }

  try {
    const { data, error } = await auth.signInWithOtp(params);
    if (error) {
      throw error;
    }
    console.log('验证码发送成功');
    return data.verifyOtp;
  } catch (error) {
    console.error('获取验证码失败:', error);
    throw error;
  }
};

/**
 * 检查用户登录态
 * @returns {Promise} 登录状态
 */
export const checkLogin = async () => {
  // 检查环境配置
  if (!checkEnvironment()) {
    throw new Error('环境ID未配置');
  }

  try {
    // 检查当前登录状态
    let { data } = await auth.getSession();

    if (data.session) {
      console.log("用户已登录");

      return !!data.session;
    } else {
      throw new Error("用户未登录");
    }
  } catch (error) {
    console.warn(error);

    let { data } = await auth.getClaims();

    if (data.claims?.sub === "anon") {
      console.log("将使用 Publishable Key 进行访问");
    }

    return false;
  }
};

/**
 * 初始化云开发
 */
export async function initCloudBase() {
  try {
    await checkLogin();
    console.log('云开发初始化成功');
    return true;
  } catch (error) {
    console.error('云开发初始化失败:', error);
    return false;
  }
}

/**
 * 调用 initUser 云函数初始化用户数据
 */
export async function initUser() {
  try {
    return await callCloudFunction({ name: "initUser", data: {} });
  } catch (error) {
    console.error('调用 initUser 云函数失败:', error);
    throw error;
  }
}

/**
 * 获取当前小程序用户资料
 */
export async function getUserProfile() {
  try {
    return await callCloudFunction<{ success: boolean; user?: NotebookUserProfile; error?: string }>({
      name: "getUserProfile",
      data: {}
    });
  } catch (error) {
    console.error('调用 getUserProfile 云函数失败:', error);
    throw error;
  }
}

/**
 * 使用微信授权资料更新当前用户信息
 */
export async function upsertUserProfile(userInfo: UserProfilePayload) {
  try {
    return await callCloudFunction<{ success: boolean; user?: NotebookUserProfile; error?: string }>({
      name: "upsertUserProfile",
      data: { userInfo }
    });
  } catch (error) {
    console.error('调用 upsertUserProfile 云函数失败:', error);
    throw error;
  }
}

/**
 * 退出登录
 * @returns {Promise}
 */
export const logout = async () => {
  try {
    await auth.signOut();
    return { success: true, message: '已成功退出登录' };
  } catch (error) {
    console.error('退出登录失败:', error);
    throw error;
  }
};

// 默认导出
export default {
  init,
  app,
  checkLogin,
  login,
  logout,
  checkEnvironment,
  isValidEnvId,
  initCloudBase,
  callCloudFunction,
  initUser,
  getUserProfile,
  signInWithOtp,
  signInWithPassword,
  signInWithPhoneAuth,
  signInWithOpenId,
  upsertUserProfile
};
