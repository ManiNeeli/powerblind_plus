/**
 * PowerBlind+ MongoDB Client & Repository Layer
 * 
 * Provides native MongoDB persistence on localhost (mongodb://127.0.0.1:27017/powerblind)
 * with complete collection indexes, relationship resolution, and sanitized queries.
 * Compatible with MongoDB Compass for real-time visualization and inspection.
 */

const { MongoClient } = require('mongodb');

let client = null;
let db = null;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/powerblind';
const DB_NAME = process.env.MONGODB_DB_NAME || 'powerblind';

async function connectMongo() {
  if (db) return { client, db };

  client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  await client.connect();
  db = client.db(DB_NAME);
  console.log(`[mongo] Connected to MongoDB database '${DB_NAME}' at ${MONGODB_URI}`);
  await initIndexes(db);
  return { client, db };
}

async function initIndexes(database) {
  try {
    await database.collection('users').createIndex({ email: 1 }, { unique: true });
    await database.collection('consumers').createIndex({ id: 1 }, { unique: true });
    await database.collection('consumers').createIndex({ groundTruthLabel: 1 });
    await database.collection('consumers').createIndex({ consumerType: 1 });
    await database.collection('readings').createIndex({ consumerId: 1, date: 1 }, { unique: true });
    await database.collection('readings').createIndex({ date: 1 });
    await database.collection('predictions').createIndex({ consumerId: 1, createdAt: -1 });
    await database.collection('predictions').createIndex({ predictedLabel: 1 });
    await database.collection('inspections').createIndex({ consumerId: 1 });
    await database.collection('inspections').createIndex({ status: 1 });
    await database.collection('inspections').createIndex({ createdAt: -1 });
    await database.collection('audit_logs').createIndex({ createdAt: -1 });
    await database.collection('audit_logs').createIndex({ action: 1 });
    await database.collection('model_versions').createIndex({ version: 1 }, { unique: true });
  } catch (err) {
    // Indexes already exist or background build
  }
}

function generateId(prefix = 'c') {
  return prefix + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function toMongoFilter(where = {}) {
  const filter = {};
  for (const [key, val] of Object.entries(where)) {
    if (val === undefined) continue;
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      const sub = {};
      if (val.in !== undefined) sub.$in = val.in;
      if (val.not !== undefined) sub.$ne = val.not;
      if (val.gte !== undefined) sub.$gte = val.gte;
      if (val.lte !== undefined) sub.$lte = val.lte;
      if (val.gt !== undefined) sub.$gt = val.gt;
      if (val.lt !== undefined) sub.$lt = val.lt;
      if (val.contains !== undefined) {
        sub.$regex = val.contains;
        sub.$options = 'i';
      }
      filter[key] = Object.keys(sub).length > 0 ? sub : val;
    } else {
      filter[key] = val;
    }
  }
  return filter;
}

