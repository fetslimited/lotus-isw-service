// Logger that accepts any type for messages
interface Logger {
  info(msg: any, ...args: any[]): void;
  warn(msg: any, ...args: any[]): void;
  error(msg: any, ...args: any[]): void;
  debug(msg: any, ...args: any[]): void;
  err(msg: any, ...args: any[]): void;
}

const formatMessage = (msg: any): string => {
  if (msg instanceof Error) {
    return msg.message;
  }
  if (typeof msg === 'object') {
    try {
      return JSON.stringify(msg);
    } catch {
      return String(msg);
    }
  }
  return String(msg);
};

const logger: Logger = {
  info: (msg: any, ...args: any[]) => 
    console.log(`[INFO] ${formatMessage(msg)}`, ...args),
  
  warn: (msg: any, ...args: any[]) => 
    console.warn(`[WARN] ${formatMessage(msg)}`, ...args),
  
  error: (msg: any, ...args: any[]) => 
    console.error(`[ERROR] ${formatMessage(msg)}`, ...args),
  
  debug: (msg: any, ...args: any[]) => 
    console.debug(`[DEBUG] ${formatMessage(msg)}`, ...args),
  
  err: (msg: any, ...args: any[]) => 
    console.error(`[ERROR] ${formatMessage(msg)}`, ...args)
};

export default logger;
