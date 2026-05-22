import { S3Client } from "@aws-sdk/client-s3";

/**
 * Server-only Cloudflare R2 client (S3-compatible API).
 *
 * R2 was chosen over Supabase Storage for proctoring recordings because:
 *   - Zero egress fees (recruiter playback doesn't accrue bandwidth cost)
 *   - 10 GB free tier; ~$0.015/GB-month beyond
 *   - Native lifecycle rules for 90-day TTL (configured via dashboard)
 *
 * Endpoint format: https://<account_id>.r2.cloudflarestorage.com
 * Region must be "auto" for R2.
 *
 * Required env:
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME       (e.g. "proctoring")
 */
let cachedClient: S3Client | null = null;

export function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 env vars missing (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)",
    );
  }

  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return cachedClient;
}

export function getR2BucketName(): string {
  const name = process.env.R2_BUCKET_NAME;
  if (!name) throw new Error("R2_BUCKET_NAME env var missing");

  return name;
}
