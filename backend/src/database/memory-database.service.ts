import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';

class MemoryDatabaseManager {
  private memoryServers = new Map<string, Promise<MongoMemoryServer>>();

  async getUri(dbName: string) {
    let serverPromise = this.memoryServers.get(dbName);
    if (!serverPromise) {
      serverPromise = MongoMemoryServer.create({
        instance: {
          dbName,
        },
      });
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
