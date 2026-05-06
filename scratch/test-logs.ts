import { logger } from '../src/observability/logger';
import { logStreamer } from '../src/observability/log-streamer';

console.log('Testing log streamer...');

logStreamer.on('log', (log) => {
  console.log('Log captured by streamer:', log.msg);
});

logger.info('Test log message from script');

setTimeout(() => {
  const history = logStreamer.getHistory();
  console.log('History length:', history.length);
  if (history.length > 0) {
    console.log('Last log in history:', history[history.length - 1].msg);
  } else {
    console.log('History is EMPTY!');
  }
  process.exit(0);
}, 1000);
