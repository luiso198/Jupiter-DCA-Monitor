import express from 'express';
import path from 'path';
import { StorageService } from './storage';
import { Logger } from './logger';

export class WebServer {
    private app: express.Application;
    private storage: StorageService;
    private isReady: boolean = false;

    constructor() {
        this.app = express();
        this.storage = new StorageService();

        // Serve static files
        this.app.use(express.static(path.join(process.cwd(), 'public')));

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
        
        // Update chart data if provided
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