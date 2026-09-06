const { getPrismaClient } = require('@powerblind/db');

/**
 * Writes a row to the AuditLog table.
 *
 * Call this for: LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, USER_CREATED,
 * ROLE_CHANGED, PASSWORD_CHANGED, INSPECTION_LOGGED, ACCOUNT_LOCKED,
 * MODEL_RETRAIN_TRIGGERED, etc.
 *
 * Non-blocking: errors are logged to stderr but never bubble up to the
 * request handler — a failed audit write must never break the main flow.
 */
async function audit(actorId, action, metadata, req) {
  const prisma = getPrismaClient();
  const ip = req
    ? (req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? null)
    : null;

  try {
    await prisma.auditLog.create({
      data: {
        actorId:  actorId  ?? null,
        action,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ip,
      },
    });
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err.message);
  }
}

module.exports = { audit };
