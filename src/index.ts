import { config } from './config';
import { Logger, LogLevel } from './logger';
import { WebServer } from './server';

// Set log level and add immediate test log
Logger.setLevel(LogLevel.DEBUG);
Logger.debug('Logger initialized with level:', config.logLevel);
Logger.info('Starting application...');

// Initialize web server only
const webServer = new WebServer();
webServer.start();
Logger.info('Web server started');
