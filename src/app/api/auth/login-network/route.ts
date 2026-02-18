import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import { isIP } from 'net';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function firstIpFromHeader(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  return first || null;
}

function expandIpv6(address: string): string[] | null {
  const clean = address.toLowerCase().split('%')[0];
  const parts = clean.split('::');
  if (parts.length > 2) return null;

  const left = parts[0] ? parts[0].split(':').filter(Boolean) : [];
  const right = parts[1] ? parts[1].split(':').filter(Boolean) : [];

  const missing = 8 - (left.length + right.length);
  if (missing < 0) return null;

  const full = [...left, ...Array(missing).fill('0'), ...right];
  if (full.length !== 8) return null;

  return full.map((group) => group.padStart(4, '0'));
}

function normalizeIpForPrivacy(ip: string): string {
  const version = isIP(ip);
  if (version === 4) {
    const octets = ip.split('.');
    if (octets.length !== 4) return 'unknown';
    return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
  }

  if (version === 6) {
    const expanded = expandIpv6(ip);
    if (!expanded) return 'unknown';
    return `${expanded.slice(0, 4).join(':')}::/64`;
  }

  return 'unknown';
}

function getClientIp(req: NextRequest): string {
  const fromForwarded = firstIpFromHeader(req.headers.get('x-forwarded-for'));
  if (fromForwarded) return fromForwarded;
  const fromReal = req.headers.get('x-real-ip');
  if (fromReal) return fromReal;
  const fromCloudflare = req.headers.get('cf-connecting-ip');
  if (fromCloudflare) return fromCloudflare;
  return 'unknown';
}

export async function POST(req: NextRequest) {
  const hmacSecret = process.env.LOGIN_NETWORK_HMAC_SECRET;
  if (!hmacSecret) {
    // Skip silently when secret is not configured.
    return NextResponse.json({ skipped: true }, { status: 202 });
  }

  const cookieClient = await createClient();
  let authedClient: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createSupabaseClient> = cookieClient;
  let userId: string | null = null;

  const cookieUserRes = await cookieClient.auth.getUser();
  if (cookieUserRes.data.user) {
    userId = cookieUserRes.data.user.id;
  }

  if (!userId) {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bearerClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const bearerUserRes = await bearerClient.auth.getUser();
    if (!bearerUserRes.data.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    userId = bearerUserRes.data.user.id;
    authedClient = bearerClient;
  }

  const normalizedNetwork = normalizeIpForPrivacy(getClientIp(req));
  const fingerprint = createHmac('sha256', hmacSecret)
    .update(`${userId}:${normalizedNetwork}`)
    .digest('hex');

  const { error } = await authedClient.rpc('track_login_network', {
    target_user_id: userId,
    fingerprint,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
