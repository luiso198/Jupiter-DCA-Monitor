import { JupiterMonitor } from './monitor';

async function main() {
    try {
        const monitor = new JupiterMonitor();
        await monitor.start();
        
        console.log('Jupiter DCA Monitor started successfully');
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            monitor.stop();
            process.exit(0);
        });
    } catch (error) {
        console.error('Failed to start monitor:', error);
        process.exit(1);
    }
}

main();
