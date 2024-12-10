import { JupiterMonitor } from '../../monitor';
import { Logger } from '../../logger';

let jupiterMonitor = null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    if (!jupiterMonitor) {
      jupiterMonitor = new JupiterMonitor();
      await jupiterMonitor.start();
      Logger.info('Jupiter Monitor started successfully');
      res.status(200).json({ message: 'App started successfully' });
    } else {
      res.status(400).json({ message: 'App is already running' });
    }
  } catch (error) {
    Logger.error('Error starting Jupiter Monitor:', error);
    res.status(500).json({ message: 'Failed to start app' });
  }
}