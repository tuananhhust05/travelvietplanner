// Verify admin_boundaries collection: counts per level + a sample commune.
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/travelvietplaner?replicaSet=rs0';

const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const db = client.db('travelvietplaner');
const col = db.collection('admin_boundaries');

const counts = await col.aggregate([{ $group: { _id: '$level', n: { $sum: 1 } } }]).toArray();
console.log('Counts:', JSON.stringify(counts));

const withProvince = await col.countDocuments({ level: 'commune', provinceName: { $ne: null } });
console.log('Communes with provinceName:', withProvince);

const sample = await col.findOne({ level: 'commune' });
console.log('Sample commune:', JSON.stringify({
  name: sample?.name,
  provinceName: sample?.provinceName,
  type: sample?.geometry?.type,
}));

const idx = await col.indexes();
console.log('Indexes:', JSON.stringify(idx.map((i) => i.name)));

await client.close();
process.exit(0);