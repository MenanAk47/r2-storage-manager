require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const mime = require('mime-types');
const archiver = require('archiver');
const rateLimit = require('express-rate-limit');
const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Upload } = require('@aws-sdk/lib-storage');
const busboy = require('busboy');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxies (Cloudflare, Nginx, Caddy, Traefik, Docker)
app.set('trust proxy', 1);

// Automatic Session Secret (Zero-Config Security)
const SESSION_SECRET = (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim())
  ? process.env.SESSION_SECRET
  : crypto.randomBytes(32).toString('hex');

if (!process.env.SESSION_SECRET) {
  console.log('[SECURITY] SESSION_SECRET not defined in .env - generated secure dynamic secret for this runtime session.');
}

// Master Dashboard Password
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin';
if (DASHBOARD_PASSWORD === 'admin') {
  console.warn('[SECURITY WARNING] DASHBOARD_PASSWORD is set to default "admin". Please change this in your .env file for production use.');
}

// Body & Cookie Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser(SESSION_SECRET));

// -----------------------------------------------------------------------------
// Rate Limiting (Brute-Force & Flood Defense)
// -----------------------------------------------------------------------------
// Strict limiter for login attempts (10 attempts per 15 minutes per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please wait 15 minutes before trying again.',
  },
});

// General API protection (500 requests per minute)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
  },
});

app.use('/api/', apiLimiter);

