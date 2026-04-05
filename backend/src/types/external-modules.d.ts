declare module 'bcrypt' {
  export function hash(
    data: string,
    saltOrRounds: string | number,
  ): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
}

declare module 'mongodb-memory-server' {
  export class MongoMemoryServer {
    static create(options?: {
      instance?: {
        dbName?: string;
      };
    }): Promise<MongoMemoryServer>;

    getUri(): string;
    stop(): Promise<boolean>;
  }
}
