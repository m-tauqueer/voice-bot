import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { Redis } from "ioredis";
import postgres from "postgres";
import type { GatewayConfig } from "./config.js";

export function createPostgres(config: GatewayConfig) {
  return postgres(config.DATABASE_URL);
}

export function createRedis(config: GatewayConfig) {
  return new Redis(config.REDIS_URL);
}

export function createBlobService(config: GatewayConfig) {
  if (
    !config.AZURE_STORAGE_ACCOUNT ||
    !config.AZURE_STORAGE_KEY ||
    !config.AZURE_BLOB_CONTAINER
  ) {
    throw new Error(
      "Azure Blob is not configured (AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_KEY, AZURE_BLOB_CONTAINER)",
    );
  }
  const credential = new StorageSharedKeyCredential(
    config.AZURE_STORAGE_ACCOUNT,
    config.AZURE_STORAGE_KEY,
  );
  // AZURE_BLOB_ENDPOINT covers sovereign clouds, custom domains and the local
  // storage emulator, whose URL puts the account in the path.
  const endpoint =
    config.AZURE_BLOB_ENDPOINT ??
    `https://${config.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`;
  return new BlobServiceClient(endpoint, credential);
}
