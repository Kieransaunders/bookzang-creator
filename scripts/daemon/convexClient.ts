import { ConvexHttpClient } from "convex/browser";

type LeaseArgs = { workerId: string; leaseMs?: number };
type HeartbeatArgs = {
  ingestJobId: string;
  workerId: string;
  stage?: string;
  leaseMs?: number;
};
type CompleteArgs = {
  ingestJobId: string;
  workerId: string;
  selectedFormat: string;
  sourceUrl: string;
  localSourcePath: string;
  localExtractedPath: string;
  checksum: string;
  warning?: string;
};

export class IngestConvexClient {
  private client: ConvexHttpClient;

  constructor(convexUrl: string) {
    this.client = new ConvexHttpClient(convexUrl);
  }

  async recoverStaleLeases(now?: number) {
    return await this.client.mutation("ingestJobs:recoverStaleLeases" as any, {
      now,
    });
  }

  async leaseNext(args: LeaseArgs) {
    return await this.client.mutation("ingestJobs:leaseNext" as any, args);
  }

  async heartbeat(args: HeartbeatArgs) {
    return await this.client.mutation("ingestJobs:heartbeat" as any, args);
  }

  async complete(args: CompleteArgs) {
    return await this.client.mutation("ingestJobs:complete" as any, args);
  }

  async fail(ingestJobId: string, error: string, workerId?: string) {
    return await this.client.mutation("ingestJobs:fail" as any, {
      ingestJobId,
      workerId,
      error,
    });
  }
}
