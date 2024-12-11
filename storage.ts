export class StorageService {
    private currentState: CachedState;

    constructor() {
        // Initialize the default state
        this.currentState = {
            timestamp: Date.now(),
            summary: {
                LOGOS: { buyOrders: 0, sellOrders: 0, buyVolume: 0, sellVolume: 0 },
                CHAOS: { buyOrders: 0, sellOrders: 0, buyVolume: 0, sellVolume: 0 },
            },
            positions: [],
            chartData: {
                LOGOS: [],
                CHAOS: [],
            },
        };
    }

    // Get the current state
    public getState(): CachedState {
        return this.currentState;
    }

    // Update the summary data
    public updateSummary(token: 'LOGOS' | 'CHAOS', summary: TokenSummary): void {
        this.currentState.summary[token] = summary;
        this.currentState.timestamp = Date.now();
    }

    // Update positions
    public updatePositions(positions: DCAPosition[]): void {
        this.currentState.positions = positions;
        this.currentState.timestamp = Date.now();
    }

    // Add a chart data point
    public addChartDataPoint(token: 'LOGOS' | 'CHAOS', dataPoint: ChartDataPoint): void {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        this.currentState.chartData[token] = [
            ...this.currentState.chartData[token].filter((point) => point.timestamp > oneDayAgo),
            dataPoint,
        ];
    }

    // Update the entire state
    public updateState(newState: CachedState): void {
        this.currentState = newState;
    }
}