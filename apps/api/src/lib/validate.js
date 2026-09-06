const { z } = require('zod');

// ── Auth ──────────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email:      z.string().email('Invalid email address.').max(254),
  password:   z.string().min(1, 'Password is required.').max(128),
  rememberMe: z.boolean().optional().default(false),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword:     z.string().min(10, 'New password must be at least 10 characters.').max(128),
});

// ── Users (Admin) ─────────────────────────────────────────────────────────────
const createUserSchema = z.object({
  email:    z.string().email().max(254),
  password: z.string().min(10).max(128),
  role:     z.enum(['OPERATOR', 'ADMIN']).default('OPERATOR'),
});

// ── Consumers ─────────────────────────────────────────────────────────────────
const consumerListSchema = z.object({
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(25),
  label:        z.enum(['Normal','Theft','FaultyMeter','CommFailure']).optional(),
  consumerType: z.enum(['residential_small','residential_large','small_commercial','industrial_light']).optional(),
  search:       z.string().max(20).optional(),
});

// ── Inspections ───────────────────────────────────────────────────────────────
const createInspectionSchema = z.object({
  consumerId: z.string().min(1).max(20),
  status:     z.enum(['QUEUED','CONFIRMED','FALSE_POSITIVE']),
  notes:      z.string().max(1000).optional(),
});

const updateInspectionSchema = z.object({
  status: z.enum(['QUEUED','CONFIRMED','FALSE_POSITIVE']).optional(),
  notes:  z.string().max(1000).optional(),
});

/**
 * Middleware factory: validates req.body or req.query against a Zod schema.
 * On failure throws ZodError — caught by errorHandler → 422.
 */
function validate(schema, source = 'body') {
  return (req, _res, next) => {
    try {
      const input  = source === 'query' ? req.query : req.body;
      const parsed = schema.parse(input);
      if (source === 'query') req.validatedQuery = parsed;
      else req.body = parsed;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  loginSchema, changePasswordSchema, createUserSchema,
  consumerListSchema, createInspectionSchema, updateInspectionSchema,
  validate,
};
