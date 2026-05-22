import type { PdfAsset, PrismaClient } from '@prisma/client';

export interface UpsertPdfAssetInput {
  sha256: string;
  storagePath: string;
  sizeBytes: number;
  contentType?: string;
  bnmpId: bigint;
  tipo?: number;
}

export class PdfAssetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findBySha(tenantId: string, sha256: string): Promise<PdfAsset | null> {
    return this.prisma.pdfAsset.findUnique({
      where: { tenant_sha_unique: { tenantId, sha256 } },
    });
  }

  findById(tenantId: string, id: string): Promise<PdfAsset | null> {
    return this.prisma.pdfAsset.findFirst({ where: { id, tenantId } });
  }

  upsert(tenantId: string, input: UpsertPdfAssetInput): Promise<PdfAsset> {
    return this.prisma.pdfAsset.upsert({
      where: { tenant_sha_unique: { tenantId, sha256: input.sha256 } },
      create: {
        tenantId,
        sha256: input.sha256,
        storagePath: input.storagePath,
        sizeBytes: input.sizeBytes,
        contentType: input.contentType ?? 'application/pdf',
        bnmpId: input.bnmpId,
        tipo: input.tipo ?? 1,
      },
      update: {
        storagePath: input.storagePath,
        sizeBytes: input.sizeBytes,
        contentType: input.contentType ?? 'application/pdf',
      },
    });
  }
}
