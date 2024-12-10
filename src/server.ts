import express from 'express';
import path from 'path';
import { StorageService } from './storage';
import { Logger } from './logger';
import { JupiterMonitor } from './monitor';

export class WebServer {
    private app: express.Application;
    private storage: StorageService;
    private jupiterMonitor: JupiterMonitor | null = null;
    private isReady: boolean = false;

    constructor() {
        this.app = express();
        this.storage = new StorageService();

        // Serve static files
        this.app.use(express.static(path.join(process.cwd(), 'public')));
        this.app.use(express.json());

        // API endpoints
        this.app.get('/api/state', (req, res) => {
            const state = this.storage.getState();
            res.json({
                status: 'success',
                data: {
                    timestamp: state.timestamp,
                    summary: state.summary,
                    positions: state.positions,
                    chartData: state.chartData
                }
            });
        });

        this.app.get('/api/chart/:token', (req, res) => {
            const { token } = req.params;
            if (token !== 'LOGOS' && token !== 'CHAOS') {
                res.status(400).json({ error: 'Invalid token' });
                return;
            }
            const chartData = this.storage.getChartData(token);
            res.json({
                status: 'success',
                data: chartData
            });
        });

        // Endpoint to start the app
        this.app.post('/start', async (req, res) => {
            try {
                if (!this.jupiterMonitor) {
                    this.jupiterMonitor = new JupiterMonitor(this);
                    await this.jupiterMonitor.start();
                    Logger.info('Jupiter Monitor started successfully');
                    res.status(200).json({ message: 'App started successfully' });
                } else {
                    res.status(400).json({ message: 'App is already running' });
                }
            } catch (error) {
                Logger.error('Error starting Jupiter Monitor:', error);
                res.status(500).json({ message: 'Failed to start app' });
            }
        });
    }

    start(port: number = 3000) {
        this.app.listen(port, () => {
            Logger.info(`Web interface available at http://localhost:${port}`);
        });
    }

    updateState(positions: any[], summary: any, chartData?: any) {
        this.storage.updatePositions(positions);
        if (summary.LOGOS) this.storage.updateSummary('LOGOS', summary.LOGOS);
        if (summary.CHAOS) this.storage.updateSummary('CHAOS', summary.CHAOS);
        
        if (chartData) {
            if (chartData.LOGOS) {
                chartData.LOGOS.forEach((point: any) => 
                    this.storage.addChartDataPoint('LOGOS', point)
                );
            }
            if (chartData.CHAOS) {
                chartData.CHAOS.forEach((point: any) => 
                    this.storage.addChartDataPoint('CHAOS', point)
                );
            }
        }
        
        this.isReady = true;
    }
} 