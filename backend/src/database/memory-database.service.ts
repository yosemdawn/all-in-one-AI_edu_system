import { Injectable, OnApplicationShutdown } from '@nestjs/common';

type MemoryServerInstance = {
  getUri(): string;
  stop(): Promise<boolean>;
};

class MemoryDatabaseManager {
  private memoryServers = new Map<string, Promise<MemoryServerInstance>>();

  private async createMemoryServer(dbName: string): Promise<MemoryServerInstance> {
    const { MongoMemoryServer } = require('mongodb-memory-server') as {
      MongoMemoryServer: {
        create(options?: Record<string, unknown>): Promise<MemoryServerInstance>;
      };
    };

    return MongoMemoryServer.create({
      instance: {
        dbName,
      },
    });
  }

  async getUri(dbName: string) {
    let serverPromise = this.memoryServers.get(dbName);
    if (!serverPromise) {
      serverPromise = this.createMemoryServer(dbName);
      this.memoryServers.set(dbName, serverPromise);
    }

    const server = await serverPromise;
    return server.getUri();
  }

  async stopAll() {
    const serverPromises = [...this.memoryServers.values()];
    this.memoryServers.clear();

    await Promise.all(
      serverPromises.map(async (serverPromise) => {
        const server = await serverPromise;
        await server.stop();
      }),
    );
  }
}

export const memoryDatabaseManager = new MemoryDatabaseManager();

@Injectable()
export class MemoryDatabaseService implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await memoryDatabaseManager.stopAll();
  }
}
