import { config } from './config';
import { Logger, LogLevel } from './logger';
import { WebServer } from './server';
import { JupiterMonitor } from './monitor';

// Set log level and add immediate test log
Logger.setLevel(LogLevel.DEBUG);
Logger.debug('Logger initialized with level:', config.logLevel);
Logger.info('Starting application...');

// Initialize services
const webServer = new WebServer();
webServer.start();
Logger.info('Web server started');

// Start monitor
const monitor = new JupiterMonitor(webServer);
monitor.start().catch(error => {
    Logger.error('Failed to start monitor:', error);
    process.exit(1);
});
