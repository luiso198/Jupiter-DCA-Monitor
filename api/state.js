import { StorageService } from '../../storage';

const storage = new StorageService();

export default function handler(req, res) {
  const state = storage.getState();
  res.status(200).json({
    status: 'success',
    data: {
      timestamp: state.timestamp,
      summary: state.summary,
      positions: state.positions,
      chartData: state.chartData,
    },
  });
}