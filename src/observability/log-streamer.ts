import { EventEmitter } from 'events';

class LogStreamer extends EventEmitter {
  private logs: any[] = [];
  private readonly maxLogs = 500;

  constructor() {
    super();
  }

  public pushLog(log: any) {
    this.logs.push(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    this.emit('log', log);
  }

  public getHistory() {
    return this.logs;
  }
}

export const logStreamer = new LogStreamer();
