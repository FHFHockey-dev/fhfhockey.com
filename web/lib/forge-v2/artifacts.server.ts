import { mkdir, readFile, link, unlink, open, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ArtifactReference, assertArtifact } from "./contracts";
import { canonicalJson } from "./identity";
import { sha256 } from "./hash.server";

export interface IntegrityIncident { artifactId: string; expectedHash: string; reason: string }
export type ArtifactRead = { state: "available"; location: "online" | "archived"; bytes: string; reference: ArtifactReference }
  | { state: "unavailable"; reason: string; incident: IntegrityIncident };
const MAX_ARTIFACT_BYTES = 16 * 1024 * 1024;

/** An explicit private local store, with permanent manifests and no expiration operation. */
export class FileArtifactStore {
  constructor(private readonly root: string, private readonly archiveRoot: string) {}
  private manifestPath(id: string) { return join(this.root, "manifests", `${sha256(id)}.json`); }
  private contentPath(hash: string, archived = false) { return join(archived ? this.archiveRoot : this.root, "content", `${hash}.json`); }

  private async bytes(path: string): Promise<string> {
    const info = await stat(path);
    if (!info.isFile() || info.size > MAX_ARTIFACT_BYTES) throw new Error("artifact_size_limit");
    return readFile(path, "utf8");
  }
  private async immutableWrite(path: string, bytes: string): Promise<void> {
    await mkdir(join(path, ".."), { recursive: true, mode: 0o700 });
    const temporary = `${path}.${randomUUID()}.pending`;
    const file = await open(temporary, "wx", 0o600);
    try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
    try {
      try { await link(temporary, path); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (await this.bytes(path) !== bytes) throw new Error("immutable_artifact_conflict");
      }
    } finally { await unlink(temporary); }
  }

  async put(reference: ArtifactReference, payload: object): Promise<void> {
    assertArtifact(reference);
    const bytes = canonicalJson(payload);
    if (Buffer.byteLength(bytes) > MAX_ARTIFACT_BYTES) throw new Error("artifact_size_limit");
    if (sha256(bytes) !== reference.sha256) throw new Error("artifact_hash_mismatch");
    // Manifest identity is claimed first; conflicting retries cannot replace content.
    await this.immutableWrite(this.manifestPath(reference.id), canonicalJson(reference));
    await this.immutableWrite(this.contentPath(reference.sha256), bytes);
  }

  async read(reference: ArtifactReference): Promise<ArtifactRead> {
    try {
      assertArtifact(reference);
      if (await this.bytes(this.manifestPath(reference.id)) !== canonicalJson(reference)) throw new Error("artifact_manifest_mismatch");
      let bytes: string, location: "online" | "archived" = "online";
      try { bytes = await this.bytes(this.contentPath(reference.sha256)); }
      catch (error) {
        // An inaccessible or altered online object is not silently replaced by a good archive.
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        bytes = await this.bytes(this.contentPath(reference.sha256, true)); location = "archived";
      }
      if (sha256(bytes) !== reference.sha256) throw new Error("artifact_hash_mismatch");
      JSON.parse(bytes);
      return { state: "available", bytes, location, reference };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const reason = code === "ENOENT" ? "artifact_missing" : code === "EACCES" || code === "EPERM" ? "artifact_inaccessible" : error instanceof SyntaxError ? "artifact_undecodable" : error instanceof Error ? error.message : "artifact_unavailable";
      // Readers return an incident; public reads never write an incident behind the caller's back.
      return { state: "unavailable", reason, incident: { artifactId: reference.id, expectedHash: reference.sha256, reason } };
    }
  }

  async archive(reference: ArtifactReference): Promise<void> {
    const result = await this.read(reference);
    if (result.state !== "available") throw new Error(result.reason);
    if (result.location === "archived") return;
    await this.immutableWrite(this.contentPath(reference.sha256, true), result.bytes);
    if (sha256(await this.bytes(this.contentPath(reference.sha256, true))) !== reference.sha256) throw new Error("archive_verification_failed");
    await unlink(this.contentPath(reference.sha256));
  }
  async restore(reference: ArtifactReference): Promise<void> {
    const result = await this.read(reference);
    if (result.state !== "available") throw new Error(result.reason);
    if (result.location === "archived") await this.immutableWrite(this.contentPath(reference.sha256), result.bytes);
  }
}
