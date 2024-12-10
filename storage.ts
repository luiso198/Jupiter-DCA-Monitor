import fs from 'fs';
import path from 'path';
import { Logger } from './logger';

interface TokenSummary {
    buyOrders: number;
    sellOrders: number;
    buyVolume: number;
    sellVolume: number;
}

interface ChartDataPoint {
    timestamp: number;
    buyVolume: number;
    sellVolume: number;
    buyOrders: number;
    sellOrders: number;
}

interface DCAPosition {
    token: 'LOGOS' | 'CHAOS';
    type: 'BUY' | 'SELL';
    publicKey: string;
    inputToken: string;
    outputToken: string;
    amount: string;
    frequency: number;
    lastUpdate: number;
}

interface CachedState {
    timestamp: number;
    summary: {
        LOGOS: TokenSummary;
        CHAOS: TokenSummary;
    };
    positions: DCAPosition[];
    chartData: {
        LOGOS: ChartDataPoint[];
        CHAOS: ChartDataPoint[];
    };
}

export class StorageService {
    private readonly dataDir: string;
    private readonly stateFile: string;
    private currentState: CachedState;

    constructor() {
        this.dataDir = path.join(process.cwd(), 'data');
        this.stateFile = path.join(this.dataDir, 'state.json');
        
        // Ensure data directory exists
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        // Initialize or load state
        this.currentState = this.loadState();
    }

    private loadState(): CachedState {
        try {
            if (fs.existsSync(this.stateFile)) {
                const data = fs.readFileSync(this.stateFile, 'utf-8');
                // Reset to only LOGOS and CHAOS regardless of what's in the file
                return {
                    timestamp: Date.now(),
                    summary: {
                        LOGOS: { buyOrders: 0, sellOrders: 0, buyVolume: 0, sellVolume: 0 },
                        CHAOS: { buyOrders: 0, sellOrders: 0, buyVolume: 0, sellVolume: 0 }
                    },
                    positions: [],
                    chartData: {
                        LOGOS: [],
                        CHAOS: []
                    }
                };
            }
        } catch (error) {
            Logger.error('Error loading state:', error);
        }

        // Return default state if loading fails
        return {
            timestamp: Date.now(),
            summary: {
                LOGOS: { buyOrders: 0, sellOrders: 0, buyVolume: 0, sellVolume: 0 },
                CHAOS: { buyOrders: 0, sellOrders: 0, buyVolume: 0, sellVolume: 0 }
            },
            positions: [],
            chartData: {
                LOGOS: [],
                CHAOS: []
            }
        };
    }

    private saveState(): void {
        try {
            fs.writeFileSync(this.stateFile, JSON.stringify(this.currentState, null, 2));
        } catch (error) {
            Logger.error('Error saving state:', error);
        }
    }

    // Get current state
    public getState(): CachedState {
        return this.currentState;
    }

    // Update summary data
    public updateSummary(token: 'LOGOS' | 'CHAOS', summary: TokenSummary): void {
        this.currentState.summary[token] = summary;
        this.currentState.timestamp = Date.now();
        this.saveState();
    }

    // Update positions
    public updatePositions(positions: DCAPosition[]): void {
        this.currentState.positions = positions;
        this.currentState.timestamp = Date.now();
        this.saveState();
    }

    // Add chart data point
    public addChartDataPoint(token: 'LOGOS' | 'CHAOS', dataPoint: ChartDataPoint): void {
        if (!this.currentState.chartData[token]) {
            this.currentState.chartData[token] = [];
        }

        // Keep last 24 hours of data points
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        this.currentState.chartData[token] = [
            ...this.currentState.chartData[token].filter(point => point.timestamp > oneDayAgo),
            dataPoint
        ];

        this.saveState();
    }

    // Get chart data
    public getChartData(token: 'LOGOS' | 'CHAOS'): ChartDataPoint[] {
        return this.currentState.chartData[token] || [];
    }

    public updateState(newState: CachedState): void {
        this.currentState = newState;
        this.saveState();
    }
} 