// -----------------------------------------------------------------------------
// Cloudflare R2 Client Initialization
// -----------------------------------------------------------------------------
const requiredEnv = ['CLOUDFLARE_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
const missingEnv = requiredEnv.filter((key) => !process.env[key] || !process.env[key].trim());
if (missingEnv.length > 0) {
  console.warn(`\n[CONFIGURATION ALERT] Missing environment variables: ${missingEnv.join(', ')}.`);
  console.warn(`Please fill in your Cloudflare R2 credentials in the '.env' file or container environment.\n`);
}

const jurisdiction = process.env.R2_JURISDICTION ? `${process.env.R2_JURISDICTION}.` : '';
const endpoint = process.env.CLOUDFLARE_ACCOUNT_ID
  ? `https://${process.env.CLOUDFLARE_ACCOUNT_ID.trim()}.${jurisdiction}r2.cloudflarestorage.com`
  : undefined;

const s3 = new S3Client({
  region: 'auto',
  endpoint: endpoint,
  credentials: {
    accessKeyId: (process.env.R2_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY || '').trim(),
  },
});

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

// Helper: Build Public CDN Direct URL
function getDirectUrl(key) {
  const publicBase = process.env.R2_PUBLIC_URL ? process.env.R2_PUBLIC_URL.trim().replace(/\/$/, '') : '';
  if (!publicBase) return '';
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${publicBase}/${encodedKey}`;
}

// Helper: Format S3 CopySource safely
function formatCopySource(bucket, key) {
  const encodedKey = key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `${encodeURIComponent(bucket)}/${encodedKey}`;
}

// Helper: Normalize directory prefix
function normalizePrefix(prefix) {
  if (!prefix) return '';
  let clean = prefix.replace(/^\/+/, '');
  if (clean && !clean.endsWith('/')) {
    clean += '/';
  }
  return clean;
}

// Helper: Timing-Safe Password Verification
function verifyPassword(inputPassword, expectedPassword) {
  if (!inputPassword || !expectedPassword) return false;
  const hashInput = crypto.createHash('sha256').update(String(inputPassword)).digest();
  const hashExpected = crypto.createHash('sha256').update(String(expectedPassword)).digest();
  return crypto.timingSafeEqual(hashInput, hashExpected);
}

// Helper: Auth Token Generator
function getAuthToken() {
  return crypto.createHmac('sha256', SESSION_SECRET).update(DASHBOARD_PASSWORD).digest('hex');
}

// Helper: S3 Error Diagnostic Translator
function diagnoseS3Error(err) {
  const name = err.name || '';
  const code = err.Code || err.code || '';
  const message = err.message || '';

  if (name === 'InvalidAccessKeyId' || code === 'InvalidAccessKeyId') {
    return {
      title: 'Invalid R2 Access Key ID',
      solution: 'Check that R2_ACCESS_KEY_ID in your .env matches the Access Key created in your Cloudflare Dashboard.',
    };
  }
  if (name === 'SignatureDoesNotMatch' || code === 'SignatureDoesNotMatch') {
    return {
      title: 'Invalid R2 Secret Access Key',
      solution: 'Your R2_SECRET_ACCESS_KEY appears incorrect. Please re-check or generate a new API token in Cloudflare.',
    };
  }
  if (name === 'NoSuchBucket' || code === 'NoSuchBucket') {
    return {
      title: `Bucket "${process.env.R2_BUCKET_NAME}" Not Found`,
      solution: 'Verify the exact spelling of R2_BUCKET_NAME in your .env, or create this bucket in the Cloudflare R2 dashboard.',
    };
  }
  if (name === 'AccessDenied' || code === 'AccessDenied' || err.$metadata?.httpStatusCode === 403) {
    return {
      title: 'Access Denied / Insufficient Permissions',
      solution: 'Ensure your Cloudflare R2 API Token was created with "Object Read & Write" (or Admin) permissions for this bucket.',
    };
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || message.includes('fetch failed')) {
    return {
      title: 'Cannot Reach Cloudflare Endpoint',
      solution: 'Verify your CLOUDFLARE_ACCOUNT_ID is correct and that your internet/network allows outbound HTTPS connections.',
    };
  }

  return {
    title: 'Cloudflare R2 Connection Error',
    solution: message || 'Please check your .env credentials and Cloudflare R2 status.',
  };
}

// -----------------------------------------------------------------------------
// Authentication Middleware
// -----------------------------------------------------------------------------
function requireAuth(req, res, next) {
  const token = req.signedCookies.auth_token;
  if (token && token === getAuthToken()) {
    return next();
  }

  if (req.path.startsWith('/api/') || req.path === '/upload') {
    return res.status(401).json({ success: false, message: 'Unauthorized. Please login.' });
  }

  return res.redirect('/login.html');
}

// -----------------------------------------------------------------------------
// Static Frontend Assets
// -----------------------------------------------------------------------------
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// -----------------------------------------------------------------------------
// Authentication Endpoints
// -----------------------------------------------------------------------------
app.post('/api/login', loginLimiter, (req, res) => {
  const { password } = req.body;

  if (!password || !verifyPassword(password, DASHBOARD_PASSWORD)) {
    return res.status(401).json({ success: false, message: 'Invalid password. Please try again.' });
  }

  const isSecureConnection = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';

  res.cookie('auth_token', getAuthToken(), {
    httpOnly: true,
    signed: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
    secure: isSecureConnection,
  });

  return res.json({ success: true, message: 'Authenticated successfully' });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('auth_token');
  return res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/status', (req, res) => {
  const token = req.signedCookies.auth_token;
  const isAuthenticated = Boolean(token && token === getAuthToken());
  return res.json({
    authenticated: isAuthenticated,
    bucketName: process.env.R2_BUCKET_NAME || 'Not configured',
    hasPublicUrl: Boolean(process.env.R2_PUBLIC_URL),
    jurisdiction: process.env.R2_JURISDICTION || 'global',
    missingConfig: missingEnv.length > 0 ? missingEnv : null,
  });
});

// Diagnostic connection test endpoint
app.get('/api/diagnostics', requireAuth, async (req, res) => {
  if (missingEnv.length > 0) {
    return res.status(400).json({
      success: false,
      healthy: false,
      title: 'Missing Required Configuration',
      solution: `Please configure the following environment variable(s): ${missingEnv.join(', ')}.`,
      missingEnv,
    });
  }

  try {
    // Attempt a lightweight head request to test connectivity and permissions
    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      MaxKeys: 1,
    });
    await s3.send(command);

    return res.json({
      success: true,
      healthy: true,
      bucketName: process.env.R2_BUCKET_NAME,
      jurisdiction: process.env.R2_JURISDICTION || 'global',
      message: 'Cloudflare R2 connection is healthy and verified!',
    });
  } catch (err) {
    const diagnostic = diagnoseS3Error(err);
    return res.status(500).json({
      success: false,
      healthy: false,
      title: diagnostic.title,
      solution: diagnostic.solution,
      rawError: err.message,
    });
  }
});

// Protected App Dashboard Root
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -----------------------------------------------------------------------------
// Storage & Bucket Statistics
// -----------------------------------------------------------------------------
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    let totalFiles = 0;
    let totalSize = 0;
    let isTruncated = true;
    let continuationToken = undefined;
    let iterations = 0;

    while (isTruncated && iterations < 10) {
      iterations++;
      const command = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const response = await s3.send(command);
      const contents = response.Contents || [];
      for (const item of contents) {
        if (!item.Key.endsWith('/')) {
          totalFiles++;
          totalSize += item.Size || 0;
        }
      }

      isTruncated = Boolean(response.IsTruncated);
      continuationToken = response.NextContinuationToken;
    }

    res.json({
      success: true,
      stats: {
        bucketName: process.env.R2_BUCKET_NAME,
        jurisdiction: process.env.R2_JURISDICTION || 'global',
        totalFiles,
        totalSize,
        hasPublicUrl: Boolean(process.env.R2_PUBLIC_URL),
        publicBaseUrl: process.env.R2_PUBLIC_URL || '',
      },
    });
  } catch (err) {
    console.error('Error fetching bucket stats:', err);
    const diagnostic = diagnoseS3Error(err);
    res.status(500).json({
      success: false,
      message: diagnostic.solution,
      diagnosticTitle: diagnostic.title,
    });
  }
});

// -----------------------------------------------------------------------------
// File & Folder Listing (Directory-Aware with Delimiter)
// -----------------------------------------------------------------------------
app.get('/api/files', requireAuth, async (req, res) => {
  try {
    const rawPrefix = req.query.prefix || '';
    const searchQuery = (req.query.search || '').trim().toLowerCase();
    const currentPrefix = normalizePrefix(rawPrefix);

    // Bucket-wide Search
    if (searchQuery) {
      const command = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        MaxKeys: 1000,
      });
      const response = await s3.send(command);
      const matchingFiles = (response.Contents || [])
        .filter((item) => {
          if (item.Key.endsWith('/')) return false;
          const filename = path.basename(item.Key).toLowerCase();
          return filename.includes(searchQuery) || item.Key.toLowerCase().includes(searchQuery);
        })
        .map((item) => {
          const filename = path.basename(item.Key);
          const mimeType = mime.lookup(filename) || 'application/octet-stream';
          return {
            key: item.Key,
            name: filename,
            size: item.Size,
            lastModified: item.LastModified,
            directUrl: getDirectUrl(item.Key),
            mimeType,
            etag: item.ETag ? item.ETag.replace(/"/g, '') : '',
          };
        });

      return res.json({
        success: true,
        currentPrefix: '',
        breadcrumbs: [],
        folders: [],
        files: matchingFiles,
        isSearch: true,
      });
    }

    // Directory listing with Delimiter '/'
    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: currentPrefix,
      Delimiter: '/',
      MaxKeys: 1000,
    });

    const response = await s3.send(command);

    // 1. Process Folders
    const folders = (response.CommonPrefixes || []).map((cp) => {
      const fullPrefix = cp.Prefix;
      const trimmed = fullPrefix.endsWith('/') ? fullPrefix.slice(0, -1) : fullPrefix;
      const folderName = trimmed.split('/').pop();
      return {
        name: folderName,
        prefix: fullPrefix,
      };
    });

    // 2. Process Files
    const files = (response.Contents || [])
      .filter((item) => {
        if (item.Key === currentPrefix) return false;
        if (item.Key.endsWith('/')) return false;
        return true;
      })
      .map((item) => {
        const filename = item.Key.slice(currentPrefix.length);
        const mimeType = mime.lookup(filename) || 'application/octet-stream';
        return {
          key: item.Key,
          name: filename,
          size: item.Size,
          lastModified: item.LastModified,
          directUrl: getDirectUrl(item.Key),
          mimeType,
          etag: item.ETag ? item.ETag.replace(/"/g, '') : '',
        };
      });

    // 3. Build Breadcrumbs
    const breadcrumbs = [{ name: 'Root', prefix: '' }];
    if (currentPrefix) {
      const parts = currentPrefix.replace(/\/$/, '').split('/');
      let accumulated = '';
      for (const part of parts) {
        accumulated += `${part}/`;
        breadcrumbs.push({
          name: part,
          prefix: accumulated,
        });
      }
    }

    return res.json({
      success: true,
      currentPrefix,
      breadcrumbs,
      folders,
      files,
      isSearch: false,
    });
  } catch (err) {
    console.error('Error listing files/folders:', err);
    const diagnostic = diagnoseS3Error(err);
    res.status(500).json({
      success: false,
      message: diagnostic.solution,
      diagnosticTitle: diagnostic.title,
    });
  }
});

// -----------------------------------------------------------------------------
// Folder Operations (Create & Recursive Delete)
// -----------------------------------------------------------------------------
app.post('/api/folders', requireAuth, async (req, res) => {
  try {
    const { prefix = '', folderName } = req.body;
    if (!folderName || typeof folderName !== 'string') {
      return res.status(400).json({ success: false, message: 'Folder name is required.' });
    }

    const sanitizedName = folderName.trim().replace(/[\/\\:*?"<>|]/g, '-');
    if (!sanitizedName) {
      return res.status(400).json({ success: false, message: 'Invalid folder name.' });
    }

    const currentPrefix = normalizePrefix(prefix);
    const newFolderKey = `${currentPrefix}${sanitizedName}/`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: newFolderKey,
      Body: '',
      ContentType: 'application/x-directory',
    });

    await s3.send(command);
    res.json({ success: true, message: `Folder "${sanitizedName}" created.`, folderKey: newFolderKey });
  } catch (err) {
    console.error('Error creating folder:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/folders', requireAuth, async (req, res) => {
  try {
    const rawPrefix = req.query.prefix || req.body.prefix;
    if (!rawPrefix) {
      return res.status(400).json({ success: false, message: 'Folder prefix is required.' });
    }

    const targetPrefix = normalizePrefix(rawPrefix);
    if (!targetPrefix || targetPrefix === '/') {
      return res.status(400).json({ success: false, message: 'Cannot delete the root bucket directory.' });
    }

    let isTruncated = true;
    let continuationToken = undefined;
    let deletedCount = 0;

    while (isTruncated) {
      const listCmd = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: targetPrefix,
        ContinuationToken: continuationToken,
      });

      const listRes = await s3.send(listCmd);
      const objectsToDelete = (listRes.Contents || []).map((item) => ({ Key: item.Key }));

      if (objectsToDelete.length > 0) {
        // Chunk deletions into batches of max 1000
        for (let i = 0; i < objectsToDelete.length; i += 1000) {
          const chunk = objectsToDelete.slice(i, i + 1000);
          const deleteCmd = new DeleteObjectsCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Delete: { Objects: chunk },
          });
          await s3.send(deleteCmd);
          deletedCount += chunk.length;
        }
      }

      isTruncated = Boolean(listRes.IsTruncated);
      continuationToken = listRes.NextContinuationToken;
    }

    res.json({ success: true, message: `Folder and ${deletedCount} object(s) deleted successfully.` });
  } catch (err) {
    console.error('Error deleting folder:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// -----------------------------------------------------------------------------
// File Operations: Rename & Move
// -----------------------------------------------------------------------------
app.post('/api/files/rename', requireAuth, async (req, res) => {
  try {
    const { oldKey, newKey } = req.body;
    if (!oldKey || !newKey) {
      return res.status(400).json({ success: false, message: 'Both oldKey and newKey are required.' });
    }

    if (oldKey === newKey) {
      return res.json({ success: true, message: 'File name unchanged.' });
    }

    const bucket = process.env.R2_BUCKET_NAME;

    // 1. Copy object to new key
    const copyCmd = new CopyObjectCommand({
      Bucket: bucket,
      Key: newKey,
      CopySource: formatCopySource(bucket, oldKey),
    });
    await s3.send(copyCmd);

    // 2. Delete original object
    const deleteCmd = new DeleteObjectCommand({
      Bucket: bucket,
      Key: oldKey,
    });
    await s3.send(deleteCmd);

    res.json({ success: true, message: 'File renamed successfully.', newKey });
  } catch (err) {
    console.error('Error renaming file:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/files/move', requireAuth, async (req, res) => {
  try {
    const { keys = [], destinationPrefix = '' } = req.body;
    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ success: false, message: 'No items selected to move.' });
    }

    const bucket = process.env.R2_BUCKET_NAME;
    const dest = normalizePrefix(destinationPrefix);
    let movedCount = 0;

    for (const key of keys) {
      const filename = path.basename(key);
      const newKey = `${dest}${filename}`;
      if (newKey !== key) {
        await s3.send(
          new CopyObjectCommand({
            Bucket: bucket,
            Key: newKey,
            CopySource: formatCopySource(bucket, key),
          })
        );
        await s3.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );
        movedCount++;
      }
    }

    res.json({ success: true, message: `${movedCount} item(s) moved successfully.` });
  } catch (err) {
    console.error('Error moving items:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// -----------------------------------------------------------------------------
// Batch Deletion (Safely Chunked for Large Arrays)
// -----------------------------------------------------------------------------
app.post('/api/files/batch-delete', requireAuth, async (req, res) => {
  try {
    const { keys = [] } = req.body;
    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided for deletion.' });
    }

    const bucket = process.env.R2_BUCKET_NAME;
    const objectsToDelete = keys.map((key) => ({ Key: key }));

    // Chunk into batches of max 1000 items (AWS S3 limit)
    for (let i = 0; i < objectsToDelete.length; i += 1000) {
      const chunk = objectsToDelete.slice(i, i + 1000);
      const command = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chunk },
      });
      await s3.send(command);
    }

    res.json({ success: true, message: `${keys.length} file(s) deleted successfully.` });
  } catch (err) {
    console.error('Error batch deleting files:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// -----------------------------------------------------------------------------
// Single File Delete
// -----------------------------------------------------------------------------
app.delete('/api/files/:key', requireAuth, async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });
    await s3.send(command);
    res.json({ success: true, message: `"${key}" deleted successfully.` });
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// -----------------------------------------------------------------------------
// Presigned URL Generator
// -----------------------------------------------------------------------------
app.post('/api/files/presign', requireAuth, async (req, res) => {
  try {
    const { key, expiresIn = 3600 } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, message: 'File key is required.' });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    const seconds = Math.min(Math.max(parseInt(expiresIn, 10) || 3600, 60), 604800);
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: seconds });

    res.json({
      success: true,
      presignedUrl,
      expiresIn: seconds,
      key,
    });
  } catch (err) {
    console.error('Error generating presigned URL:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// -----------------------------------------------------------------------------
// Raw File Streaming & Range Requests (Media Previews)
// -----------------------------------------------------------------------------
app.get('/api/files/raw', requireAuth, async (req, res) => {
  try {
    const key = req.query.key;
    if (!key) {
      return res.status(400).send('File key is required');
    }

    const isDownload = req.query.download === '1';
    const filename = path.basename(key);
    const mimeType = mime.lookup(filename) || 'application/octet-stream';
    const rangeHeader = req.headers.range;

    const commandParams = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    };

    if (rangeHeader) {
      commandParams.Range = rangeHeader;
    }

    const command = new GetObjectCommand(commandParams);
    const s3Response = await s3.send(command);

    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    }

    res.setHeader('Content-Type', s3Response.ContentType || mimeType);

    if (s3Response.ContentRange) {
      res.status(206);
      res.setHeader('Content-Range', s3Response.ContentRange);
      res.setHeader('Accept-Ranges', 'bytes');
    }

    if (s3Response.ContentLength) {
      res.setHeader('Content-Length', s3Response.ContentLength);
    }

    if (s3Response.ETag) {
      res.setHeader('ETag', s3Response.ETag);
    }

    s3Response.Body.pipe(res);
  } catch (err) {
    console.error('Error streaming raw file:', err);
    if (!res.headersSent) {
      res.status(500).send(`Failed to stream file: ${err.message}`);
    }
  }
});

// -----------------------------------------------------------------------------
// Batch Download as Dynamic ZIP Stream
// -----------------------------------------------------------------------------
app.post('/api/files/batch-download', requireAuth, async (req, res) => {
  try {
    const { keys = [], prefix = '', zipName = 'r2_files.zip' } = req.body;

    let targetKeys = [...keys];

    if (targetKeys.length === 0 && prefix) {
      const cleanPrefix = normalizePrefix(prefix);
      const listCmd = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: cleanPrefix,
      });
      const listRes = await s3.send(listCmd);
      targetKeys = (listRes.Contents || [])
        .filter((item) => !item.Key.endsWith('/'))
        .map((item) => item.Key);
    }

    if (targetKeys.length === 0) {
      return res.status(400).json({ success: false, message: 'No files to download.' });
    }

    const safeZipName = (zipName.endsWith('.zip') ? zipName : `${zipName}.zip`).replace(/[\/\\:*?"<>|]/g, '_');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeZipName)}"`);

    const archive = archiver('zip', {
      zlib: { level: 6 },
    });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    archive.pipe(res);

    for (const key of targetKeys) {
      try {
        const getCmd = new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
        });
        const s3File = await s3.send(getCmd);

        let relativePath = key;
        if (prefix && key.startsWith(prefix)) {
          relativePath = key.slice(prefix.length);
        }

        archive.append(s3File.Body, { name: relativePath });
      } catch (fileErr) {
        console.warn(`Failed to include file in zip: ${key}`, fileErr.message);
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error('Error generating zip stream:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
});

