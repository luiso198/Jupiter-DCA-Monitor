import { StorageService } from '../../storage';

const storage = new StorageService();

export default function handler(req, res) {
  const { token } = req.query;

  if (token !== 'LOGOS' && token !== 'CHAOS') {
    return res.status(400).json({ error: 'Invalid token' });
  }

  const chartData = storage.getChartData(token);
  res.status(200).json({
    status: 'success',
    data: chartData,
  });
}