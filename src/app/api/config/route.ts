import { NextResponse } from 'next/server';
import { serverEncrypt } from '@/lib/cryptoServer';

export async function GET() {
  try {
    const password = process.env.APP_PASSWORD;
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    if (!password || !token || !owner || !repo) {
      return NextResponse.json({ success: false, message: 'Configuration missing' }, { status: 500 });
    }

    const config = { token, owner, repo };
    // 使用 APP_PASSWORD 加密配置，这样在网络传输中也是安全的
    const encryptedConfig = serverEncrypt(JSON.stringify(config), password);

    return NextResponse.json({ success: true, data: encryptedConfig });
  } catch {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