// -----------------------------------------------------------------------------
// Multi-File & Folder Upload Engine
// -----------------------------------------------------------------------------
app.post('/upload', requireAuth, (req, res) => {
  const bb = busboy({
    headers: req.headers,
    limits: { fileSize: 50 * 1024 * 1024 * 1024 }, // 50 GB per file
  });

  let uploadPromise = null;
  let targetFolder = '';
  let uploadedKey = '';

  bb.on('field', (name, val) => {
    if (name === 'folder') {
      targetFolder = normalizePrefix(val);
    }
  });

  bb.on('file', (name, fileStream, info) => {
    const rawFilename = info.filename;
    const cleanFilename = rawFilename.replace(/^(\.\.[\/\\])+/, '').replace(/^[\\\/]+/, '');
    uploadedKey = `${targetFolder}${cleanFilename}`;

    const mimeType = info.mimeType || mime.lookup(cleanFilename) || 'application/octet-stream';

    const parallelUpload = new Upload({
      client: s3,
      params: {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: uploadedKey,
        Body: fileStream,
        ContentType: mimeType,
      },
      queueSize: 4,
      partSize: 20 * 1024 * 1024,
      leavePartsOnError: false,
    });

    uploadPromise = parallelUpload.done();
  });

  bb.on('finish', async () => {
    if (!uploadPromise) {
      return res.status(400).json({ success: false, message: 'No file stream detected in upload.' });
    }

    try {
      const result = await uploadPromise;
      res.json({
        success: true,
        message: 'Upload completed successfully!',
        key: result.Key || uploadedKey,
        directUrl: getDirectUrl(result.Key || uploadedKey),
      });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  bb.on('error', (err) => {
    console.error('Busboy parsing error:', err);
    res.status(500).json({ success: false, message: err.message });
  });

  req.pipe(bb);
});

// -----------------------------------------------------------------------------
// Start Server
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` ⚡ Cloudflare R2 Storage Manager is running!`);
  console.log(` 🔗 Local Dashboard: http://localhost:${PORT}`);
  console.log(` 📦 Bucket Name    : ${process.env.R2_BUCKET_NAME || 'Not configured'}`);
  console.log(` 🌐 Mode           : ${process.env.R2_PUBLIC_URL ? 'Public CDN' : 'Private Direct'}`);
  console.log(`=======================================================`);
});