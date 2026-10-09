// Test reverse geocoding against the imported admin boundaries.
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/travelvietplaner?replicaSet=rs0';

const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const db = client.db('travelvietplaner');
const col = db.collection('admin_boundaries');

const points = [
  { label: 'Hanoi', coords: [105.8342, 21.0278] },
  { label: 'HCMC', coords: [106.6297, 10.8231] },
  { label: 'DaNang', coords: [108.2022, 16.0544] },
  { label: 'Hue', coords: [107.5901, 16.4637] },
  { label: 'CanTho', coords: [105.7882, 10.0452] },
  { label: 'HaLong', coords: [107.0900, 20.9500] },
  { label: 'NhaTrang', coords: [109.1967, 12.2388] },
  { label: 'DaLat', coords: [108.4419, 11.9465] },
];

for (const { label, coords } of points) {
  const r = await col.findOne({
    level: 'commune',
    geometry: { $geoIntersects: { $geometry: { type: 'Point', coordinates: coords } } },
  });
  console.log(`${label}:`, r ? `${r.name}, ${r.provinceName}` : 'NULL');
}

await client.close();
process.exit(0);