// ── MONGO REPOSITORY ADAPTER ─────────────────────────────────────────────────
function createMongoAdapter() {
  const getDb = async () => {
    if (!db) await connectMongo();
    return db;
  };

  return {
    async $connect() {
      await connectMongo();
    },
    async $disconnect() {
      if (client) {
        await client.close();
        client = null;
        db = null;
      }
    },
    async $queryRaw() {
      const database = await getDb();
      await database.admin().ping();
      return [{ 1: 1 }];
    },

    // ── USERS ────────────────────────────────────────────────────────────────
    user: {
      async findUnique({ where, select }) {
        const database = await getDb();
        const filter = {};
        if (where.email) filter.email = where.email.toLowerCase();
        if (where.id) filter.id = where.id;
        const u = await database.collection('users').findOne(filter);
        if (!u) return null;
        const formatted = { ...u, _id: undefined };
        if (select) {
          const out = {};
          for (const k of Object.keys(select)) out[k] = formatted[k];
          return out;
        }
        return formatted;
      },

      async upsert({ where, update, create }) {
        const database = await getDb();
        const filter = where.id ? { id: where.id } : { email: where.email?.toLowerCase() };
        const existing = await database.collection('users').findOne(filter);
        if (existing) {
          if (update && Object.keys(update).length > 0) {
            await database.collection('users').updateOne(filter, { $set: { ...update, updatedAt: new Date() } });
          }
          const updated = await database.collection('users').findOne(filter);
          return { ...updated, _id: undefined };
        } else {
          const doc = {
            id: create.id || generateId('usr_'),
            email: create.email.toLowerCase(),
            passwordHash: create.passwordHash,
            role: create.role || 'OPERATOR',
            failedLoginCount: create.failedLoginCount || 0,
            lockedUntil: create.lockedUntil || null,
            createdAt: create.createdAt || new Date(),
            updatedAt: new Date(),
          };
          await database.collection('users').insertOne(doc);
          return { ...doc, _id: undefined };
        }
      },

      async findMany({ where = {}, orderBy, select } = {}) {
        const database = await getDb();
        const cursor = database.collection('users').find(where);
        if (orderBy?.createdAt) cursor.sort({ createdAt: orderBy.createdAt === 'desc' ? -1 : 1 });
        const list = await cursor.toArray();
        return list.map(u => {
          const formatted = { ...u, _id: undefined };
          if (select) {
            const out = {};
            for (const k of Object.keys(select)) out[k] = formatted[k];
            return out;
          }
          return formatted;
        });
      },

      async create({ data }) {
        const database = await getDb();
        const doc = {
          id: data.id || generateId('usr_'),
          email: data.email.toLowerCase(),
          passwordHash: data.passwordHash,
          role: data.role || 'OPERATOR',
          failedLoginCount: data.failedLoginCount || 0,
          lockedUntil: data.lockedUntil || null,
          createdAt: data.createdAt || new Date(),
          updatedAt: new Date(),
        };
        await database.collection('users').insertOne(doc);
        return { ...doc, _id: undefined };
      },

      async update({ where, data, select }) {
        const database = await getDb();
        const filter = where.id ? { id: where.id } : { email: where.email?.toLowerCase() };
        const updateData = { ...data, updatedAt: new Date() };
        await database.collection('users').updateOne(filter, { $set: updateData });
        const updated = await database.collection('users').findOne(filter);
        if (!updated) return null;
        const res = { ...updated, _id: undefined };
        if (select) {
          const out = {};
          for (const k of Object.keys(select)) out[k] = res[k];
          return out;
        }
        return res;
      },

      async delete({ where }) {
        const database = await getDb();
        await database.collection('users').deleteOne({ id: where.id });
        return { ok: true };
      },

      async deleteMany({ where = {} } = {}) {
        const database = await getDb();
        const filter = toMongoFilter(where);
        if (filter.email && typeof filter.email === 'string') filter.email = filter.email.toLowerCase();
        if (filter.email?.$in) filter.email.$in = filter.email.$in.map(e => typeof e === 'string' ? e.toLowerCase() : e);
        const res = await database.collection('users').deleteMany(filter);
        return { count: res.deletedCount };
      },

      async count({ where = {} } = {}) {
        const database = await getDb();
        return database.collection('users').countDocuments(toMongoFilter(where));
      },
    },

    // ── CONSUMERS ────────────────────────────────────────────────────────────
    consumer: {
      async findUnique({ where, include }) {
        const database = await getDb();
        const c = await database.collection('consumers').findOne({ id: where.id });
        if (!c) return null;
        const res = { ...c, _id: undefined };
        if (include) {
          if (include.predictions) {
            const preds = await database.collection('predictions')
              .find({ consumerId: c.id })
              .sort({ createdAt: -1 })
              .limit(include.predictions.take || 1)
              .toArray();
            res.predictions = preds.map(p => ({ ...p, _id: undefined }));
          }
          if (include.inspections) {
            const insps = await database.collection('inspections')
              .find({ consumerId: c.id })
              .sort({ createdAt: -1 })
              .limit(include.inspections.take || 5)
              .toArray();
            const formatted = insps.map(i => ({ ...i, _id: undefined }));
            if (include.inspections.include?.operator) {
              for (const i of formatted) {
                const u = await database.collection('users').findOne({ id: i.operatorId });
                i.operator = u ? { email: u.email } : null;
              }
            }
            res.inspections = formatted;
          }
          if (include._count?.select?.readings) {
            const count = await database.collection('readings').countDocuments({ consumerId: c.id });
            res._count = { readings: count };
          }
        }
        return res;
      },

      async deleteMany({ where = {} } = {}) {
        const database = await getDb();
        const filter = toMongoFilter(where);
        const res = await database.collection('consumers').deleteMany(filter);
        return { count: res.deletedCount };
      },

      async upsert({ where, update, create }) {
        const database = await getDb();
        const existing = await database.collection('consumers').findOne({ id: where.id });
        if (existing) {
          if (update && Object.keys(update).length > 0) {
            await database.collection('consumers').updateOne({ id: where.id }, { $set: update });
          }
          const updated = await database.collection('consumers').findOne({ id: where.id });
          return { ...updated, _id: undefined };
        } else {
          const doc = {
            id: create.id || where.id,
            consumerType: create.consumerType || 'residential_small',
            baseKwh: create.baseKwh ?? null,
            groundTruthLabel: create.groundTruthLabel || 'Normal',
            groundTruthSubtype: create.groundTruthSubtype ?? null,
            anomalyStartDate: create.anomalyStartDate ?? null,
            anomalyEndDate: create.anomalyEndDate ?? null,
            anomalyStartDay: create.anomalyStartDay ?? null,
            anomalyEndDay: create.anomalyEndDay ?? null,
            ...create,
          };
          await database.collection('consumers').insertOne(doc);
          return { ...doc, _id: undefined };
        }
      },

      async findMany({ where = {}, skip = 0, take = 50, orderBy, include, select } = {}) {
        const database = await getDb();
        const mongoFilter = {};

        if (where.groundTruthLabel) {
          if (where.groundTruthLabel.in) {
            mongoFilter.groundTruthLabel = { $in: where.groundTruthLabel.in };
          } else {
            mongoFilter.groundTruthLabel = where.groundTruthLabel;
          }
        }
        if (where.consumerType) mongoFilter.consumerType = where.consumerType;
        if (where.id?.in) mongoFilter.id = { $in: where.id.in };
        if (where.id?.contains) mongoFilter.id = { $regex: where.id.contains, $options: 'i' };
        if (where.anomalyStartDate?.not === null) mongoFilter.anomalyStartDate = { $ne: null };

        let cursor = database.collection('consumers').find(mongoFilter);
        if (orderBy) {
          const sortObj = {};
          if (Array.isArray(orderBy)) {
            for (const o of orderBy) {
              const k = Object.keys(o)[0];
              sortObj[k] = o[k] === 'desc' ? -1 : 1;
            }
          } else {
            const k = Object.keys(orderBy)[0];
            sortObj[k] = orderBy[k] === 'desc' ? -1 : 1;
          }
          cursor = cursor.sort(sortObj);
        }
        if (skip) cursor = cursor.skip(skip);
        if (take) cursor = cursor.limit(take);

        const consumers = (await cursor.toArray()).map(c => ({ ...c, _id: undefined }));

        // Resolve relations if requested
        if (include?.predictions || include?.inspections) {
          for (const c of consumers) {
            if (include.predictions) {
              const preds = await database.collection('predictions')
                .find({ consumerId: c.id })
                .sort({ createdAt: -1 })
                .limit(include.predictions.take || 1)
                .toArray();
              c.predictions = preds.map(p => ({ ...p, _id: undefined }));
            }
            if (include.inspections) {
              const insps = await database.collection('inspections')
                .find({ consumerId: c.id })
                .sort({ createdAt: -1 })
                .limit(include.inspections.take || 1)
                .toArray();
              c.inspections = insps.map(i => ({ ...i, _id: undefined }));
            }
          }
        }

        if (select) {
          return consumers.map(c => {
            const out = {};
            for (const k of Object.keys(select)) out[k] = c[k];
            return out;
          });
        }
        return consumers;
      },

      async count({ where = {} } = {}) {
        const database = await getDb();
        const mongoFilter = {};
        if (where.groundTruthLabel) {
          if (where.groundTruthLabel.in) {
            mongoFilter.groundTruthLabel = { $in: where.groundTruthLabel.in };
          } else {
            mongoFilter.groundTruthLabel = where.groundTruthLabel;
          }
        }
        if (where.consumerType) mongoFilter.consumerType = where.consumerType;
        if (where.id?.contains) mongoFilter.id = { $regex: where.id.contains, $options: 'i' };
        return database.collection('consumers').countDocuments(mongoFilter);
      },

      async groupBy({ by, _count }) {
        const database = await getDb();
        const pipeline = [
          { $group: { _id: '$groundTruthLabel', count: { $sum: 1 } } }
        ];
        const res = await database.collection('consumers').aggregate(pipeline).toArray();
        return res.map(r => ({ groundTruthLabel: r._id, _count: { id: r.count } }));
      },

      async create({ data }) {
        const database = await getDb();
        const doc = { ...data };
        await database.collection('consumers').insertOne(doc);
        return { ...doc, _id: undefined };
      },

      async createMany({ data }) {
        const database = await getDb();
        if (!data || !data.length) return { count: 0 };
        const res = await database.collection('consumers').insertMany(data, { ordered: false });
        return { count: res.insertedCount };
      },
    },

    // ── READINGS ─────────────────────────────────────────────────────────────
    reading: {
      async findMany({ where = {}, orderBy, select } = {}) {
        const database = await getDb();
        const filter = toMongoFilter(where);

        let cursor = database.collection('readings').find(filter);
        if (orderBy?.date) cursor = cursor.sort({ date: orderBy.date === 'desc' ? -1 : 1 });
        const list = await cursor.toArray();
        return list.map(r => {
          const formatted = { ...r, _id: undefined };
          if (select) {
            const out = {};
            for (const k of Object.keys(select)) out[k] = formatted[k];
            return out;
          }
          return formatted;
        });
      },

      async create({ data }) {
        const database = await getDb();
        const doc = { ...data };
        await database.collection('readings').insertOne(doc);
        return { ...doc, _id: undefined };
      },

      async createMany({ data }) {
        const database = await getDb();
        if (!data || !data.length) return { count: 0 };
        const res = await database.collection('readings').insertMany(data, { ordered: false });
        return { count: res.insertedCount };
      },

      async deleteMany({ where = {} } = {}) {
        const database = await getDb();
        const filter = toMongoFilter(where);
        const res = await database.collection('readings').deleteMany(filter);
        return { count: res.deletedCount };
      },

      async upsert({ where, update, create }) {
        const database = await getDb();
        let filter = {};
        if (where.consumerId_date) {
          filter = { consumerId: where.consumerId_date.consumerId, date: where.consumerId_date.date };
        } else if (where.id) {
          filter = { id: where.id };
        } else {
          filter = toMongoFilter(where);
        }
        const existing = await database.collection('readings').findOne(filter);
        if (existing) {
          if (update && Object.keys(update).length > 0) {
            await database.collection('readings').updateOne(filter, { $set: update });
          }
          const updated = await database.collection('readings').findOne(filter);
          return { ...updated, _id: undefined };
        } else {
          const doc = { ...create };
          await database.collection('readings').insertOne(doc);
          return { ...doc, _id: undefined };
        }
      },
    },

    // ── PREDICTIONS ──────────────────────────────────────────────────────────
    prediction: {
      async create({ data }) {
        const database = await getDb();
        const doc = {
          id: data.id || generateId('pred_'),
          consumerId: data.consumerId,
          predictedLabel: data.predictedLabel,
          predictedSubtype: data.predictedSubtype ?? null,
          confidence: data.confidence,
          topFeatures: data.topFeatures,
          recommendation: data.recommendation,
          modelVersion: data.modelVersion,
          source: data.source || 'xgboost',
          createdAt: data.createdAt || new Date(),
        };
        await database.collection('predictions').insertOne(doc);
        return { ...doc, _id: undefined };
      },

      async findMany({ where = {}, orderBy, take = 50, select, include } = {}) {
        const database = await getDb();
        const filter = toMongoFilter(where);

        let cursor = database.collection('predictions').find(filter);
        if (orderBy?.createdAt) cursor = cursor.sort({ createdAt: orderBy.createdAt === 'desc' ? -1 : 1 });
        if (take) cursor = cursor.limit(take);

        const preds = (await cursor.toArray()).map(p => ({ ...p, _id: undefined }));

        if (include?.consumer) {
          for (const p of preds) {
            const c = await database.collection('consumers').findOne({ id: p.consumerId });
            p.consumer = c ? { consumerType: c.consumerType, groundTruthLabel: c.groundTruthLabel } : null;
          }
        }

        if (select) {
          return preds.map(p => {
            const out = {};
            for (const k of Object.keys(select)) out[k] = p[k];
            return out;
          });
        }
        return preds;
      },

      async deleteMany({ where = {} } = {}) {
        const database = await getDb();
        const filter = toMongoFilter(where);
        const res = await database.collection('predictions').deleteMany(filter);
        return { count: res.deletedCount };
      },
    },

    // ── INSPECTIONS ──────────────────────────────────────────────────────────
    inspection: {
      async findMany({ where = {}, skip = 0, take = 50, orderBy, include } = {}) {
        const database = await getDb();
        const filter = {};
        if (where.status) filter.status = where.status;
        if (where.createdAt?.gte) filter.createdAt = { $gte: where.createdAt.gte };

        let cursor = database.collection('inspections').find(filter);
        if (orderBy?.createdAt) cursor = cursor.sort({ createdAt: orderBy.createdAt === 'desc' ? -1 : 1 });
        if (skip) cursor = cursor.skip(skip);
        if (take) cursor = cursor.limit(take);

        const list = (await cursor.toArray()).map(i => ({ ...i, _id: undefined }));

        if (include?.consumer || include?.operator) {
          for (const item of list) {
            if (include.consumer) {
              const c = await database.collection('consumers').findOne({ id: item.consumerId });
              item.consumer = c ? {
                id: c.id, consumerType: c.consumerType, groundTruthLabel: c.groundTruthLabel, groundTruthSubtype: c.groundTruthSubtype
              } : null;
            }
            if (include.operator) {
              const u = await database.collection('users').findOne({ id: item.operatorId });
              item.operator = u ? { id: u.id, email: u.email, role: u.role } : null;
            }
          }
        }
        return list;
      },

      async findUnique({ where, include }) {
        const database = await getDb();
        const item = await database.collection('inspections').findOne({ id: where.id });
        if (!item) return null;
        const res = { ...item, _id: undefined };
        if (include?.consumer) {
          res.consumer = await database.collection('consumers').findOne({ id: res.consumerId });
        }
        if (include?.operator) {
          const u = await database.collection('users').findOne({ id: res.operatorId });
          res.operator = u ? { email: u.email, role: u.role } : null;
        }
        return res;
      },

      async create({ data, include }) {
        const database = await getDb();
        const doc = {
          id: data.id || generateId('insp_'),
          consumerId: data.consumerId,
          operatorId: data.operatorId,
          status: data.status || 'QUEUED',
          notes: data.notes || '',
          createdAt: data.createdAt || new Date(),
        };
        await database.collection('inspections').insertOne(doc);
        const res = { ...doc, _id: undefined };
        if (include?.consumer) {
          res.consumer = await database.collection('consumers').findOne({ id: res.consumerId });
        }
        if (include?.operator) {
          const u = await database.collection('users').findOne({ id: res.operatorId });
          res.operator = u ? { email: u.email } : null;
        }
        return res;
      },

      async update({ where, data }) {
        const database = await getDb();
        await database.collection('inspections').updateOne({ id: where.id }, { $set: data });
        const updated = await database.collection('inspections').findOne({ id: where.id });
        return updated ? { ...updated, _id: undefined } : null;
      },

      async count({ where = {} } = {}) {
        const database = await getDb();
        const filter = toMongoFilter(where);
        return database.collection('inspections').countDocuments(filter);
      },

      async deleteMany({ where = {} } = {}) {
        const database = await getDb();
        const filter = toMongoFilter(where);
        const res = await database.collection('inspections').deleteMany(filter);
        return { count: res.deletedCount };
      },
    },

    // ── AUDIT LOGS ───────────────────────────────────────────────────────────
    auditLog: {
      async create({ data }) {
        const database = await getDb();
        const doc = {
          id: data.id || generateId('aud_'),
          actorId: data.actorId || null,
          action: data.action,
          metadata: data.metadata || null,
          ip: data.ip || null,
          createdAt: data.createdAt || new Date(),
        };
        await database.collection('audit_logs').insertOne(doc);
        return { ...doc, _id: undefined };
      },

      async findMany({ where = {}, skip = 0, take = 50, orderBy, include } = {}) {
        const database = await getDb();
        const filter = toMongoFilter(where);

        let cursor = database.collection('audit_logs').find(filter);
        if (orderBy?.createdAt) cursor = cursor.sort({ createdAt: orderBy.createdAt === 'desc' ? -1 : 1 });
        if (skip) cursor = cursor.skip(skip);
        if (take) cursor = cursor.limit(take);

        const logs = (await cursor.toArray()).map(l => ({ ...l, _id: undefined }));

        if (include?.actor) {
          for (const l of logs) {
            if (l.actorId) {
              const u = await database.collection('users').findOne({ id: l.actorId });
              l.actor = u ? { email: u.email, role: u.role } : null;
            }
          }
        }
        return logs;
      },

      async count({ where = {} } = {}) {
        const database = await getDb();
        const filter = toMongoFilter(where);
        return database.collection('audit_logs').countDocuments(filter);
      },

      async deleteMany({ where = {} } = {}) {
        const database = await getDb();
        const filter = toMongoFilter(where);
        const res = await database.collection('audit_logs').deleteMany(filter);
        return { count: res.deletedCount };
      },
    },

    // ── MODEL VERSIONS ───────────────────────────────────────────────────────
    modelVersion: {
      async findMany({ orderBy } = {}) {
        const database = await getDb();
        let cursor = database.collection('model_versions').find({});
        if (orderBy?.trainedAt) cursor = cursor.sort({ trainedAt: orderBy.trainedAt === 'desc' ? -1 : 1 });
        const list = await cursor.toArray();
        return list.map(m => ({ ...m, _id: undefined }));
      },

      async findUnique({ where }) {
        const database = await getDb();
        const filter = where.version ? { version: where.version } : { id: where.id };
        const m = await database.collection('model_versions').findOne(filter);
        return m ? { ...m, _id: undefined } : null;
      },

      async create({ data }) {
        const database = await getDb();
        const doc = {
          id: data.id || generateId('mdl_'),
          version: data.version,
          isActive: data.isActive || false,
          metricsJson: data.metricsJson || '{}',
          trainedAt: data.trainedAt || new Date(),
        };
        await database.collection('model_versions').insertOne(doc);
        return { ...doc, _id: undefined };
      },

      async update({ where, data }) {
        const database = await getDb();
        const filter = where.id ? { id: where.id } : { version: where.version };
        await database.collection('model_versions').updateOne(filter, { $set: data });
        const updated = await database.collection('model_versions').findOne(filter);
        return updated ? { ...updated, _id: undefined } : null;
      },

      async updateMany({ where = {}, data }) {
        const database = await getDb();
        const filter = toMongoFilter(where);
        const res = await database.collection('model_versions').updateMany(filter, { $set: data });
        return { count: res.modifiedCount };
      },

      async deleteMany({ where = {} } = {}) {
        const database = await getDb();
        const filter = toMongoFilter(where);
        const res = await database.collection('model_versions').deleteMany(filter);
        return { count: res.deletedCount };
      },
    },
  };
}

module.exports = {
  connectMongo,
  createMongoAdapter,
};
