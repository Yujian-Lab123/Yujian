import { NextResponse } from 'next/server';
import { credentialDiagnostics, credentialWarnings, lastOAuthDebug, zhihuConfigured } from '@/lib/providers/zhihu';

// 部署联调诊断（脱敏）：只输出长度/sha256 前缀，绝不输出完整密钥、授权码或 Token。
export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: zhihuConfigured(),
    diagnostics: credentialDiagnostics(),
    warnings: credentialWarnings(),
    lastOAuthDebug,
  });
}
